"""LLM dashboard backend: current model settings + usage/cost analytics."""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field
from urllib.parse import unquote

from app.config import settings
from app.db import collection

log = logging.getLogger(__name__)
router = APIRouter(prefix="/llm", tags=["llm"])

# In-process cache of the model catalog (refreshed at most every 10 min).
_models_cache: dict = {"at": 0.0, "models": []}
_MODEL_TTL = 600.0


def _fallback_models() -> list[dict]:
    return [
        {
            "id": mid,
            "name": mid,
            "context_length": 0,
            "free": mid.endswith(":free"),
            "pricing": {"prompt": None, "completion": None, "request": None},
            "description": "",
        }
        for mid in settings.free_model_fallbacks
    ]


def _per_mtok(value: object) -> float | None:
    """Convert OpenRouter's per-token price into USD / 1M tokens."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return round(f * 1_000_000, 4) if f > 0 else 0.0


def _normalize_model(m: dict) -> dict:
    pricing = m.get("pricing") or {}
    model_id = str(m.get("id", ""))
    return {
        "id": model_id,
        "name": m.get("name") or model_id,
        "context_length": int(m.get("context_length") or 0),
        "free": model_id.endswith(":free"),
        "pricing": {
            "prompt": _per_mtok(pricing.get("prompt")),
            "completion": _per_mtok(pricing.get("completion")),
            "request": _per_mtok(pricing.get("request")),
        },
        "description": (m.get("description") or "").strip(),
    }


def _sort_models(models: list[dict]) -> list[dict]:
    """Default model first, then free tier, then largest context, then name."""
    default = settings.openrouter_llm_model

    def key(m: dict) -> tuple:
        return (
            0 if m["id"] == default else 1,
            0 if m["free"] else 1,
            -(m.get("context_length") or 0),
            m["id"],
        )

    return sorted(models, key=key)


def _bare_model(model_id: str) -> dict:
    return {
        "id": model_id,
        "name": model_id,
        "context_length": 0,
        "free": model_id.endswith(":free"),
        "pricing": {"prompt": None, "completion": None, "request": None},
        "description": "",
    }


async def _fetch_models() -> list[dict]:
    """Pull the live OpenRouter model catalog (rich fields), cached."""
    now = time.monotonic()
    if _models_cache["models"] and now - _models_cache["at"] < _MODEL_TTL:
        return _models_cache["models"]
    try:
        headers = {"Authorization": f"Bearer {settings.openrouter_api_key}"}
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{settings.openrouter_base_url}/models", headers=headers
            )
        data = resp.json() if resp.status_code == 200 else {}
        raw = data.get("data", [])
        models = [_normalize_model(m) for m in raw if m.get("id")]
        models = models or _fallback_models()
    except Exception as exc:  # noqa: BLE001
        log.warning("openrouter /models unavailable (%s) — using fallback list", exc)
        models = _fallback_models()
    # Ensure the current/default model is always present and listed first.
    default = settings.openrouter_llm_model
    if not any(m["id"] == default for m in models):
        models.insert(0, _bare_model(default))
    models = _sort_models(models)
    _models_cache.update({"at": now, "models": models})
    return models


async def _fetch_model_detail(model_id: str) -> dict | None:
    """Detail for one model — from the cached catalog or a direct fetch."""
    models = await _fetch_models()
    for m in models:
        if m["id"] == model_id:
            return dict(m)
    try:
        headers = {"Authorization": f"Bearer {settings.openrouter_api_key}"}
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{settings.openrouter_base_url}/models/{model_id}", headers=headers
            )
        if resp.status_code == 200:
            data = resp.json().get("data") or {}
            if data.get("id"):
                return _normalize_model(data)
    except Exception as exc:  # noqa: BLE001
        log.warning("openrouter model %s unavailable (%s)", model_id, exc)
    return None


def _env_path() -> Path:
    # backend/.env (this file lives in backend/app/routers/)
    return Path(__file__).resolve().parents[2] / ".env"


def _persist_env_model(model: str) -> bool:
    """Persist OPENROUTER_LLM_MODEL into backend/.env so the choice survives."""
    try:
        path = _env_path()
        if not path.exists():
            return False
        lines = path.read_text(encoding="utf-8").splitlines()
        key = "OPENROUTER_LLM_MODEL"
        out: list[str] = []
        written = False
        for line in lines:
            if line.startswith(key + "="):
                out.append(f"{key}={model}")
                written = True
            else:
                out.append(line)
        if not written:
            out.append(f"{key}={model}")
        path.write_text("\n".join(out) + "\n", encoding="utf-8")
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("could not persist model choice: %s", exc)
        return False


@router.get("/models")
async def llm_models() -> dict:
    """Dynamic model catalog (OpenRouter live, fallback curated list).

    `default` is the model every new conversation starts with; the list is
    sorted with it first. `current` is kept as a legacy alias.
    """
    return {
        "default": settings.openrouter_llm_model,
        "current": settings.openrouter_llm_model,
        "models": await _fetch_models(),
    }


@router.get("/models/{rest:path}")
async def llm_model_detail(rest: str) -> dict:
    """Detail for a single model (dynamic route: /llm/models/{model_id}).

    OpenRouter ids contain slashes (org/model:tag), so the id is captured as a
    catch-all path segment and URL-decoded here.
    """
    model_id = unquote(rest)
    detail = await _fetch_model_detail(model_id)
    if detail is None:
        return {"found": False, "id": model_id, "model": None,
                "default": settings.openrouter_llm_model}
    detail = dict(detail)
    detail["found"] = True
    detail["default"] = settings.openrouter_llm_model
    detail["is_default"] = detail["id"] == settings.openrouter_llm_model
    return detail


class LlmModelIn(BaseModel):
    model: str = Field(min_length=3, max_length=200)


@router.put("/model")
async def llm_set_model(body: LlmModelIn) -> dict:
    """Switch the active chat model at runtime (and persist to .env)."""
    from app.events import audit, notify

    model = body.model.strip()
    prev = settings.openrouter_llm_model
    settings.openrouter_llm_model = model
    persisted = _persist_env_model(model)
    # Update summary default too when it tracked the previous chat default.
    if settings.openrouter_summary_model == prev:
        settings.openrouter_summary_model = model
    await audit("llm.model_changed", entity_type="llm",
                meta={"from": prev, "to": model, "persisted": persisted})
    await notify("🧠 LLM model changed", f"Agent conversations now use {model}.",
                 kind="llm", data={"model": model})
    log.info("llm model changed %s -> %s (persisted=%s)", prev, model, persisted)
    return {"model": model, "persisted": persisted, "previous": prev}


class LlmTestIn(BaseModel):
    model: str | None = None


@router.post("/test")
async def llm_test(body: LlmTestIn) -> dict:
    """Send a tiny prompt to a model and report latency/reply/usage."""
    from app.llm.openrouter import OpenRouterError, chat

    model_id = (body.model or settings.openrouter_llm_model).strip()
    started = time.perf_counter()
    try:
        data = await chat(
            [{"role": "user", "content": "Reply with exactly: OK"}],
            model=model_id, max_tokens=16, temperature=0.0, purpose="model_test",
        )
    except OpenRouterError as exc:
        return {"ok": False, "model": model_id,
                "error": str(exc)[:400],
                "latency_ms": int((time.perf_counter() - started) * 1000)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "model": model_id, "error": f"{type(exc).__name__}: {exc}"[:400],
                "latency_ms": int((time.perf_counter() - started) * 1000)}
    usage = data.get("usage") or {}
    reply = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    return {
        "ok": True,
        "model": model_id,
        "reply": reply.strip(),
        "latency_ms": int((time.perf_counter() - started) * 1000),
        "usage": {
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
        },
    }


@router.get("/status")
async def llm_status() -> dict:
    return {
        "enabled": bool(settings.openrouter_api_key),
        "model": settings.openrouter_llm_model,
        "default_model": settings.openrouter_llm_model,
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
