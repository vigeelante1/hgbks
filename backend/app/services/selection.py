"""Which forecast was available when the buying decision was made?

Pure functions, no I/O. This module encodes the core business rule of the product.

Rule (cutoff mode, default):
    for delivery day D and target time t,
    use the forecast vintage with the latest publishTime that satisfies
        publishTime <= cutoff (D-1 at 09:50 UTC)
        startTime   >= publishTime            # WINDFOR runs contain backfilled past hours: drop them
        startTime - publishTime <= 48 h

Rule (horizon mode):
    same, but the latest allowed publishTime is t - H hours.
"""

from __future__ import annotations

from bisect import bisect_right
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from enum import Enum

from app import config
from app.services.repository import Repository

HALF_HOUR = timedelta(minutes=30)


class Mode(str, Enum):
    CUTOFF = "cutoff"
    HORIZON = "horizon"


@dataclass(frozen=True)
class Pair:
    """One scored point: a forecast matched to its actual."""

    target: datetime
    actual: float
    forecast: float
    publish_time: datetime

    @property
    def error(self) -> float:
        """Positive = over-forecast (more wind predicted than happened -> desk under-bought)."""
        return self.forecast - self.actual

    @property
    def horizon_h(self) -> float:
        return (self.target - self.publish_time).total_seconds() / 3600


def decision_cutoff(delivery_day: date, cutoff: time = config.DEFAULT_CUTOFF) -> datetime:
    """The moment the buying decision for `delivery_day` must be made: D-1 at `cutoff` (UTC)."""
    return datetime.combine(delivery_day - timedelta(days=1), cutoff, tzinfo=timezone.utc)


def is_valid_vintage(target: datetime, publish_time: datetime, max_horizon_h: float = config.MAX_HORIZON_H) -> bool:
    """A real forecast: published before the target, and not further ahead than the cap."""
    horizon_h = (target - publish_time).total_seconds() / 3600
    return 0 <= horizon_h <= max_horizon_h


def latest_vintage(
    vintages: list[tuple[datetime, float]],
    target: datetime,
    latest_publish: datetime,
) -> tuple[datetime, float] | None:
    """Latest valid vintage published at or before `latest_publish`. `vintages` must be sorted by publish time."""
    idx = bisect_right(vintages, (latest_publish, float("inf")))
    for publish_time, value in reversed(vintages[:idx]):
        if publish_time > target:
            continue  # backfill row, not a forecast
        if is_valid_vintage(target, publish_time):
            return publish_time, value
        return None  # older vintages are only further ahead -> also beyond the cap
    return None


def latest_allowed_publish(
    target: datetime, mode: Mode, cutoff: time = config.DEFAULT_CUTOFF, horizon_h: float = 0
) -> datetime:
    if mode is Mode.CUTOFF:
        delivery_day = target.date()
        return decision_cutoff(delivery_day, cutoff)
    return target - timedelta(hours=horizon_h)


def day_slots(day: date, step: timedelta = HALF_HOUR) -> Iterator[datetime]:
    t = datetime.combine(day, time(0), tzinfo=timezone.utc)
    end = t + timedelta(days=1)
    while t < end:
        yield t
        t += step


def days_between(start: date, end: date) -> Iterator[date]:
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def select_forecast(
    repo: Repository, target: datetime, mode: Mode, cutoff: time = config.DEFAULT_CUTOFF, horizon_h: float = 0
) -> tuple[datetime, float] | None:
    vintages = repo.forecasts.get(target)
    if not vintages:
        return None
    return latest_vintage(vintages, target, latest_allowed_publish(target, mode, cutoff, horizon_h))


def build_pairs(
    repo: Repository,
    start: date,
    end: date,
    mode: Mode = Mode.CUTOFF,
    cutoff: time = config.DEFAULT_CUTOFF,
    horizon_h: float = 0,
) -> list[Pair]:
    """All scored points in [start, end] (delivery days, inclusive). Only times with both an actual and a forecast."""
    pairs: list[Pair] = []
    for day in days_between(start, end):
        for target in day_slots(day):
            actual = repo.actuals.get(target)
            if actual is None:
                continue
            chosen = select_forecast(repo, target, mode, cutoff, horizon_h)
            if chosen is None:
                continue
            pairs.append(Pair(target=target, actual=actual, forecast=chosen[1], publish_time=chosen[0]))
    return pairs


def all_vintage_pairs(repo: Repository, start: date, end: date) -> list[Pair]:
    """Every valid (target, vintage) combination — used to show how error grows with lead time."""
    pairs: list[Pair] = []
    for day in days_between(start, end):
        for target in day_slots(day):
            actual = repo.actuals.get(target)
            if actual is None:
                continue
            for publish_time, value in repo.forecasts.get(target, []):
                if is_valid_vintage(target, publish_time):
                    pairs.append(Pair(target=target, actual=actual, forecast=value, publish_time=publish_time))
    return pairs
