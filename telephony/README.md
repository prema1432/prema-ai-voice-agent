# Telephony (Asterisk + SIP trunk)

This folder contains a ready-to-run Asterisk 20 setup wired for the backend's
ARI dialer (`app/telephony/asterisk.py`).

## 1. Why Asterisk + ARI

The backend places calls through the [Asterisk REST Interface (ARI)](https://docs.asterisk.org/Asterisk_18_Documentation/API_Documentation/ARI/):
originate → bridge an `externalMedia` RTP channel → your Python pipeline
handles VAD/STT/LLM/TTS on the raw audio. No paid telephony SDK involved.

## 2. Quick start (dev)

1. Edit `configs/pjsip.conf` with your SIP trunk credentials.
2. Build + run:

```bash
docker build -t prema-asterisk ./telephony/asterisk
docker run --network host -e ARI_PASSWORD=change-me-ari-password prema-asterisk
```

3. Point the backend at it in `.env`:

```
ARI_BASE_URL=http://<asterisk-host>:8088
ARI_USERNAME=ari_user
ARI_PASSWORD=change-me-ari-password
ARI_STASIS_APP=prema-ai-voice-agent
MEDIA_HOST=<ip reachable from asterisk>
SIP_TRUNK_ENDPOINT=pjsip:trunk
```

4. Health-check the dialer path:

```bash
curl http://localhost:8000/health   # "telephony": "asterisk"
```

## 3. Call flow recap

```
Backend (Python)                      Asterisk
────────────────                      ────────
POST /channels (originate)  ────────► dial SIP trunk → customer
POST /channels/externalMedia ───────► RTP UDP socket ↔ media channel
POST /bridges + addChannel    ──────► customer ⟷ externalMedia
RTP in: caller µ-law frames ────────► ulaw_to_linear → VAD → STT → LLM
RTP out: TTS → linear_to_ulaw ──────► caller hears the agent
DELETE /channels/{id}        ───────► hangup
```

## 4. India compliance (important)

- **Licensing**: Termination to Indian PSTN/mobile numbers requires a
  DoT-licensed OSP/UL-VNO arrangement. For production use a licensed SIP
  trunk provider; free SIP accounts (iptel.org etc.) are fine for
  app-to-app/dev testing only.
- **TRAI TCCCPR / DND**: scrub your lead lists against the DND registry
  (via your provider's DLT scrubbing API) before dialing; hook it in
  `app/phone_utils.is_dnd()`.
- **Calling hours**: default 9am–9pm IST enforced in
  `app/phone_utils.is_within_call_window()` — configurable via
  `CALL_WINDOW_START/END`.
- **Consent & recordings**: inform callers (the agent prompt does this via
  the "AI disclosure" rule), store recordings lawfully, honor opt-outs
  (`opt_out_dnd` tool).
- **Caller ID**: only present your own authorized numbers.

## 5. Sizing

| Concurrent calls | CPU (STT/TTS on GPU) | Network |
|------------------|----------------------|---------|
| 5–10             | 4 vCPU + 1 GPU       | ~1 Mbps |
| 25–50            | 8 vCPU + 1–2 GPU     | ~5 Mbps |

Each call consumes ~64 kbps G.711 RTP each way plus the GPU/CPU for models.
