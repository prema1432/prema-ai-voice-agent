"""Campaign dialer: pulls due leads and places calls with concurrency control.

Runs as an asyncio task per campaign. Compliance first: TRAI calling window,
DND scrubbing, max concurrency, per-lead retry limits.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from app.config import settings
from app.db import collection
from app.schemas import AgentPersona
from app.services import calls as calls_svc
from app.services.calls import oid
from app.telephony.provider import get_provider
from app.voice.pipeline import VoicePipeline

log = logging.getLogger(__name__)

MAX_ATTEMPTS = 3

# Rotates which team agent takes the next call (round-robin across campaigns).
_SPIN = __import__("itertools").count()


def _log_task_crash(task: "asyncio.Task") -> None:
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        log.error("campaign runner crashed: %r", exc, exc_info=exc)


class CampaignRunner:
    """Drives one campaign until paused/completed or cancelled."""

    def __init__(self, campaign_id: str) -> None:
        self.campaign_id = campaign_id
        self.task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    async def run(self) -> None:
        log.info("campaign %s: runner started", self.campaign_id)
        provider = get_provider(None)
        # Each campaign spins up to its own `concurrency` agents in parallel.
        initial = await collection("campaigns").find_one(
            {"_id": oid(self.campaign_id)}, {"concurrency": 1}
        )
        cap = int((initial or {}).get("concurrency") or settings.max_concurrent_calls)
        semaphore = asyncio.Semaphore(max(1, cap))

        while not self._stop.is_set():
            campaign = await collection("campaigns").find_one({"_id": oid(self.campaign_id)})
            if not campaign or campaign.get("status") not in ("running", "scheduled"):
                log.info("campaign %s: status=%s, runner exiting",
                         self.campaign_id, (campaign or {}).get("status"))
                break

            lead = await self._claim_next_lead(self.campaign_id)
            if lead is None:
                campaign_doc = await collection("campaigns").find_one(
                    {"_id": oid(self.campaign_id)}, {"name": 1}
                )
                await collection("campaigns").update_one(
                    {"_id": oid(self.campaign_id)}, {"$set": {"status": "completed"}}
                )
                log.info("campaign %s: no more leads, completing", self.campaign_id)
                # Domain event: mark completion + surface a notification.
                try:
                    from app.events import audit, emit, notify

                    await audit("campaign.completed", entity_type="campaign",
                                entity_id=self.campaign_id,
                                meta={"name": (campaign_doc or {}).get("name")})
                    await notify(
                        "🏁 Campaign finished",
                        f"'{campaign_doc.get('name') if campaign_doc else self.campaign_id}' "
                        "ran through all its leads.",
                        kind="campaign", data={"campaign_id": self.campaign_id},
                    )
                    emit("campaign.completed", {
                        "campaign_id": self.campaign_id,
                        "name": (campaign_doc or {}).get("name"),
                    })
                except Exception:  # noqa: BLE001
                    log.exception("campaign.completed event failed")
                break

            log.info("campaign %s: claimed lead %s (%s)",
                     self.campaign_id, lead.get("name"), lead.get("phone"))
            async with semaphore:
                await self._call_lead(lead, campaign, provider)

        log.info("campaign %s: runner stopped", self.campaign_id)

    def start(self) -> None:
        self.task = asyncio.get_event_loop().create_task(self.run())
        # Runner deaths must never be silent again.
        self.task.add_done_callback(_log_task_crash)

    def stop(self) -> None:
        self._stop.set()

    # ── Per-lead call ───────────────────────────────────────────────────────
    async def _call_lead(self, lead: dict, campaign: dict, provider: Any) -> None:
        from app.phone_utils import is_dnd, is_within_call_window

        phone = lead["phone"]

        # Compliance gates
        if settings.scrub_dnd_enabled and is_dnd(phone):
            await collection("leads").update_one(
                {"_id": lead["_id"]}, {"$set": {"status": "dnd", "last_outcome": "dnd"}}
            )
            return
        if not is_within_call_window(
            settings.call_window_start, settings.call_window_end, settings.call_timezone
        ):
            # Outside window: defer lead back to queue until tomorrow's window.
            await collection("leads").update_one(
                {"_id": lead["_id"]}, {"$set": {"status": "new"}}
            )
            log.info("campaign %s: outside calling window, pausing", self.campaign_id)
            await asyncio.sleep(60)
            return

        persona = await _persona_for(campaign, lead)
        call_id = await calls_svc.create_call_session(
            campaign_id=self.campaign_id,
            lead_id=str(lead["_id"]),
            phone=phone,
            agent_name=persona.name,
            provider=provider.name,
            language=lead.get("language") or persona.primary_language,
        )
        await collection("leads").update_one(
            {"_id": lead["_id"]},
            {"$set": {"status": "dialing", "last_call_at": datetime.now(timezone.utc)}},
        )

        engines = calls_svc.get_engines()
        pipeline = VoicePipeline(
            persona=persona,
            sink=_NoopSink(),
            vad=engines["vad"],
            stt=engines["stt"],
            tts=engines["tts"],
            lead=lead,
        )
        pipeline.lead_id = str(lead["_id"])

        outcome = "connected"
        error: str | None = None
        try:
            result = await provider.place_call(phone, pipeline)
            await calls_svc.mark_call_status(call_id, "in_progress")
            await pipeline.run_until_idle()
            # Wait for the call to end naturally or time out
            deadline = pipeline.max_call_seconds
            for _ in range(deadline * 10):
                if pipeline.ended:
                    break
                await asyncio.sleep(0.1)
        except Exception as exc:  # noqa: BLE001 — one bad call must not kill the campaign
            log.exception("call failed for lead %s", lead["_id"])
            outcome = "failed"
            error = str(exc)
        finally:
            await calls_svc.persist_call_result(call_id, pipeline, outcome, error)
            if outcome == "failed" and not getattr(pipeline, "ended", False):
                # schedule retry if attempts remain
                attempts = lead.get("call_count", 1)
                next_status = "new" if attempts < MAX_ATTEMPTS else "failed"
                await collection("leads").update_one(
                    {"_id": lead["_id"]}, {"$set": {"status": next_status}}
                )

    async def _claim_next_lead(self, campaign_id: str) -> dict | None:
        """Atomically claim one 'new' lead for dialing."""
        return await collection("leads").find_one_and_update(
            {"campaign_id": campaign_id, "status": "new"},
            {"$set": {"status": "dialing"}},
            sort=[("created_at", 1)],
        )


class _NoopSink:
    def send_audio(self, pcm) -> None:  # noqa: ANN001
        pass

    def on_interrupt(self) -> None:
        pass


async def _persona_for(campaign: dict, lead: dict) -> AgentPersona:
    """Pick the persona for one call.

    When the campaign lists a team (`team_agent_ids`), calls rotate through
    those directory agents — that is what 'spin N dynamic agents' means: up to
    `concurrency` of them run at once and each call gets a team member. Falls
    back to the inline campaign agent otherwise.
    """
    team_ids = campaign.get("team_agent_ids") or []
    if team_ids:
        try:
            docs = await collection("agent_configs").find(
                {"_id": {"$in": [oid(i) for i in team_ids]}}
            ).to_list(50)
            team = [d for d in docs if d.get("name")]
            if team:
                doc = team[next(_SPIN) % len(team)]
                cfg = {k: v for k, v in doc.items()
                       if k not in ("_id", "created_at", "updated_at")}
                persona = AgentPersona(**cfg)
                if lead.get("language"):
                    persona.primary_language = lead["language"]
                return persona
        except Exception:  # noqa: BLE001 — team pick failure falls back to inline
            log.exception("team persona lookup failed; using inline agent")

    agent = campaign.get("agent") or {}
    persona = AgentPersona(
        name=agent.get("name", "Agent"),
        description=agent.get("description", ""),
        requirements=agent.get("requirements", ""),
        system_prompt=agent.get("system_prompt"),
        primary_language=lead.get("language") or agent.get("primary_language", "hi"),
        fallback_languages=agent.get("fallback_languages", ["hinglish", "en"]),
        auto_language_switch=agent.get("auto_language_switch", True),
        tools_enabled=agent.get("tools_enabled", []),
        max_call_seconds=agent.get("max_call_seconds", 600),
    )
    return persona


# ── In-process registry of running campaigns ─────────────────────────────────
RUNNERS: dict[str, CampaignRunner] = {}


def start_campaign(campaign_id: str) -> None:
    runner = RUNNERS.get(campaign_id)
    if runner and runner.task and not runner.task.done():
        return
    # A finished runner (e.g. campaign completed) must not block a restart
    # after new leads are added — replace it.
    RUNNERS.pop(campaign_id, None)
    runner = CampaignRunner(campaign_id)
    RUNNERS[campaign_id] = runner
    runner.start()


def stop_campaign(campaign_id: str) -> None:
    runner = RUNNERS.pop(campaign_id, None)
    if runner:
        runner.stop()


def is_running(campaign_id: str) -> bool:
    runner = RUNNERS.get(campaign_id)
    return bool(runner and runner.task and not runner.task.done())
