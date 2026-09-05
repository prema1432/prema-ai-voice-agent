"""OpenRouter chat-completions client (streaming + tool calls).

OpenRouter is OpenAI-compatible: POST {base}/chat/completions with SSE streaming.
Also records per-request usage (tokens + estimated cost) to MongoDB so the
LLM dashboard can show history and spend analytics.
"""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncIterator

import httpx

from app.config import settings

log = logging.getLogger(__name__)


class OpenRouterError(RuntimeError):
    pass


@dataclass
class ToolCallDelta:
    """Assembled tool call coming out of a streamed response."""
    id: str = ""
    name: str = ""
    arguments: str = ""

    def complete(self) -> bool:
        return bool(self.id) and bool(self.name)


@dataclass
class StreamResult:
    content: str = ""
    tool_calls: list[ToolCallDelta] = field(default_factory=list)
    finish_reason: str | None = None
    raw_chunks: int = 0
    # Usage captured from the API (or estimated) so callers can meter cost.
    usage: dict[str, Any] = field(default_factory=dict)
    model: str | None = None


# USD per 1M tokens (input, output) — coarse fallback table; :free models cost 0.
_PRICES: dict[str, tuple[float, float]] = {
    "openai/gpt-4o": (2.5, 10.0),
    "openai/gpt-4.1": (2.0, 8.0),
    "anthropic/claude-3.5-sonnet": (3.0, 15.0),
    "anthropic/claude-3.7-sonnet": (3.0, 15.0),
    "google/gemini-flash": (0.30, 2.50),
    "google/gemini-2.0-flash": (0.10, 0.40),
    "deepseek/deepseek-chat": (0.27, 1.10),
    "minimax/minimax-m3": (0.30, 1.20),
    "minimax/minimax-m2.7": (0.30, 1.20),
    "z-ai/glm": (0.30, 1.10),
}
_DEFAULT_PRICE = (0.40, 1.60)


def _is_free(model: str) -> bool:
    return model.rstrip().endswith(":free")


def _model_key(model: str) -> str:
    return model.split(":")[0].lower()


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    if _is_free(model):
        return 0.0
    key = _model_key(model)
    price = next((v for prefix, v in _PRICES.items() if key.startswith(prefix)), _DEFAULT_PRICE)
    return (input_tokens * price[0] + output_tokens * price[1]) / 1_000_000


def _est_tokens(text: str) -> int:
    return max(0, len(text) // 4)


async def _persist_usage(
    *,
    model: str,
    purpose: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> None:
    """Fire-and-forget write of one LLM request's usage to Mongo."""
    if not settings.llm_usage_enabled:
        return
    if prompt_tokens <= 0 and completion_tokens <= 0:
        return
    doc = {
        "model": model,
        "purpose": purpose,
        "prompt_tokens": max(0, prompt_tokens),
        "completion_tokens": max(0, completion_tokens),
        "cost": round(estimate_cost(model, prompt_tokens, completion_tokens), 8),
        "free": _is_free(model),
        "ts": datetime.now(timezone.utc),
    }
    try:
        from app.db import collection  # lazy — keeps this module import-safe
        await collection("llm_usage").insert_one(doc)
    except Exception:  # noqa: BLE001 — metering must never break a conversation
        log.debug("llm usage write skipped", exc_info=True)


def _schedule_usage(*, model: str, purpose: str, prompt: int, completion: int) -> None:
    try:
        asyncio.get_event_loop()
    except RuntimeError:
        return
    if settings.llm_usage_enabled:
        asyncio.get_event_loop().create_task(
            _persist_usage(model=model, purpose=purpose,
                           prompt_tokens=prompt, completion_tokens=completion)
        )


def _headers() -> dict[str, str]:
    if not settings.openrouter_api_key:
        raise OpenRouterError(
            "OPENROUTER_API_KEY is not set — get one at https://openrouter.ai/keys"
        )
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.openrouter_app_url or "https://github.com/prema1432/prema-ai-voice-agent",
        "X-Title": settings.app_name,
    }
    return headers


async def chat(
    messages: list[dict[str, Any]],
    model: str | None = None,
    tools: list[dict[str, Any]] | None = None,
    temperature: float = 0.6,
    max_tokens: int = 300,
    timeout: float = 20.0,
    purpose: str = "conversation",
) -> dict[str, Any]:
    """Non-streaming chat completion — used for summaries / structured extraction."""
    model_id = model or settings.openrouter_llm_model
    payload: dict[str, Any] = {
        "model": model_id,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if tools:
        payload["tools"] = tools
    if settings.openrouter_send_reasoning and settings.openrouter_thinking_effort:
        payload["reasoning_effort"] = settings.openrouter_thinking_effort
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{settings.openrouter_base_url}/chat/completions",
            headers=_headers(),
            json=payload,
        )
    if resp.status_code != 200:
        raise OpenRouterError(f"OpenRouter HTTP {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    usage = data.get("usage") or {}
    prompt_tokens = usage.get("prompt_tokens") or 0
    completion_tokens = usage.get("completion_tokens") or 0
    if not prompt_tokens and not completion_tokens:
        content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
        prompt_tokens = sum(_est_tokens(str(m.get("content", ""))) for m in messages)
        completion_tokens = _est_tokens(content)
    _schedule_usage(model=model_id, purpose=purpose,
                    prompt=prompt_tokens, completion=completion_tokens)
    return data


async def chat_stream(
    messages: list[dict[str, Any]],
    model: str | None = None,
    tools: list[dict[str, Any]] | None = None,
    temperature: float = 0.6,
    max_tokens: int = 200,
    timeout: float = 30.0,
) -> AsyncIterator[dict[str, Any]]:
    """Yield raw OpenRouter SSE choice-delta dicts from a streamed completion.

    A final frame carrying only top-level `usage` is yielded as
    {"_usage": {...}} so callers can meter tokens without extra requests.
    """
    model_id = model or settings.openrouter_llm_model
    payload: dict[str, Any] = {
        "model": model_id,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    if tools:
        payload["tools"] = tools
    if settings.openrouter_send_reasoning and settings.openrouter_thinking_effort:
        payload["reasoning_effort"] = settings.openrouter_thinking_effort

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            f"{settings.openrouter_base_url}/chat/completions",
            headers=_headers(),
            json=payload,
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                raise OpenRouterError(
                    f"OpenRouter HTTP {resp.status_code}: {body[:300]!r}"
                )
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if not data or data == "[DONE]":
                    continue
                try:
                    parsed = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choices = parsed.get("choices") or []
                if choices:
                    yield choices[0].get("delta", {})
                usage = parsed.get("usage")
                if usage:
                    yield {"_usage": usage, "model": model_id}


async def chat_stream_collected(
    messages: list[dict[str, Any]],
    **kwargs: Any,
) -> StreamResult:
    """Convenience wrapper: stream and assemble into text + tool calls."""
    model_id = kwargs.get("model") or settings.openrouter_llm_model
    purpose = kwargs.pop("purpose", "conversation")
    result = StreamResult(model=model_id)
    tool_index: dict[int, ToolCallDelta] = {}

    async for delta in chat_stream(messages, **kwargs):
        if "_usage" in delta:
            result.usage = delta.get("_usage") or {}
            continue
        result.raw_chunks += 1
        if delta.get("content"):
            result.content += delta["content"]
        for tc in delta.get("tool_calls") or []:
            idx = tc.get("index", 0)
            entry = tool_index.setdefault(idx, ToolCallDelta())
            if tc.get("id"):
                entry.id = tc["id"]
            fn = tc.get("function") or {}
            if fn.get("name"):
                entry.name = fn["name"]
            if fn.get("arguments"):
                entry.arguments += fn["arguments"]
        if delta.get("finish_reason"):
            result.finish_reason = delta["finish_reason"]

    result.tool_calls = [tool_index[i] for i in sorted(tool_index)]

    usage = result.usage or {}
    prompt_tokens = usage.get("prompt_tokens") or 0
    completion_tokens = usage.get("completion_tokens") or 0
    if not prompt_tokens and not completion_tokens:
        prompt_tokens = sum(_est_tokens(str(m.get("content", ""))) for m in messages)
        completion_tokens = _est_tokens(result.content)
    result.usage = {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost": round(estimate_cost(model_id, prompt_tokens, completion_tokens), 8),
    }
    _schedule_usage(model=model_id, purpose=purpose,
                    prompt=prompt_tokens, completion=completion_tokens)
    return result
