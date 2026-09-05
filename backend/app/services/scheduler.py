"""Campaign scheduler — auto-starts 'scheduled' campaigns on time.

Runs one background loop in the app lifespan. Polling a small collection on a
tick is fine at this scale (dozens of campaigns); it keeps the scheduler
trivial to reason about and safe across restarts (a missed window is picked up
immediately on boot because the loop compares against `schedule_start`).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.db import collection
from app.services import dialer

log = logging.getLogger(__name__)

TICK_SECONDS = 15
_task: asyncio.Task | None = None


async def _tick() -> None:
    """Start due campaigns; auto-pause campaigns past their schedule_end."""
    now = datetime.now(timezone.utc)

    # 1) Campaigns whose start time has arrived.
    due = await collection("campaigns").find(
        {"status": "scheduled", "schedule_start": {"$lte": now}},
        {"name": 1, "concurrency": 1, "expected_leads": 1},
    ).to_list(50)

    for doc in due:
        cid = str(doc["_id"])
        if dialer.is_running(cid):
            continue
        log.info("scheduler: starting scheduled campaign %s", cid)
        from app.events import audit, emit, notify

        await collection("campaigns").update_one(
            {"_id": doc["_id"]}, {"$set": {"status": "running"}}
        )
        dialer.start_campaign(cid)
        await audit("campaign.started", entity_type="campaign", entity_id=cid,
                    meta={"name": doc.get("name"), "source": "scheduler"})
        await notify(
            "▶ Scheduled campaign started",
            f"'{doc.get('name')}' auto-started — spinning agents now.",
            kind="campaign", data={"campaign_id": cid},
        )
        emit("campaign.started", {"campaign_id": cid, "name": doc.get("name")})

    # 2) Running campaigns whose optional end time has passed → auto-pause.
    past_end = await collection("campaigns").find(
        {"status": "running", "schedule_end": {"$lte": now}},
        {"name": 1},
    ).to_list(50)
    for doc in past_end:
        cid = str(doc["_id"])
        log.info("scheduler: schedule_end reached for %s", cid)
        from app.events import audit, notify

        dialer.stop_campaign(cid)
        await collection("campaigns").update_one(
            {"_id": doc["_id"]}, {"$set": {"status": "paused"}}
        )
        await audit("campaign.paused", entity_type="campaign", entity_id=cid,
                    meta={"name": doc.get("name"), "source": "schedule_end"})
        await notify("⏹ Scheduled window ended", f"'{doc.get('name')}' paused automatically.",
                     kind="campaign", data={"campaign_id": cid})


async def _loop() -> None:
    while True:
        try:
            await _tick()
        except asyncio.CancelledError:
            return
        except Exception:  # noqa: BLE001 — scheduler must never die silently
            log.exception("scheduler tick failed")
        await asyncio.sleep(TICK_SECONDS)


def start_scheduler() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.get_event_loop().create_task(_loop())
        log.info("scheduler started (tick %ss)", TICK_SECONDS)


def stop_scheduler() -> None:
    global _task
    if _task:
        _task.cancel()
        _task = None
