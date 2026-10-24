from __future__ import annotations

import math

import pytest

from app.services import metrics
from app.services.selection import Pair
from tests.conftest import ts


def make_pairs(errors: list[float], actual: float = 1000.0) -> list[Pair]:
    pub = ts("2026-01-10T09:30:00")
    return [
        Pair(target=ts(f"2026-01-11T{h:02d}:00:00"), actual=actual, forecast=actual + e, publish_time=pub)
        for h, e in enumerate(errors)
    ]


def test_percentile_matches_linear_interpolation():
    assert metrics.percentile([1, 2, 3, 4], 50) == 2.5
    assert metrics.percentile([0, 10], 90) == 9
    assert math.isnan(metrics.percentile([], 50))


def test_summary_known_answers():
    s = metrics.summarize(make_pairs([100, -100, 300, -300]))
    assert s["n"] == 4
    assert s["mae"] == 200
    assert s["bias"] == 0
    assert s["rmse"] == pytest.approx(math.sqrt((100**2 * 2 + 300**2 * 2) / 4))
    assert s["nmae_pct"] == pytest.approx(20.0)
    assert s["max_abs"] == 300


def test_bias_sign_positive_means_over_forecast():
    assert metrics.summarize(make_pairs([50, 150]))["bias"] == 100


def test_empty_summary_is_safe():
    s = metrics.summarize([])
    assert s["n"] == 0 and s["mae"] is None


def test_daily_energy_error_is_hourly_mwh():
    rows = metrics.by_day(make_pairs([100, -50, 25]))
    assert rows[0]["energy_error_mwh"] == 75
    assert rows[0]["abs_energy_error_mwh"] == 175


def test_histogram_counts_everything():
    pairs = make_pairs([-600, -10, 10, 499, 501])
    bins = metrics.histogram(pairs, bin_mw=500)
    assert sum(b["count"] for b in bins) == len(pairs)
    assert bins[0]["from_mw"] == -1000


def test_horizon_buckets_include_48h_edge():
    pub = ts("2026-01-10T00:00:00")
    pairs = [Pair(target=ts("2026-01-12T00:00:00"), actual=1, forecast=2, publish_time=pub)]  # exactly 48 h
    rows = metrics.by_horizon(pairs)
    assert rows[-1]["n"] == 1
