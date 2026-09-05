"""Small, safe formula engine for form fields.

Substitutes ``{{field_id}}`` references from a submission and evaluates the
remaining expression with a real parser (no ``eval``). Supports numbers,
quoted strings, ``+ - * / %``, parentheses, unary minus, comparisons and the
boolean operators ``and/or/not`` plus helpers ``round(x)``, ``min(a,b)``,
``max(a,b)`` and ``len(x)``. Concat strings with ``+``.
"""
from __future__ import annotations

import math
import re

_REF = re.compile(r"\{\{\s*([A-Za-z0-9_.\-]+)\s*\}\}")


class FormulaError(ValueError):
    pass


def _resolve_ref(name: str, data: dict) -> object:
    cur: object = data
    for part in name.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        elif isinstance(cur, list) and part.isdigit() and int(part) < len(cur):
            cur = cur[int(part)]
        else:
            return None
    return cur


def substitute(expr: str, data: dict) -> str:
    """Replace every {{ref}} with its value; unknown refs become empty string."""

    def rep(m: re.Match) -> str:
        val = _resolve_ref(m.group(1).strip(), data)
        if val is None:
            return ""
        if isinstance(val, bool):
            return "true" if val else "false"
        if isinstance(val, (int, float)):
            return str(val)
        text = str(val)
        # Quote it so the evaluator treats it as one string token.
        return jsonish(text)

    return _REF.sub(rep, expr)


def jsonish(text: str) -> str:
    """Wrap a string in double quotes with escapes so it parses as a token."""
    escaped = text.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


_TOKEN_RE = re.compile(
    r"""
    \s*(?:
        (?P<num>\d+(?:\.\d+)?)
      | (?P<str>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')
      | (?P<kw>true|false|null)
      | (?P<op><=|>=|==|!=|<>|&&|\|\||[+\-*/%()<>,])
      | (?P<word>[A-Za-z_][A-Za-z0-9_]*)
    )
    """,
    re.VERBOSE,
)

_OPERATORS: dict[str, tuple[int, str]] = {
    "||": (1, "l"), "or": (1, "l"),
    "&&": (2, "l"), "and": (2, "l"),
    "==": (3, "l"), "!=": (3, "l"), "<>": (3, "l"),
    "<": (4, "l"), "<=": (4, "l"), ">": (4, "l"), ">=": (4, "l"),
    "+": (5, "l"), "-": (5, "l"),
    "*": (6, "l"), "/": (6, "l"), "%": (6, "l"),
}

_FUNCS: dict[str, int] = {"abs": 1, "round": 1, "min": 2, "max": 2, "len": 1}


def _tokenize(expr: str) -> list[tuple[str, object]]:
    tokens: list[tuple[str, object]] = []
    pos = 0
    length = len(expr)
    while pos < length:
        m = _TOKEN_RE.match(expr, pos)
        if not m or m.end() == pos:
            raise FormulaError(f"bad token near: {expr[pos:pos+20]!r}")
        pos = m.end()
        kind = m.lastgroup or "op"
        text = m.group(0).strip()
        if kind == "num":
            tokens.append(("num", float(text)))
        elif kind == "str":
            body = text[1:-1]
            body = body.replace('\\"', '"').replace("\\'", "'").replace("\\\\", "\\")
            tokens.append(("str", body))
        elif kind == "kw":
            tokens.append(("kw", text))
        elif kind == "word":
            tokens.append(("word", text))
        else:
            tokens.append(("op", text))
    return tokens


class _Parser:
    def __init__(self, tokens: list[tuple[str, object]]):
        self.tokens = tokens
        self.i = 0

    def peek(self) -> tuple[str, object] | None:
        return self.tokens[self.i] if self.i < len(self.tokens) else None

    def pop(self) -> tuple[str, object] | None:
        tok = self.peek()
        if tok:
            self.i += 1
        return tok

    def expect_op(self, op: str) -> None:
        tok = self.pop()
        if not tok or tok[0] != "op" or tok[1] != op:
            raise FormulaError(f"expected '{op}'")

    def parse(self) -> object:
        if len(self.tokens) > 200:
            raise FormulaError("expression too long")
        value = self._or()
        if self.peek() is not None:
            raise FormulaError(f"unexpected token near end: {self.peek()}")
        return value

    # or -> and ('or' and)*
    def _or(self) -> object:
        left = self._and()
        while self._is_op("or", "||"):
            self.pop()
            right = self._and()
            left = bool(left) or bool(right)
        return left

    def _and(self) -> object:
        left = self._equality()
        while self._is_op("and", "&&"):
            self.pop()
            right = self._equality()
            left = bool(left) and bool(right)
        return left

    def _equality(self) -> object:
        left = self._relational()
        while self._is_op("==", "!=", "<>"):
            op = self.pop()[1]
            right = self._relational()
            left = (left == right) if op == "==" else (left != right)
        return left

    def _relational(self) -> object:
        left = self._additive()
        while self._is_op("<", "<=", ">", ">="):
            op = self.pop()[1]
            right = self._additive()
            try:
                if op == "<":
                    left = left < right
                elif op == "<=":
                    left = left <= right
                elif op == ">":
                    left = left > right
                else:
                    left = left >= right
            except TypeError:
                raise FormulaError(f"cannot compare {left!r} {op} {right!r}") from None
        return left

    def _additive(self) -> object:
        left = self._multiplicative()
        while self._is_op("+", "-"):
            op = self.pop()[1]
            right = self._multiplicative()
            if op == "+" and isinstance(left, str):
                left = left + str(right)
            elif op == "+" and isinstance(right, str):
                left = str(left) + right
            elif op == "+":
                left = _num(left) + _num(right)
            else:
                left = _num(left) - _num(right)
        return left

    def _multiplicative(self) -> object:
        left = self._unary()
        while self._is_op("*", "/", "%"):
            op = self.pop()[1]
            right = self._unary()
            a, b = _num(left), _num(right)
            if op == "*":
                left = a * b
            elif op == "/":
                if b == 0:
                    raise FormulaError("division by zero")
                left = a / b
            else:
                if b == 0:
                    raise FormulaError("modulo by zero")
                left = a % b
        return left

    def _unary(self) -> object:
        tok = self.peek()
        if tok and tok[0] == "op" and tok[1] == "-":
            self.pop()
            return -_num(self._unary())
        if tok and tok[0] == "op" and tok[1] == "(":
            self.pop()
            value = self._or()
            self.expect_op(")")
            return value
        if tok and tok[0] == "word":
            self.pop()
            name = tok[1]
            if name == "not":
                return not bool(self._unary())
            if self._is_op("("):
                return self._call(name)
            raise FormulaError(f"unknown identifier '{name}'")
        return self._primary()

    def _call(self, name: str) -> object:
        self.pop()  # (
        if name not in _FUNCS:
            raise FormulaError(f"unknown function '{name}'")
        args: list[object] = []
        if not self._is_op(")"):
            while True:
                args.append(self._or())
                if self._is_op(","):
                    self.pop()
                else:
                    break
        self.expect_op(")")
        if name == "abs":
            return abs(_num(args[0]))
        if name == "round":
            return round(_num(args[0]))
        if name == "min":
            return min(_num(a) for a in args)
        if name == "max":
            return max(_num(a) for a in args)
        if name == "len":
            return len(args[0]) if hasattr(args[0], "__len__") else len(str(args[0]))
        raise FormulaError(f"unknown function '{name}'")

    def _primary(self) -> object:
        tok = self.pop()
        if not tok:
            raise FormulaError("unexpected end of expression")
        kind, val = tok
        if kind == "num":
            return val
        if kind == "str":
            return val
        if kind == "kw":
            if val == "true":
                return True
            if val == "false":
                return False
            if val == "null":
                return None
        raise FormulaError(f"unexpected token {val!r}")

    def _is_op(self, *ops: str) -> bool:
        tok = self.peek()
        if not tok:
            return False
        # word operators: and / or / not
        if tok[0] == "word":
            return tok[1] in ("and", "or", "not") and tok[1] in ops
        return tok[0] == "op" and tok[1] in ops


def _num(value: object) -> float:
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float)):
        return float(value)
    try:
        text = str(value).replace(",", "").strip()
        return float(text) if text else 0.0
    except ValueError:
        raise FormulaError(f"'{value}' is not a number") from None


def evaluate(expression: str, data: dict) -> object:
    """Evaluate a formula string against a submission dict (safe)."""
    expr = (expression or "").strip()
    if not expr:
        return None
    substituted = substitute(expr, data)
    if not substituted.strip():
        return None
    try:
        value = _Parser(_tokenize(substituted)).parse()
    except FormulaError as exc:
        raise FormulaError(f"formula error in {expression!r}: {exc}") from None
    if isinstance(value, float) and value.is_integer() and abs(value) < 1e15:
        return int(value)
    return value


def compute_field(field_id: str, formula: str, data: dict) -> object:
    """Compute a single field; returns the substituted value on failure-safe None."""
    try:
        return evaluate(formula, data)
    except FormulaError:
        return None


def format_value(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)
