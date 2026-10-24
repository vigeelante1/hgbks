"""Accuracy View data: error statistics over a range of delivery days."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app import config
from app.deps import SelectionParams, check_in_scope, repo_dep, selection_params
from app.models import Accuracy, ByHorizon, Stats
from app.services import metrics
from app.services.repository import Repository
from app.services.selection import all_vintage_pairs, build_pairs, days_between

router = APIRouter(prefix="/api", tags=["accuracy"])

StartQ = Annotated[date, Query(description="First delivery day")]
EndQ = Annotated[date, Query(description="Last delivery day (inclusive)")]


def _check_range(start: date, end: date) -> None:
    check_in_scope(start, "start")
    check_in_scope(end, "end")
    if start > end:
        raise HTTPException(status_code=422, detail="start must be on or before end")


@router.get("/accuracy", response_model=Accuracy)
def accuracy(
    start: StartQ = config.SCOPE_START,
    end: EndQ = config.SCOPE_END,
    params: SelectionParams = Depends(selection_params),
    repo: Repository = Depends(repo_dep),
) -> Accuracy:
    _check_range(start, end)
    pairs = build_pairs(repo, start, end, params.mode, params.cutoff, params.horizon_h)
    expected = 24 * len(list(days_between(start, end)))
    return Accuracy(
        start=start,
        end=end,
        mode=params.mode.value,
        stats=Stats(**metrics.summarize(pairs)),
        coverage_pct=100 * len(pairs) / expected if expected else 0,
        by_hour=metrics.by_hour(pairs),
        by_day=metrics.by_day(pairs),
        by_band=metrics.by_band(pairs),
        histogram=metrics.histogram(pairs),
    )


@router.get("/accuracy/by-horizon", response_model=ByHorizon)
def accuracy_by_horizon(
    start: StartQ = config.SCOPE_START,
    end: EndQ = config.SCOPE_END,
    repo: Repository = Depends(repo_dep),
) -> ByHorizon:
    """Error of *every* forecast run, bucketed by how far ahead it was made."""
    _check_range(start, end)
    return ByHorizon(start=start, end=end, rows=metrics.by_horizon(all_vintage_pairs(repo, start, end)))
