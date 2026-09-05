"""Lead endpoints: CRUD, bulk JSON import, CSV upload.

CSV columns (header row required): phone[,name,language,extra-anything...]
Any extra columns land in the lead's `extra` dict.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.db import collection
from app.phone_utils import clean_phone, is_dnd, is_valid_indian_mobile
from app.schemas import LeadBulkIn, LeadIn

router = APIRouter(prefix="/leads", tags=["leads"])


def _out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/bulk", status_code=201)
async def bulk_add(campaign_id: str, body: LeadBulkIn) -> dict:
    """Bulk upsert leads for a campaign. Validates + DND-scrubs each number."""
    from app.events import audit, emit, notify

    # Default CRM stage = first stage of the campaign's pipeline (usually 'new').
    campaign = await collection("campaigns").find_one(
        {"_id": ObjectId(campaign_id)}, {"name": 1, "crm_stages": 1}
    )
    if not campaign:
        raise HTTPException(404, "campaign not found")
    stages = campaign.get("crm_stages") or []
    default_stage = stages[0]["id"] if stages else "new"

    added, updated, invalid, dnd = 0, 0, [], 0
    ops = []
    for lead in body.leads:
        phone = clean_phone(lead.phone)
        if not is_valid_indian_mobile(phone):
            invalid.append(lead.phone)
            continue
        if is_dnd(phone):
            dnd += 1
            continue
        set_doc = {
            "phone": phone,
            "name": lead.name,
            "language": lead.language,
            "extra": lead.extra,
            "campaign_id": campaign_id,
        }
        ops.append({
            "_op": "upsert",
            "filter": {"campaign_id": campaign_id, "phone": phone},
            "set": set_doc,
        })

    for op in ops:
        if body.upsert:
            result = await collection("leads").update_one(
                op["filter"],
                {"$set": op["set"], "$setOnInsert": {
                    "status": "new", "call_count": 0, "stage": default_stage,
                    "created_at": datetime.now(timezone.utc),
                }},
                upsert=True,
            )
            if result.upserted_id:
                added += 1
            else:
                updated += 1
        else:
            try:
                doc = {**op["set"], "status": "new", "call_count": 0,
                       "stage": default_stage,
                       "created_at": datetime.now(timezone.utc)}
                await collection("leads").insert_one(doc)
                added += 1
            except Exception:
                updated += 1

    if added:
        await audit("leads.added", entity_type="campaign", entity_id=campaign_id,
                    meta={"name": campaign.get("name"), "added": added, "updated": updated})
        await notify(
            "👥 Leads added",
            f"{added} new lead(s) added to '{campaign.get('name')}'"
            + (f" · {updated} updated" if updated else ""),
            kind="campaign", data={"campaign_id": campaign_id, "added": added},
        )
        emit("leads.added", {"campaign_id": campaign_id, "added": added})

    return {"added": added, "updated": updated, "invalid": invalid, "dnd_skipped": dnd}


@router.post("/csv", status_code=201)
async def upload_csv(campaign_id: str, file: UploadFile = File(...)) -> dict:
    """Upload a leads CSV for a campaign."""
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or "phone" not in [f.strip().lower() for f in reader.fieldnames]:
        raise HTTPException(400, "CSV must have a 'phone' column")

    leads: list[LeadIn] = []
    for row in reader:
        clean_row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
        phone = clean_row.get("phone", "")
        extra = {k: v for k, v in clean_row.items()
                 if k not in ("phone", "name", "language") and v}
        leads.append(LeadIn(
            phone=phone,
            name=clean_row.get("name") or None,
            language=clean_row.get("language") or None,
            extra=extra,
        ))

    return await bulk_add(campaign_id, LeadBulkIn(leads=leads))


@router.get("")
async def list_leads(campaign_id: str, status: str | None = None,
                     limit: int = 200, skip: int = 0) -> list[dict]:
    query: dict = {"campaign_id": campaign_id}
    if status:
        query["status"] = status
    docs = (await collection("leads").find(query)
            .sort("created_at", 1).skip(skip).limit(min(limit, 1000)).to_list(min(limit, 1000)))
    return [_out(d) for d in docs]


@router.get("/{lead_id}")
async def get_lead(lead_id: str) -> dict:
    doc = await collection("leads").find_one({"_id": ObjectId(lead_id)})
    if not doc:
        raise HTTPException(404, "lead not found")
    return _out(doc)


@router.delete("/{lead_id}")
async def delete_lead(lead_id: str) -> dict:
    await collection("leads").delete_one({"_id": ObjectId(lead_id)})
    return {"deleted": True}


@router.get("/{lead_id}/calls")
async def lead_calls(lead_id: str) -> list[dict]:
    docs = (await collection("call_sessions").find({"lead_id": lead_id})
            .sort("created_at", -1).to_list(50))
    return [_out(d) for d in docs]


@router.get("/export/csv")
async def export_csv(campaign_id: str) -> StreamingResponse:
    """Export a campaign's leads + outcomes as CSV."""
    docs = await collection("leads").find({"campaign_id": campaign_id}).to_list(10000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["phone", "name", "language", "status", "last_outcome",
                     "call_count", "last_call_at"])
    for d in docs:
        writer.writerow([
            d.get("phone"), d.get("name") or "", d.get("language") or "",
            d.get("status"), d.get("last_outcome") or "",
            d.get("call_count", 0),
            (d.get("last_call_at") or "").isoformat() if d.get("last_call_at") else "",
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=leads-{campaign_id}.csv"},
    )
