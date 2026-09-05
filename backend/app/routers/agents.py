"""Agent directory — dynamic AI agents with specialization & performance stats.

Agents are stored in `agent_configs` as an AgentPersona plus directory
metadata (gender, specialization, avatar). Their live stats (leads completed,
rating) are computed from `call_sessions` on every read, so campaigns that use
an agent immediately show results.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

from app.db import collection
from app.schemas import AgentPersona

log = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])

# ── Dynamic specialization catalog ──────────────────────────────────────────
DEFAULT_SPECIALIZATIONS = [
    "Telecalling",
    "Customer Support",
    "Sales / Closing",
    "Lead Generation",
    "Buying / Procurement",
    "Information Desk",
]

# Indian names shown as quick-picks in the create-agent form.
SAMPLE_NAMES: dict[str, list[str]] = {
    "male": [
        "Aarav", "Arjun", "Rohan", "Kabir", "Vikram", "Siddharth", "Aditya",
        "Rahul", "Vivek", "Rajesh", "Karthik", "Amit",
    ],
    "female": [
        "Ananya", "Priya", "Meera", "Diya", "Kavya", "Nisha", "Lakshmi",
        "Sneha", "Pooja", "Radhika", "Divya", "Shreya",
    ],
}

# avatar accent choices used by the UI
ACCENTS = ["indigo", "violet", "cyan", "green", "amber", "red"]


def _out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


async def _stats_for(name: str) -> dict:
    """Completed leads, calls, avg score and derived rating for an agent."""
    calls = collection("call_sessions")
    completed = await calls.count_documents({"agent_name": name, "status": "completed"})
    total_calls = await calls.count_documents({"agent_name": name})
    pipe = [
        {"$match": {"agent_name": name, "lead_score": {"$ne": None}}},
        {"$group": {"_id": None, "avg": {"$avg": "$lead_score"}}},
    ]
    rows = await calls.aggregate(pipe).to_list(1)
    avg_score = rows[0]["avg"] if rows and rows[0].get("avg") is not None else None
    # Volume + quality → 1–5 star rating
    rating = round(min(5.0, 3.0 + min(1.5, completed * 0.2) + (avg_score or 0) / 100.0 * 0.5), 1)
    return {
        "leads_completed": completed,
        "calls": total_calls,
        "avg_score": round(avg_score, 1) if avg_score is not None else None,
        "rating": rating,
    }


def _avatar(name: str, gender: str) -> str:
    seed = name.replace(" ", "")
    style = "adventurer" if gender == "male" else "adventurer"
    return f"https://api.dicebear.com/9.x/adventurer/png?seed={seed}&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=50"


def _seed_agents() -> list[dict]:
    """12 defaults: every specialization x male/female, per-language pairs."""
    pairs = [
        ("Aarav", "male", "Customer Support"),
        ("Ananya", "female", "Customer Support"),
        ("Arjun", "male", "Telecalling"),
        ("Priya", "female", "Telecalling"),
        ("Kabir", "male", "Lead Generation"),
        ("Diya", "female", "Lead Generation"),
        ("Rohan", "male", "Sales / Closing"),
        ("Meera", "female", "Sales / Closing"),
        ("Vikram", "male", "Buying / Procurement"),
        ("Kavya", "female", "Buying / Procurement"),
        ("Siddharth", "male", "Information Desk"),
        ("Nisha", "female", "Information Desk"),
    ]
    personas = []
    for name, gender, spec in pairs:
        personas.append(AgentPersona(
            name=name,
            gender=gender,
            specialization=spec,
            avatar=_avatar(name, gender),
            description=f"A {gender} {spec.lower()} agent, friendly and professional.",
            requirements=(
                f"You are {name}, a {spec.lower()} agent. Be warm, polite and clear. "
                "Introduce yourself, listen, and always confirm before any commitment."
            ),
            primary_language="te",
            fallback_languages=["hi", "hinglish", "en"],
            auto_language_switch=True,
            tools_enabled=["book_appointment", "set_callback", "end_call", "opt_out_dnd"],
            max_call_seconds=300,
        ))
    return [p.model_dump() for p in personas]


async def ensure_default_agents() -> None:
    """Seed the default catalog once (only when the directory is empty)."""
    try:
        existing = await collection("agent_configs").count_documents({})
        if existing > 0:
            return
        docs = _seed_agents()
        now = datetime.now(timezone.utc)
        for d in docs:
            d["created_at"] = now
            try:
                await collection("agent_configs").insert_one(d)
            except DuplicateKeyError:
                pass
        log.info("seeded %d default agents", len(docs))
    except Exception:  # noqa: BLE001 — seeding must not block startup
        log.exception("agent seeding failed")


@router.get("/meta")
async def agent_meta() -> dict:
    return {
        "specializations": DEFAULT_SPECIALIZATIONS,
        "sample_names": SAMPLE_NAMES,
        "accents": ACCENTS,
        "default_avatar": "https://api.dicebear.com/9.x/adventurer/png?seed={seed}",
    }


@router.post("")
async def create_agent(persona: AgentPersona) -> dict:
    doc = persona.model_dump()
    if not doc.get("avatar"):
        doc["avatar"] = _avatar(persona.name, persona.gender)
    doc["created_at"] = datetime.now(timezone.utc)
    try:
        result = await collection("agent_configs").insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, f"An agent named '{persona.name}' already exists") from None
    return {"id": str(result.inserted_id)}


@router.get("")
async def list_agents() -> list[dict]:
    await ensure_default_agents()
    docs = await collection("agent_configs").find().sort("specialization", 1).to_list(500)
    out = []
    for d in docs:
        out.append(_out(d))
    # attach live stats (small N — one agg per agent is fine at this scale)
    for a in out:
        a["stats"] = await _stats_for(a.get("name") or "")
    return out


@router.get("/{agent_id}")
async def get_agent(agent_id: str) -> dict:
    from app.services.calls import oid

    doc = await collection("agent_configs").find_one({"_id": oid(agent_id)})
    if not doc:
        raise HTTPException(404, "agent not found")
    out = _out(doc)
    out["stats"] = await _stats_for(out.get("name") or "")
    return out


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
