"""Lead-context prompt tests: operator notes reach the agent, safely."""
from app.llm.prompts import build_lead_context, build_system_prompt
from app.schemas import AgentPersona


def test_no_lead_gives_no_section():
    assert build_lead_context(None) == ""
    assert build_lead_context({}) == ""
    prompt = build_system_prompt(AgentPersona(name="Bot"), lead={})
    assert "Lead context" not in prompt


def test_name_and_language_injected():
    ctx = build_lead_context({"name": "Amit Sharma", "language": "hi"})
    assert "Amit Sharma" in ctx
    assert "Hindi" in ctx


def test_notes_and_guidelines_variants():
    for key in ("notes", "guidelines", "instructions"):
        ctx = build_lead_context({"extra": {key: "offer 10% discount, polite close"}})
        assert "offer 10% discount" in ctx
        assert "Special instructions" in ctx


def test_extra_fields_listed():
    ctx = build_lead_context({"extra": {"city": "Chennai", "interest": "solar", "notes": "warm lead"}})
    assert "city: Chennai" in ctx
    assert "interest: solar" in ctx
    assert "warm lead" in ctx


def test_full_prompt_contains_section():
    persona = AgentPersona(name="Priya", primary_language="hi")
    lead = {"name": "Lakshmi", "language": "ta", "extra": {"notes": "call after 6pm only"}}
    prompt = build_system_prompt(persona, lead=lead)
    assert "# Lead context (this specific person)" in prompt
    assert "call after 6pm only" in prompt
    assert "Tamil" in prompt


def test_injection_shape_ignored_safely():
    # Odd shapes must not crash — values are interpolated as plain text only.
    ctx = build_lead_context({"name": 42, "extra": {"weird": {"nested": "dict"}}})
    assert "42" in ctx
