"""Phone utils tests: normalization, validation, calling window."""
from datetime import datetime
from zoneinfo import ZoneInfo

from app.phone_utils import (
    add_to_dnd,
    clean_phone,
    is_dnd,
    is_valid_indian_mobile,
    is_within_call_window,
    next_call_window_open,
)


def test_clean_phone_variants():
    assert clean_phone("+91 98765 43210") == "919876543210"
    assert clean_phone("09876543210") == "919876543210"
    assert clean_phone("9876543210") == "919876543210"
    assert clean_phone("919876543210") == "919876543210"
    assert clean_phone("98765-43210") == "919876543210"


def test_validation():
    assert is_valid_indian_mobile("919876543210")
    assert is_valid_indian_mobile("916123456789")   # 6-series now valid
    assert not is_valid_indian_mobile("915123456789")  # 5 not allocated
    assert not is_valid_indian_mobile("12345")
    assert not is_valid_indian_mobile("442071234567")  # UK number


def test_dnd_blocklist():
    add_to_dnd("+91 98000 00001")
    assert is_dnd("919800000001")
    assert is_dnd("+91-98000-00001")     # normalization applies both ways
    assert not is_dnd("919800000002")


def test_call_window():
    ist = ZoneInfo("Asia/Kolkata")
    noon = datetime(2026, 1, 10, 12, 0, tzinfo=ist)
    night = datetime(2026, 1, 10, 22, 30, tzinfo=ist)
    morning_edge = datetime(2026, 1, 10, 9, 0, tzinfo=ist)
    assert is_within_call_window(now=noon)
    assert not is_within_call_window(now=night)
    assert is_within_call_window(now=morning_edge)          # 9am inclusive
    assert not is_within_call_window(now=night, end_hour=22)  # custom window


def test_next_window_open():
    ist = ZoneInfo("Asia/Kolkata")
    night = datetime(2026, 1, 10, 22, 30, tzinfo=ist)
    nxt = next_call_window_open(now=night)
    assert nxt.day == 11 and nxt.hour == 9

    evening = datetime(2026, 1, 10, 20, 0, tzinfo=ist)
    assert next_call_window_open(now=evening).day == 10     # still today
