"""Summarizer JSON parsing tests."""
from app.services.summarizer import parse_analysis


def test_plain_json():
    out = parse_analysis(
        '{"summary": "Interested in solar", "outcome": "interested", "lead_score": 80,'
        ' "next_action": "Send quote"}'
    )
    assert out["outcome"] == "interested"
    assert out["lead_score"] == 80


def test_json_in_fences():
    text = '```json\n{"summary": "s", "outcome": "dnd", "lead_score": 10}\n```'
    out = parse_analysis(text)
    assert out["outcome"] == "dnd"


def test_json_with_prose():
    text = 'Here is the analysis: {"summary": "s", "outcome": "callback_requested", "lead_score": 55} hope this helps'
    out = parse_analysis(text)
    assert out["outcome"] == "callback_requested"


def test_invalid_output_falls_back():
    out = parse_analysis("the caller hung up immediately, no json here")
    assert out["outcome"] == "unknown"
    assert out["lead_score"] is None
    assert "hung up" in out["summary"]


def test_outcome_and_score_validation():
    out = parse_analysis('{"summary": "s", "outcome": "made_up", "lead_score": 900}')
    assert out["outcome"] == "unknown"
    assert out["lead_score"] == 100        # clamped
