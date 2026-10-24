from __future__ import annotations

from datetime import date, time

from app.services.repository import Repository
from app.services.selection import (
    Mode,
    all_vintage_pairs,
    build_pairs,
    decision_cutoff,
    latest_vintage,
    select_forecast,
)
from tests.conftest import ts

TARGET = ts("2026-01-11T12:00:00")


def test_decision_cutoff_is_previous_day_0950_utc():
    assert decision_cutoff(date(2026, 1, 11)) == ts("2026-01-10T09:50:00")
    assert decision_cutoff(date(2026, 1, 11), time(8, 0)) == ts("2026-01-10T08:00:00")


def test_picks_latest_run_before_cutoff_not_after():
    vintages = [(ts("2026-01-10T07:30:00"), 1.0), (ts("2026-01-10T09:30:00"), 2.0), (ts("2026-01-10T11:30:00"), 3.0)]
    assert latest_vintage(vintages, TARGET, ts("2026-01-10T09:50:00")) == (ts("2026-01-10T09:30:00"), 2.0)


def test_run_published_exactly_at_cutoff_is_available():
    vintages = [(ts("2026-01-10T09:30:00"), 2.0), (ts("2026-01-10T09:50:00"), 5.0)]
    assert latest_vintage(vintages, TARGET, ts("2026-01-10T09:50:00")) == (ts("2026-01-10T09:50:00"), 5.0)


def test_backfill_rows_published_after_target_are_never_used():
    # WINDFOR runs include past hours; a run published after the target is not a forecast of it.
    vintages = [(ts("2026-01-11T09:30:00"), 2.0), (ts("2026-01-11T15:30:00"), 99.0)]
    assert latest_vintage(vintages, TARGET, ts("2026-01-11T23:00:00")) == (ts("2026-01-11T09:30:00"), 2.0)


def test_forecast_beyond_48h_is_ignored():
    vintages = [(ts("2026-01-09T10:00:00"), 1.0)]  # 50 h ahead of TARGET
    assert latest_vintage(vintages, TARGET, ts("2026-01-10T09:50:00")) is None


def test_no_vintage_before_cutoff_returns_none():
    assert latest_vintage([(ts("2026-01-10T11:30:00"), 1.0)], TARGET, ts("2026-01-10T09:50:00")) is None
    assert select_forecast(Repository(), TARGET, Mode.CUTOFF) is None


def test_horizon_mode_uses_latest_run_at_least_h_hours_before_target():
    vintages = [(ts("2026-01-11T02:30:00"), 1.0), (ts("2026-01-11T04:30:00"), 2.0), (ts("2026-01-11T07:30:00"), 3.0)]
    repo = Repository(forecasts={TARGET: vintages})
    # t - 6 h = 06:00 -> the 04:30 run
    assert select_forecast(repo, TARGET, Mode.HORIZON, horizon_h=6) == (ts("2026-01-11T04:30:00"), 2.0)


def test_build_pairs_skips_times_without_actual_or_forecast():
    repo = Repository(
        actuals={ts("2026-01-11T00:00:00"): 100.0, ts("2026-01-11T00:30:00"): 110.0},
        forecasts={ts("2026-01-11T00:00:00"): [(ts("2026-01-10T09:30:00"), 120.0)]},
    )
    pairs = build_pairs(repo, date(2026, 1, 11), date(2026, 1, 11))
    assert len(pairs) == 1
    assert pairs[0].error == 20.0
    assert pairs[0].horizon_h == 14.5


# --- Against the real WINDFOR sample (runs published 10 Jan 2026) ---------------------------------


def test_real_data_decision_for_11_jan_uses_0930_run(real_repo):
    pairs = build_pairs(real_repo, date(2026, 1, 11), date(2026, 1, 11))
    assert len(pairs) == 24  # hourly forecasts scored against half-hourly actuals at the hour
    assert {p.publish_time for p in pairs} == {ts("2026-01-10T09:30:00")}
    horizons = sorted(p.horizon_h for p in pairs)
    assert horizons[0] == 14.5 and horizons[-1] == 37.5


def test_real_data_vintages_exclude_backfill(real_repo):
    pairs = all_vintage_pairs(real_repo, date(2026, 1, 11), date(2026, 1, 11))
    assert pairs, "expected forecast pairs"
    assert all(0 <= p.horizon_h <= 48 for p in pairs)
