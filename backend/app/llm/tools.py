"""Agent tools: OpenRouter function-calling schemas + execution dispatcher."""
from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable

log = logging.getLogger(__name__)

ToolHandler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]

# ── Tool schemas (OpenRouter / OpenAI function-calling format) ───────────────

BOOK_APPOINTMENT = {
    "type": "function",
    "function": {
        "name": "book_appointment",
        "description": "Book an appointment slot for the caller after confirming date and time with them.",
        "parameters": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "YYYY-MM-DD"},
                "time": {"type": "string", "description": "HH:MM 24h"},
                "note": {"type": "string", "description": "What the visit/meeting is for"},
            },
            "required": ["date", "time"],
        },
    },
}

UPDATE_LEAD_STATUS = {
    "type": "function",
    "function": {
        "name": "update_lead_status",
        "description": "Update the lead's qualification status during the call.",
        "parameters": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["interested", "not_interested", "callback_requested", "dnd"],
                },
                "note": {"type": "string"},
            },
            "required": ["status"],
        },
    },
}

REQUEST_HUMAN_TRANSFER = {
    "type": "function",
    "function": {
        "name": "request_human_transfer",
        "description": "Transfer the live call to a human agent when the caller insists or the issue is out of scope.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {"type": "string"},
            },
            "required": ["reason"],
        },
    },
}

SET_CALLBACK = {
    "type": "function",
    "function": {
        "name": "set_callback",
        "description": "Schedule a callback at a specific day and time the caller agrees to.",
        "parameters": {
            "type": "object",
            "properties": {
                "when": {"type": "string", "description": "Natural date/time, e.g. 'tomorrow 11am'"},
                "reason": {"type": "string"},
            },
            "required": ["when"],
        },
    },
}

OPT_OUT_DND = {
    "type": "function",
    "function": {
        "name": "opt_out_dnd",
        "description": "Caller asked to never be called again. Mark DND and end the call politely.",
        "parameters": {"type": "object", "properties": {}},
    },
}

END_CALL = {
    "type": "function",
    "function": {
        "name": "end_call",
        "description": "Politely end the call once the goal is achieved or the caller says goodbye.",
        "parameters": {
            "type": "object",
            "properties": {"farewell": {"type": "string", "description": "One-line parting words to speak before hanging up"}},
            "required": ["farewell"],
        },
    },
}

ALL_TOOLS = [
    BOOK_APPOINTMENT,
    UPDATE_LEAD_STATUS,
    REQUEST_HUMAN_TRANSFER,
    SET_CALLBACK,
    OPT_OUT_DND,
    END_CALL,
]

TOOL_NAMES = {t["function"]["name"] for t in ALL_TOOLS}


# ── Dispatcher ───────────────────────────────────────────────────────────────

class ToolBox:
    """Holds per-call handlers; `dispatch` executes a tool call by name."""

    def __init__(self) -> None:
        self._handlers: dict[str, ToolHandler] = {}

    def register(self, name: str, handler: ToolHandler) -> None:
        self._handlers[name] = handler

    def has(self, name: str) -> bool:
        return name in self._handlers

    async def dispatch(self, name: str, arguments_json: str) -> dict[str, Any]:
        """Execute a tool call; never raises — errors become tool results."""
        args: dict[str, Any] = {}
        if arguments_json:
            try:
                args = json.loads(arguments_json)
            except json.JSONDecodeError:
                return {"ok": False, "error": f"Invalid JSON arguments for {name}"}

        handler = self._handlers.get(name)
        if handler is None:
            return {"ok": False, "error": f"Tool '{name}' not available in this call"}
        try:
            result = await handler(args)
            return result if isinstance(result, dict) else {"ok": True, "result": result}
        except Exception as exc:  # noqa: BLE001 — tools must not crash the call
            log.exception("tool %s failed", name)
            return {"ok": False, "error": str(exc)}
