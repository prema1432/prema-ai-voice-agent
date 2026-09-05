"""Singleton MongoDB access via Motor (async)."""
from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings


class Database:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


db_singleton = Database()

# Collection names used across the app
COLLECTIONS = {
    "users": "users",
    "campaigns": "campaigns",
    "leads": "leads",
    "call_sessions": "call_sessions",
    "agent_configs": "agent_configs",
    "appointments": "appointments",
    "callbacks": "callbacks",
    "llm_usage": "llm_usage",
    # Platform ops: audit trail, in-app notifications, integrations & delivery log
    "audit_logs": "audit_logs",
    "notifications": "notifications",
    "integrations": "integrations",
    "delivery_logs": "delivery_logs",
    # Form builder
    "forms": "forms",
    "form_submissions": "form_submissions",
}


async def connect_db() -> None:
    from app import indexes

    db_singleton.client = AsyncIOMotorClient(settings.mongo_uri, tz_aware=True)
    db_singleton.db = db_singleton.client[settings.mongo_db]
    await indexes.ensure_indexes(db_singleton.db)


async def close_db() -> None:
    if db_singleton.client is not None:
        db_singleton.client.close()
        db_singleton.client = None
        db_singleton.db = None


def get_db() -> AsyncIOMotorDatabase:
    if db_singleton.db is None:
        raise RuntimeError("Database not connected — call connect_db() on startup")
    return db_singleton.db


def collection(name: str) -> Any:
    """Shorthand: collection("leads") etc. Unknown names raise ValueError."""
    if name not in COLLECTIONS:
        raise ValueError(f"Unknown collection '{name}'. Known: {list(COLLECTIONS)}")
    return get_db()[name]
