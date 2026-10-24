from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.services.repository import get_repository


@pytest.fixture()
def client(tmp_path, monkeypatch, real_windfor_rows, flat_actual_rows):
    (tmp_path / "actuals.json").write_text(json.dumps(flat_actual_rows))
    (tmp_path / "forecasts.json").write_text(json.dumps(real_windfor_rows))
    (tmp_path / "meta.json").write_text(json.dumps({"built_at": "test", "sources": ["fixture"]}))
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)
    get_repository.cache_clear()
    yield TestClient(app)
    get_repository.cache_clear()


def test_health_ok(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok" and body["data_loaded"] is True


def test_health_degraded_without_snapshot(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA_DIR", tmp_path / "missing")
    get_repository.cache_clear()
    c = TestClient(app)
    assert c.get("/api/health").json()["data_loaded"] is False
    assert c.get("/api/meta").status_code == 503
    get_repository.cache_clear()


def test_series_for_a_day(client):
    body = client.get("/api/series", params={"date": "2026-01-11"}).json()
    assert len(body["points"]) == 48
    assert body["decision_time"].startswith("2026-01-10T09:50")
    assert body["publish_times_used"] == ["2026-01-10T09:30:00Z"]
    assert body["day_stats"]["n"] == 24
    hourly = [p for p in body["points"] if p["forecast"] is not None]
    assert all(p["range_low"] <= p["range_high"] for p in hourly)


def test_series_rejects_out_of_scope_date(client):
    r = client.get("/api/series", params={"date": "2026-03-01"})
    assert r.status_code == 422 and "outside the pilot scope" in r.json()["detail"]


def test_series_rejects_bad_cutoff(client):
    assert client.get("/api/series", params={"date": "2026-01-11", "cutoff": "25:00"}).status_code == 422


def test_accuracy_and_horizon(client):
    acc = client.get("/api/accuracy", params={"start": "2026-01-11", "end": "2026-01-11"}).json()
    assert acc["stats"]["n"] == 24 and acc["coverage_pct"] == 100
    hz = client.get("/api/accuracy/by-horizon", params={"start": "2026-01-11", "end": "2026-01-11"}).json()
    assert [r["bucket"] for r in hz["rows"]] == ["0-6 h", "6-12 h", "12-24 h", "24-36 h", "36-48 h"]


def test_vintages(client):
    body = client.get("/api/vintages", params={"date": "2026-01-11"}).json()
    assert len(body["vintages"]) == 8
