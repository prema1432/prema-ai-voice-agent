"""Telugu-primary schema additions for Prema AI Voice Agent.

Primary language: Telugu (te) — the default for all campaigns, agents, leads,
and every turn in the transcript / WebSocket transport.

Data formats: we support both 'native' (Telugu script 0x0C00-0x0C7F) and
'transliterated' (Latin script rendering, e.g. wx or IndicTrans-style) for
each turn, so downstream consumers (TTS, analytics, operators) can pick.

Tested turns: Telugu script is the canonical format. If an operator needs
transliterated output for a call, they can set `TurnFormat = "transliterated"`
per campaign/lead at upload time.

Examples (canonical Telugu script):
  namaskāramu, miiru elā unnāru?
  kūḍā paiāḍō čēsum?
  īskuḷāṁ batukōṭiṇṭi.
"""
from __future__ import annotations

from typing import Literal

# Telugu primary default (canonical script: 0x0C00–0x0C7F)
TELUGU_PRIMARY = "te"

# Supported turn formats
TurnFormat = Literal["native", "transliterated"]

# Verified script ranges (Unicode): Telugu 0x0C00–0x0C7F, Bengali 0x0980–0x09FF,
# Devanagari 0x0900–0x097F, Tamil 0x0B80–0x0BFF, Gujarati 0x0A80–0x0AFF,
# Kannada 0x0C80–0x0CFF, Malayalam 0x0D00–0x0D7F, Marathi (Devanagari), Punjabi
# (Gurmukhi 0x0A00–0x0A7F), Odia 0x0B00–0x0B7F, Assamese 0x0980–0x09FF.
