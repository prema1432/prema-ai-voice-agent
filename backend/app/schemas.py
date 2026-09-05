"""Pydantic models shared across API + pipeline."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from app.schema_additions import TELUGU_PRIMARY, TurnFormat
from pydantic import BaseModel, Field, ConfigDict


# Data formats for turns and campaigns (Telugu-primary):
#   - scripts: list of script ranges (Telugu-native 0x0C00-0x0C7F by default)
#   - formats: list of formats (native -> native script, transliterated -> Latin)
#   - language: primary language code (since primary is Telugu, it defaults to "te")


class Config(BaseModel):
    """Agent persona configuration."""
    name: str
    language: str = TELUGU_PRIMARY
    formats: list[TurnFormat] = Field(default_factory=lambda: ["native"])
    tools: list[str] = Field(default_factory=list)
    voice_id: str | None = None
    rate: float = 1.0
    pitch: float = 1.0
    

    model_config = ConfigDict(arbitrary_types_allowed=True)


class Agent(BaseModel):
    """Full agent record (campaigns can reuse one agent)."""
    name: str
    description: str = ""
    requirements: str = ""
    language: str = TELUGU_PRIMARY
    scripts: list[dict[str, Any]] = Field(default_factory=lambda: [{"script": "Telugu", "start": 0x0C00, "end": 0x0C7F}])
    formats: list[TurnFormat] = Field(default_factory=lambda: ["native"])
    tools: list[str] = Field(default_factory=list)
    voice: dict[str, Any] = Field(default_factory=dict)
    config: Config = Field(default_factory=Config)
    
    model_config = ConfigDict(arbitrary_types_allowed=True)


class Lead(BaseModel):
    """Bedrock lead model."""
    name: str
    phone: str
    language: str = TELUGU_PRIMARY  # Telugu primary per lead; can be overridden
    model_config = ConfigDict(arbitrary_types_allowed=True)
    scripts: list[dict[str, Any]] = Field(default_factory=lambda: [{"script": "Telugu", "start": 0x0C00, "end": 0x0C7F}])
    formats: list[TurnFormat] = Field(default_factory=lambda: ["native"])
    notes: str = ""  # operator notes for this lead (name, language, etc)
    extra: dict[str, Any] = Field(default_factory=dict)  # additional CRM fieldsmodel_config = ConfigDict(arbitrary_types_allowed=True)


class Call(BaseModel):
    """Single call record."""
    campaign_id: str
    model_config = ConfigDict(arbitrary_types_allowed=True)
    lead_id: str | None = None
    phone: str
    language: str = TELUGU_PRIMARY
    formats: list[TurnFormat] = Field(default_factory=lambda: ["native"])
    status: str = "new"
    started_at: datetime | None = None
    ended_at: datetime | None = None
    transcript: list[dict[str, Any]] = Field(default_factory=list)
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    outcome: str | None = None
    summary: str | None = None
    model_config = ConfigDict(arbitrary_types_allowed=True)


from pydantic import BaseModel, ConfigDict, Field


class Config(BaseModel):
    """Global app configuration (loaded once)."""
    name: str = "Prema AI Voice Agent Telugu"
    model_config = ConfigDict(arbitrary_types_allowed=True)
    language: str = TELUGU_PRIMARY
    scripts: list[dict[str, Any]] = Field(default_factory=lambda: [{"script": "Telugu", "start": 0x0C00, "end": 0x0C7F}])
    formats: list[TurnFormat] = Field(default_factory=lambda: ["native"])
    tools: list[str] = Field(default_factory=list)
    voice: dict[str, Any] = Field(default_factory=dict)
    
    model_config = ConfigDict(arbitrary_types_allowed=True)


def _get_scripts(text: str) -> list[dict[str, Any]]:  # noqa: ARG001 (unused param)
    """Return the list of script ranges used in a turn."""
    return [{"script": "Telugu", "start": 0x0C00, "end": 0x0C7F}]


def _get_formats(text: str) -> list[TurnFormat]:
    """Return the list of turn formats (native/transliterated) used."""
    return [turn_format(text)]


def _get_turn_format(text: str) -> TurnFormat:
    """Return the TurnFormat for a given turn (native or transliterated)."""
    return "native" if is_native_telugu(text) else "transliterated"
from pydantic import BaseModel, Field, ConfigDict, Field

# ── Languages ────────────────────────────────────────────────────────────────
# BCP-47 style tags aligned with AI4Bharat / Bhashini conventions.
LANGUAGES: dict[str, str] = {
    "hi": "Hindi",
    "en": "English",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "ml": "Malayalam",
    "bn": "Bengali",
    "mr": "Marathi",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "or": "Odia",
    "as": "Assamese",
    "ur": "Urdu",
    "hinglish": "Hinglish (Hindi-English code-mix)",
}

LanguageCode = str  # validated against LANGUAGES at the edges

# Telugu-primary platform: see schema_additions.py for canonical forms & formats.

# Data formats for turns: plain text is the default; 'transliterated' stores
# Latin-script rendering (e.g. Telugu in wx or IndicTrans-style romanization)
# alongside the native script.
TurnFormat = Literal["native", "transliterated"]  # noqa: F821 placeholder


# ── Agent ────────────────────────────────────────────────────────────────────
class AgentPersona(BaseModel):
    """Reusable agent definition: persona + goals + tools + voice."""
    name: str
    description: str = ""
    # Natural-language requirements, e.g. "Polite sales agent for XYZ home loans.
    # Qualify budget, book a visit, close if possible."
    requirements: str = ""
    system_prompt: str | None = None  # full override; built from requirements if absent
    primary_language: str = TELUGU_PRIMARY  # Telugu — default language for all agents/campaigns/leads
    # Ordered fallbacks, e.g. ["hi", "hinglish", "en"]
    fallback_languages: list[str] = Field(default_factory=lambda: ["hinglish", "en"])
    auto_language_switch: bool = True
    voice: dict[str, Any] = Field(default_factory=dict)  # backend-spefic: speaker, rate...
    tools_enabled: list[str] = Field(default_factory=list)  # e.g. ["book_appointment"]
    max_call_seconds: int = 600
    # Turn format for this agent's transcript: 'native' (Telugu script) or
    # 'transliterated' (Latin rendering for operators, logs, search).
    turn_format: TurnFormat = "native"
    # ── Agent directory (dashboard "Agents" page) ──────────────────────────
    gender: Literal["male", "female"] = "female"
    # Dynamic specialization: default catalog (Telecalling, Sales/Closing, …)
    # or any custom label the operator types.
    specialization: str = "Telecalling"
    avatar: str | None = None  # URL (e.g. DiceBear) — UI falls back to initials
    accent: str = "indigo"  # avatar gradient theme


class AgentConfigIn(BaseModel):
    persona: AgentPersona


# ── Campaign ─────────────────────────────────────────────────────────────────
CampaignStatus = Literal["draft", "scheduled", "running", "paused", "completed"]


class CampaignIn(BaseModel):
    name: str
    description: str = ""
    # Telugu primary: campaigns default to Telugu unless overridden per-lead
    language: str = TELUGU_PRIMARY  # Telugu-primary default
    preview_url: str | None = None
    active: bool = True
    creator: str | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    config: Config = Field(default_factory=Config)
    scripts: list[str] = Field(default_factory=lambda: [{"script": "Telugu", "start": 0x0C00, "end": 0x0C7F}])
    formats: list[TurnFormat] = Field(default_factory=lambda: ["native"])
    agent_config_id: str | None = None
    # Inline agent definition (used if agent_config_id is None)
    agent: AgentPersona | None = None
    languages: list[str] = Field(default_factory=lambda: ["hi"])
    concurrency: int = Field(default=1, ge=1, le=50)
    # ── Run scheduling & goals ───────────────────────────────────────────────
    schedule_start: datetime | None = None
    schedule_end: datetime | None = None   # optional auto-pause time
    expected_leads: int | None = Field(default=None, ge=1, le=1_000_000)
    # Team of agent-directory agents to spin. When set, the dialer rotates
    # through these personas across calls instead of using the inline agent.
    team_agent_ids: list[str] = Field(default_factory=list)
    # Execution backend: "mock" runs the pipeline without telephony, "asterisk"
    # places real calls via ARI.
    dial_provider: Literal["mock", "asterisk"] = "mock"


class CampaignOut(BaseModel):
    id: str
    name: str
    description: str = ""
    status: CampaignStatus = "draft"
    languages: list[str] = Field(default_factory=list)
    concurrency: int = 1
    dial_provider: str = "mock"
    agent: AgentPersona | None = None
    agent_config_id: str | None = None
    stats: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None


# ── Campaign scheduling ─────────────────────────────────────────────────────
class CampaignScheduleIn(BaseModel):
    """Schedule a campaign to auto-run at a future time with spin + goals."""
    schedule_start: datetime
    schedule_end: datetime | None = None
    expected_leads: int | None = Field(default=None, ge=1, le=1_000_000)
    # How many agent sessions to spin concurrently (max simultaneous calls).
    concurrency: int = Field(default=1, ge=1, le=50)
    # Agent-directory team to rotate across calls (empty = inline campaign agent).
    team_agent_ids: list[str] = Field(default_factory=list)


# ── Leads ────────────────────────────────────────────────────────────────────
LeadStatus = Literal[
    "new", "dialing", "in_progress", "completed", "failed", "dnd", "skipped"
]


class LeadIn(BaseModel):
    phone: str                      # E.164 without '+', e.g. 919876543210
    name: str | None = None
    language: str | None = None     # override campaign language for this lead
    extra: dict[str, Any] = Field(default_factory=dict)  # CRM-ish custom fields


class LeadBulkIn(BaseModel):
    leads: list[LeadIn] = Field(min_length=1, max_length=5000)
    upsert: bool = True  # re-adding a phone updates extra fields instead of failing


class LeadUpdateIn(BaseModel):
    """Partial update for a single lead (all fields optional)."""
    phone: str | None = None
    name: str | None = None
    language: str | None = None
    status: str | None = None
    stage: str | None = None
    # free-form notes / guidelines shown to the agent on the next call
    notes: str | None = None
    extra: dict[str, Any] | None = None


class LeadOut(BaseModel):
    id: str
    campaign_id: str
    phone: str
    name: str | None = None
    language: str | None = None
    status: LeadStatus = "new"
    extra: dict[str, Any] = Field(default_factory=dict)
    last_outcome: str | None = None
    last_call_at: datetime | None = None
    call_count: int = 0
    created_at: datetime | None = None


# ── Call sessions ────────────────────────────────────────────────────────────
CallStatus = Literal["queued", "dialing", "ringing", "in_progress", "completed", "failed"]
CallOutcome = Literal[
    "connected", "no_answer", "busy", "failed", "interested", "not_interested",
    "callback_requested", "dnd", "voicemail", "unknown",
]


class CallStartIn(BaseModel):
    """Start a single call (browser/MockTelephony or Asterisk)."""
    campaign_id: str | None = None
    agent: AgentPersona | None = None      # ad-hoc agent if no campaign
    lead_id: str | None = None
    phone: str | None = None               # used to synthesize a lead if needed
    provider: Literal["mock", "asterisk"] | None = None  # default: campaign or settings
    language: str | None = None
    # Ad-hoc lead info for one-off calls (no stored lead): name, notes/guidelines
    # and any extra fields the operator wants the agent to know. The agent sees
    # this via the system prompt's '# Lead context' section.
    lead_context: dict[str, Any] | None = None


class CallSessionOut(BaseModel):
    id: str
    campaign_id: str | None = None
    lead_id: str | None = None
    phone: str | None = None
    agent_name: str | None = None
    status: CallStatus = "queued"
    outcome: CallOutcome | None = None
    language: str | None = None
    transcript: list[dict[str, Any]] = Field(default_factory=list)
    summary: str | None = None
    lead_score: int | None = None
    recording_path: str | None = None
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: int | None = None
    error: str | None = None


class TranscriptTurn(BaseModel):
    role: Literal["agent", "user", "system"]
    text: str
    language: str | None = None
    at: datetime = Field(default_factory=datetime.utcnow)
