"""OpenRouter chat-completions client (streaming + tool calls).

OpenRouter is OpenAI-compatible: POST {base}/chat/completions with SSE streaming.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

import httpx

from app.config import settings


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


def _headers() -> dict[str, str]:
    if not settings.openrouter_api_key:
        raise OpenRouterError(
            "OPENROUTER_API_KEY is not set — get one at https://openrouter.ai/keys"
        )
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.openrouter_app_url or "https://freebuff.voice",
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
) -> dict[str, Any]:
    """Non-streaming chat completion — used for summaries / structured extraction."""
    payload: dict[str, Any] = {
        "model": model or settings.openrouter_llm_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if tools:
        payload["tools"] = tools
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{settings.openrouter_base_url}/chat/completions",
            headers=_headers(),
            json=payload,
        )
    if resp.status_code != 200:
        raise OpenRouterError(f"OpenRouter HTTP {resp.status_code}: {resp.text[:300]}")
    return resp.json()


async def chat_stream(
    messages: list[dict[str, Any]],
    model: str | None = None,
    tools: list[dict[str, Any]] | None = None,
    temperature: float = 0.6,
    max_tokens: int = 200,
    timeout: float = 30.0,
) -> AsyncIterator[dict[str, Any]]:
    """Yield raw OpenRouter SSE choice-delta dicts from a streamed completion."""
    payload: dict[str, Any] = {
        "model": model or settings.openrouter_llm_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    if tools:
        payload["tools"] = tools

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


async def chat_stream_collected(
    messages: list[dict[str, Any]],
    **kwargs: Any,
) -> StreamResult:
    """Convenience wrapper: stream and assemble into text + tool calls."""
    result = StreamResult()
    tool_index: dict[int, ToolCallDelta] = {}

    async for delta in chat_stream(messages, **kwargs):
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
    return result
