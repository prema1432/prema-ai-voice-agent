"""Telephony provider abstraction.

`MockProvider` runs calls without any telephony (tests / browser flow).
`AsteriskProvider` places real outbound calls via ARI. The dialer only talks
to this interface, so adding another trunk/SBC later is one class away.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable

import numpy as np

from app.config import settings
from app.voice.pipeline import AudioSink, VoicePipeline

log = logging.getLogger(__name__)


class AudioSinkAdapter(AudioSink):
    """Bridges VoicePipeline sink calls to an async RTP/socket sender."""

    def __init__(self, send_fn, interrupt_cb=None) -> None:
        self._send = send_fn
        self._interrupt = interrupt_cb

    def send_audio(self, pcm: np.ndarray) -> None:
        self._send(pcm)

    def on_interrupt(self) -> None:
        if self._interrupt:
            self._interrupt()


class TelephonyProvider:
    """Place a call and run a VoicePipeline over it. Returns call metadata."""

    name = "base"

    async def place_call(
        self,
        phone: str,
        pipeline: VoicePipeline,
        on_hangup: Callable[[], None] | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError


class MockProvider(TelephonyProvider):
    """Simulated call: greets, then waits for the pipeline to end.

    Used by tests and by the dashboard "dry run" mode — no real audio.
    """

    name = "mock"

    async def place_call(
        self,
        phone: str,
        pipeline: VoicePipeline,
        on_hangup: Callable[[], None] | None = None,
    ) -> dict[str, Any]:
        sink = AudioSinkAdapter(lambda pcm: None)
        pipeline.sink = sink
        await pipeline.greet()
        # Dry run ends after the greeting so campaign tests finish instantly.
        pipeline.ended = True
        pipeline.end_reason = "mock_dry_run"
        return {"provider": self.name, "connected": True, "hangup": on_hangup}


class AsteriskProvider(TelephonyProvider):
    """Real outbound calls through Asterisk ARI + externalMedia RTP."""

    name = "asterisk"

    def __init__(self) -> None:
        from app.telephony.asterisk import AsteriskARI, build_ari

        self.ari: AsteriskARI | None = build_ari()
        if self.ari is None:
            raise RuntimeError("Asterisk ARI is not configured (ARI_BASE_URL missing)")

    async def place_call(
        self,
        phone: str,
        pipeline: VoicePipeline,
        on_hangup: Callable[[], None] | None = None,
    ) -> dict[str, Any]:
        assert self.ari is not None

        # 1. RTP socket for this call
        from app.telephony.asterisk import RtpSession

        media_channel_id, sock, port = await self.ari.external_media()
        rtp = RtpSession(sock, on_audio=pipeline.feed_audio)
        sink = AudioSinkAdapter(
            lambda pcm: asyncio.get_event_loop().create_task(rtp.send(pcm)),
            interrupt_cb=None,
        )
        pipeline.sink = sink

        # 2. Dial the customer
        customer_channel = await self.ari.originate(phone)
        log.info("originated %s → channel %s", phone, customer_channel)

        # 3. Bridge media channel + customer channel (after answer).
        #    In production you'd await StasisStart events; the sample dialer
        #    in app/services/dialer.py handles the event-driven version.
        bridge_id = await self.ari.create_bridge()
        await self.ari.add_channel_to_bridge(bridge_id, customer_channel)
        await self.ari.add_channel_to_bridge(bridge_id, media_channel_id)

        rtp.start()
        await pipeline.greet()

        return {
            "provider": self.name,
            "connected": True,
            "channel_id": customer_channel,
            "media_channel_id": media_channel_id,
            "bridge_id": bridge_id,
            "rtp_port": port,
        }

    async def hangup(self, channel_id: str) -> None:
        assert self.ari is not None
        await self.ari.hangup(channel_id)


def get_provider(name: str | None) -> TelephonyProvider:
    name = (name or "").lower()
    if name == "asterisk":
        return AsteriskProvider()
    if name == "mock":
        return MockProvider()
    # Auto-detect: use Asterisk if configured, else mock.
    if settings.ari_base_url:
        return AsteriskProvider()
    return MockProvider()
