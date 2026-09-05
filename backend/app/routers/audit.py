"""Audit trail endpoints — every meaningful action is logged (append-only)."""
from __future__ import annotations

from fastapi import APIRouter

from app.db import collection

router = APIRouter(prefix="/audit", tags=["audit"])


def _out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    if doc.get("ts"):
        doc["ts"] = doc["ts"].isoformat()
    return doc


@router.get("")
async def list_audit(
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    actor: str | None = None,
    limit: int = 200,
    skip: int = 0,
) -> list[dict]:
    query: dict = {}
    if action:
        query["action"] = action
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if actor:
        query["actor"] = actor
    docs = (await collection("audit_logs").find(query)
            .sort("ts", -1).skip(skip).limit(min(limit, 500)).to_list(min(limit, 500)))
    return [_out(d) for d in docs]


@router.get("/stats")
async def audit_stats(limit: int = 500) -> dict:
    """Group recent entries by action so operators see what changed today."""
    pipeline = [
        {"$sort": {"ts": -1}},
        {"$limit": min(limit, 2000)},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    rows = await collection("audit_logs").aggregate(pipeline).to_list(100)
    return {"by_action": {r["_id"]: r["count"] for r in rows}}
