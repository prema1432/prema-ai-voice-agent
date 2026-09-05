"""G.711 codec + resampler round-trip tests."""
import numpy as np
import pytest

from app import audio


def _tone(freq: int, ms: int, rate: int = 8000) -> np.ndarray:
    t = np.linspace(0, ms / 1000, int(rate * ms / 1000), endpoint=False)
    return (np.sin(2 * np.pi * freq * t) * 12000).astype(np.int16)


@pytest.mark.parametrize("encode,decode", [
    (audio.linear_to_ulaw, audio.ulaw_to_linear),
    (audio.linear_to_alaw, audio.alaw_to_linear),
])
def test_g711_round_trip(encode, decode):
    pcm = _tone(440, 100)
    encoded = encode(pcm)
    assert isinstance(encoded, bytes)
    assert len(encoded) == len(pcm)          # 1 byte per sample
    decoded = decode(encoded)
    assert len(decoded) == len(pcm)
    # G.711 is lossy but should stay within ~2% of full scale for a mid tone
    err = np.max(np.abs(decoded.astype(np.int32) - pcm.astype(np.int32)))
    assert err < 800, f"max codec error {err}"


def test_ulaw_silence_and_clip():
    silence = np.zeros(160, dtype=np.int16)
    dec = audio.ulaw_to_linear(audio.linear_to_ulaw(silence))
    assert np.abs(dec).max() <= 100

    loud = np.full(160, 32767, dtype=np.int16)
    dec = audio.ulaw_to_linear(audio.linear_to_ulaw(loud))
    assert np.abs(dec).max() > 30000


def test_resample_length_and_dc():
    pcm = _tone(1000, 100, rate=48000)
    out = audio.resample(pcm, 48000, 8000)
    assert len(out) == 800                   # 100ms at 8k
    assert out.dtype == np.int16
    # DC signal must survive resampling unchanged-ish
    dc = np.full(480, 1000, dtype=np.int16)
    out_dc = audio.resample(dc, 8000, 16000)
    assert abs(int(out_dc.mean()) - 1000) < 50
