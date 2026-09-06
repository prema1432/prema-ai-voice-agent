#!/usr/bin/env python3
"""Split aireq.css into aireq.css + aireq-ui.css (keeps files under 500 lines)."""
import re
from pathlib import Path

src = Path("dashboard/src/views/aireq/aireq.css")
text = src.read_text()

# Find the top-level line numbers of the blocks to MOVE OUT.
move_starts = [
    "/* ── Job requirement cards (list grid) ─",       # 58
    "/* ── Share panel on the job card",               # 209
    "/* ── Per-job application fields editor",         # 482
]
lines = text.split("\n")

# locate boundaries
def find(marker, after=0):
    for i in range(after, len(lines)):
        if lines[i].startswith(marker):
            return i
    raise SystemExit(f"marker not found: {marker}")

segments = []
for m in move_starts:
    segments.append(find(m))
# append end-of-file as final cut point
segments.append(len(lines))

# segment ranges to keep: [0, s0), [s1, s2) ... between moved blocks
keep_idx = []
moved_idx = []
prev = 0
for k, s in enumerate(segments):
    if k % 2 == 0:
        keep_idx.append((prev, s))
    else:
        moved_idx.append((prev, s))
    prev = s

keep_parts = "\n".join("\n".join(lines[a:b]) for a, b in keep_idx)
moved_parts = "\n".join("\n".join(lines[a:b]) for a, b in moved_idx)

header = "/* ============================================================\n   AI Requirement — job cards, sharing, application forms UI\n   (split out of aireq.css to keep every file under 500 lines)\n   ============================================================ */\n"
Path("dashboard/src/views/aireq/aireq.css").write_text(keep_parts + "\n")
Path("dashboard/src/views/aireq/aireq-ui.css").write_text(header + moved_parts + "\n")
print("aireq.css lines:", len(keep_parts.split("\n")))
print("aireq-ui.css lines:", len(moved_parts.split("\n")) + 5)
