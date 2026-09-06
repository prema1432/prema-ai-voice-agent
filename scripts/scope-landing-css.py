#!/usr/bin/env python3
"""Scope generic selectors in the landing stylesheets under `.landing`.

The landing page CSS was written with short generic class names (`.chip`,
`.stage`, `.mock`, `.eq`, ...) that also exist app-wide. Because the landing
bundle is loaded globally, those rules leaked into every page — e.g.
`.chip { position: absolute; ... }` stacked every filter chip in the app.
This rewrites each rule so its selector list is prefixed with `.landing `,
keeping it scoped to the landing page only.
"""
import sys

SKIP_PREFIX = (
    ".landing",      # root + already-scoped rules (.landing a, .landing h1 ...)
    ".ld-",          # landing-specific namespace
    ":root", ":", "@",
)


def transform(path: str) -> int:
    lines = open(path, encoding="utf-8").read().split("\n")
    out: list[str] = []
    in_keyframes = False
    changed = 0
    for line in lines:
        stripped = line.strip()
        if not stripped:
            out.append(line)
            continue
        if stripped.startswith("@keyframes"):
            # Self-contained one-line keyframes (`@keyframes spin { to {...} }`)
            # never leave the flag set; multi-line ones stay set until their
            # closing brace so from/to/percent lines aren't touched.
            if stripped.count("{") > stripped.count("}"):
                in_keyframes = True
            out.append(line)
            continue
        if in_keyframes:
            out.append(line)
            if stripped.count("}") > stripped.count("{"):
                in_keyframes = False
            continue
        # Comments between keyframes and the next rule must not keep the flag set.
        if stripped.startswith("/*"):
            out.append(line)
            continue
        if stripped.startswith("@media") or stripped.startswith("@supports"):
            out.append(line)
            continue
        if "{" not in stripped:
            out.append(line)
            continue
        before = stripped.split("{")[0].strip()
        rest = stripped[len(before):]
        new_sels = []
        for sel in before.split(","):
            sel = sel.strip()
            if not sel:
                continue
            if sel.startswith(SKIP_PREFIX):
                new_sels.append(sel)
            else:
                new_sels.append(".landing " + sel)
                changed += 1
        out.append(", ".join(new_sels) + rest)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    return changed


if __name__ == "__main__":
    total = 0
    for p in sys.argv[1:]:
        n = transform(p)
        total += n
        print(f"{p}: {n} selectors scoped")
    print(f"total: {total}")