"""Audio utilities: G.711 codec (µ-law / A-law) and PCM resampling.

G.711 is the standard codec for telephony (Asterisk/RTP). Pure-numpy
implementations, self-consistent encode/decode (quantization error ≤ half step).
"""
from __future__ import annotations

import numpy as np

BIAS = 0x84      # 132: bias for u-law quantization
CLIP = 32635     # max magnitude before clipping in u-law encoding


# ── µ-law ────────────────────────────────────────────────────────────────────
def linear_to_ulaw(pcm: np.ndarray) -> bytes:
    """Encode 16-bit linear PCM (int16 numpy array) to G.711 µ-law bytes."""
    samples = np.asarray(pcm, dtype=np.int32)
    sign = np.where(samples < 0, 0x80, 0x00).astype(np.int32)
    mag = np.minimum(np.abs(samples), CLIP) + BIAS

    exponent = np.zeros_like(mag)
    for exp in range(1, 8):
        exponent[mag >= (1 << (exp + 7))] = exp
    mantissa = (mag >> (exponent + 3)) & 0x0F

    ulaw = ~(sign | (exponent << 4) | mantissa)
    return ulaw.astype(np.uint8).tobytes()


def ulaw_to_linear(data: bytes) -> np.ndarray:
    """Decode G.711 µ-law bytes to 16-bit linear PCM (int16 numpy array)."""
    ulaw = (~np.frombuffer(data, dtype=np.uint8)).astype(np.int32)
    sign = ulaw & 0x80
    exponent = (ulaw >> 4) & 0x07
    mantissa = ulaw & 0x0F
    magnitude = ((mantissa << 3) + BIAS) << exponent
    pcm = np.where(sign == 0, magnitude, -magnitude) - BIAS
    return np.clip(pcm, -32768, 32767).astype(np.int16)


# ── A-law ────────────────────────────────────────────────────────────────────
_ALAW_DECODE: np.ndarray | None = None
_ALAW_ENCODE: np.ndarray | None = None


def _alaw_decode_table() -> np.ndarray:
    """256-entry decode table. Convention: XOR 0x55 then sign bit 0x80 → negative."""
    global _ALAW_DECODE
    if _ALAW_DECODE is not None:
        return _ALAW_DECODE
    table = np.zeros(256, dtype=np.int32)
    for i in range(256):
        a = i ^ 0x55
        sign = a & 0x80
        exponent = (a & 0x70) >> 4
        mantissa = a & 0x0F
        if exponent == 0:
            magnitude = (mantissa << 4) + 8
        else:
            magnitude = ((mantissa << 4) + 0x108) << (exponent - 1)
        table[i] = -magnitude if sign else magnitude
    _ALAW_DECODE = table.astype(np.int16)
    return _ALAW_DECODE


def _alaw_encode_table() -> np.ndarray:
    """Magnitude (0..32767) → byte, nearest decodable value from the decode table.

    Built from the decode table itself, so encode∘decode is provably consistent
    (error ≤ half the local quantization step).
    """
    global _ALAW_ENCODE
    if _ALAW_ENCODE is not None:
        return _ALAW_ENCODE
    dec = _alaw_decode_table().astype(np.int64)
    pos = sorted((int(v), i) for i, v in enumerate(dec) if v > 0)
    vals = np.array([v for v, _ in pos], dtype=np.int64)
    codes = np.array([i for _, i in pos], dtype=np.int64)

    mags = np.arange(0, 32768, dtype=np.int64)
    j = np.clip(np.searchsorted(vals, mags), 1, len(vals) - 1)
    left, right = vals[j - 1], vals[j]
    choose_left = (mags - left) <= (right - mags)
    enc = np.where(choose_left, codes[j - 1], codes[j]).astype(np.uint8)
    _ALAW_ENCODE = enc
    return _ALAW_ENCODE


def linear_to_alaw(pcm: np.ndarray) -> bytes:
    """Encode 16-bit linear PCM to G.711 A-law bytes (nearest decodable value)."""
    samples = np.asarray(pcm, dtype=np.int32)
    sign = np.where(samples < 0, 0x80, 0x00).astype(np.int32)
    mag = np.minimum(np.abs(samples), 32767)
    # enc_table yields the transmitted byte for +mag (XOR 0x55 already applied);
    # negative values flip only the sign bit of the transmitted byte.
    alaw = _alaw_encode_table()[mag].astype(np.int32) ^ sign
    return alaw.astype(np.uint8).tobytes()


def alaw_to_linear(data: bytes) -> np.ndarray:
    return _alaw_decode_table()[np.frombuffer(data, dtype=np.uint8)].copy()


CODECS = {
    "ulaw": (linear_to_ulaw, ulaw_to_linear),
    "alaw": (linear_to_alaw, alaw_to_linear),
}


# ── Resampling ───────────────────────────────────────────────────────────────
def resample(pcm: np.ndarray, src_rate: int, dst_rate: int) -> np.ndarray:
    """Linear-interpolation resample of int16 mono PCM (e.g. 48k mic → 8k phone)."""
    if src_rate == dst_rate:
        return pcm
    x = np.asarray(pcm, dtype=np.float32)
    n_src, n_dst = len(x), int(round(len(x) * dst_rate / src_rate))
    if n_src == 0 or n_dst == 0:
        return np.zeros(n_dst, dtype=np.int16)
    indices = np.linspace(0, n_src - 1, num=n_dst)
    out = np.interp(indices, np.arange(n_src), x)
    return np.clip(out, -32768, 32767).astype(np.int16)


def bytes_to_int16(data: bytes) -> np.ndarray:
    return np.frombuffer(data, dtype=np.int16)


def int16_to_bytes(pcm: np.ndarray) -> bytes:
    return np.asarray(pcm, dtype=np.int16).tobytes()
