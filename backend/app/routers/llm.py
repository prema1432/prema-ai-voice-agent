"""LLM dashboard backend: current model settings + usage/cost analytics."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

from app.config import settings
from app.db import collection

router = APIRouter(prefix="/llm", tags=["llm"])


@router.get("/status")
async def llm_status() -> dict:
    return {
        "enabled": bool(settings.openrouter_api_key),
        "model": settings.openrouter_llm_model,
        "summary_model": settings.openrouter_summary_model,
        "base_url": settings.openrouter_base_url,
        "key_set": bool(settings.openrouter_api_key),
        "thinking_effort": settings.openrouter_thinking_effort or None,
        "send_reasoning": settings.openrouter_send_reasoning,
        "usage_enabled": settings.llm_usage_enabled,
        "free_fallbacks": settings.free_model_fallbacks,
    }


@router.get("/usage")
async def llm_usage(days: int = 7, limit: int = 50) -> dict:
    """Aggregate token/cost usage over the window + recent request log."""
    days = max(1, min(90, days))
    limit = max(1, min(500, limit))
    since = datetime.now(timezone.utc) - timedelta(days=days)
    match = {"ts": {"$gte": since}}

    total = await collection("llm_usage").aggregate([
        {"$match": match},
        {"$group": {
            "_id": None,
            "calls": {"$sum": 1},
            "prompt_tokens": {"$sum": "$prompt_tokens"},
            "completion_tokens": {"$sum": "$completion_tokens"},
            "cost": {"$sum": "$cost"},
            "free_calls": {"$sum": {"$cond": ["$free", 1, 0]}},
        }},
    ]).to_list(1)

    per_day = await collection("llm_usage").aggregate([
        {"$match": match},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$ts"}},
            "calls": {"$sum": 1},
            "prompt_tokens": {"$sum": "$prompt_tokens"},
            "completion_tokens": {"$sum": "$completion_tokens"},
            "cost": {"$sum": "$cost"},
        }},
        {"$sort": {"_id": 1}},
    ]).to_list(100)

    per_model = await collection("llm_usage").aggregate([
        {"$match": match},
        {"$group": {
            "_id": "$model",
            "calls": {"$sum": 1},
            "prompt_tokens": {"$sum": "$prompt_tokens"},
            "completion_tokens": {"$sum": "$completion_tokens"},
            "cost": {"$sum": "$cost"},
        }},
        {"$sort": {"calls": -1}},
    ]).to_list(50)

    recent = await collection("llm_usage").find(
        match, {"_id": 0}
    ).sort("ts", -1).limit(limit).to_list(limit)
    for r in recent:
        if r.get("ts"):
            r["ts"] = r["ts"].isoformat()

    agg = total[0] if total else {
        "calls": 0, "prompt_tokens": 0, "completion_tokens": 0,
        "cost": 0.0, "free_calls": 0,
    }
    agg.pop("_id", None)
    for key in ("cost",):
        agg[key] = round(agg.get(key, 0.0), 6)

    return {
        "window_days": days,
        "total": agg,
        "per_day": per_day,
        "per_model": per_model,
        "recent": recent,
    }
