"""Decision View data: one delivery day, actual vs the forecast that was available at decision time."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app import config
from app.deps import SelectionParams, check_in_scope, repo_dep, selection_params
from app.models import Series, SeriesPoint, Stats, Vintage, VintagePoint, Vintages
from app.services import metrics
from app.services.repository import Repository
from app.services.selection import Mode, build_pairs, day_slots, decision_cutoff, is_valid_vintage, select_forecast

router = APIRouter(prefix="/api", tags=["series"])

_range_cache: dict[tuple, tuple[float | None, float | None]] = {}


def scope_error_range(repo: Repository, params: SelectionParams) -> tuple[float | None, float | None]:
    """Signed error P10 / P90 over the whole pilot scope, for the same selection settings.

    Used to draw the band of plausible actual outcomes around a forecast:
        actual = forecast - error  ->  [forecast - P90, forecast - P10]
    """
    key = (id(repo), params)
    if key not in _range_cache:
        stats = metrics.summarize(
            build_pairs(repo, config.SCOPE_START, config.SCOPE_END, params.mode, params.cutoff, params.horizon_h)
        )
        _range_cache[key] = (stats["p10"], stats["p90_signed"])
    return _range_cache[key]


@router.get("/series", response_model=Series)
def series(
    day: Annotated[date, Query(alias="date", description="Delivery day, YYYY-MM-DD")],
    params: SelectionParams = Depends(selection_params),
    repo: Repository = Depends(repo_dep),
) -> Series:
    check_in_scope(day, "date")
    p10, p90 = scope_error_range(repo, params)
    points: list[SeriesPoint] = []
    used: set = set()
    for t in day_slots(day):
        actual = repo.actuals.get(t)
        chosen = select_forecast(repo, t, params.mode, params.cutoff, params.horizon_h)
        forecast = publish = horizon = error = low = high = None
        if chosen is not None:
            publish, forecast = chosen
            used.add(publish)
            horizon = (t - publish).total_seconds() / 3600
            error = forecast - actual if actual is not None else None
            if p10 is not None and p90 is not None:
                low, high = forecast - p90, forecast - p10
        points.append(
            SeriesPoint(
                t=t,
                actual=actual,
                forecast=forecast,
                publish_time=publish,
                horizon_h=horizon,
                error=error,
                range_low=low,
                range_high=high,
            )
        )

    day_pairs = build_pairs(repo, day, day, params.mode, params.cutoff, params.horizon_h)
    return Series(
        date=day,
        mode=params.mode.value,
        decision_time=decision_cutoff(day, params.cutoff) if params.mode is Mode.CUTOFF else None,
        publish_times_used=sorted(used),
        points=points,
        day_stats=Stats(**metrics.summarize(day_pairs)),
    )


@router.get("/vintages", response_model=Vintages)
def vintages(
    day: Annotated[date, Query(alias="date", description="Delivery day, YYYY-MM-DD")],
    repo: Repository = Depends(repo_dep),
) -> Vintages:
    """Every forecast run that covered this day (within 0-48 h ahead): shows how the forecast evolved."""
    check_in_scope(day, "date")
    runs: dict = {}
    for t in day_slots(day):
        for publish, value in repo.forecasts.get(t, []):
            if is_valid_vintage(t, publish):
                runs.setdefault(publish, []).append(VintagePoint(t=t, forecast=value))
    return Vintages(date=day, vintages=[Vintage(publish_time=p, points=runs[p]) for p in sorted(runs)])
