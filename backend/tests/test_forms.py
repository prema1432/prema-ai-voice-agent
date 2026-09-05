"""Offline-safe tests for the form-builder formula engine + slug helper."""
import pytest

from app.form_schemas import slugify
from app.services import formula


def test_arithmetic_and_precedence():
    assert formula.evaluate("{{a}} * 2 + 1", {"a": 5}) == 11
    assert formula.evaluate("({{a}} + {{b}}) * {{c}}", {"a": 2, "b": 3, "c": 4}) == 20
    assert formula.evaluate("{{a}} % {{b}}", {"a": 7, "b": 3}) == 1


def test_string_concat_and_nested_refs():
    assert formula.evaluate('"Hi " + {{name}}', {"name": "Prema"}) == "Hi Prema"
    assert formula.evaluate('{{user.first}} + " " + {{user.last}}', {"user": {"first": "A", "last": "B"}}) == "A B"
    assert formula.evaluate("{{missing}}", {}) is None  # unknown refs render empty
    with pytest.raises(formula.FormulaError):
        formula.evaluate("{{missing}} + 1", {})  # dangling '+' after empty ref


def test_comparisons_and_booleans():
    assert formula.evaluate("{{x}} > 3 and {{y}} < 5", {"x": 4, "y": 2}) is True
    assert formula.evaluate("{{x}} > 3 and {{y}} < 5", {"x": 1, "y": 2}) is False
    assert formula.evaluate("{{x}} == 4 or {{y}} == 9", {"x": 4, "y": 9}) is True


def test_helpers():
    assert formula.evaluate("round({{p}} / 2)", {"p": 9}) == 4
    assert formula.evaluate("min({{a}}, {{b}}) * 2", {"a": 3, "b": 9}) == 6
    assert formula.evaluate("max({{a}}, {{b}})", {"a": 3, "b": 9}) == 9
    assert formula.evaluate("len({{s}})", {"s": "abcd"}) == 4


def test_safety():
    with pytest.raises(formula.FormulaError):
        formula.evaluate("{{a}} / 0", {"a": 5})
    with pytest.raises(formula.FormulaError):
        formula.evaluate("__import__('os')", {})
    with pytest.raises(formula.FormulaError):
        formula.evaluate("1 +", {})


def test_slugify():
    assert slugify("Diwali Survey #2!") == "diwali-survey-2"
    assert slugify("   LEAD FORM   ") == "lead-form"
    assert slugify("నమస్తే")  # non-latin collapses to '' -> fallback 'form'
