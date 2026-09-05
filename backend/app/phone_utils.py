"""Indian phone-number helpers: normalization, validation, TRAI calling window.

Phone format used across the app: E.164 without '+' — '919876543210'.
"""
from __future__ import annotations

import re
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

IND_MOBILE_RE = re.compile(r"^91[6-9]\d{9}$")
CLEAN_RE = re.compile(r"[^\d+]")

# DND scrubbing: in production, plug the TRAI DLT/DND scrubbing API in here.
DND_BLOCKLIST: set[str] = set()


def clean_phone(raw: str) -> str:
    """Strip formatting; normalize bare/0-prefixed Indian numbers to 91XXXXXXXXXX."""
    digits = CLEAN_RE.sub("", (raw or "").strip())
    if digits.startswith("+"):
        digits = digits[1:]
    if len(digits) == 10 and digits[0] in "6789":
        digits = "91" + digits
    elif len(digits) == 11 and digits.startswith("0"):
        digits = "91" + digits[1:]
    return digits


def is_valid_indian_mobile(phone: str) -> bool:
    return bool(IND_MOBILE_RE.match(clean_phone(phone)))


def is_dnd(phone: str) -> bool:
    """True if the number is on the internal DND blocklist."""
    return clean_phone(phone) in DND_BLOCKLIST


def add_to_dnd(phone: str) -> None:
    DND_BLOCKLIST.add(clean_phone(phone))


def is_within_call_window(
    start_hour: int = 9,
    end_hour: int = 21,
    tz: str = "Asia/Kolkata",
    now: datetime | None = None,
) -> bool:
    """TRAI-style quiet hours: commercial calls 9am-9pm IST by default."""
    now = now or datetime.now(ZoneInfo(tz))
    t = now.time()
    return time(start_hour, 0) <= t < time(end_hour, 0)


def next_call_window_open(tz: str = "Asia/Kolkata", now: datetime | None = None) -> datetime:
    """When the calling window next opens (for scheduling deferred leads)."""
    now = now or datetime.now(ZoneInfo(tz))
    candidate = now.replace(hour=9, minute=0, second=0, microsecond=0)
    if now.time() >= time(21, 0):
        candidate = candidate + timedelta(days=1)
    return candidate
