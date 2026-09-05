"""Core duplex voice-agent loop.

One `VoicePipeline` runs one call. It wires: VAD → STT → OpenRouter LLM
(streaming, tool calls) → TTS → an abstract AudioSink, with barge-in
(caller speech cancels pending agent speech) and full transcript capture.

Inbound frames are serialized through an asyncio.Queue + worker task, so VAD,
barge-in and end-of-turn detection never race. The same pipeline serves the
browser WebSocket transport, the Asterisk ARI transport and tests — only the
AudioSink differs.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Protocol

import numpy as np

from app import audio as audiomod
from app.language import detect_language
from app.llm import openrouter as orr
from app.llm.prompts import build_system_prompt
from app.llm.tools import ALL_TOOLS, ToolBox
from app.voice import stt as stt_mod
from app.voice import tts as tts_mod
from app.voice.vad import EnergyVAD, VAD

log = logging.getLogger(__name__)

AGENT_SAMPLE_RATE = 24000   # TTS native rate
TELEPHONY_SAMPLE_RATE = 8000
TELEPHONY_FRAME_MS = 20
TELEPHONY_FRAME_SAMPLES = 160   # 20ms at 8kHz

END_OF_TURN_SILENCE = 0.55      # seconds of silence that close a user turn
MIN_UTTERANCE_MS = 250          # ignore blips shorter than this
MAX_TURN_SECONDS = 12           # force-flush very long rambling utterances


class AudioSink(Protocol):
    """Where synthesized agent speech goes (browser WS, RTP, or a test buffer)."""

    def send_audio(self, pcm8k: np.ndarray) -> None: ...

    def on_interrupt(self) -> None: ...


class NullSink:
    """Placeholder sink replaced by the transport before audio flows."""

    def send_audio(self, pcm8k: np.ndarray) -> None:
        pass

    def on_interrupt(self) -> None:
        pass


class VoicePipeline:
    def __init__(
        self,
        persona: Any,
        sink: AudioSink | None = None,
        toolbox: ToolBox | None = None,
        vad: VAD | None = None,
        stt: stt_mod.STT | None = None,
        tts: tts_mod.TTS | None = None,
        model: str | None = None,
        max_call_seconds: int = 600,
        lead: Any = None,
    ) -> None:
        self.persona = persona
        self.sink = sink or NullSink()
        self.toolbox = toolbox or ToolBox()
        self.vad = vad or EnergyVAD()
        self.stt = stt or stt_mod.make_stt("mock")
        self.tts = tts or tts_mod.make_tts("mock")
        self.model = model
        self.max_call_seconds = max_call_seconds
        self.lead = lead

        # Conversation state
        self.messages: list[dict[str, Any]] = [
            {"role": "system", "content": build_system_prompt(persona, lead=lead)}
        ]
        self.transcript: list[dict[str, Any]] = []
        self.language: str = getattr(persona, "primary_language", "hi")
        self.tool_calls_log: list[dict[str, Any]] = []
        self.ended: bool = False
        self.end_reason: str | None = None
        self.error: str | None = None

        # Barge-in / playback state
        self._generation = 0      # bumped on barge-in; stale playback aborts
        self._speaking = False

        # User utterance accumulation
        self._user_buf: list[np.ndarray] = []
        self._user_speaking = False
        self._silence_samples = 0   # silence buffered since last voice frame

        self._started_at = time.monotonic()
        self._queue: asyncio.Queue[np.ndarray | None] = asyncio.Queue(maxsize=2000)
        self._worker: asyncio.Task | None = None

    # ── Lifecycle ───────────────────────────────────────────────────────────
    def start(self) -> None:
        """Start the audio worker. Call once after wiring the sink."""
        if self._worker is None:
            self._worker = asyncio.get_event_loop().create_task(self._audio_worker())

    async def close(self) -> None:
        self.ended = True
        self._generation += 1
        if self._worker:
            self._worker.cancel()
            try:
                await self._worker
            except asyncio.CancelledError:
                pass
            self._worker = None

    # ── Inbound audio ───────────────────────────────────────────────────────
    def feed_audio(self, pcm: np.ndarray, sample_rate: int = 8000) -> None:
        """Receive caller audio (PCM16 mono). Never blocks the caller's thread."""
        if self.ended or self._worker is None:
            return
        if sample_rate != 16000:
            pcm = audiomod.resample(pcm, sample_rate, 16000)
        try:
            self._queue.put_nowait(pcm)
        except asyncio.QueueFull:
            log.warning("audio queue full — dropping frame")

    async def _audio_worker(self) -> None:
        """Single consumer: VAD, barge-in detection, end-of-turn flush."""
        while True:
            pcm = await self._queue.get()
            if self.ended:
                return
            now = time.monotonic()

            speech = await self.vad.is_speech(pcm)

            # Barge-in: caller voice while agent is talking cancels playback.
            if speech and self._speaking:
                self._generation += 1
                self._speaking = False
                self.sink.on_interrupt()
                self.messages.append({
                    "role": "system",
                    "content": "The caller interrupted you mid-sentence. "
                               "Stop and respond to what they just said.",
                })

            if speech:
                if not self._user_speaking:
                    self._user_speaking = True
                    self._silence_samples = 0
                self._user_buf.append(pcm)
                self._silence_samples = 0
            elif self._user_speaking:
                # Keep trailing silence in the buffer so STT gets natural audio.
                self._user_buf.append(pcm)
                self._silence_samples += len(pcm)

            if self._user_speaking:
                voiced_ms = self._voiced_ms()
                silence_ms = self._silence_samples / 16.0   # 16kHz → ms
                turn_ms = sum(len(f) for f in self._user_buf) / 16.0
                if (
                    voiced_ms >= MIN_UTTERANCE_MS
                    and (silence_ms >= END_OF_TURN_SILENCE * 1000
                         or turn_ms >= MAX_TURN_SECONDS * 1000)
                ):
                    self._flush_user_turn()

    def _voiced_ms(self) -> float:
        """Rough voiced duration: total buffered audio minus trailing silence."""
        total_ms = sum(len(f) for f in self._user_buf) / 16.0  # 16kHz → ms
        return total_ms

    def _flush_user_turn(self) -> None:
        audio = np.concatenate(self._user_buf)
        self._user_buf = []
        self._user_speaking = False
        asyncio.get_event_loop().create_task(self._process_user_turn(audio))

    # ── STT + LLM turn ──────────────────────────────────────────────────────
    async def _process_user_turn(self, audio: np.ndarray) -> None:
        gen = self._generation
        try:
            text = await self.stt.transcribe(audio, language=self.language)
        except Exception:  # noqa: BLE001 — a failed STT must not kill the call
            log.exception("STT failed")
            return

        text = (text or "").strip()
        if not text:
            return

        # Auto language switch on detected Indic script
        if getattr(self.persona, "auto_language_switch", True):
            detected = detect_language(text)
            if detected and detected != self.language:
                log.info("language switch %s → %s", self.language, detected)
                self.language = detected

        self.messages.append({"role": "user", "content": text})
        self.transcript.append({
            "role": "user", "text": text, "language": self.language,
            "at": datetime.now(timezone.utc),
        })

        await self._run_llm(gen)

    async def _run_llm(self, gen: int) -> None:
        """One LLM turn: stream reply, speak it, run tools, chain as needed."""
        for _ in range(4):  # cap chained tool calls per user turn
            if self.ended or gen != self._generation:
                return
            tools = ALL_TOOLS if getattr(self.persona, "tools_enabled", []) else None
            try:
                result = await orr.chat_stream_collected(
                    self.messages, model=self.model, tools=tools, max_tokens=200,
                )
            except orr.OpenRouterError as exc:
                log.error("OpenRouter error: %s", exc)
                fallback = (
                    "Sorry, mujhe abhi connect karne mein dikkat ho rahi hai. "
                    "Main ek minute mein wapas call karti hoon."
                )
                # Surface the failure in the transcript so UIs (Voice Lab, call
                # logs) don't show a silently-empty conversation.
                self.transcript.append({
                    "role": "agent", "text": fallback, "language": self.language,
                    "at": datetime.now(timezone.utc),
                })
                self.error = f"LLM unavailable: {exc}"
                await self._speak_text(fallback, gen)
                return

            reply = result.content.strip()
            if reply:
                self.messages.append({"role": "assistant", "content": reply})
                self.transcript.append({
                    "role": "agent", "text": reply, "language": self.language,
                    "at": datetime.now(timezone.utc),
                })
                await self._speak_text(reply, gen)
                if gen != self._generation or self.ended:
                    return

            if not result.tool_calls:
                return

            # Per OpenAI/OpenRouter protocol: assistant message with tool_calls,
            # then one role=tool message per call.
            assistant_msg: dict[str, Any] = {"role": "assistant", "content": reply or None}
            assistant_msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.name, "arguments": tc.arguments or "{}"},
                }
                for tc in result.tool_calls
                if tc.complete()
            ]
            self.messages.append(assistant_msg)

            for tc in result.tool_calls:
                if not tc.complete():
                    continue
                try:
                    args = json.loads(tc.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                outcome = await self.toolbox.dispatch(tc.name, tc.arguments or "{}")
                self.tool_calls_log.append({
                    "name": tc.name, "arguments": args, "result": outcome,
                    "at": datetime.now(timezone.utc),
                })
                self.messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(outcome),
                })

                if tc.name == "end_call":
                    farewell = args.get("farewell") or "Dhanyavaad! Aapka din shubh ho."
                    if not reply:
                        await self._speak_text(farewell, gen)
                    self.ended = True
                    self.end_reason = "agent_end_call"
                    return
                if tc.name == "opt_out_dnd":
                    self.ended = True
                    self.end_reason = "dnd_opt_out"
                    return

    # ── Speech synthesis ────────────────────────────────────────────────────
    async def _speak_text(self, text: str, gen: int) -> None:
        """Synthesize text and stream to the sink in realtime-paced frames."""
        if not text or self.ended:
            return
        try:
            pcm = await asyncio.to_thread(self.tts.synth, text, self.language)
        except Exception:  # noqa: BLE001
            log.exception("TTS failed")
            return
        if gen != self._generation or self.ended:
            return  # barged in or call ended while synthesizing
        await self._stream_audio(pcm, gen)

    async def _stream_audio(self, pcm24k: np.ndarray, gen: int) -> None:
        """Resample TTS audio to 8kHz and stream in 20ms frames, paced."""
        self._speaking = True
        try:
            pcm8k = audiomod.resample(pcm24k, AGENT_SAMPLE_RATE, TELEPHONY_SAMPLE_RATE)
            step = TELEPHONY_FRAME_SAMPLES * 4   # 80ms per await → fewer wakeups
            for i in range(0, len(pcm8k), step):
                if gen != self._generation or self.ended:
                    return
                self.sink.send_audio(pcm8k[i:i + step])
                await asyncio.sleep((step / TELEPHONY_SAMPLE_RATE) * 0.98)
        finally:
            if gen == self._generation:
                self._speaking = False

    # ── Helpers ─────────────────────────────────────────────────────────────
    async def greet(self) -> None:
        """Opening line — LLM generates it so it matches persona + language."""
        self.start()
        self.messages.append({
            "role": "user",
            "content": "(The call was just answered. Give your natural opening greeting.)",
        })
        await self._run_llm(self._generation)

    async def run_until_idle(self) -> None:
        """Wait until agent speech playback finishes (test/dry-run helper)."""
        while self._speaking:
            await asyncio.sleep(0.05)

    def summary_snapshot(self) -> dict[str, Any]:
        return {
            "transcript": self.transcript,
            "tool_calls": self.tool_calls_log,
            "language": self.language,
            "end_reason": self.end_reason,
            "error": self.error,
            "duration_seconds": int(time.monotonic() - self._started_at),
        }
