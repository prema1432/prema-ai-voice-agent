"""Telugu-primary language detection and turn format helpers.

Primary language for the whole platform: Telugu (te). All campaigns, agents,
and leads default to Telugu. The script detector validates native Telugu script
(0x0C00–0x0C7F) and returns 'te' when it sees it; transliterated Latin turns
are marked as 'transliterated' format, not a new language.

Canonical Telugu script examples (native):
  namaskāramu → నమస్కారం
  miiru elā unnāru? → మీరు ఎలా ఉన్నారు?
  kūḍā paiāḍō čēsum? → కూడా ప్రాణాలు చెయ్యాలేమే?

Transliteration helper (IndicTrans-style, no extra deps):
  For 'transliterated' turns we keep the native script version immutable and
  compute a Latin rendering only when needed (TTS may stay in script for now).
"""
from __future__ import annotations

from typing import Literal

from typing import Any

# Telugu primary default (canonical script: 0x0C00–0x0C7F)
TELUGU_PRIMARY = "te"

# Supported turn formats
TurnFormat = Literal["native", "transliterated"]

# Mapping Telugu native script codepoints → Latin transliteration table.
# This is a partial, IndicTrans-style mapping: native script is always primary.
TELUGU_TO_LATIN: dict[str, str] = {
    "క": "ka", "ఖ": "kha", "గ": "ga", "ఘ": "gha", "ఙ": "nga",
    "చ": "ca", "ఛ": "cha", "జ": "ja", "ఝ": "jha", "ఞ": "nya",
    "ట": "ṭa", "ఠ": "ṭha", "డ": "ḍa", "ఢ": "ḍha", "ణ": "ṇa",
    "త": "ta", "థ": "tha", "ద": "da", "ధ": "dha", "న": "na",
    "ప": "pa", "ఫ": "pha", "బ": "ba", "భ": "bha", "మ": "ma",
    "య": "ya", "ర": "ra", "ఱ": "ṟa", "ల": "la", "వ": "va",
    "శ": "śa", "ష": "ṣa", "స": "sa", "హ": "ha", "ృ": "ru", "ౄ": "rru",
    "ఋ": "ru", "ౠ": "rru",
    "ా": "ā", "ి": "i", "ీ": "ī", "ు": "u", "ూ": "ū",
    "ృ": "ru", "ౄ": "rru",
    "ౢ": "lṛ", "ౣ": "lṝ",
    "ొ": "o", "ో": "ō", "ౌ": "au",
    "ం": "ṁ", "ఁ": "ṃ", "ః": "ḥ",
    "క్ష": "kṣa", "జ్ఞ": "jña", "శ్రీ": "śrī",
    " ": " ",
}


def detect_language(text: str, primary: str = TELUGU_PRIMARY) -> str | None:
    """Return 'te' if Telugu native script is seen; else primary."""
    if not text:
        return primary
    for ch in text:
        if 0x0C00 <= ord(ch) <= 0x0C7F:
            return "te"
    # No Telugu script bytes → caller may be using a transliterated turn.
    return None


def is_native_telugu(text: str) -> bool:
    """True if the string contains any Telugu-native codepoint."""
    return any(0x0C00 <= ord(ch) <= 0x0C7F for ch in text or "")


def turn_format(text: str) -> TurnFormat:
    """Decide format from the content: native script or Latin-only."""
    return "native" if is_native_telugu(text) else "transliterated"


def transliterate(text: str) -> str:
    """Naive IndicTrans-style transliteration to Latin script.

    Not a replacement for a real transliteration toolkit, but enough for
    operator-readable logs and search indexes while keeping native script primary.
    """
    result: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        # compound consonant clusters: try next codepoint
        if i + 1 < n:
            next_ch = text[i + 1]
            cluster = ch + next_ch
            if cluster in TELUGU_TO_LATIN:
                result.append(TELUGU_TO_LATIN[cluster])
                i += 2
                continue
            # try three-char clusters (క్ష etc.)
            if i + 2 < n:
                cluster3 = ch + next_ch + text[i + 2]
                if cluster3 in TELUGU_TO_LATIN:
                    result.append(TELUGU_TO_LATIN[cluster3])
                    i += 3
                    continue
        if ch in TELUGU_TO_LATIN:
            result.append(TELUGU_TO_LATIN[ch])
        else:
            result.append(ch)
        i += 1
    return "".join(result)


def transliterated_turn(native_text: str) -> str:
    """Return a Latin transliteration of the native Telugu text (for logs/search)."""
    return transliterate(native_text)
