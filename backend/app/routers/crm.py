"""Campaign-level CRM: a configurable lead pipeline (stages) per campaign.

Leads live in one stage at a time; the dashboard renders a drag-and-drop
kanban board. Terminal stages ('won'/'lost') mark the lead completed so the
dialer and progress stats behave consistently.

Pipeline stages are stored on the campaign document (`crm_stages`) so every
campaign can have its own funnel (New → Contacted → Qualified → Proposal →
Won / Lost, or anything the operator wants).
"""
from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Body, HTTPException

from app.db import collection
from app.events import audit, emit

router = APIRouter(prefix="/campaigns", tags=["crm"])

DEFAULT_STAGES = [
    {"id": "new", "name": "🆕 New", "color": "#94a3b8", "terminal": False},
    {"id": "contacted", "name": "📞 Contacted", "color": "#38bdf8", "terminal": False},
    {"id": "qualified", "name": "⭐ Qualified", "color": "#a78bfa", "terminal": False},
    {"id": "proposal", "name": "📄 Proposal", "color": "#f59e0b", "terminal": False},
    {"id": "won", "name": "🎉 Won", "color": "#10b981", "terminal": True},
    {"id": "lost", "name": "🚫 Lost", "color": "#ef4444", "terminal": True},
]

LEAD_SUMMARY = {
    "_id": 1, "name": 1, "phone": 1, "language": 1, "status": 1,
    "stage": 1, "last_outcome": 1, "call_count": 1, "created_at": 1,
    "last_call_at": 1,
}


async def _ensure_stages(campaign_id: str) -> list[dict]:
    """Return (and lazily seed) the campaign's pipeline stages."""
    doc = await collection("campaigns").find_one(
        {"_id": ObjectId(campaign_id)}, {"crm_stages": 1}
    )
    if not doc:
        raise HTTPException(404, "campaign not found")
    stages = doc.get("crm_stages")
    if not stages:
        stages = [dict(s) for s in DEFAULT_STAGES]
        await collection("campaigns").update_one(
            {"_id": ObjectId(campaign_id)}, {"$set": {"crm_stages": stages}}
        )
    return stages


def _lead_out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/{campaign_id}/crm/board")
async def crm_board(campaign_id: str) -> dict:
    """Full board: configured stages + leads grouped by stage."""
    stages = await _ensure_stages(campaign_id)
    leads = await collection("leads").find(
        {"campaign_id": campaign_id}, LEAD_SUMMARY
    ).sort("created_at", 1).to_list(2000)
    columns = {s["id"]: [] for s in stages}
    for lead in leads:
        stage_id = lead.get("stage") or stages[0]["id"]
        columns.setdefault(stage_id, []).append(_lead_out(lead))
    total = len(leads)
    return {
        "campaign_id": campaign_id,
        "stages": stages,
        "columns": columns,
        "totals": {
            "leads": total,
            "in_progress": sum(len(v) for k, v in columns.items()
                               if k not in ("won", "lost")),
            "won": len(columns.get("won", [])),
            "lost": len(columns.get("lost", [])),
        },
    }


@router.put("/{campaign_id}/crm/stages")
async def save_stages(campaign_id: str, stages: list[dict] = Body(...)) -> dict:
    """Replace the campaign's pipeline. Stage dicts: {id,name,color}."""
    campaign = await collection("campaigns").find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(404, "campaign not found")
    cleaned: list[dict] = []
    seen: set[str] = set()
    for i, s in enumerate(stages):
        sid = str(s.get("id") or f"stage_{i}").strip().lower().replace(" ", "_")
        if not sid or sid in seen:
            continue
        seen.add(sid)
        name = str(s.get("name") or sid).strip()[:40]
        terminal = bool(s.get("terminal")) or sid in ("won", "lost")
        cleaned.append({
            "id": sid,
            "name": name or sid,
            "color": str(s.get("color") or "#94a3b8")[:9],
            "terminal": terminal,
        })
    if not cleaned:
        raise HTTPException(422, "at least one stage is required")
    # Migrate leads stuck on removed stages back to the first column.
    valid = {s["id"] for s in cleaned}
    await collection("leads").update_many(
        {"campaign_id": campaign_id, "stage": {"$nin": list(valid)}},
        {"$set": {"stage": cleaned[0]["id"]}},
    )
    await collection("campaigns").update_one(
        {"_id": ObjectId(campaign_id)}, {"$set": {"crm_stages": cleaned}}
    )
    await audit("crm.stages_updated", entity_type="campaign", entity_id=campaign_id,
                meta={"stage_count": len(cleaned)})
    return {"stages": cleaned}


@router.post("/{campaign_id}/crm/move")
async def move_lead(campaign_id: str, body: dict = Body(...)) -> dict:
    """Move a lead to another stage (drag & drop on the board)."""
    lead_id = str(body.get("lead_id") or "")
    stage_id = str(body.get("stage") or "")
    if not lead_id or not stage_id:
        raise HTTPException(422, "lead_id and stage are required")
    stages = await _ensure_stages(campaign_id)
    stage = next((s for s in stages if s["id"] == stage_id), None)
    if not stage:
        raise HTTPException(404, f"stage '{stage_id}' does not exist on this campaign")
    lead = await collection("leads").find_one({"_id": ObjectId(lead_id)})
    if not lead:
        raise HTTPException(404, "lead not found")

    update: dict = {"stage": stage_id, "stage_updated_at": datetime.now(timezone.utc)}
    # Terminal funnel states move the lead out of the dialer queue entirely.
    if stage["terminal"]:
        update["status"] = "completed"
        update["last_outcome"] = stage_id
    elif lead.get("status") == "completed" and lead.get("stage") in ("won", "lost"):
        # Reopening a closed lead puts it back in the queue.
        update["status"] = "new"
        update["last_outcome"] = None
    await collection("leads").update_one({"_id": ObjectId(lead_id)}, {"$set": update})

    await audit("lead.moved", entity_type="lead", entity_id=lead_id,
                meta={"campaign_id": campaign_id, "from": lead.get("stage"),
                      "to": stage_id, "stage_name": stage["name"]})
    emit("lead.moved", {
        "lead_id": lead_id,
        "campaign_id": campaign_id,
        "from": lead.get("stage"),
        "to": stage_id,
        "phone": lead.get("phone"),
    })
    return {"moved": True, "stage": stage_id}
