"""Lead-context prompt tests: operator notes reach the agent, safely."""
from app.llm.prompts import build_system_prompt
from app.schemas import AgentPersona


def test_no_lead_gives_no_section():
    prompt = build_system_prompt(AgentPersona(name="Bot"), lead=None)
    assert "Lead name" not in prompt
    prompt2 = build_system_prompt(AgentPersona(name="Bot"), lead={})
    assert "Lead name" not in prompt2


def test_name_injected():
    prompt = build_system_prompt(AgentPersona(name="Priya"), lead={"name": "Amit Sharma"})
    assert "Amit Sharma" in prompt


def test_notes_injected():
    # The canonical "notes" key inside extra reaches the agent verbatim.
    prompt = build_system_prompt(
        AgentPersona(name="Priya"),
        lead={"extra": {"notes": "offer 10% discount, polite close"}},
    )
    assert "offer 10% discount" in prompt
    assert "polite close" in prompt


def test_full_prompt_contains_section():
    persona = AgentPersona(name="Priya", primary_language="hi")
    lead = {"name": "Lakshmi", "language": "ta", "extra": {"notes": "call after 6pm only"}}
    prompt = build_system_prompt(persona, lead=lead)
    assert "Lakshmi" in prompt
    assert "call after 6pm only" in prompt
    assert "Tamil" in prompt


def test_injection_shape_ignored_safely():
    # Odd shapes must not crash — values are interpolated as plain text only.
    prompt = build_system_prompt(
        AgentPersona(name="Priya"),
        lead={"name": 42, "extra": {"weird": {"nested": "dict"}}},
    )
    assert "42" in prompt
