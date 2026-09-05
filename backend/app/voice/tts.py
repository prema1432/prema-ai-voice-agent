"""Text-to-speech wrappers: Piper (fast CPU) and Indic-Parler-TTS (quality).

Self-hosted only. Piper ships small per-language onnx voices — ideal for
low-latency telephony. Indic-Parler-TTS gives higher naturalness with a GPU.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Protocol

import numpy as np

from app.config import settings

log = logging.getLogger(__name__)

SAMPLE_RATE = 24000  # pipeline runs TTS at 24k, resamples per transport


class TTS(Protocol):
    def synth(self, text: str, language: str) -> np.ndarray: ...


class MockTTS:
    """Silence generator for tests/demo — no model needed."""

    def __init__(self, seconds: float = 1.0) -> None:
        self.seconds = seconds

    def synth(self, text: str, language: str) -> np.ndarray:
        n = int(SAMPLE_RATE * self.seconds * max(1, len(text) // 40))
        return np.zeros(n, dtype=np.int16)


class PiperTTS:
    """Piper onnx voices: hi_IN, ta_IN, bn_IN etc. from rhasspy piper-voices repo."""

    def __init__(self) -> None:
        from piper import PiperVoice  # local import (optional dep)

        import glob

        voices = sorted(glob.glob(settings.tts_piper_voices_dir + "/*.onnx"))
        if not voices:
            raise RuntimeError(
                f"No Piper voices found in {settings.tts_piper_voices_dir}. "
                "Download from https://github.com/rhasspy/piper-phonemize (hi_IN etc.)"
            )
        self.voices: dict[str, PiperVoice] = {}
        for path in voices:
            name = path.split("/")[-1]  # e.g. hi_IN-swara-medium.onnx
            lang = name.split("_")[0]
            self.voices[lang] = PiperVoice.load(path)
        self._lock = asyncio.Lock()

    def _voice_for(self, language: str) -> PiperVoice | None:
        return self.voices.get((language or "hi").split("-")[0]) or next(iter(self.voices.values()))

    async def synth(self, text: str, language: str) -> np.ndarray:
        async with self._lock:
            voice = self._voice_for(language)

            def _run() -> np.ndarray:
                chunks: list[np.ndarray] = []
                for chunk in voice.synthesize_stream_raw(text):
                    chunks.append(np.frombuffer(chunk, dtype=np.int16))
                return np.concatenate(chunks) if chunks else np.zeros(1, dtype=np.int16)

            return await asyncio.to_thread(_run)


class IndicParlerTTS:
    """AI4Bharat Indic-Parler-TTS — best open Indic naturalness (needs GPU)."""

    def __init__(self) -> None:
        import torch
        from transformers import AutoTokenizer, ParlerTTSForConditionalGeneration

        self.desc_tokenizer = AutoTokenizer.from_pretrained(settings.tts_hf_model_id)
        self.tokenizer = AutoTokenizer.from_pretrained(settings.tts_hf_model_id)
        self.model = ParlerTTSForConditionalGeneration.from_pretrained(
            settings.tts_hf_model_id
        ).to(settings.tts_device)
        self.model.eval()
        self._lock = asyncio.Lock()

    async def synth(self, text: str, language: str) -> np.ndarray:
        async with self._lock:
            def _run() -> np.ndarray:
                import torch

                description = (
                    f"{language} speaking voice, natural conversational pace, warm tone, clear audio"
                )
                inputs = self.desc_tokenizer(description, return_tensors="pt").to(self.model.device)
                prompt = self.tokenizer(text, return_tensors="pt").to(self.model.device)
                with torch.no_grad():
                    audio = self.model.generate(
                        input_ids=inputs.input_ids,
                        attention_mask=inputs.attention_mask,
                        prompt_input_ids=prompt.input_ids,
                        prompt_attention_mask=prompt.attention_mask,
                    )
                wave = audio.cpu().numpy().squeeze().astype(np.float32)
                wave = np.clip(wave, -1.0, 1.0)
                return (wave * 32767).astype(np.int16)

            return await asyncio.to_thread(_run)


def make_tts(backend: str | None = None) -> TTS:
    backend = (backend or settings.tts_backend).lower()
    if backend == "piper":
        return PiperTTS()
    if backend in ("indic_parler", "indic-parler", "ai4bharat", "vexyl-tts"):
        return IndicParlerTTS()
    return MockTTS()
