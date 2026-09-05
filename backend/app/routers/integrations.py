"""Dynamic integrations: connect external systems to platform events.

Each integration has a type from a fixed catalog (webhook, whatsapp, email,
sms, push, instagram, telegram, crm, custom). Outbound: enabled integrations
subscribed to an event receive an HTTP POST via the delivery worker. Inbound:
every integration exposes /integrations/in/{token} so external systems can
push data into Prema (logged as an inbound delivery + in-app notification).

Adding a new integration type = one entry in CATALOG (Open/Closed).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Body, HTTPException

from app.db import collection
from app.events import audit, emit, new_inbound_token

router = APIRouter(prefix="/integrations", tags=["integrations"])

# ── Catalog: id → display meta + example config fields (dynamically extended) ─
CATALOG: dict[str, dict[str, Any]] = {
    "webhook": {
        "label": "Generic Webhook",
        "icon": "🔗",
        "blurb": "POST every platform event to any HTTPS endpoint.",
        "fields": ["url", "secret", "events"],
    },
    "whatsapp": {
        "label": "WhatsApp Business",
        "icon": "💬",
        "blurb": "Send lead / call notifications via a WhatsApp gateway API.",
        "fields": ["url", "secret", "events"],
    },
    "instagram": {
        "label": "Instagram DM",
        "icon": "📸",
        "blurb": "Instagram messaging gateway (Meta Graph API URL).",
        "fields": ["url", "secret", "events"],
    },
    "email": {
        "label": "Email (SMTP/HTTP)",
        "icon": "✉️",
        "blurb": "Email delivery via any SMTP relay or HTTP email API.",
        "fields": ["url", "secret", "events"],
    },
    "sms": {
        "label": "SMS Gateway",
        "icon": "📱",
        "blurb": "Transactional SMS via an HTTP gateway.",
        "fields": ["url", "secret", "events"],
    },
    "push": {
        "label": "Push (web/mobile)",
        "icon": "🔔",
        "blurb": "Push notifications via a push gateway endpoint.",
        "fields": ["url", "secret", "events"],
    },
    "telegram": {
        "label": "Telegram Bot",
        "icon": "✈️",
        "blurb": "Telegram bot API delivery.",
        "fields": ["url", "secret", "events"],
    },
    "crm": {
        "label": "External CRM / ERP",
        "icon": "🗂",
        "blurb": "Mirror leads & call outcomes into your CRM.",
        "fields": ["url", "secret", "events"],
    },
    "custom": {
        "label": "Custom API",
        "icon": "🧩",
        "blurb": "Any other service with a JSON HTTP endpoint.",
        "fields": ["url", "secret", "events"],
    },
}


def _out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/catalog")
async def catalog() -> dict:
    return {
        "types": CATALOG,
        "events": [
            "campaign.started", "campaign.paused", "campaign.completed",
            "leads.added", "lead.moved", "call.ended", "agent.created",
            "*",
        ],
    }


@router.get("")
async def list_integrations() -> list[dict]:
    docs = (await collection("integrations").find()
            .sort("created_at", -1).to_list(100))
    out = []
    for d in docs:
        out.append(_out(d))
    return out


@router.get("/{integration_id}")
async def get_integration(integration_id: str) -> dict:
    doc = await collection("integrations").find_one({"_id": ObjectId(integration_id)})
    if not doc:
        raise HTTPException(404, "integration not found")
    return _out(doc)


@router.post("", status_code=201)
async def create_integration(body: dict = Body(...)) -> dict:
    itype = (body.get("type") or "").strip().lower()
    if itype not in CATALOG:
        raise HTTPException(422, f"unknown type '{itype}'. Known: {', '.join(CATALOG)}")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(422, "name is required")
    doc = {
        "name": name,
        "type": itype,
        "description": (body.get("description") or "").strip(),
        "enabled": bool(body.get("enabled", True)),
        "config": {
            "url": (body.get("config") or {}).get("url") or "",
            "secret": (body.get("config") or {}).get("secret") or "",
        },
        "events": list(body.get("events") or ["*"]),
        "token": new_inbound_token(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await collection("integrations").insert_one(doc)
    integration_id = str(result.inserted_id)
    await audit("integration.created", entity_type="integration", entity_id=integration_id,
                meta={"name": name, "type": itype})
    emit("integration.changed", {"integration_id": integration_id, "type": itype, "name": name})
    return {"id": integration_id, "token": doc["token"]}


@router.put("/{integration_id}")
async def update_integration(integration_id: str, body: dict = Body(...)) -> dict:
    doc = await collection("integrations").find_one({"_id": ObjectId(integration_id)})
    if not doc:
        raise HTTPException(404, "integration not found")
    update: dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    if "name" in body and str(body.get("name") or "").strip():
        update["name"] = str(body["name"]).strip()
    if "enabled" in body:
        update["enabled"] = bool(body["enabled"])
    if "description" in body:
        update["description"] = str(body.get("description") or "")
    if "config" in body:
        cfg = {**doc.get("config", {}), **(body["config"] or {})}
        update["config"] = {k: (cfg.get(k) or "") for k in ("url", "secret")}
    if "events" in body:
        update["events"] = list(body["events"] or ["*"])
    await collection("integrations").update_one(
        {"_id": ObjectId(integration_id)}, {"$set": update}
    )
    await audit("integration.updated", entity_type="integration", entity_id=integration_id,
                meta={"name": update.get("name") or doc.get("name")})
    return {"updated": True}


@router.delete("/{integration_id}")
async def delete_integration(integration_id: str) -> dict:
    doc = await collection("integrations").find_one_and_delete(
        {"_id": ObjectId(integration_id)}
    )
    if not doc:
        raise HTTPException(404, "integration not found")
    await audit("integration.deleted", entity_type="integration", entity_id=integration_id,
                meta={"name": doc.get("name"), "type": doc.get("type")})
    return {"deleted": True}


@router.post("/{integration_id}/test")
async def test_integration(integration_id: str) -> dict:
    """Send a ping through the delivery worker to prove connectivity."""
    doc = await collection("integrations").find_one({"_id": ObjectId(integration_id)})
    if not doc:
        raise HTTPException(404, "integration not found")
    emit("integration.changed", {
        "integration_id": integration_id,
        "name": doc.get("name"),
        "type": doc.get("type"),
        "test": True,
        "message": f"Test ping from {doc.get('name')}",
    })
    await audit("integration.test", entity_type="integration", entity_id=integration_id,
                meta={"name": doc.get("name")})
    return {"queued": True, "hint": "Watch the recent deliveries panel for the result."}


@router.get("/deliveries/latest")
async def latest_deliveries(limit: int = 25) -> list[dict]:
    docs = (await collection("delivery_logs").find()
            .sort("ts", -1).limit(min(limit, 100)).to_list(min(limit, 100)))
    out = []
    for d in docs:
        d = dict(d)
        d["id"] = str(d.pop("_id"))
        d["ts"] = d.get("ts").isoformat() if d.get("ts") else None
        d["done_at"] = d.get("done_at").isoformat() if d.get("done_at") else None
        out.append(d)
    return out


@router.post("/in/{token}")
async def receive_inbound(token: str, body: dict = Body(default={})) -> dict:
    """Public receive endpoint for any integration (WhatsApp, webhook, ...)."""
    doc = await collection("integrations").find_one({"token": token})
    if not doc:
        raise HTTPException(404, "unknown token — create the integration first")
    payload = dict(body)
    await collection("delivery_logs").insert_one({
        "integration_id": str(doc["_id"]),
        "integration_name": doc.get("name"),
        "integration_type": doc.get("type"),
        "direction": "in",
        "event": "inbound",
        "payload": payload,
        "status": "received",
        "ts": datetime.now(timezone.utc),
    })
    # Surface the inbound message in the bell when it looks human-facing.
    text = payload.get("text") or payload.get("message") or payload.get("body")
    if text:
        from app.events import notify

        await notify(
            f"📥 {doc.get('name')}",
            str(text)[:300],
            kind="integration",
            data={"integration_id": str(doc["_id"]), "payload": payload},
        )
    return {"ok": True, "integration": doc.get("name")}
