# AGENTS.md — orientation for AI & human contributors

Prema AI Voice Agent is a self-hosted platform for AI voice-call agents over
Indian phone numbers, with a full CRM-style lead pipeline on top.

## Quickstart

```bash
# Backend (FastAPI + MongoDB)
cd backend
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
./.venv/bin/python -m uvicorn app.main:app --port 8000        # needs MongoDB + .env

# Dashboard (React + Vite)
cd dashboard && npm install && npm run dev                     # http://localhost:5173
```

Copy `.env.example` → `.env` and set `OPENROUTER_API_KEY`. MongoDB defaults to
`mongodb://localhost:27017/prema_voice` (see `backend/app/config.py`).

## Where things live

| Concern | Path |
| --- | --- |
| HTTP API routers | `backend/app/routers/` |
| Business logic (calls, dialer, events) | `backend/app/services/` |
| Voice pipeline + VAD/STT/TTS | `backend/app/voice/` |
| LLM (OpenRouter), prompts, tools | `backend/app/llm/` |
| Event bus (audit/notify/integrations) | `backend/app/events.py` |
| Pages (views) | `dashboard/src/views/` |
| Shared UI kit | `dashboard/src/components.tsx` |
| API client + types | `dashboard/src/api.ts` |
| Routing | `dashboard/src/router.ts` |
| Conventions (READ FIRST) | `docs/PROJECT_RULES.md` |
| Architecture notes | `docs/ARCHITECTURE.md` |

## Non-negotiables

1. Read `docs/PROJECT_RULES.md` — especially the 500-line/file cap and the
   layering (routers thin, services own logic).
2. Backend tests must stay **offline**: fake the OpenRouter transport, never
   touch real MongoDB/network in tests. Run: `./.venv/bin/python -m pytest -q`.
3. Dashboard must pass `npm run build` (tsc + vite). Fix type errors, don't
   silence them.
4. No new paid SaaS in the hot path and no new dependencies unless the rules
   doc says otherwise.
5. No debug leftovers, no generated co-author trailers in commits.
6. Run `python3 scripts/check-lines.py` before committing.

## Mental model

One `VoicePipeline` = one call = VAD → STT → LLM (OpenRouter) → TTS, wired to a
transport (browser WS / Asterisk / tests) through an `AudioSink` interface.
Campaigns are dialed by an in-process runner per campaign. Everything worth
knowing lands in MongoDB; `app/events.py` fans events out to audit logs,
notifications and enabled integrations (webhook/WhatsApp/SMS/…) with a FIFO
delivery worker.
