"""VoicePipeline end-to-end tests — fully offline, fake LLM + mock engines."""
from __future__ import annotations

import asyncio

import numpy as np

from app.llm.tools import ToolBox
from app.schemas import AgentPersona
from app.voice.pipeline import VoicePipeline
from app.voice.stt import MockSTT
from app.voice.tts import MockTTS


def _pcm(ms: int, rate: int = 16000, amplitude: int = 9000) -> np.ndarray:
    n = int(rate * ms / 1000)
    t = np.arange(n) / rate
    return (np.sin(2 * np.pi * 300 * t) * amplitude).astype(np.int16)


def _pipeline(fake_orr, responses_needed: bool = True, **kw) -> VoicePipeline:
    """Build a pipeline wired to a fake LLM + mock engines + recording sink."""
    from conftest import RecordingSink

    async def _end_call_handler(args):
        return {"ok": True}

    toolbox = kw.pop("toolbox", None) or ToolBox()
    toolbox.register("end_call", _end_call_handler)
    toolbox.register("opt_out_dnd", _end_call_handler)

    persona = AgentPersona(name="Test Bot", primary_language="hi",
                           tools_enabled=kw.pop("tools_enabled", []))
    p = VoicePipeline(
        persona=persona,
        sink=kw.pop("sink", RecordingSink()),
        toolbox=toolbox,
        vad=kw.pop("vad", None),          # EnergyVAD: 300Hz tone counts as speech
        stt=kw.pop("stt", MockSTT("haan boliye")),
        tts=kw.pop("tts", MockTTS(0.05)),
    )
    import app.voice.pipeline as pipeline_mod
    pipeline_mod.orr = fake_orr
    return p


async def test_greeting_streams_audio(fake_orr_factory):
    fake_orr = fake_orr_factory([("Namaste! Main aapki kya madad kar sakti hoon?", [])])
    p = _pipeline(fake_orr)
    await p.greet()
    await p.run_until_idle()

    assert len(p.sink.chunks) > 0                     # audio was streamed
    assert p.transcript[0]["role"] == "agent"
    assert "Namaste" in p.transcript[0]["text"]
    assert p.messages[-1]["role"] == "assistant"


async def test_user_turn_flows_to_llm(fake_orr_factory):
    fake_orr = fake_orr_factory([
        ("Namaste!", []),                              # greeting
        ("Theek hai, main note kar leti hoon.", []),   # reply to user turn
    ])
    p = _pipeline(fake_orr, stt=MockSTT("mujhe jaankari chahiye"))
    p.start()

    p.feed_audio(_pcm(900), sample_rate=16000)
    p.feed_audio(np.zeros(12800, dtype=np.int16))      # 800ms silence closes turn
    await asyncio.sleep(0.3)
    await p.run_until_idle()

    roles = [m["role"] for m in p.messages]
    assert "user" in roles
    user_msg = next(m for m in p.messages if m["role"] == "user")
    assert user_msg["content"] == "mujhe jaankari chahiye"
    assert p.transcript[-1]["role"] == "agent"
    user_contents = [m["content"] for m in fake_orr.requests[-1]["messages"]
                     if m["role"] == "user"]
    assert "mujhe jaankari chahiye" in user_contents


async def test_tool_end_call_terminates(fake_orr_factory):
    from conftest import FakeToolCall

    fake_orr = fake_orr_factory([
        ("", [FakeToolCall("end_call", '{"farewell": "Shukriya!"}')]),
    ])
    p = _pipeline(fake_orr, tools_enabled=["end_call"])

    await p._process_user_turn(_pcm(400))              # direct turn injection
    assert p.ended is True
    assert p.end_reason == "agent_end_call"
    tool_log = [t for t in p.tool_calls_log if t["name"] == "end_call"]
    assert tool_log and tool_log[0]["result"] == {"ok": True}
    # protocol shape: assistant tool_calls message + role=tool result message
    assert any(m.get("tool_calls") for m in p.messages)
    assert any(m.get("role") == "tool" for m in p.messages)


async def test_barge_in_cancels_playback(fake_orr_factory):
    fake_orr = fake_orr_factory([
        ("Ye ek lamba vakya hai jo bolte waqt kaafi der tak chalta rehta hai.", []),
    ])
    p = _pipeline(fake_orr, tts=MockTTS(2.0))          # long fake audio
    p.start()

    greet_task = asyncio.create_task(p.greet())
    await asyncio.sleep(0.15)                          # mid-playback
    assert p._speaking is True

    p.feed_audio(_pcm(200), sample_rate=16000)         # caller starts talking
    await asyncio.sleep(0.25)

    assert p.sink.interrupts >= 1 or p._speaking is False
    assert p._generation >= 1
    # a barge-in marker was added to the conversation
    assert any("interrupted" in m.get("content", "") for m in p.messages
               if m["role"] == "system")
    await asyncio.wait_for(greet_task, timeout=1.0)   # greet aborts cleanly
    await p.close()


import pytest  # noqa: E402


async def test_language_switch_on_script(fake_orr_factory):
    # Telugu-native script from STT switches the reply language to te.
    class TeluguSTT:
        async def transcribe(self, pcm, language=None):  # noqa: ANN001
            return "నమస్కారం, మీరు ఎలా ఉన్నారు?"

    fake_orr = fake_orr_factory([("Namaskaram!", [])])
    p = _pipeline(fake_orr, stt=TeluguSTT())

    await p._process_user_turn(_pcm(400))
    assert p.language == "te"                          # switched from hi → te


async def test_non_telugu_script_does_not_switch(fake_orr_factory):
    # The script detector only reports Telugu (Telugu-primary platform), so Tamil
    # input leaves the reply language untouched rather than mid-call flickering.
    class TamilSTT:
        async def transcribe(self, pcm, language=None):  # noqa: ANN001
            return "வணக்கம், எப்படி இருக்கிறீர்கள்?"

    fake_orr = fake_orr_factory([("Vanakkam!", [])])
    p = _pipeline(fake_orr, stt=TamilSTT())

    await p._process_user_turn(_pcm(400))
    assert p.language == "hi"
