# Prema AI Voice Agent — Project Rules & Guidelines

These rules are binding for every contributor (human or AI). The goal is a
codebase that stays **simple, layered, testable and self-hosted**.

## 1. Repository layout

```
backend/   FastAPI + Motor (MongoDB) — routers thin, services own logic
dashboard/ React + Vite + TypeScript — views own a page, shared UI in components/
telephony/ Asterisk configs & notes (optional, for real PSTN)
scripts/   repo hygiene tools (e.g. check-lines.py)
docs/      rules & architecture notes
```

Backend layering (keeps every module single-purpose — S in SOLID):

- `app/routers/` — HTTP only: parse the request, call a service, return JSON.
- `app/services/` — business logic: calls, dialer, summarizer, events.
- `app/voice/` — pipeline + VAD/STT/TTS engines behind small interfaces.
- `app/llm/` — OpenRouter client, prompt builders, tools.
- `app/` root modules — schemas, config, db access, phone utils, events bus.

## 2. File size guideline (500 lines max)

- Every source file (`.py`, `.ts`, `.tsx`, `.css`) **must stay ≤ 500 lines**.
- Enforcement: `python3 scripts/check-lines.py` (run it before every commit).
- When a file approaches the cap, split it into focused modules:
  - Frontend: extract hooks (`useX.ts`), dumb presentational components, and
    keep the route page as an assembler under 500 lines.
  - Backend: extract services/handlers per responsibility.

## 3. Code conventions

- **TypeScript/React**: one page per `views/<Name>.tsx`; reusable UI in
  `components/`; state and async logic in hooks, not inline in JSX.
  `components.tsx` is the shared kit (Card, Badge, Button, Avatar…); new shared
  primitives belong there or in a purpose-named component file.
- **Python**: type hints everywhere; `from __future__ import annotations`;
  routers stay thin; DB writes via `app.db.collection()` helpers; imports that
  could create cycles are done at function level with a comment.
- No dead imports, no `console.log`/`print` debug leftovers, no commented-out
  blocks. Remove what you do not use.
- Commit messages: concise summary of **why**, one line + body. No generated
  co-author trailers. English only.

## 4. SOLID principles in practice

- **S**ingle responsibility — routers parse; services decide; engines speak.
- **O**pen/Closed — add a webhook integration type = one row in the catalog;
  add an event type = one name in `app/events.EVENTS` + subscribers. Callers
  never change.
- **L**iskov — VAD/STT/TTS/AudioSink are protocols; transports implement them
  identically (WS vs Asterisk share one `VoicePipeline`).
- **I**nterface segregation — engines expose exactly what the pipeline needs
  (`synth`, `transcribe`, `is_speech`, `send_audio`).
- **D**ependency inversion — pipeline depends on engine *interfaces*, dialer
  depends on `get_provider(name)`, pages depend on `api.*` not fetch().

## 5. DSA awareness (what we already use — keep it deliberate)

- `asyncio.Queue` FIFO for webhook deliveries + call audio frames
  (bounded — never unbounded buffers).
- Sets / hash lookups for DND scrub, lead-dedupe and index-backed queries;
  Mongo compound unique indexes guarantee one lead per campaign+phone.
- The events bus is an **observer** with fan-out; audit log is append-only
  (immutable history). Do not turn these into blocking RPC.

## 6. Notifications, integrations & CRM architecture

- `app/events.py` is the only writer of the `audit_logs`, `notifications` and
  `delivery_logs` collections. Call `audit()`/`notify()`/`emit()` from routers
  and services; never write those collections directly.
- Notification channels: `in_app` always stored; `email/sms/whatsapp/push`
  require an enabled integration of that type — status per channel is recorded
  on the notification document.
- Integrations are **dynamic**: type catalog + per-record config + event
  subscriptions. Outbound = HTTP POST through the FIFO worker; inbound = the
  per-integration `/integrations/in/{token}` receive URL.
- CRM pipeline stages live on the campaign document (`crm_stages`); moving a
  lead to a terminal stage (`won`/`lost`) marks the lead completed.
- Every mutating endpoint records an audit row — if you add one, add the
  `audit(...)` call in the same change.

## 7. Dependency policy

- Everything must be self-hostable and free (no paid SaaS in the hot path).
  OpenRouter is the only external LLM call; all STT/TTS/VAD are local engines.
- Prefer **no new dependency** when the standard library / existing stack
  suffices (native HTML5 drag-and-drop instead of a DnD library, etc.).
- If a new library is genuinely required: pin it, keep it in `package.json`
  via the project package manager, and update these rules with the rationale.
- React/Vite/TypeScript stay on current stable majors; bump deliberately and
  re-run `npm run build` + backend tests.

## 8. Testing

- Backend tests are **fully offline** (fake OpenRouter in `tests/conftest.py`).
  New domain logic must come with offline unit tests (see `test_platform.py`).
- Before pushing: `python3 scripts/check-lines.py`,
  `cd dashboard && npm run build`, `cd backend && .venv/bin/python -m pytest -q`.
