"""Domain event bus: audit trail, in-app notifications, integration fan-out.

SOLID (Open/Closed): handlers subscribe to event *names* and are dispatched
from `emit()`; adding a new event type or a new observer never touches the
callers of `emit()`.

Every write is fire-and-forget and exception-isolated so a failing observer
(DB hiccup, dead webhook) can never break the request that triggered it.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.db import collection

log = logging.getLogger(__name__)

# Channel kinds the app knows how to *represent*. Delivery depends on an
# enabled integration of the same type (set in the Integrations UI).
CHANNELS = ("in_app", "email", "sms", "whatsapp", "push", "webhook")

# Event names emitted by the platform (used by webhook subscriptions + UI).
EVENTS = [
    "campaign.created",
    "campaign.scheduled",
    "campaign.unscheduled",
    "campaign.started",
    "campaign.paused",
    "campaign.completed",
    "campaign.deleted",
    "leads.added",
    "lead.moved",
    "agent.created",
    "agent.deleted",
    "integration.changed",
    "call.ended",
]

# Outbound webhook deliveries run through one FIFO queue + worker.
_delivery_queue: asyncio.Queue | None = None
_delivery_task: asyncio.Task | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _run(task: asyncio.Task) -> None:
    """done-callback: surface observer crashes in logs, never propagate."""
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        log.error("event observer failed: %r", exc, exc_info=exc)


async def audit(
    action: str,
    *,
    actor: str = "operator",
    entity_type: str | None = None,
    entity_id: str | None = None,
    meta: dict | None = None,
) -> None:
    """Record one entry in the audit trail (append-only)."""
    try:
        await collection("audit_logs").insert_one({
            "action": action,
            "actor": actor,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "meta": meta or {},
            "ts": _now(),
        })
    except Exception:  # noqa: BLE001
        log.exception("audit write failed for %s", action)


async def notify(
    title: str,
    body: str,
    *,
    kind: str = "info",
    data: dict | None = None,
    channels: tuple[str, ...] = ("in_app",),
) -> None:
    """Create an in-app notification with per-channel delivery status.

    in_app is always stored (shown in the bell). The other channels are only
    'delivered' when an enabled integration of that type is configured; the
    status map on the document records exactly what happened per channel.
    """
    try:
        statuses: dict[str, str] = {}
        for ch in set(channels) | {"in_app"}:
            if ch == "in_app":
                statuses[ch] = "sent"
            else:
                statuses[ch] = await _channel_status(ch)
        await collection("notifications").insert_one({
            "title": title,
            "body": body,
            "kind": kind,
            "channels": statuses,
            "data": data or {},
            "read": False,
            "read_at": None,
            "ts": _now(),
        })
    except Exception:  # noqa: BLE001
        log.exception("notify failed")


async def _channel_status(channel: str) -> str:
    """'pending' when an enabled integration exists, else a clear 'skipped'."""
    try:
        doc = await collection("integrations").find_one(
            {"type": channel, "enabled": True}, {"_id": 1}
        )
        return "pending" if doc is not None else "skipped:no provider"
    except Exception:  # noqa: BLE001
        return "error"


def emit(event: str, payload: dict | None = None) -> None:
    """Publish a domain event to subscribed observers (never blocks caller)."""
    task = asyncio.get_event_loop().create_task(_dispatch(event, payload or {}))
    task.add_done_callback(_run)


async def _dispatch(event: str, payload: dict) -> None:
    """Enqueue an outbound delivery for every enabled integration subscribed."""
    if event not in EVENTS:
        log.warning("unknown event emitted: %s", event)
    try:
        subs = await collection("integrations").find(
            {"enabled": True, "events": {"$in": [event, "*"]}}
        ).to_list(50)
    except Exception:  # noqa: BLE001
        log.exception("integrations query failed")
        return
    for sub in subs:
        await _enqueue(sub, event, payload)


async def _enqueue(sub: dict, event: str, payload: dict) -> None:
    url = (sub.get("config") or {}).get("url") or ""
    delivery = {
        "integration_id": str(sub["_id"]),
        "integration_name": sub.get("name"),
        "integration_type": sub.get("type"),
        "direction": "out",
        "event": event,
        "url": url,
        "status": "queued",
        "ts": _now(),
        "attempts": 0,
    }
    if not url:
        delivery["status"] = "skipped:no url"
        await _log_delivery(delivery)
        return
    try:
        await _delivery_queue.put((url, sub, event, payload, delivery))
    except Exception:  # noqa: BLE001
        delivery["status"] = "error:queue"
        await _log_delivery(delivery)


def start_delivery_worker() -> None:
    """Idempotent queue + consumer for outbound webhook POSTs (FIFO)."""
    global _delivery_queue, _delivery_task
    if _delivery_queue is None:
        _delivery_queue = asyncio.Queue(maxsize=2000)
    if _delivery_task is None or _delivery_task.done():
        _delivery_task = asyncio.get_event_loop().create_task(_delivery_worker())
        _delivery_task.add_done_callback(_run)


async def _delivery_worker() -> None:
    import httpx

    while True:
        url, sub, event, payload, delivery = await _delivery_queue.get()
        delivery["attempts"] += 1
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "prema-ai-voice-agent/0.1",
        }
        secret = (sub.get("config") or {}).get("secret")
        if secret:
            headers["X-Webhook-Secret"] = secret
        body = {
            "event": event,
            "payload": payload,
            "integration": sub.get("name"),
            "sent_at": _now().isoformat(),
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(url, json=body, headers=headers)
            delivery["status"] = "delivered" if resp.status_code < 400 else f"http:{resp.status_code}"
            delivery["response"] = resp.text[:500]
        except Exception as exc:  # noqa: BLE001
            delivery["status"] = f"error:{type(exc).__name__}"
            delivery["error"] = str(exc)[:500]
        delivery["done_at"] = _now()
        await _log_delivery(delivery)


async def _log_delivery(delivery: dict) -> None:
    try:
        await collection("delivery_logs").insert_one(delivery)
    except Exception:  # noqa: BLE001
        log.exception("delivery_logs write failed")


def new_inbound_token() -> str:
    """Random token for an integration's inbound receive URL."""
    return uuid.uuid4().hex
