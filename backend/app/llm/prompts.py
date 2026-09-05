"""System-prompt construction for Telugu-first Indic voice agents.

The agent is Telugu-primary by default. If it detects Hindi or Devanagari script
in the caller's speech, it switches to Hindi; if it detects English (Latin text
without Indic script) it stays/support English. Code-switching (Hinglish) is allowed
only when the caller is mixing scripts across two turns; otherwise the agent mirrors
the caller's script exactly.

Script floors:
  - Telugu native script (0x0C00-0x0C7F) → the agent speaks Telugu
  - Devanagari (0x0900-0x097F) → Hindi
  - Latin script only (no Indian script at all) → English / Hinglish as appropriate

The system prompt enforces the floor, language-switching timing, and the
operator's business requirements.
"""
from __future__ import annotations

from typing import Any

from app.schema_additions import TELUGU_PRIMARY
from pydantic import BaseModel
from typing import Literal
from app.schemas import LANGUAGES


DETECTION_FLOOR_RULES = [
    ("Telugu (తెలుగు) native script 0x0C00–0x0C7F",
     "the caller is speaking Telugu script; reply ONLY in Telugu script "
     "(native Telugu Unicode, 0x0C00–0x0C7F). Never switch to Hindi or English "
     "just because the caller used a word that happens to be common across languages. "
     "Mirror Telugu script exactly."),
    ("Devanagari script (0x0900–0x097F, Hindi/Marathi)",
     "the caller is speaking Devanagari-script Hindi (or Marathi). Reply in "
     "DEVANAGARI Hindi only. If the caller says a Telugu word, still answer in "
     "Hindi. Do NOT switch to Telugu script unless the caller switches back to "
     "Telugu script for two consecutive turns."),
    ("Latin script only (no Indian script)",
     "the caller is speaking English, Hinglish, or romanized Indic. Reply in "
     "English or Hinglish as appropriate — natural code-mix is allowed — but "
     "keep the reply in Latin script (no Telugu/Devanagari Unicode output) to "
     "match the caller's literacy level."),
]

CODE_SWITCH_RULE = (
    "Language/Script switching rule:\n"
    "- The agent starts in Telugu script (see below).\n"
    "- On every user turn, check which script the caller used.\n"
    "    * Telugu script → force Reply Language: Telugu script.\n"
    "    * Devanagari script → force Reply Language: Hindi (Devanagari script).\n"
    "    * Latin script only → allow English/Hinglish (Latin script) replies.\n"
    "- Do NOT switch languages across one turn unless the caller actually used "
    "the new script for TWO consecutive user turns. This keeps the conversation "
    "natural and avoids flickering between Telugu and Hindi mid-dialogue.\n"
    "- Within a turn, code-mix is allowed (e.g., Hinglish) if it matches the "
    "caller's mix — but ALWAYS keep the output script aligned with the caller's.\n"
    "- If unsure which script the caller used but they typed in Latin script, "
    "stay in English/Hinglish (Latin output)."
)


def build_system_prompt(persona: Any, lead: dict | None = None) -> str:
    name = getattr(persona, "name", None) or "Telugu Voice Agent"
    requirements = (getattr(persona, "requirements", "") or "").strip()
    primary = getattr(persona, "primary_language", TELUGU_PRIMARY)
    fallbacks = getattr(persona, "fallback_languages", ["hinglish", "en"]) or []
    auto_switch = bool(getattr(persona, "auto_language_switch", True))
    turn_format = getattr(persona, "turn_format", "native")

    parts = [
        "You are a LIVE VOICE AGENT on a real phone call in India. "
        "You speak; you never write to the caller.\n"
        "Voice-agent basics:\n"
        "- Keep every reply 1–2 short sentences (under 25 words) unless reading out "
        "a number, address, or price.\n"
        "- Use natural Indian phone-conversation punctuation — no markdown, emojis, "
        "bullet points, or stage directions. Speech only.\n"
        "- One question at a time. Wait for the answer before the next.\n"
        "- If the caller interrupts you (barge-in), stop mid-sentence gracefully and "
        "listen.\n"
        "- Never use markdown, emojis, bullet points, or stage directions. Speech only.\n"
        "- If asked whether you are AI, answer honestly and briefly, then continue.\n"
        "- If the caller is angry or asks not to be called, apologize once, mark it, "
        "and end politely.\n",
        f"\n# Language & script floor (Telugu-primary)\n"
        f"Primary language: {TELUGU_PRIMARY} (Telugu).\n"
        "On every user turn, determine which script the caller used and follow the "
        "script floor below. The default reply language is Telugu script.\n",
        _script_floor_table(),
        "\n" + CODE_SWITCH_RULE,
        ("\n# Operating instructions\n"
         f"Agent name: {name}."),
    ]
    if requirements:
        parts.append(f"\nBusiness requirements from operator:\n{requirements}")
    persona_prompt = getattr(persona, "system_prompt", None)
    if persona_prompt:
        parts.append("\n# Operator override prompt (highest priority)\n" + persona_prompt)

    if auto_switch:
        parts.append(
            "\n# Auto language-switch (hard script floor)\n"
            "Detect the caller's script on each turn and switch ONLY when the floor "
            "rules above require it. Never switch just because of a single shared word. "
            "Mirror the caller's script exactly."
        )
    if lead:
        parts.extend(_lead_context_block(lead))

    parts.append(
        "\n# Call goal\n"
        "Achieve the business goal conversationally. Confirm key details by repeating "
        "them once. If not interested, close politely and mark it."
    )
    return "\n".join(parts) + "\n"


def _script_floor_table() -> str:
    rows = ["Script floor (pick ONE for the whole reply):"]
    for header, rule in DETECTION_FLOOR_RULES:
        rows.append(f"\n**{header}**\n{rule}")
    return "\n".join(rows)


def _lead_context_block(lead: dict) -> list[str]:
    lines: list[str] = []
    name = lead.get("name")
    if name:
        lines.append(f"\n#Lead context (who you are talking to)\nLead name: {name} — address them respectfully by name.")
    lang = lead.get("language")
    if lang and lang != TELUGU_PRIMARY:
        lines.append(f"Lead's preferred language: {LANGUAGES.get(lang, lang)} — open in this language.")
    notes = (lead.get("extra") or {}).get("notes")
    if notes:
        lines.append(f"Special instructions about this lead: {notes}")
    return lines


def build_postcall_summary_messages(
    transcript: list[dict[str, Any]],
    agent_name: str = "Agent",
) -> list[dict[str, Any]]:
    lines = []
    for turn in transcript:
        who = "Agent" if turn.get("role") == "agent" else "Caller"
        lines.append(f"{who}: {turn.get('text', '')}")
    joined = "\n".join(lines) or "(no speech captured)"
    return [
        {
            "role": "system",
            "content": (
                "You are a call QA analyst for Indian voice-agent calls. Given the "
                "transcript (may be Telugu/Hindi/English/Hinglish), reply in STRICT "
                "JSON only (no markdown fences, no extra keys):\n"
                '{"summary": str (2-3 sentences, English), '
                '"outcome": one of ["interested","not_interested","callback_requested",'
                '"dnd","unknown"], '
                '"lead_score": int 0-100, '
                '"next_action": str (one short sentence)}\n'
            ),
        },
        {"role": "user", "content": f"Agent: {agent_name}\n\nTranscript:\n{joined}"},
    ]
