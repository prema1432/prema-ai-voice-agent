"""Offline tests for the platform layer: events, CRM pipeline, integrations.

These avoid MongoDB (the test suite is fully offline); they lock down the
shapes and invariants the routers rely on.
"""
from __future__ import annotations

from app.events import EVENTS, CHANNELS, new_inbound_token
from app.routers.crm import DEFAULT_STAGES
from app.routers.integrations import CATALOG


def test_event_catalog_has_expected_actions():
    for name in ("campaign.created", "campaign.started", "campaign.paused",
                 "campaign.completed", "leads.added", "call.ended",
                 "lead.moved", "integration.changed"):
        assert name in EVENTS


def test_notification_channels_model():
    assert "in_app" in CHANNELS
    for ch in ("email", "sms", "whatsapp", "push", "webhook"):
        assert ch in CHANNELS


def test_inbound_token_unique():
    assert len({new_inbound_token() for _ in range(200)}) == 200


def test_default_crm_pipeline_shape():
    ids = [s["id"] for s in DEFAULT_STAGES]
    assert ids == ["new", "contacted", "qualified", "proposal", "won", "lost"]
    # exactly two terminal funnel exits
    assert sum(1 for s in DEFAULT_STAGES if s["terminal"]) == 2
    for s in DEFAULT_STAGES:
        assert set(s) >= {"id", "name", "color", "terminal"}


def test_integration_catalog_dynamic_types():
    for key in ("webhook", "whatsapp", "instagram", "email", "sms",
                "push", "telegram", "crm", "custom"):
        assert key in CATALOG
        assert "label" in CATALOG[key] and "fields" in CATALOG[key]
