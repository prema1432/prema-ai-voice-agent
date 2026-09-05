/**
 * Browser mirror of the backend formula engine — used only to preview
 * computed fields live while filling the form. The server recomputes
 * everything on submit, so this is a UX nicety, not an authority.
 */
const REF = /\{\{\s*([A-Za-z0-9_.\-]+)\s*\}\}/g;

function getPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else if (Array.isArray(cur) && /^\d+$/.test(part) && Number(part) < cur.length) {
      cur = cur[Number(part)];
    } else {
      return undefined;
    }
  }
  return cur;
}

const json = (v: unknown) =>
  v === undefined || v === null ? "null" : JSON.stringify(String(v));

/** Validate that an expression only contains numbers, strings and operators. */
const SAFE = /^[0-9+\-*/%().,\s"'<>!=&|]+$/;
const ALLOWED_WORDS = new Set(["true", "false", "null"]);

export function evalFormula(expression: string, data: Record<string, unknown>): string {
  const expr = (expression || "").trim();
  if (!expr) return "";
  const substituted = expr.replace(REF, (_m, key: string) => json(getPath(data, key.trim())));
  if (!substituted.trim()) return "";
  // no identifiers, function calls or brackets may reach Function()
  if (!SAFE.test(substituted)) {
    for (const word of substituted.split(/[^A-Za-z]+/).filter(Boolean)) {
      if (!ALLOWED_WORDS.has(word)) return "";
    }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(`"use strict"; return (${substituted});`) as () => unknown;
    const value = fn();
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
    return String(value ?? "");
  } catch {
    return "";
  }
}

/** Client-side version of show_when (eq/neq/in/gt/lt/empty). */
export function visibleWhen(
  cond: { field: string; op: string; value: string } | null | undefined,
  data: Record<string, unknown>,
): boolean {
  if (!cond || !cond.field) return true;
  const cur = data[cond.field];
  const op = cond.op;
  const want = cond.value ?? "";
  if (op === "empty") return cur === undefined || cur === null || cur === "" || (Array.isArray(cur) && cur.length === 0);
  const curS = Array.isArray(cur) ? cur.join(",") : String(cur ?? "");
  if (op === "eq") return curS === want;
  if (op === "neq") return curS !== want;
  if (op === "in") return want.split(",").map((s) => s.trim()).includes(curS);
  const a = Number(curS);
  const b = Number(want);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return op === "gt" ? a > b : a < b;
}

export function isFilled(v: unknown): boolean {
  return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
}
