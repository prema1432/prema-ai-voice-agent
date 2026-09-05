"""MongoDB indexes — keep queries fast and phone numbers unique per tenant."""
from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

COMPOUND_UNIQUE = {"unique": True}


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db["campaigns"].create_index("created_at")
    await db["campaigns"].create_index("status")

    # One lead per (tenant, campaign, phone)
    await db["leads"].create_index(
        [("tenant_id", 1), ("campaign_id", 1), ("phone", 1)], **COMPOUND_UNIQUE
    )
    await db["leads"].create_index([("campaign_id", 1), ("status", 1)])
    await db["leads"].create_index("phone")

    await db["call_sessions"].create_index([("campaign_id", 1), ("created_at", -1)])
    await db["call_sessions"].create_index([("lead_id", 1), ("created_at", -1)])
    await db["call_sessions"].create_index("status")

    await db["agent_configs"].create_index("name", **COMPOUND_UNIQUE)
    await db["users"].create_index("email", **COMPOUND_UNIQUE)

    await db["llm_usage"].create_index([("ts", -1)])
    await db["llm_usage"].create_index([("model", 1), ("ts", -1)])

    await db["audit_logs"].create_index([("ts", -1)])
    await db["audit_logs"].create_index([("entity_type", 1), ("entity_id", 1)])
    await db["audit_logs"].create_index([("action", 1), ("ts", -1)])

    await db["notifications"].create_index([("read", 1), ("ts", -1)])

    await db["integrations"].create_index("type")
    await db["integrations"].create_index([("enabled", 1), ("events", 1)])

    await db["delivery_logs"].create_index([("ts", -1)])
    await db["delivery_logs"].create_index([("direction", 1), ("ts", -1)])
