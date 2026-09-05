"""In-app notification feed (the bell) + read state."""
from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException

from app.db import collection
from app.events import audit

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    if doc.get("ts"):
        doc["ts"] = doc["ts"].isoformat()
    if doc.get("read_at"):
        doc["read_at"] = doc["read_at"].isoformat()
    return doc


@router.get("")
async def list_notifications(unread_only: bool = False, limit: int = 100) -> list[dict]:
    query = {"read": False} if unread_only else {}
    docs = (await collection("notifications").find(query)
            .sort("ts", -1).limit(min(limit, 500)).to_list(min(limit, 500)))
    return [_out(d) for d in docs]


@router.get("/unread-count")
async def unread_count() -> dict:
    count = await collection("notifications").count_documents({"read": False})
    return {"count": count}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str) -> dict:
    result = await collection("notifications").update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "notification not found")
    return {"updated": True}


@router.post("/read-all")
async def mark_all_read() -> dict:
    result = await collection("notifications").update_many(
        {"read": False}, {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
    )
    return {"updated": result.modified_count}


@router.post("/sample")
async def send_sample() -> dict:
    """Push a demo notification so the bell/delivery pipeline can be tested."""
    from app.events import notify

    await notify(
        "🔔 This is a test notification",
        "Notifications, audit logs and webhook delivery are wired up. ",
        kind="info",
        channels=("in_app", "email", "whatsapp"),
    )
    await audit("notification.sample", meta={"kind": "demo"})
    return {"sent": True}
