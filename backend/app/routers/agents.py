"""Agent persona/config CRUD — reusable agent definitions stored in Mongo."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.db import collection
from app.schemas import AgentPersona

router = APIRouter(prefix="/agents", tags=["agents"])


def _out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("")
async def create_agent(persona: AgentPersona) -> dict:
    doc = persona.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    result = await collection("agent_configs").insert_one(doc)
    return {"id": str(result.inserted_id)}


@router.get("")
async def list_agents() -> list[dict]:
    docs = await collection("agent_configs").find().sort("created_at", -1).to_list(200)
    return [_out(d) for d in docs]


@router.get("/{agent_id}")
async def get_agent(agent_id: str) -> dict:
    from app.services.calls import oid

    doc = await collection("agent_configs").find_one({"_id": oid(agent_id)})
    if not doc:
        raise HTTPException(404, "agent not found")
    return _out(doc)


@router.put("/{agent_id}")
async def update_agent(agent_id: str, persona: AgentPersona) -> dict:
    from app.services.calls import oid

    result = await collection("agent_configs").update_one(
        {"_id": oid(agent_id)}, {"$set": persona.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "agent not found")
    return {"updated": True}


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str) -> dict:
    from app.services.calls import oid

    await collection("agent_configs").delete_one({"_id": oid(agent_id)})
    return {"deleted": True}
