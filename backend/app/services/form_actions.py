"""Action workflow runner for published forms.

Runs after every submission. Each action gets its own result record stored on
the submission so the builder UI can show exactly what fired, what failed and
why — every action is also written to the audit log.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import settings

log = logging.getLogger(__name__)


def _templates(text: str, data: dict, answers: dict) -> str:
    """Replace {{field_id}} tokens in subject/body/url/message templates."""
    from app.services.formula import _REF, format_value

    def rep(m) -> str:
        key = m.group(1).strip()
        if key in answers and answers[key] is not None:
            return format_value(answers[key])
        if key in data and data[key] is not None:
            return format_value(data[key])
        return ""

    return _REF.sub(rep, text)


async def _post(url: str, payload: dict, headers: dict | None = None, timeout: float = 10.0) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.post(url, json=payload, headers=headers or {})
        ok = resp.status_code < 300
        detail = resp.text[:300] if resp.text else f"HTTP {resp.status_code}"
        return ok, f"HTTP {resp.status_code}" if ok else detail
    except Exception as exc:  # noqa: BLE001
        return False, f"{type(exc).__name__}: {exc}"[:300]


def _headers_from_json(text: str) -> dict:
    try:
        parsed = json.loads(text) if text else {}
        return {str(k): str(v) for k, v in parsed.items()} if isinstance(parsed, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


async def _run_email(cfg: dict, data: dict, answers: dict) -> tuple[bool, str]:
    to = _templates(cfg.get("to", ""), data, answers)
    if not to:
        return False, "no recipient (to)"
    if not settings.smtp_host:
        return False, "SMTP not configured (set SMTP_HOST in backend/.env)"
    subject = _templates(cfg.get("subject", "New form submission"), data, answers)
    body = _templates(cfg.get("body", ""), data, answers)
    if not body:
        rows = "".join(f"<li><b>{k}:</b> {_safe_html(v)}</li>" for k, v in answers.items())
        body = f"<p>A new form submission arrived.</p><ul>{rows}</ul>"
    try:
        result = await asyncio.to_thread(_smtp_send, to, subject, body)
        return True, result
    except Exception as exc:  # noqa: BLE001
        return False, f"{type(exc).__name__}: {exc}"[:300]


def _safe_html(value: Any) -> str:
    text = str(value if value is not None else "")
    return (
        text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )


def _smtp_send(to: str, subject: str, body: str) -> str:
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.attach(MIMEText(body.replace("<li>", "\n- ").replace("<br>", "\n").replace("</p>", "\n"), "plain"))
    msg.attach(MIMEText(body, "html"))
    smtp = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
    try:
        if settings.smtp_tls:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.sendmail(settings.smtp_from, [a.strip() for a in to.split(",") if a.strip()], msg.as_string())
    finally:
        smtp.quit()
    return f"queued to {to}"


async def _run_campaign_lead(cfg: dict, data: dict, answers: dict) -> tuple[bool, str]:
    campaign_id = cfg.get("campaign_id", "")
    phone_field = cfg.get("phone_field", "phone")
    phone_raw = str(data.get(phone_field) or "").strip()
    if not campaign_id:
        return False, "no campaign_id configured"
    if not phone_raw:
        return False, f"no value in phone field '{phone_field}'"
    from app.phone_utils import clean_phone, is_dnd, is_valid_indian_mobile
    from app.db import collection

    phone = clean_phone(phone_raw)
    if not is_valid_indian_mobile(phone):
        return False, f"not a valid Indian mobile: {phone_raw}"
    if is_dnd(phone):
        return False, "number on DND list"
    name_field = cfg.get("name_field", "name")
    name = str(data.get(name_field) or "").strip() or None
    extra = {k: v for k, v in answers.items() if k not in (phone_field, name_field) and v is not None}
    doc = await collection("campaigns").find_one({"_id": __import__("bson").ObjectId(campaign_id)}, {"crm_stages": 1})
    if not doc:
        return False, "campaign not found"
    stages = doc.get("crm_stages") or []
    default_stage = stages[0]["id"] if stages else "new"
    await collection("leads").update_one(
        {"campaign_id": campaign_id, "phone": phone},
        {"$set": {"phone": phone, "name": name, "extra": extra, "campaign_id": campaign_id, "updated_at": datetime.now(timezone.utc)},
         "$setOnInsert": {"status": "new", "call_count": 0, "stage": default_stage, "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return True, f"lead {phone} added to campaign"


async def run_form_actions(form: dict, submission_id: str, data: dict, answers: dict) -> list[dict]:
    """Execute every enabled action; returns per-action results for storage."""
    results: list[dict] = []
    ts = datetime.now(timezone.utc).isoformat()
    actions = [a for a in form.get("actions", []) if a.get("enabled", True)]
    for action in actions:
        kind = action.get("type", "webhook")
        cfg = action.get("config", {}) or {}
        label = action.get("name") or f"{kind}:{action.get('id', '')}"
        ok, detail = False, ""
        try:
            if kind == "webhook":
                url = _templates(cfg.get("url", ""), data, answers)
                if not url:
                    ok, detail = False, "no webhook url configured"
                else:
                    headers = _headers_from_json(_templates(cfg.get("headers", ""), data, answers))
                    ok, detail = await _post(url, {"form": form.get("title"), "submission_id": submission_id,
                                                  "submitted_at": ts, "answers": answers, "data": data}, headers)
            elif kind == "google_sheet":
                url = cfg.get("url", "")
                if not url:
                    ok, detail = False, "no Apps Script / Sheets url configured"
                else:
                    headers = _headers_from_json(cfg.get("headers", ""))
                    ok, detail = await _post(url, {"event": "form_submitted", "form": form.get("title"),
                                                   "submission_id": submission_id, "submitted_at": ts,
                                                   "answers": answers}, headers)
            elif kind == "email":
                ok, detail = await _run_email(cfg, data, answers)
            elif kind == "notification":
                title = _templates(cfg.get("title", "📝 New form submission"), data, answers)
                message = _templates(cfg.get("message", "A response was submitted."), data, answers)
                from app.events import notify
                await notify(title, message, kind="form", data={"form_id": str(form.get("_id")), "submission_id": submission_id})
                ok, detail = True, "in-app notification sent"
            elif kind == "campaign_lead":
                ok, detail = await _run_campaign_lead(cfg, data, answers)
            else:
                ok, detail = False, f"unsupported action type: {kind}"
        except Exception as exc:  # noqa: BLE001
            ok, detail = False, f"{type(exc).__name__}: {exc}"[:300]
        results.append({"action_id": action.get("id"), "type": kind, "name": label,
                        "status": "ok" if ok else "failed", "detail": detail, "at": ts})
    return results
