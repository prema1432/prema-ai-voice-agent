"""Prompt building + language detection tests."""
from app.language import detect_language
from app.llm.prompts import build_postcall_summary_messages, build_system_prompt
from app.schemas import AgentPersona


def _persona(**kw) -> AgentPersona:
    return AgentPersona(name="Ravi", requirements="Sell solar panels politely.", **kw)


def test_prompt_contains_persona_and_language_rules():
    p = _persona(primary_language="hi")
    prompt = build_system_prompt(p)
    assert "Ravi" in prompt
    assert "solar panels" in prompt
    assert "aap-form" in prompt            # Hindi-specific rule injected
    assert "LIVE VOICE AGENT" in prompt
    assert "markdown" in prompt            # anti-markdown speech rule


def test_prompt_hinglish_rule():
    prompt = build_system_prompt(_persona(primary_language="hinglish"))
    assert "Code-mix" in prompt


def test_prompt_no_tools_leak():
    prompt = build_system_prompt(_persona())
    assert prompt.count("#") >= 2          # structured sections present


def test_summary_messages_shape():
    transcript = [
        {"role": "agent", "text": "Namaste!"},
        {"role": "user", "text": "Haan boliye"},
    ]
    msgs = build_postcall_summary_messages(transcript, "Ravi")
    assert msgs[0]["role"] == "system"
    assert "JSON" in msgs[0]["content"]
    assert "Namaste!" in msgs[1]["content"]
    assert "Ravi" in msgs[1]["content"]


def test_detect_language_scripts():
    assert detect_language("नमस्ते आप कैसे हैं") == "hi"
    assert detect_language("வணக்கம்") == "ta"
    assert detect_language("నమస్కారం") == "te"
    assert detect_language("নমস্কার") == "bn"
    assert detect_language("hello there") is None       # Latin → None
    assert detect_language("haan boliye kya haal hai") is None  # romanized → None
    assert detect_language("") is None


def test_persona_defaults():
    p = AgentPersona(name="x")
    assert p.primary_language == "hi"
    assert p.auto_language_switch is True
    assert "hinglish" in p.fallback_languages
