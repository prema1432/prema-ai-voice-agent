"""Speech-to-text wrappers: faster-whisper (Indic-friendly) and AI4Bharat IndicConformer.

Both run fully self-hosted — no paid API calls. The mock backend returns a fixed
string so the pipeline can be exercised end-to-end without models installed.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Protocol

import numpy as np

from app.config import settings

log = logging.getLogger(__name__)


class STT(Protocol):
    async def transcribe(self, pcm16k: np.ndarray, language: str | None = None) -> str: ...


class MockSTT:
    """Deterministic transcript for tests/demo — never loads a model."""

    def __init__(self, text: str = "haan boliye") -> None:
        self.text = text

    async def transcribe(self, pcm16k: np.ndarray, language: str | None = None) -> str:
        return self.text


class WhisperSTT:
    """faster-whisper on CTranslate2 — good Indic accuracy at small/medium sizes."""

    def __init__(self) -> None:
        from faster_whisper import WhisperModel  # local import (optional dep)

        log.info("loading whisper model size=%s device=%s", settings.stt_model_size, settings.stt_device)
        self.model = WhisperModel(
            settings.stt_model_size,
            device=settings.stt_device,
            compute_type=settings.stt_compute_type,
        )
        self._lock = asyncio.Lock()

    async def transcribe(self, pcm16k: np.ndarray, language: str | None = None) -> str:
        # Model inference is not thread-safe; serialize per instance.
        async with self._lock:
            segments, _info = await asyncio.to_thread(
                self.model.transcribe,
                pcm16k,
                language=language if language not in (None, "hinglish") else None,
                beam_size=1,
                vad_filter=False,   # pipeline already applies its own VAD
                condition_on_previous_text=False,
            )
            texts = [seg.text.strip() for seg in segments]
            return " ".join(t for t in texts if t)


class IndicConformerSTT:
    """AI4Bharat IndicConformer — 22 Indian languages, CTC onnx/transformers."""

    def __init__(self) -> None:
        import torch  # noqa: F401
        from transformers import AutoModelForCTC, AutoProcessor

        self.processor = AutoProcessor.from_pretrained(settings.stt_hf_model_id)
        self.model = AutoModelForCTC.from_pretrained(settings.stt_hf_model_id)
        self.model.to(settings.stt_device)
        self.model.eval()
        self._lock = asyncio.Lock()

    async def transcribe(self, pcm16k: np.ndarray, language: str | None = None) -> str:
        async with self._lock:
            def _run() -> str:
                import torch

                inputs = self.processor(
                    pcm16k.astype(np.float32) / 32768.0, sampling_rate=16000, return_tensors="pt"
                )
                with torch.no_grad():
                    logits = self.model(inputs.input_values.to(self.model.device)).logits
                # IndicConformer needs the language id for best results; default hi.
                lang_ids = self.processor.model.lang_ids
                lid = lang_ids.get(language or "hi", lang_ids.get("hi"))
                decoded = self.processor.batch_decode(logits.numpy(), lang_ids=[lid])
                return decoded[0].strip()

            return await asyncio.to_thread(_run)


def make_stt(backend: str | None = None) -> STT:
    backend = (backend or settings.stt_backend).lower()
    if backend == "whisper":
        return WhisperSTT()
    if backend in ("indicconformer", "ai4bharat", "vexyl-stt"):
        return IndicConformerSTT()
    return MockSTT()
