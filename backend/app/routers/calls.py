"""Single-call endpoints + browser WebSocket voice transport.

WS protocol (JSON + binary):
  client → server:
    {"type": "start", agent?: {...}, campaign_id?, phone?, language?,
     provider?: "mock"|"asterisk", tools_enabled?: [..]}   — start a call
    {"type": "stop"}                                       — hang up
    binary frames: PCM16 mono audio (8kHz or 16kHz)
  server → client:
    {"type": "status", call_id, status}
    {"type": "transcript", role, text, language}
    {"type": "ended", end_reason}
    binary frames: PCM16 mono 8kHz agent audio
"""
from __future__ import annotations

import asyncio
import json
import logging

import numpy as np
from bson import ObjectId
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app import audio as audiomod
from app.db import collection
from app.schemas import AgentPersona, CallStartIn
from app.services import calls as calls_svc

log = logging.getLogger(__name__)
router = APIRouter(prefix="/calls", tags=["calls"])


def _out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    for key in ("created_at", "started_at", "ended_at"):
        if isinstance(doc.get(key), object) and doc.get(key) is not None:
            if hasattr(doc[key], "isoformat"):
                doc[key] = doc[key].isoformat()
    return doc


@router.get("")
async def list_calls(campaign_id: str | None = None, limit: int = 100) -> list[dict]:
    query = {"campaign_id": campaign_id} if campaign_id else {}
    docs = (await collection("call_sessions").find(query)
            .sort("created_at", -1).limit(min(limit, 500)).to_list(min(limit, 500)))
    return [_out(d) for d in docs]


@router.get("/{call_id}")
async def get_call(call_id: str) -> dict:
    doc = await collection("call_sessions").find_one({"_id": ObjectId(call_id)})
    if not doc:
        raise HTTPException(404, "call not found")
    return _out(doc)


@router.post("/start", status_code=201)
async def start_call(body: CallStartIn) -> dict:
    """Place a single outbound call (mock dry-run or real via Asterisk)."""
    persona = body.agent or AgentPersona(name="Adhoc Agent")
    if not body.agent and body.campaign_id:
        campaign = await collection("campaigns").find_one({"_id": ObjectId(body.campaign_id)})
        if campaign and campaign.get("agent"):
            persona = AgentPersona(**campaign["agent"])

    call_id, pipeline, provider = await calls_svc.start_adhoc_call(
        persona=persona,
        phone=body.phone,
        lead_id=body.lead_id,
        campaign_id=body.campaign_id,
        provider_name=body.provider or ("mock" if not body.phone else None),
        language=body.language,
        lead_context=body.lead_context,
    )
    try:
        await provider.place_call(body.phone or "", pipeline)
        await calls_svc.mark_call_status(call_id, "in_progress")
        await pipeline.run_until_idle()
        # Dry-run/mock calls end immediately; real calls end via hangup events.
        if provider.name == "mock":
            await calls_svc.persist_call_result(call_id, pipeline, "connected")
        return {"call_id": call_id, "provider": provider.name}
    except Exception as exc:  # noqa: BLE001
        await calls_svc.persist_call_result(call_id, pipeline, "failed", str(exc))
        raise HTTPException(502, f"call failed: {exc}") from exc


class BrowserCallSession:
    """Glues a WebSocket connection to a VoicePipeline."""

    def __init__(self, ws: WebSocket) -> None:
        self.ws = ws
        self.pipeline = None
        self.call_id: str | None = None

    async def send_status(self, status: str, **extra) -> None:
        await self.ws.send_json({"type": "status", "status": status, **extra})

    async def run(self) -> None:
        started = False
        while True:
            msg = await self.ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if "bytes" in msg and msg["bytes"]:
                if started and self.pipeline:
                    pcm = np.frombuffer(msg["bytes"], dtype=np.int16)
                    self.pipeline.feed_audio(pcm, sample_rate=8000)
                continue
            # Accept text or blob frames (Vite proxy may deliver text as Blob).
            raw_text: str | None = msg.get("text") or None
            if raw_text is None and "bytes" not in msg:
                # Try reading blob/data as text
                try:
                    if isinstance(msg.get("text"), bytes):
                        raw_text = msg["text"].decode("utf-8", errors="replace")
                    elif hasattr(msg, "get") and msg.get("type") == "websocket.receive":
                        # FastAPI WSReceiveModel: text may be in msg["text"] or bytes
                        pass
                except Exception:
                    pass
            if not raw_text:
                continue
            data = json.loads(raw_text)

            if data.get("type") == "start" and not started:
                started = True
                await self._start_call(data)
            elif data.get("type") == "stop" and self.pipeline:
                await self._end_call("client_hangup")
                break

        if self.pipeline:
            await self._end_call("client_disconnected")

    async def _start_call(self, data: dict) -> None:
        log.info("BrowserCallSession._start_call: received start, keys=%s", list(data.keys()))
        persona = AgentPersona(**(data.get("agent") or {}))
        persona.tools_enabled = data.get("tools_enabled", persona.tools_enabled)
        provider_name = data.get("provider") or "mock"

        call_id, pipeline, _provider = await calls_svc.start_adhoc_call(
            persona=persona,
            phone=data.get("phone"),
            lead_id=data.get("lead_id"),
            campaign_id=data.get("campaign_id"),
            provider_name=provider_name,
            language=data.get("language"),
            lead_context=data.get("lead_context"),
        )
        self.call_id = call_id
        self.pipeline = pipeline

        async def sink_send(pcm8k: np.ndarray) -> None:
            await self.ws.send_bytes(pcm8k.astype(np.int16).tobytes())

        async def sink_interrupt() -> None:
            await self.ws.send_json({"type": "interrupted"})

        class WSSink:
            """Sync AudioSink that schedules async WS sends from the pipeline."""

            def send_audio(self, pcm: np.ndarray) -> None:
                import asyncio
                asyncio.get_event_loop().create_task(sink_send(pcm))

            def on_interrupt(self) -> None:
                import asyncio
                asyncio.get_event_loop().create_task(sink_interrupt())

        pipeline.sink = WSSink()
        pipeline.start()

        await self.send_status("in_progress", call_id=call_id)
        await calls_svc.mark_call_status(call_id, "in_progress")

        # Greet once the client starts streaming; greet() runs the LLM.
        await pipeline.greet()

        # Background task: push transcript turns to the browser as they come.
        self._seen = 0
        self._pump_task = asyncio.get_event_loop().create_task(self._pump_transcript())

    async def _pump_transcript(self) -> None:
        """Push new transcript turns to the browser (runs alongside receive loop)."""
        while self.pipeline and not self.pipeline.ended:
            turns = self.pipeline.transcript
            while self._seen < len(turns):
                t = turns[self._seen]
                self._seen += 1
                await self.ws.send_json({
                    "type": "transcript", "role": t["role"],
                    "text": t["text"], "language": t["language"],
                })
            await asyncio.sleep(0.25)

    async def _end_call(self, reason: str) -> None:
        if not self.pipeline:
            return
        pipeline, self.pipeline = self.pipeline, None
        if getattr(self, "_pump_task", None):
            self._pump_task.cancel()
        pipeline.ended = True
        await calls_svc.persist_call_result(self.call_id, pipeline, "connected")
        try:
            await self.ws.send_json({
                "type": "ended", "end_reason": reason,
                "summary": pipeline.summary_snapshot(),
            })
        except Exception:  # noqa: BLE001 — socket may already be gone
            pass


@router.websocket("/wstest")
async def ws_echo(ws: WebSocket) -> None:
    """Echo socket for connectivity checks (proxy/firewall debugging)."""
    await ws.accept()
    await ws.send_json({"type": "hello"})
    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                return
            if msg.get("text") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        return


@router.websocket("/ws")
async def call_ws(ws: WebSocket) -> None:
    await ws.accept()
    session = BrowserCallSession(ws)
    try:
        await session.run()
    except WebSocketDisconnect:
        if session.pipeline:
            await session._end_call("client_disconnected")
    except Exception:  # noqa: BLE001
        log.exception("ws call crashed")
        if session.pipeline:
            await session._end_call("error")
