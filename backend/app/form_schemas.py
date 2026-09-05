"""Form-builder data models: fields (all data types), steps, actions, forms."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

# Every input type the builder supports (kept as one catalog for the UI too).
FIELD_TYPES: list[str] = [
    "text", "textarea", "email", "phone", "number", "date", "time",
    "datetime-local", "url", "select", "multiselect", "radio", "checkbox",
    "toggle", "slider", "rating", "color", "hidden", "computed",
]

ACTION_TYPES: list[str] = ["webhook", "google_sheet", "email", "notification", "campaign_lead"]


class OptionsApi(BaseModel):
    """Fetch dropdown/radio options from a live API when the form is opened."""
    url: str = ""
    method: Literal["GET", "POST"] = "GET"
    headers: str = ""            # JSON object, e.g. {"Authorization": "Bearer x"}
    body: str = ""               # JSON request body when POST ({{field}} allowed)
    data_path: str = ""          # dot path to the array in the response
    label_path: str = ""         # dot path for the display label inside an item
    value_path: str = ""         # dot path for the stored value inside an item


class ShowWhen(BaseModel):
    """Conditionally show a field based on another field's value."""
    field: str = ""
    op: Literal["eq", "neq", "in", "gt", "lt", "empty"] = "eq"
    value: str = ""


class FieldDef(BaseModel):
    id: str = ""
    label: str = ""
    type: str = "text"
    required: bool = False
    placeholder: str = ""
    help: str = ""
    default: str = ""                       # literal default or {{formula}} to compute
    options: list[str] = Field(default_factory=list)          # static choices
    options_api: OptionsApi | None = None   # dynamic choices
    formula: str = ""                       # computed value: {{price}} * 2, "{{a}} {{b}}"
    computed: bool = False                  # read-only field whose value comes from formula
    show_when: ShowWhen | None = None
    validation: dict[str, Any] = Field(default_factory=dict)  # min/max/minlen/maxlen/pattern/step
    width: Literal["full", "half"] = "full"
    step: int = 1


class StepDef(BaseModel):
    id: str = ""
    title: str = "Step"
    description: str = ""
    fields: list[FieldDef] = Field(default_factory=list)


class ActionDef(BaseModel):
    id: str = ""
    type: str = "webhook"
    name: str = ""
    enabled: bool = True
    config: dict[str, Any] = Field(default_factory=dict)
    # config keys per type:
    #   webhook      -> {url, method?, headers?(json), template?(json string)}
    #   google_sheet -> {url}  (Apps Script endpoint; header row auto-sent)
    #   email        -> {to, subject, body}  ({{field}} tokens are replaced)
    #   notification -> {title, message}     (in-app)
    #   campaign_lead-> {campaign_id, phone_field?, name_field?}


class FormSettings(BaseModel):
    submit_label: str = "Submit"
    success_message: str = "Thank you — your response has been recorded."
    redirect_url: str = ""                  # optional post-submit redirect
    show_progress: bool = True              # step indicator on multi-step forms


class FormIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    slug: str = ""                          # optional; auto-generated on publish
    settings: FormSettings = Field(default_factory=FormSettings)
    steps: list[StepDef] = Field(default_factory=list)
    actions: list[ActionDef] = Field(default_factory=list)


class FormPublicSubmit(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


def slugify(text: str) -> str:
    """URL-safe slug: 'Diwali Survey #2!' -> 'diwali-survey-2'."""
    import re
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return text[:64] or "form"


def field_defaults() -> dict[str, Any]:
    return {
        "text": {}, "textarea": {}, "email": {}, "phone": {}, "url": {},
        "hidden": {}, "computed": {},
        "number": {"step": "1"}, "date": {}, "time": {}, "datetime-local": {},
        "select": {}, "multiselect": {}, "radio": {}, "checkbox": {},
        "toggle": {}, "slider": {"min": "0", "max": "100", "step": "1"},
        "rating": {"max": "5"}, "color": {},
    }


def _now() -> datetime:
    from datetime import timezone
    return datetime.now(timezone.utc)


def _field_count(form: dict) -> int:
    return sum(len(s.get("fields", [])) for s in form.get("steps", []))
