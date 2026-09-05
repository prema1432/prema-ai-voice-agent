"""Campaign endpoints: CRUD + start/stop + live stats."""
from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException

from app.db import collection
from app.schemas import CampaignIn
from app.services import dialer

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("", status_code=201)
async def create_campaign(body: CampaignIn) -> dict:
    from app.events import audit, emit
    from app.routers.crm import DEFAULT_STAGES

    doc = body.model_dump()
    doc["status"] = "draft"
    doc["created_at"] = datetime.now(timezone.utc)
    doc["stats"] = {"total": 0, "completed": 0, "failed": 0, "interested": 0}
    # Default CRM pipeline so the board works out of the box.
    doc["crm_stages"] = [dict(s) for s in DEFAULT_STAGES]
    result = await collection("campaigns").insert_one(doc)
    cid = str(result.inserted_id)
    await audit("campaign.created", entity_type="campaign", entity_id=cid,
                meta={"name": doc.get("name")})
    emit("campaign.created", {"campaign_id": cid, "name": doc.get("name")})
    return {"id": cid}


@router.get("")
async def list_campaigns() -> list[dict]:
    docs = await collection("campaigns").find().sort("created_at", -1).to_list(200)
    out = []
    for d in docs:
        d = _out(d)
        # live stats from leads collection
        cid = d["id"]
        d["stats"] = await _campaign_stats(cid)
        out.append(d)
    return out


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str) -> dict:
    doc = await collection("campaigns").find_one({"_id": ObjectId(campaign_id)})
    if not doc:
        raise HTTPException(404, "campaign not found")
    doc = _out(doc)
    doc["stats"] = await _campaign_stats(campaign_id)
    return doc


@router.put("/{campaign_id}")
async def update_campaign(campaign_id: str, body: CampaignIn) -> dict:
    from app.events import audit

    result = await collection("campaigns").update_one(
        {"_id": ObjectId(campaign_id)}, {"$set": body.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "campaign not found")
    await audit("campaign.updated", entity_type="campaign", entity_id=campaign_id,
                meta={"name": body.name})
    return {"updated": True}


@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str) -> dict:
    from app.events import audit

    doc = await collection("campaigns").find_one({"_id": ObjectId(campaign_id)})
    dialer.stop_campaign(campaign_id)
    await collection("campaigns").delete_one({"_id": ObjectId(campaign_id)})
    await audit("campaign.deleted", entity_type="campaign", entity_id=campaign_id,
                meta={"name": (doc or {}).get("name")})
    return {"deleted": True}


@router.post("/{campaign_id}/start")
async def start_campaign(campaign_id: str) -> dict:
    from app.events import audit, emit, notify

    doc = await collection("campaigns").find_one({"_id": ObjectId(campaign_id)})
    if not doc:
        raise HTTPException(404, "campaign not found")
    await collection("campaigns").update_one(
        {"_id": ObjectId(campaign_id)}, {"$set": {"status": "running"}}
    )
    dialer.start_campaign(campaign_id)
    await audit("campaign.started", entity_type="campaign", entity_id=campaign_id,
                meta={"name": doc.get("name")})
    await notify("▶ Campaign started", f"'{doc.get('name')}' is now dialing leads.",
                 kind="campaign", data={"campaign_id": campaign_id})
    emit("campaign.started", {"campaign_id": campaign_id, "name": doc.get("name")})
    return {"status": "running"}


@router.post("/{campaign_id}/pause")
async def pause_campaign(campaign_id: str) -> dict:
    from app.events import audit, emit, notify

    doc = await collection("campaigns").find_one({"_id": ObjectId(campaign_id)})
    dialer.stop_campaign(campaign_id)
    await collection("campaigns").update_one(
        {"_id": ObjectId(campaign_id)}, {"$set": {"status": "paused"}}
    )
    await audit("campaign.paused", entity_type="campaign", entity_id=campaign_id,
                meta={"name": (doc or {}).get("name")})
    await notify("⏸ Campaign paused", f"'{doc.get('name')}' dialing is paused.",
                 kind="campaign", data={"campaign_id": campaign_id})
    emit("campaign.paused", {"campaign_id": campaign_id, "name": (doc or {}).get("name")})
    return {"status": "paused"}


@router.get("/{campaign_id}/stats")
async def campaign_stats(campaign_id: str) -> dict:
    return await _campaign_stats(campaign_id)


async def _campaign_stats(campaign_id: str) -> dict:
    pipeline = [
        {"$match": {"campaign_id": campaign_id}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
        }},
    ]
    by_status = {doc["_id"]: doc["count"] async for doc in
                 collection("leads").aggregate(pipeline)}

    outcomes = [
        {"$match": {"campaign_id": campaign_id, "last_outcome": {"$ne": None}}},
        {"$group": {"_id": "$last_outcome", "count": {"$sum": 1}}},
    ]
    by_outcome = {doc["_id"]: doc["count"] async for doc in
                  collection("leads").aggregate(outcomes)}

    # Recent call outcomes (from call_sessions, not just leads)
    call_outcomes = [
        {"$match": {"campaign_id": campaign_id, "status": {"$in": ["completed", "failed"]}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    by_call = {doc["_id"]: doc["count"] async for doc in
               collection("call_sessions").aggregate(call_outcomes)}

    total = sum(by_status.values())
    return {
        "total": total,
        "by_status": by_status,
        "by_outcome": by_outcome,
        "calls": by_call,
        "dialer_running": dialer.is_running(campaign_id),
    }
