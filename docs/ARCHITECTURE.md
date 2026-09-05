# Architecture notes

## Call flow

```
Campaign runner / Voice Lab (WS) / HTTP /start
        │  start_adhoc_call() / create_call_session()
        ▼
VoicePipeline (VAD → STT → OpenRouter LLM + tools → TTS)  →  AudioSink
        │
        └─ persist_call_result()  → call_sessions doc + lead outcome
                └─ events: audit("call.ended") · notify() · emit("call.ended")
```

Everything (campaigns, leads, call sessions, transcripts, summaries, agent
directory, audit, notifications, integrations) lives in MongoDB under the
`prema_voice` database.

## Event bus (`app/events.py`)

Three async, exception-isolated writers:

| Writer | Purpose |
| --- | --- |
| `audit(action, entity, meta)` | append-only `audit_logs` row per meaningful action |
| `notify(title, body, channels)` | `notifications` row; per-channel delivery status |
| `emit(event, payload)` | fan-out to enabled integrations subscribed to `event` |

Outbound deliveries are FIFO (`asyncio.Queue` + worker) with an HTTP POST
(`X-Webhook-Secret` when set); every attempt is recorded in `delivery_logs`.
`start_delivery_worker()` is started in the FastAPI lifespan.

## Notification channels

`in_app` is always delivered (bell + feed page). `email`, `sms`, `whatsapp`,
`push`, `webhook` are delivered only when an **enabled integration** of that
type exists — the status map (`sent` / `pending` / `skipped:no provider`) on
each notification tells the operator exactly what happened and why.

## Integrations

Dynamic, catalog-driven (`app/routers/integrations.py`). Adding a type = one
catalog entry (icon, label, config fields). Each instance has:

- `type`, `name`, `enabled`
- `config.url` + `config.secret`
- `events` subscription list (or `*`)
- `token` → public inbound URL `/api/integrations/in/{token}`

Any external system can push into the app through that inbound URL; the payload
is logged and (when it looks human-facing) becomes a notification.

## CRM pipeline

Stages are stored per campaign as `crm_stages` (id, name, color, terminal).
Default funnel: New → Contacted → Qualified → Proposal → Won / Lost.
Each lead carries a `stage`; drag-and-drop on the board calls
`POST /campaigns/{id}/crm/move`, which records `lead.moved` in audit + events
and marks leads completed when they reach a terminal stage.

## SOLID & DSA mapping

See `docs/PROJECT_RULES.md` §4–5 for the exact principles the code follows.
