"""Pydantic response schemas (they also drive the OpenAPI docs at /api/docs)."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class Health(BaseModel):
    status: str
    data_loaded: bool
    detail: str | None = None
    snapshot_built_at: str | None = None


class Meta(BaseModel):
    scope_start: date
    scope_end: date
    delivery_days: list[date]
    default_cutoff: str = Field(description="HH:MM UTC (= UK time in January)")
    max_horizon_h: int
    units: str = "MW"
    actual_rows: int
    forecast_rows: int
    snapshot_built_at: str | None = None
    sources: list[str]


class Stats(BaseModel):
    n: int
    mae: float | None = None
    rmse: float | None = None
    bias: float | None = None
    nmae_pct: float | None = None
    p10: float | None = None
    p90_signed: float | None = None
    p50: float | None = None
    p90: float | None = None
    p99: float | None = None
    max_abs: float | None = None
    r2: float | None = None
    mean_actual: float | None = None


class CompactStats(BaseModel):
    n: int
    mae: float | None = None
    rmse: float | None = None
    bias: float | None = None
    p90: float | None = None


class SeriesPoint(BaseModel):
    t: datetime
    actual: float | None
    forecast: float | None
    publish_time: datetime | None
    horizon_h: float | None
    error: float | None
    range_low: float | None = Field(None, description="Plausible actual, lower bound (forecast - P90 signed error)")
    range_high: float | None = Field(None, description="Plausible actual, upper bound (forecast - P10 signed error)")


class Series(BaseModel):
    date: date
    mode: str
    decision_time: datetime | None
    publish_times_used: list[datetime]
    points: list[SeriesPoint]
    day_stats: Stats


class VintagePoint(BaseModel):
    t: datetime
    forecast: float


class Vintage(BaseModel):
    publish_time: datetime
    points: list[VintagePoint]


class Vintages(BaseModel):
    date: date
    vintages: list[Vintage]


class HourRow(CompactStats):
    hour: int


class DayRow(CompactStats):
    date: date
    energy_error_mwh: float
    abs_energy_error_mwh: float
    forecast_mwh: float
    actual_mwh: float


class BandRow(CompactStats):
    band: str


class HorizonRow(CompactStats):
    bucket: str
    from_h: int
    to_h: int


class HistogramBin(BaseModel):
    from_mw: int
    to_mw: int
    count: int


class Accuracy(BaseModel):
    start: date
    end: date
    mode: str
    stats: Stats
    coverage_pct: float = Field(description="Share of hourly targets that had both an actual and a forecast")
    by_hour: list[HourRow]
    by_day: list[DayRow]
    by_band: list[BandRow]
    histogram: list[HistogramBin]


class ByHorizon(BaseModel):
    start: date
    end: date
    rows: list[HorizonRow]
