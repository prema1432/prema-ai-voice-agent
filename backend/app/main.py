"""FastAPI application entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import close_db, connect_db
from app.routers import agents, calls, campaigns, leads

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    log.info("connected to MongoDB at %s/%s", settings.mongo_uri, settings.mongo_db)

    # Resume dialers for campaigns that were 'running' before a restart —
    # runners live in-process, so without this they silently die on redeploy.
    from app.db import collection
    from app.services import dialer

    running = await collection("campaigns").find(
        {"status": "running"}, {"_id": 1}
    ).to_list(100)
    for doc in running:
        cid = str(doc["_id"])
        log.info("resuming dialer for campaign %s", cid)
        dialer.start_campaign(cid)

    yield
    from app.services import dialer

    for campaign_id in list(dialer.RUNNERS):
        dialer.stop_campaign(campaign_id)
    await close_db()
    log.info("shutdown complete")


app = FastAPI(
    title="Freebuff Voice",
    description=(
        "Self-hosted AI voice-call agent platform for Indian numbers & regional "
        "languages. STT/TTS/VAD self-hosted, LLM via OpenRouter, storage in MongoDB."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router)
app.include_router(campaigns.router)
app.include_router(leads.router)
app.include_router(calls.router)


@app.get("/health")
async def health() -> dict:
    from app.telephony.asterisk import build_ari

    return {
        "ok": True,
        "app": settings.app_name,
        "env": settings.env,
        "stt_backend": settings.stt_backend,
        "tts_backend": settings.tts_backend,
        "vad_backend": settings.vad_backend,
        "llm_model": settings.openrouter_llm_model,
        "llm_key_set": bool(settings.openrouter_api_key),
        "telephony": "asterisk" if settings.ari_base_url else "browser-only (no ARI)",
    }
