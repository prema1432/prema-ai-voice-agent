"""Shared test fixtures — offline fake OpenRouter transport.

The pipeline imports `app.llm.openrouter` as `orr`, so tests monkeypatch
`app.voice.pipeline.orr` with a fake module object exposing the same surface
(chat_stream_collected / OpenRouterError) without any HTTP.
"""
from __future__ import annotations

from typing import Any

import pytest


class FakeToolCall:
    def __init__(self, name: str, arguments: str = "{}") -> None:
        self.id = f"call_{name}"
        self.name = name
        self.arguments = arguments

    def complete(self) -> bool:
        return True


class FakeStreamResult:
    def __init__(self, content: str, tool_calls: list | None = None) -> None:
        self.content = content
        self.tool_calls = tool_calls or []
        self.finish_reason = "stop"
        self.raw_chunks = 1


class FakeOpenRouter:
    """Scripted responses; records every request for assertions."""

    def __init__(self, responses: list[tuple[str, list] | str]) -> None:
        # each entry: ("text", [...tool calls]) or plain "text"
        self.responses = list(responses)
        self.requests: list[dict[str, Any]] = []

    async def chat_stream_collected(self, messages, **kwargs):  # noqa: ANN001
        self.requests.append({"messages": [dict(m) for m in messages], "kwargs": kwargs})
        item = self.responses.pop(0) if self.responses else ("...", [])
        if isinstance(item, str):
            item = (item, [])
        return FakeStreamResult(item[0], item[1])

    async def chat(self, messages, **kwargs):  # noqa: ANN001
        return {"choices": [{"message": {"content": "{}"}}]}

    class OpenRouterError(RuntimeError):
        pass


@pytest.fixture
def fake_orr_factory():
    """Returns a factory that builds a FakeOpenRouter and patches pipeline.orr."""
    def _make(responses: list):
        import app.voice.pipeline as pipeline_mod

        fake = FakeOpenRouter(responses)
        pipeline_mod.orr = fake
        return fake
    return _make


class RecordingSink:
    """AudioSink that records every send/interrupt for assertions."""

    def __init__(self) -> None:
        self.chunks: list = []
        self.interrupts = 0

    def send_audio(self, pcm) -> None:  # noqa: ANN001
        self.chunks.append(pcm)

    def on_interrupt(self) -> None:
        self.interrupts += 1
