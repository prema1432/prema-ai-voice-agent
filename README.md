# Prema AI Voice Agent 🎙️

**Self-hosted AI voice-call agent platform for Indian numbers & regional languages.**
Free/open-source stack: self-hosted STT/TTS/VAD, LLM via OpenRouter, MongoDB storage,
Asterisk (optional) for real telephony. No Twilio, no ElevenLabs, no paid STT/TTS APIs.

```
Dashboard (React) ──► FastAPI backend ──► MongoDB (leads, campaigns, call_sessions)
        │                    │
        │                    ├─► OpenRouter (LLM, tool calls, post-call analysis)
        │                    ├─► Self-hosted STT (Whisper / IndicConformer)
        │                    ├─► Self-hosted TTS (Piper / Indic-Parler-TTS)
        │                    └─► Asterisk ARI (optional) ──► SIP trunk ──► PSTN
        └── Browser voice calls (Voice Lab) via WebSocket + mic
```

## Quickstart

### 1. Backend + dashboard + Mongo (browser mode, no telephony)

```bash
cp .env.example .env         # set OPENROUTER_API_KEY; defaults work for the rest
docker compose up --build
# dashboard: http://localhost:8080  ·  API docs: http://localhost:8000/docs
```

Local (no Docker) alternative:

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp ../.env.example ../.env  # edit MONGODB_URI if needed
.venv/bin/uvicorn app.main:app --reload --port 8000

cd ../dashboard && npm install && npm run dev   # http://localhost:5173
```

### 2. Talk to an agent in the browser (no phone needed)

Dashboard → **Voice Lab** → pick a language → *Start talking*.
The pipeline (VAD → STT → LLM → TTS with barge-in) runs exactly as it does on
phone calls, so it's the fastest way to tune prompts and voices.

> Default `STT_BACKEND=mock` / `TTS_BACKEND=mock` run the full loop with silence
> so you can wire everything before downloading models.

### 3. Enable real speech models

```bash
# STT — faster-whisper (good Indic accuracy, runs on CPU)
pip install faster-whisper
# TTS — Piper voices: download hi_IN, ta_IN, bn_IN… into models/piper/
# https://github.com/rhasspy/piper/blob/master/VOICES.md
# High quality (GPU): pip install transformers && STT_BACKEND=indicconformer
```

Then in `.env`:

```
STT_BACKEND=whisper        # or indicconformer (AI4Bharat, 22 languages)
TTS_BACKEND=piper          # or indic_parler (AI4Bharat Indic-Parler-TTS)
VAD_BACKEND=silero         # falls back to energy VAD automatically
```

### 4. Real outbound calls (Asterisk + SIP trunk)

See **[telephony/README.md](telephony/README.md)**. Short version: run the
Asterisk container with a licensed Indian SIP trunk, set `ARI_*` + `MEDIA_HOST`
in `.env`, then create a campaign with `dial_provider: "asterisk"` and press
**Start**. The dialer enforces TRAI calling hours, DND scrubbing, retries and
concurrency limits.

### 5. Load leads

Dashboard → campaign → upload CSV (see [docs/sample-leads.csv](docs/sample-leads.csv)):
`phone,name,language,city,interest` — extra columns are stored on the lead.

## Agent capabilities

- Natural conversation in **Hindi, Hinglish, English + 10 Indian languages**
  with automatic language switching (script detection per user turn).
- **Tool calling** via OpenRouter: `book_appointment`, `set_callback`,
  `update_lead_status`, `request_human_transfer`, `opt_out_dnd`, `end_call`.
- **Barge-in**: caller speech cancels agent speech mid-sentence.
- **Post-call analysis**: LLM-generated summary, outcome classification
  (interested / not_interested / callback_requested / dnd), lead score 0–100.
- Everything persisted in MongoDB: full transcripts, tool-call logs, outcomes.

## MongoDB collections

| Collection | Purpose |
|---|---|
| `campaigns` | name, agent persona + requirements, languages, status, dial provider |
| `leads` | phone (E.164), name, language override, extra CRM fields, status, outcome |
| `call_sessions` | transcript, tool calls, summary, lead score, outcome, timing |
| `agent_configs` | reusable agent personas |
| `appointments`, `callbacks` | written by agent tools during calls |

## API surface

`/campaigns` CRUD + `/start` `/pause` `/stats` · `/leads` CRUD + `/bulk`
`/csv` `/export/csv` · `/calls` list/get + `/calls/start` + `/calls/ws`
(browser voice) · `/agents` CRUD · `/health`. Interactive docs at `/docs`.

## Testing

```bash
cd backend && .venv/bin/python -m pytest     # 31 tests: codec, VAD, prompts, tools, pipeline
```

## Cost picture

| Item | Cost |
|---|---|
| STT / TTS / VAD / orchestration | ₹0 (self-hosted) |
| LLM | OpenRouter — free tiers exist (`:free` models); paid models are cheap |
| MongoDB | free Atlas tier or self-hosted Docker |
| Telephony to real Indian mobiles | the only unavoidable cost — a licensed SIP trunk (₹0.30–0.70/min typical). Dev/test can be ₹0 with browser calls or app-to-app SIP. |

## Compliance (India)

- TRAI TCCCPR: DND scrubbing hook (`app/phone_utils.is_dnd`), 9am–9pm calling
  window enforcement, opt-out tool, AI disclosure in agent prompts.
- Use only DoT-licensed trunks for PSTN termination; present authorized CLI.
- Take consent for recorded calls; recordings/transcripts contain personal data.

## Roadmap ideas

- WebRTC transport (LiveKit/Pipecat style) alongside the WebSocket one
- Streaming TTS (sentence-level chunking to cut first-audio latency)
- Redis-backed multi-worker dialer + call queue
- Fine-tuned IndicConformer + IndicTTS voices per persona
- WhatsApp follow-up tool (via free self-hosted gateways where permissible)
