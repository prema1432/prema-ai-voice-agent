"""Post-call analysis: transcript → {summary, outcome, lead_score, next_action}.

Uses the cheaper OPENROUTER_SUMMARY_MODEL — one call per completed call.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from app.llm import openrouter as orr
from app.config import settings

log = logging.getLogger(__name__)

VALID_OUTCOMES = {
    "interested", "not_interested", "callback_requested", "dnd", "unknown",
}


async def summarize_call(messages: list[dict[str, Any]]) -> dict[str, Any]:
    """Returns parsed analysis dict; raises OpenRouterError on API failure."""
    resp = await orr.chat(
        messages,
        model=settings.openrouter_summary_model,
        temperature=0.1,
        max_tokens=300,
    )
    content = (resp.get("choices") or [{}])[0].get("message", {}).get("content", "")
    return parse_analysis(content)


def parse_analysis(content: str) -> dict[str, Any]:
    """Tolerant JSON parser — models occasionally wrap JSON in prose/fences."""
    text = (content or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            log.warning("unparseable summary output: %r", content[:200])
            return {"summary": text[:500] or None, "outcome": "unknown", "lead_score": None}
        try:
            data = json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            return {"summary": text[:500], "outcome": "unknown", "lead_score": None}

    outcome = data.get("outcome")
    if outcome not in VALID_OUTCOMES:
        outcome = "unknown"
    score = data.get("lead_score")
    try:
        score = max(0, min(100, int(score))) if score is not None else None
    except (TypeError, ValueError):
        score = None
    return {
        "summary": data.get("summary"),
        "outcome": outcome,
        "lead_score": score,
        "next_action": data.get("next_action"),
    }
