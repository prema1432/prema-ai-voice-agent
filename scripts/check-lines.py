#!/usr/bin/env python3
"""Enforce the repo's 500-line-per-source-file guideline (see docs/PROJECT_RULES.md).

Usage:
    python3 scripts/check-lines.py [--max 500] [path ...]

Scans Python, TypeScript, TSX and CSS source trees. Exits non-zero listing any
file that exceeds the cap, so it can run in CI or a pre-commit hook.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

EXTENSIONS = (".py", ".ts", ".tsx", ".css")
# Never enforce generated / third-party / lockfile content.
SKIP_DIRS = {"node_modules", ".venv", "dist", ".git", "__pycache__", ".freebuff"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=500)
    ap.add_argument("paths", nargs="*", default=["backend/app", "dashboard/src"])
    args = ap.parse_args()

    bad: list[tuple[Path, int]] = []
    total = 0
    for raw in args.paths:
        root = Path(raw)
        if not root.exists():
            continue
        for p in root.rglob("*"):
            if p.suffix not in EXTENSIONS:
                continue
            if any(part in SKIP_DIRS for part in p.parts):
                continue
            if p.name.startswith("."):
                continue
            total += 1
            n = sum(1 for _ in p.open(encoding="utf-8", errors="replace"))
            if n > args.max:
                bad.append((p, n))

    if bad:
        print(f"❌ {len(bad)} file(s) exceed the {args.max}-line guideline:")
        for p, n in sorted(bad, key=lambda x: -x[1]):
            print(f"   {n:>5}  {p}")
        print("Split large files into reusable components/modules — see docs/PROJECT_RULES.md.")
        return 1
    print(f"✅ {total} source file(s) checked — all within {args.max} lines.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
