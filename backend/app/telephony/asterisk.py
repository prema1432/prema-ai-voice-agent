"""Asterisk ARI (Asterisk REST Interface) client + RTP media session.

Outbound AI call flow:
  1. POST /channels?endpoint=pjsip:trunk/91xxxx&app=freebuff-voice  → originate
  2. StasisStart (dialed channel answered)
  3. POST /channels/externalMedia → RTP media channel into this process
  4. Bridge them → full-duplex audio
  5. RTP arrives here → VoicePipeline; TTS goes back out as RTP
  6. DELETE /channels/{id} or caller hangup (StasisEnd)
"""
from __future__ import annotations

import asyncio
import json
import logging
import socket
import uuid
from typing import Any, Awaitable, Callable

import httpx
import numpy as np

from app import audio as audiomod
from app.config import settings
from app.voice.pipeline import TELEPHONY_FRAME_SAMPLES

log = logging.getLogger(__name__)

RTP_HEADER_LEN = 12


class ARIError(RuntimeError):
    pass


class AsteriskARI:
    """Minimal async ARI client covering what the dialer needs."""

    def __init__(self) -> None:
        self.base = settings.ari_base_url.rstrip("/")
        if not self.base:
            raise ARIError("ARI_BASE_URL is not configured")
        self.app = settings.ari_stasis_app
        self._client = httpx.AsyncClient(
            base_url=self.base,
            auth=(settings.ari_username, settings.ari_password),
            timeout=15.0,
        )

    async def close(self) -> None:
        await self._client.aclose()

    # ── Channels ────────────────────────────────────────────────────────────
    async def originate(
        self,
        number: str,
        caller_id: str | None = None,
        timeout: int | None = None,
        variables: dict[str, Any] | None = None,
    ) -> str:
        """Place an outbound call via the SIP trunk. Returns the channel id."""
        params: dict[str, Any] = {
            "endpoint": f"{settings.sip_trunk_endpoint}/{number}",
            "app": self.app,
            "callerId": caller_id or settings.sip_caller_id,
            "timeout": timeout or settings.dial_timeout_seconds,
        }
        if variables:
            params["variables"] = json.dumps(variables)
        resp = await self._client.post("/channels", params=params)
        if resp.status_code not in (200, 201):
            raise ARIError(f"originate failed: HTTP {resp.status_code} {resp.text[:200]}")
        return resp.json()["id"]

    async def hangup(self, channel_id: str) -> None:
        resp = await self._client.delete(f"/channels/{channel_id}")
        if resp.status_code not in (200, 204, 404):
            raise ARIError(f"hangup failed: HTTP {resp.status_code}")

    async def external_media(
        self, codec: str = "ulaw", direction: str = "both"
    ) -> tuple[str, socket.socket, int]:
        """Create an externalMedia channel; RTP flows to MEDIA_HOST:<port>.

        Binds one UDP socket per call so concurrent calls never interleave.
        Returns (channel_id, bound_socket, local_port).
        """
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.bind(("0.0.0.0", 0))
        port = sock.getsockname()[1]

        params = {
            "app": self.app,
            "external_host": f"{settings.media_host}:{port}",
            "format": "slin16",  # 16-bit signed linear; we encode µ-law at RTP layer
            "encapsulation": "rtp",
            "transport": "udp",
            "direction": direction,
        }
        resp = await self._client.post("/channels/externalMedia", params=params)
        if resp.status_code not in (200, 201):
            sock.close()
            raise ARIError(
                f"externalMedia failed: HTTP {resp.status_code} {resp.text[:200]}"
            )
        return resp.json()["id"], sock, port

    async def create_bridge(self, bridge_type: str = "mixing") -> str:
        resp = await self._client.post("/bridges", params={"type": bridge_type})
        if resp.status_code not in (200, 201):
            raise ARIError(f"bridge create failed: HTTP {resp.status_code}")
        return resp.json()["id"]

    async def add_channel_to_bridge(self, bridge_id: str, channel_id: str) -> None:
        resp = await self._client.post(
            f"/bridges/{bridge_id}/addChannel", params={"channel": channel_id}
        )
        if resp.status_code not in (200, 204):
            raise ARIError(f"bridge add failed: HTTP {resp.status_code}")

    # ── Events ──────────────────────────────────────────────────────────────
    async def open_event_stream(self) -> httpx.Response:
        """Open the long-lived ARI event stream (GET /events)."""
        req = self._client.build_request(
            "GET", "/events", params={"app": self.app, "apiVersion": "ari"}, timeout=None
        )
        resp = await self._client.send(req, stream=True)
        if resp.status_code != 200:
            raise ARIError(f"event subscription failed: HTTP {resp.status_code}")
        return resp


def build_ari() -> AsteriskARI | None:
    """Return a client if telephony is configured, else None (browser-only mode)."""
    if not settings.ari_base_url:
        return None
    try:
        return AsteriskARI()
    except ARIError:
        return None


class RtpSession:
    """One UDP RTP socket: decodes inbound µ-law → PCM, encodes PCM → µ-law out."""

    def __init__(
        self,
        sock: socket.socket,
        on_audio: Callable[[np.ndarray], Awaitable[None]],
    ) -> None:
        self.sock = sock
        self.on_audio = on_audio
        self.remote: tuple[str, int] | None = None
        self._seq = 0
        self._ts = 0
        self._ssrc = uuid.uuid4().int & 0x7FFFFFFF
        self._task: asyncio.Task | None = None
        self._running = False

    def start(self) -> None:
        self._running = True
        self._task = asyncio.get_event_loop().create_task(self._recv_loop())

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        try:
            self.sock.close()
        except OSError:
            pass

    async def _recv_loop(self) -> None:
        loop = asyncio.get_event_loop()
        while self._running:
            try:
                data, _addr = await loop.run_in_executor(None, self.sock.recvfrom, 4096)
            except (OSError, asyncio.CancelledError):
                break
            if len(data) <= RTP_HEADER_LEN:
                continue
            # Learn the remote RTP address from the first inbound packet.
            if self.remote is None and _addr:
                self.remote = (_addr[0], _addr[1])
            pcm = audiomod.ulaw_to_linear(data[RTP_HEADER_LEN:])
            await self.on_audio(pcm)

    async def send(self, pcm8k: np.ndarray) -> None:
        """Send one 20ms PCM frame as an RTP/PCMU packet."""
        if self.remote is None:
            return
        payload = audiomod.linear_to_ulaw(pcm8k)
        header = bytearray(RTP_HEADER_LEN)
        header[0] = 0x80                      # version 2
        header[1] = 0x00                      # payload type 0 = PCMU
        header[2:4] = (self._seq & 0xFFFF).to_bytes(2, "big")
        self._seq = (self._seq + 1) & 0xFFFF
        self._ts = (self._ts + TELEPHONY_FRAME_SAMPLES) & 0xFFFFFFFF
        header[4:8] = self._ts.to_bytes(4, "big")
        header[8:12] = self._ssrc.to_bytes(4, "big")
        try:
            self.sock.sendto(bytes(header) + payload, self.remote)
        except OSError:
            pass
