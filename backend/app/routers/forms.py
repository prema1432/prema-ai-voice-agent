"""Form builder backend.

Admin CRUD lives under /forms, public fill/options under /public/forms/{slug}.
Submissions are stored with a display snapshot + per-action results so the
submissions page can show exactly what each workflow action did.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.db import collection
from app.form_schemas import FormIn, FormPublicSubmit, _field_count, slugify
from app.services import formula

router = APIRouter(tags=["forms"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    for key in ("created_at", "updated_at", "published_at"):
        if doc.get(key):
            doc[key] = doc[key].isoformat()
    return doc


def _flatten_fields(form: dict) -> list[dict]:
    out: list[dict] = []
    for step in form.get("steps", []):
        for f in step.get("fields", []):
            f = dict(f)
            f["step_id"] = step.get("id")
            out.append(f)
    return out


def _visible(field: dict, data: dict) -> bool:
    sw = field.get("show_when")
    if not sw or not sw.get("field"):
        return True
    cond = data.get(sw["field"])
    op = sw.get("op", "eq")
    want = sw.get("value", "")
    if op == "empty":
        return cond in (None, "", [], {})
    if op == "eq":
        return str(cond) == str(want)
    if op == "neq":
        return str(cond) != str(want)
    if op == "in":
        return str(cond) in [x.strip() for x in str(want).split(",")]
    try:
        a, b = float(cond), float(want)
        return a > b if op == "gt" else a < b
    except (TypeError, ValueError):
        return False


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _coerce(field: dict, raw: object) -> object:
    """Type-coerce a raw value; raises ValueError with a friendly message."""
    ftype = field.get("type")
    if raw is None:
        return None
    if ftype in ("multiselect", "checkbox"):
        if isinstance(raw, list):
            values = raw
        elif isinstance(raw, str):
            values = [v.strip() for v in raw.split(",") if v.strip()]
        else:
            values = [raw]
        return [str(v) for v in values]
    if ftype == "number":
        text = str(raw).strip().replace(",", "")
        if text == "":
            return None
        value = float(text)
        vmax = field.get("validation", {}).get("max")
        vmin = field.get("validation", {}).get("min")
        if vmax is not None and value > float(vmax):
            raise ValueError(f"{field['label']} must be at most {vmax}")
        if vmin is not None and value < float(vmin):
            raise ValueError(f"{field['label']} must be at least {vmin}")
        return int(value) if value.is_integer() else value
    if ftype == "toggle":
        return raw in (True, "true", "on", "yes", "1", 1)
    if ftype == "rating" or ftype == "slider":
        try:
            return int(float(str(raw)))
        except (TypeError, ValueError):
            return None
    text = str(raw).strip()
    if ftype == "email" and text and not _EMAIL_RE.match(text):
        raise ValueError(f"{field['label']}: not a valid email")
    if ftype == "phone" and text and not re.fullmatch(r"\+?[\d\s\-()]{7,16}", text):
        raise ValueError(f"{field['label']}: not a valid phone number")
    if ftype == "url" and text and not text.lower().startswith(("http://", "https://")):
        raise ValueError(f"{field['label']}: must start with http(s)://")
    pattern = field.get("validation", {}).get("pattern")
    if pattern and text and not re.search(pattern, text):
        raise ValueError(f"{field['label']}: does not match the required format")
    return text


async def _process_submission(form: dict, data: dict) -> dict:
    """Validate + coerce incoming data, compute formulas, build answers."""
    values: dict = {}
    for field in _flatten_fields(form):
        fid = field["id"]
        ftype = field.get("type", "text")
        if not _visible(field, data):
            continue
        if field.get("computed") or ftype == "computed":
            values[fid] = formula.compute_field(fid, field.get("formula", ""), {**data, **values})
            continue
        # support defaults expressed as formulas or literal defaults
        raw = data.get(fid, None)
        default = field.get("default", "")
        if raw in (None, "") and default:
            try:
                raw = formula.evaluate(default, {**data, **values})
            except formula.FormulaError:
                raw = default
        if field.get("required") and raw in (None, "", [], {}):
            raise HTTPException(422, f"'{field['label']}' is required")
        values[fid] = _coerce(field, raw)

    # computed fields already merged via values; now re-run any formula default
    # referencing computed fields (two passes keep ordering bugs away).
    for field in _flatten_fields(form):
        fid = field["id"]
        if field.get("computed") or field.get("type") == "computed":
            values[fid] = formula.compute_field(fid, field.get("formula", ""), {**data, **values})

    answers: dict = {}
    for field in _flatten_fields(form):
        fid = field["id"]
        if fid in values and values[fid] not in (None, "", []):
            answers[field.get("label") or fid] = values[fid]
    return {"values": values, "answers": answers}


async def _grab(obj, path: str):
    """Dot-path access into nested dicts/lists."""
    cur = obj
    for part in (path or "").split(".") if path else []:
        if part == "":
            continue
        if isinstance(cur, dict):
            cur = cur.get(part)
        elif isinstance(cur, list) and part.isdigit():
            cur = cur[int(part)] if int(part) < len(cur) else None
        else:
            return None
    return cur


# ── Admin CRUD ─────────────────────────────────────────────────────────────
@router.get("/forms")
async def list_forms() -> list[dict]:
    docs = await collection("forms").find().sort("created_at", -1).to_list(200)
    out = []
    for d in docs:
        fid = d["_id"]
        count = await collection("form_submissions").count_documents({"form_id": str(fid)})
        d = _out(d)
        d["submissions"] = count
        d["field_count"] = _field_count(d)
        out.append(d)
    return out


@router.post("/forms", status_code=201)
async def create_form(body: FormIn) -> dict:
    from app.events import audit

    doc = body.model_dump()
    doc["published"] = False
    doc["created_at"] = doc["updated_at"] = _now()
    doc["stats"] = {"submissions": 0}
    res = await collection("forms").insert_one(doc)
    await audit("form.created", entity_type="form", entity_id=str(res.inserted_id), meta={"title": body.title})
    return {"id": str(res.inserted_id)}


@router.get("/forms/{form_id}")
async def get_form(form_id: str) -> dict:
    doc = await collection("forms").find_one({"_id": ObjectId(form_id)})
    if not doc:
        raise HTTPException(404, "form not found")
    return _out(doc)


@router.put("/forms/{form_id}")
async def update_form(form_id: str, body: FormIn) -> dict:
    from app.events import audit

    doc = body.model_dump()
    doc["updated_at"] = _now()
    res = await collection("forms").update_one({"_id": ObjectId(form_id)}, {"$set": doc})
    if res.matched_count == 0:
        raise HTTPException(404, "form not found")
    await audit("form.updated", entity_type="form", entity_id=form_id, meta={"title": body.title})
    return {"updated": True}


@router.delete("/forms/{form_id}")
async def delete_form(form_id: str) -> dict:
    from app.events import audit

    await collection("form_submissions").delete_many({"form_id": form_id})
    await collection("forms").delete_one({"_id": ObjectId(form_id)})
    await audit("form.deleted", entity_type="form", entity_id=form_id)
    return {"deleted": True}


# ── Publish / share link ────────────────────────────────────────────────────
async def _ensure_slug(doc: dict) -> str:
    base = slugify(doc.get("slug") or doc.get("title") or "form")
    candidate = base
    n = 2
    while True:
        dup = await collection("forms").find_one(
            {"slug": candidate, "_id": {"$ne": doc["_id"]}}, {"_id": 1}
        )
        if not dup:
            return candidate
        candidate = f"{base}-{n}"
        n += 1


@router.post("/forms/{form_id}/publish")
async def publish_form(form_id: str) -> dict:
    from app.events import audit, emit

    doc = await collection("forms").find_one({"_id": ObjectId(form_id)})
    if not doc:
        raise HTTPException(404, "form not found")
    slug = doc.get("slug") or await _ensure_slug(doc)
    await collection("forms").update_one(
        {"_id": ObjectId(form_id)},
        {"$set": {"published": True, "slug": slug, "published_at": _now(), "updated_at": _now()}},
    )
    await audit("form.published", entity_type="form", entity_id=form_id,
                meta={"title": doc.get("title"), "slug": slug})
    emit("form.published", {"form_id": form_id, "slug": slug, "title": doc.get("title")})
    return {"published": True, "slug": slug}


@router.post("/forms/{form_id}/unpublish")
async def unpublish_form(form_id: str) -> dict:
    from app.events import audit

    await collection("forms").update_one(
        {"_id": ObjectId(form_id)},
        {"$set": {"published": False, "updated_at": _now()}},
    )
    await audit("form.unpublished", entity_type="form", entity_id=form_id)
    return {"published": False}


# ── Submissions (admin) ─────────────────────────────────────────────────────
@router.get("/forms/{form_id}/submissions")
async def list_submissions(form_id: str, limit: int = 100, skip: int = 0) -> list[dict]:
    docs = (await collection("form_submissions")
            .find({"form_id": form_id}).sort("created_at", -1)
            .skip(max(0, skip)).limit(min(limit, 500)).to_list(min(limit, 500)))
    return [_out(d) for d in docs]


@router.delete("/forms/submissions/{submission_id}")
async def delete_submission(submission_id: str) -> dict:
    from app.events import audit

    doc = await collection("form_submissions").find_one({"_id": ObjectId(submission_id)})
    if not doc:
        raise HTTPException(404, "submission not found")
    await collection("form_submissions").delete_one({"_id": ObjectId(submission_id)})
    await audit("form.submission_deleted", entity_type="submission", entity_id=submission_id,
                meta={"form_id": doc.get("form_id")})
    return {"deleted": True}


# ── Public endpoints (published forms only) ─────────────────────────────────
async def _published_by_slug(slug: str) -> dict:
    doc = await collection("forms").find_one({"slug": slug, "published": True})
    if not doc:
        raise HTTPException(404, "form not found or not published")
    return doc


@router.get("/public/forms/{slug}")
async def public_form(slug: str) -> dict:
    doc = await _published_by_slug(slug)
    return {
        "title": doc.get("title"),
        "description": doc.get("description"),
        "slug": doc.get("slug"),
        "settings": doc.get("settings", {}),
        "steps": doc.get("steps", []),
        "published_at": (doc.get("published_at") or _now()).isoformat(),
    }


@router.post("/public/forms/{slug}/submit", status_code=201)
async def public_submit(slug: str, body: FormPublicSubmit, background: BackgroundTasks) -> dict:
    from app.events import audit, emit

    doc = await _published_by_slug(slug)
    form_id = str(doc["_id"])
    try:
        processed = await _process_submission(doc, body.data)
    except HTTPException:
        raise
    values, answers = processed["values"], processed["answers"]

    sub_doc = {
        "form_id": form_id,
        "form_title": doc.get("title"),
        "slug": slug,
        "data": values,
        "answers": answers,
        "actions": [],
        "created_at": _now(),
    }
    res = await collection("form_submissions").insert_one(sub_doc)
    sid = str(res.inserted_id)
    await collection("forms").update_one(
        {"_id": doc["_id"]}, {"$inc": {"stats.submissions": 1}, "$set": {"updated_at": _now()}}
    )
    await audit("form.submitted", entity_type="form", entity_id=form_id,
                meta={"title": doc.get("title"), "submission_id": sid})
    emit("form.submitted", {"form_id": form_id, "slug": slug, "submission_id": sid})

    async def _run_actions() -> None:
        from app.services.form_actions import run_form_actions
        results = await run_form_actions(doc, sid, values, answers)
        await collection("form_submissions").update_one(
            {"_id": ObjectId(sid)}, {"$set": {"actions": results}}
        )

    background.add_task(_run_actions)
    return {"ok": True, "submission_id": sid, "form_title": doc.get("title")}


@router.get("/public/forms/{slug}/options")
async def public_options(slug: str, field: str) -> dict:
    """Live options for a dynamic dropdown/radio fetched from the field's API."""
    doc = await _published_by_slug(slug)
    field_def = next((f for f in _flatten_fields(doc) if f.get("id") == field), None)
    if not field_def:
        raise HTTPException(404, "field not found")
    api = field_def.get("options_api")
    if not api or not api.get("url"):
        return {"options": [{"label": o, "value": o} for o in field_def.get("options", [])]}
    url = api["url"]
    headers = {}
    try:
        raw_headers = json.loads(api.get("headers") or "{}")
        if isinstance(raw_headers, dict):
            headers = {str(k): str(v) for k, v in raw_headers.items()}
    except Exception:  # noqa: BLE001
        headers = {}
    payload = None
    if api.get("method") == "POST":
        try:
            payload = json.loads(api.get("body") or "{}")
        except Exception:  # noqa: BLE001
            payload = {}
    try:
        import httpx

        async with httpx.AsyncClient(timeout=10.0) as client:
            if payload is not None:
                resp = await client.post(url, json=payload, headers=headers)
            else:
                resp = await client.get(url, headers=headers)
        if resp.status_code >= 300:
            return {"ok": False, "error": f"HTTP {resp.status_code}", "options": []}
        data = resp.json()
        items = await _grab(data, api.get("data_path", "")) or data
        if isinstance(items, dict):
            items = [items]
        if not isinstance(items, list):
            return {"ok": False, "error": "response is not a list", "options": []}
        options = []
        for item in items:
            if isinstance(item, (str, int, float)):
                options.append({"label": str(item), "value": str(item)})
            elif isinstance(item, dict):
                label = await _grab(item, api.get("label_path", "")) or item.get("label") or item.get("name") or ""
                value = await _grab(item, api.get("value_path", "")) or item.get("value") or item.get("id") or label
                options.append({"label": str(label), "value": str(value)})
        return {"ok": True, "options": options[:500]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"[:200], "options": []}
