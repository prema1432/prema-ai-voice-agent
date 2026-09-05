"""Application configuration loaded from environment variables."""
from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

# Load .env (if present) BEFORE reading any env vars.
load_dotenv(override=False)

FREE_MODEL_FALLBACKS = [
    "z-ai/glm-5.2:free",
    "minimax/minimax-m3:free",
    "deepseek/deepseek-r1:free",
    "minimax/minimax-m2.7:free",
]

def _bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        self.app_name: str = os.getenv("APP_NAME", "prema-ai-voice-agent")
        self.env: str = os.getenv("ENV", "development")

        # MongoDB
        self.mongo_uri: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        self.mongo_db: str = os.getenv("MONGODB_DB", "prema_voice")

        # OpenRouter
        self.openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
        self.openrouter_base_url: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        self.openrouter_llm_model: str = os.getenv("OPENROUTER_LLM_MODEL", "minimax/minimax-m3:free")
        self.openrouter_summary_model: str = os.getenv("OPENROUTER_SUMMARY_MODEL", self.openrouter_llm_model)
        self.openrouter_app_url: str = os.getenv("OPENROUTER_APP_URL", "")
        # Reasoning controls. Displayed in the LLM dashboard and sent to the API
        # only when non-empty (few :free providers accept it).
        self.openrouter_thinking_effort: str = os.getenv("OPENROUTER_THINKING_EFFORT", "low")
        self.openrouter_send_reasoning: bool = _bool(
            os.getenv("OPENROUTER_SEND_REASONING_EFFORT"), False
        )
        # Cost monitoring switches
        self.llm_usage_enabled: bool = _bool(os.getenv("LLM_USAGE_ENABLED"), True)
        self.free_model_fallbacks: list[str] = FREE_MODEL_FALLBACKS
        self.auto_rotate_on_429: bool = os.getenv("FREE_MODEL_AUTO_ROTATE", "true").strip().lower() in {"1","true","yes","on"}

        # STT
        self.stt_backend: str = os.getenv("STT_BACKEND", "mock")
        self.stt_model_size: str = os.getenv("STT_MODEL_SIZE", "small")
        self.stt_device: str = os.getenv("STT_DEVICE", "cpu")
        self.stt_compute_type: str = os.getenv("STT_COMPUTE_TYPE", "int8")
        self.stt_hf_model_id: str = os.getenv("STT_HF_MODEL_ID", "ai4bharat/IndicConformer")

        # TTS
        self.tts_backend: str = os.getenv("TTS_BACKEND", "mock")
        self.tts_device: str = os.getenv("TTS_DEVICE", "cpu")
        self.tts_piper_voices_dir: str = os.getenv("TTS_PIPER_VOICES_DIR", "./models/piper")
        self.tts_hf_model_id: str = os.getenv("TTS_HF_MODEL_ID", "ai4bharat/indic-parler-tts")

        # VAD
        self.vad_backend: str = os.getenv("VAD_BACKEND", "silero")

        # Telephony
        self.ari_base_url: str = os.getenv("ARI_BASE_URL", "")
        self.ari_username: str = os.getenv("ARI_USERNAME", "")
        self.ari_password: str = os.getenv("ARI_PASSWORD", "")
        self.ari_stasis_app: str = os.getenv("ARI_STASIS_APP", "prema-ai-voice-agent")
        self.media_host: str = os.getenv("MEDIA_HOST", "127.0.0.1")
        self.media_port: int = int(os.getenv("MEDIA_PORT", "20000"))
        self.sip_caller_id: str = os.getenv("SIP_CALLER_ID", "prema-ai-voice-agent")
        self.sip_trunk_endpoint: str = os.getenv("SIP_TRUNK_ENDPOINT", "pjsip:trunk")
        self.dial_timeout_seconds: int = int(os.getenv("DIAL_TIMEOUT_SECONDS", "45"))

        # Compliance
        self.call_timezone: str = os.getenv("CALL_TIMEZONE", "Asia/Kolkata")
        self.call_window_start: int = int(os.getenv("CALL_WINDOW_START", "9"))
        self.call_window_end: int = int(os.getenv("CALL_WINDOW_END", "21"))
        self.scrub_dnd_enabled: bool = _bool(os.getenv("SCRUB_DND_ENABLED"), True)
        self.max_concurrent_calls: int = int(os.getenv("MAX_CONCURRENT_CALLS", "3"))

        # Media
        self.recording_dir: str = os.getenv("RECORDING_DIR", "./recordings")


def get_settings() -> Settings:
    return Settings()


def reload_settings() -> Settings:
    get_settings.cache_clear()
    return Settings()


settings = get_settings()
