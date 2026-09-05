"""Call orchestration: create session → run pipeline → persist + summarize.

This is the glue used by both the browser WebSocket route and the campaign
dialer so every call is stored identically in MongoDB.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.db import collection
from app.llm.prompts import build_postcall_summary_messages
from app.llm import openrouter as orr
from app.schemas import AgentPersona
from app.services.summarizer import summarize_call
from app.telephony.provider import get_provider
from app.voice.pipeline import NullSink, VoicePipeline
from app.voice.stt import make_stt
from app.voice.tts import make_tts
from app.voice.vad import make_vad

log = logging.getLogger(__name__)

# Shared, lazily-built heavy engines (loaded once per process).
_ENGINES: dict[str, Any] = {}


def get_engines() -> dict[str, Any]:
    if "stt" not in _ENGINES:
        _ENGINES["stt"] = make_stt()
        _ENGINES["tts"] = make_tts()
        _ENGINES["vad"] = make_vad()
    return _ENGINES


async def create_call_session(
    *,
    campaign_id: str | None,
    lead_id: str | None,
    phone: str | None,
    agent_name: str,
    provider: str,
    language: str | None = None,
) -> str:
    doc = {
        "campaign_id": campaign_id,
        "lead_id": lead_id,
        "phone": phone,
        "agent_name": agent_name,
        "provider": provider,
        "language": language,
        "status": "dialing",
        "outcome": None,
        "transcript": [],
        "tool_calls": [],
        "summary": None,
        "lead_score": None,
        "created_at": datetime.now(timezone.utc),
        "started_at": None,
        "ended_at": None,
        "duration_seconds": None,
        "error": None,
    }
    result = await collection("call_sessions").insert_one(doc)
    return str(result.inserted_id)


async def mark_call_status(call_id: str, status: str, **extra: Any) -> None:
    update: dict[str, Any] = {"status": status}
    if status == "in_progress":
        update["started_at"] = datetime.now(timezone.utc)
    if status in ("completed", "failed"):
        update["ended_at"] = datetime.now(timezone.utc)
    update.update(extra)
    await collection("call_sessions").update_one({"_id": oid(call_id)}, {"$set": update})


def oid(call_id: str):
    from bson import ObjectId

    return ObjectId(call_id)


async def persist_call_result(
    call_id: str,
    pipeline: VoicePipeline,
    outcome: str = "connected",
    error: str | None = None,
) -> None:
    """Write transcript/tools/summary back to the call_sessions document."""
    summary: str | None = None
    lead_score: int | None = None
    detected_outcome: str | None = None
    if pipeline.transcript:
        try:
            analysis = await summarize_call(
                build_postcall_summary_messages(pipeline.transcript, pipeline.persona.name)
            )
            summary = analysis.get("summary")
            lead_score = analysis.get("lead_score")
            detected_outcome = analysis.get("outcome")
        except orr.OpenRouterError as exc:
            log.warning("post-call summary failed: %s", exc)

    final_outcome = detected_outcome or outcome
    await mark_call_status(
        call_id,
        "failed" if (error or getattr(pipeline, "error", None)) else "completed",
        transcript=pipeline.transcript,
        tool_calls=pipeline.tool_calls_log,
        summary=summary,
        lead_score=lead_score,
        outcome=final_outcome,
        error=error or getattr(pipeline, "error", None),
        language=pipeline.language,
    )

    # Reflect outcome on the lead, if the call belongs to one.
    lead_doc = None
    if pipeline_end_lead_id := getattr(pipeline, "lead_id", None):
        lead_doc = await collection("leads").find_one_and_update(
            {"_id": oid(pipeline_end_lead_id)},
            {
                "$set": {
                    "status": "completed",
                    "last_outcome": final_outcome,
                    "last_call_at": datetime.now(timezone.utc),
                },
                "$inc": {"call_count": 1},
            },
            return_document=True,
        )

    # Domain events: audit + notifications + webhook fan-out (isolated).
    try:
        from app.events import audit, emit, notify

        meta = {
            "call_id": call_id,
            "campaign_id": getattr(pipeline, "campaign_id", None),
            "lead_id": getattr(pipeline, "lead_id", None),
            "outcome": final_outcome,
            "agent": pipeline.persona.name if getattr(pipeline, "persona", None) else None,
            "lead_score": lead_score,
            "duration_seconds": pipeline.summary_snapshot().get("duration_seconds"),
        }
        await audit("call.ended", entity_type="call", entity_id=call_id, meta=meta)
        emit("call.ended", meta)

        if final_outcome in ("interested", "callback_requested"):
            name = (lead_doc or {}).get("name") or (lead_doc or {}).get("phone") or "lead"
            await notify(
                f"{'🔥' if final_outcome == 'interested' else '📅'} {final_outcome.replace('_', ' ').title()} lead",
                f"{pipeline.persona.name} just finished a call — {name} is {final_outcome.replace('_', ' ')}.",
                kind="call",
                data=meta,
            )
        elif final_outcome == "dnd":
            name = (lead_doc or {}).get("name") or (lead_doc or {}).get("phone") or "lead"
            await notify("🚫 DND requested", f"{name} asked not to be called again.",
                         kind="call", data=meta)
    except Exception:  # noqa: BLE001 — events must never break call persistence
        log.exception("event emission failed after call end")


async def start_adhoc_call(
    persona: AgentPersona,
    phone: str | None,
    lead_id: str | None,
    campaign_id: str | None,
    provider_name: str | None,
    language: str | None = None,
    lead_context: dict | None = None,
) -> tuple[str, VoicePipeline, Any]:
    """Shared setup for single calls (used by the WS route + dialer).

    Returns (call_id, pipeline, provider). The caller drives the pipeline and
    must call persist_call_result() when done.
    """
    engines = get_engines()
    provider = get_provider(provider_name)
    call_id = await create_call_session(
        campaign_id=campaign_id,
        lead_id=lead_id,
        phone=phone,
        agent_name=persona.name,
        provider=provider.name,
        language=language or persona.primary_language,
    )

    if language:
        persona.primary_language = language

    # Load the lead so the agent knows who it's talking to (name, language,
    # operator notes/guidelines, extra fields) via the system prompt.
    lead_doc = None
    if lead_context:
        lead_doc = dict(lead_context)
    elif lead_id:
        lead_doc = await collection("leads").find_one({"_id": oid(lead_id)})
        if lead_doc:
            lead_doc.pop("_id", None)

    pipeline = VoicePipeline(
        persona=persona,
        sink=NullSink(),
        toolbox=_build_toolbox(call_id, lead_id),
        vad=engines["vad"],
        stt=engines["stt"],
        tts=engines["tts"],
        max_call_seconds=persona.max_call_seconds,
        lead=lead_doc,
    )
    pipeline.lead_id = lead_id
    return call_id, pipeline, provider


def _build_toolbox(call_id: str, lead_id: str | None):
    """Wire agent tools to DB writes."""
    from app.llm.tools import ToolBox
    from app.phone_utils import add_to_dnd

    box = ToolBox()

    async def book_appointment(args: dict) -> dict:
        doc = {
            "call_id": call_id,
            "lead_id": lead_id,
            "date": args.get("date"),
            "time": args.get("time"),
            "note": args.get("note"),
            "created_at": datetime.now(timezone.utc),
        }
        await collection("appointments").insert_one(doc)
        return {"ok": True, "appointment_id": str(doc.get("_id", ""))}

    async def update_lead_status(args: dict) -> dict:
        status = args.get("status", "unknown")
        if lead_id:
            await collection("leads").update_one(
                {"_id": oid(lead_id)},
                {"$set": {"status": "completed", "last_outcome": status,
                          "qualification_note": args.get("note")}},
            )
        return {"ok": True, "status": status}

    async def set_callback(args: dict) -> dict:
        doc = {
            "call_id": call_id,
            "lead_id": lead_id,
            "when": args.get("when"),
            "reason": args.get("reason"),
            "done": False,
            "created_at": datetime.now(timezone.utc),
        }
        await collection("callbacks").insert_one(doc)
        return {"ok": True}

    async def request_human_transfer(args: dict) -> dict:
        log.info("human transfer requested on call %s: %s", call_id, args.get("reason"))
        return {"ok": True, "queued": True}

    async def opt_out_dnd(args: dict) -> dict:
        if lead_id:
            lead = await collection("leads").find_one({"_id": oid(lead_id)})
            if lead and lead.get("phone"):
                add_to_dnd(lead["phone"])
            await collection("leads").update_one(
                {"_id": oid(lead_id)}, {"$set": {"status": "dnd", "last_outcome": "dnd"}}
            )
        return {"ok": True}

    box.register("book_appointment", book_appointment)
    box.register("update_lead_status", update_lead_status)
    box.register("set_callback", set_callback)
    box.register("request_human_transfer", request_human_transfer)
    box.register("opt_out_dnd", opt_out_dnd)
    return box
