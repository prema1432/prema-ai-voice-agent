"""Voice activity detection: Silero VAD with an energy-based fallback.

Silero gives robust speech detection; the energy fallback runs anywhere
(including CPU-only boxes without torch installed).
"""
from __future__ import annotations

import logging
from collections import deque
from typing import Protocol

import numpy as np

log = logging.getLogger(__name__)

try:  # optional heavy dependency
    import torch
    _TORCH_OK = True
except Exception:  # pragma: no cover
    _TORCH_OK = False

SILERO_MODEL_URL = (
    "https://github.com/snakers4/silero-vad/raw/master/src/silero_vad/data/silero_vad.onnx"
)


class VAD(Protocol):
    async def is_speech(self, pcm16k: np.ndarray) -> bool: ...


class EnergyVAD:
    """RMS + adaptive noise-floor energy detector — dependency-free."""

    def __init__(self, threshold: float = 0.006, hangover_ms: int = 300,
                 adaptive_cap: float = 0.08) -> None:
        self.threshold = threshold
        self.hangover = max(1, hangover_ms // 30)  # 30ms frames
        self.adaptive_cap = adaptive_cap           # ceiling for the adaptive floor
        self._recent: deque[float] = deque(maxlen=100)

    async def is_speech(self, pcm16k: np.ndarray) -> bool:
        x = np.asarray(pcm16k, dtype=np.float32) / 32768.0
        rms = float(np.sqrt(np.mean(x * x)) if len(x) else 0.0)
        self._recent.append(rms)
        # Adaptive floor: 25th percentile of recent frames, capped so a burst
        # of loud speech can never push the threshold above real speech.
        floor = float(np.percentile(list(self._recent), 25)) if self._recent else 0.0
        effective = min(max(self.threshold, floor * 3.0), self.adaptive_cap)
        return rms > effective


class SileroVAD:
    """Silero via ONNX runtime (no torch needed at runtime with onnxruntime)."""

    def __init__(self, onnx_path: str | None = None) -> None:
        import onnxruntime  # local import; optional dependency

        self.session = onnxruntime.InferenceSession(
            onnx_path or "silero_vad.onnx", providers=["CPUExecutionProvider"]
        )
        self._state = np.zeros((2, 1, 128), dtype=np.float32)
        self._context = np.zeros((1, 64), dtype=np.float32)
        self._hangover = 0

    def reset(self) -> None:
        self._state[:] = 0
        self._context[:] = 0
        self._hangover = 0

    async def is_speech(self, pcm16k: np.ndarray) -> bool:
        # Silero expects 16kHz mono float32; chunks of 512 samples are ideal.
        x = np.concatenate([self._context, pcm16k.astype(np.float32) / 32768.0])
        x = x[None, :]
        ort_inputs = {
            "input": x,
            "state": self._state,
            "sr": np.array(16000, dtype=np.int64),
        }
        out, state = self.session.run(None, ort_inputs)
        self._state = state
        self._context = x[:, -64:].copy()
        speech = bool(out[0][0] > 0.5)
        if speech:
            self._hangover = 8  # ~240ms hangover keeps words from clipping
        elif self._hangover > 0:
            self._hangover -= 1
            speech = True
        return speech


def make_vad(backend: str | None = None) -> VAD:
    backend = (backend or __import__("app.config", fromlist=["settings"]).settings.vad_backend).lower()
    if backend == "silero":
        try:
            return SileroVAD()
        except Exception as exc:  # noqa: BLE001
            log.warning("Silero VAD unavailable (%s); falling back to EnergyVAD", exc)
    return EnergyVAD()
