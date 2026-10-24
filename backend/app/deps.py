"""Shared, validated query parameters and dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time
from typing import Annotated

from fastapi import HTTPException, Query

from app import config
from app.services.repository import DataNotLoadedError, Repository, get_repository
from app.services.selection import Mode


def repo_dep() -> Repository:
    try:
        return get_repository()
    except DataNotLoadedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def check_in_scope(value: date, name: str) -> date:
    if not (config.SCOPE_START <= value <= config.SCOPE_END):
        raise HTTPException(
            status_code=422,
            detail=f"{name}={value} is outside the pilot scope {config.SCOPE_START} … {config.SCOPE_END} "
            "(delivery days for decisions made in January 2026).",
        )
    return value


@dataclass(frozen=True)
class SelectionParams:
    mode: Mode
    cutoff: time
    horizon_h: float


def selection_params(
    mode: Annotated[
        Mode, Query(description="cutoff = forecast available at decision time; horizon = H hours ahead")
    ] = Mode.CUTOFF,
    cutoff: Annotated[
        str, Query(pattern=r"^([01]\d|2[0-3]):[0-5]\d$", description="Decision time on D-1, HH:MM UTC")
    ] = config.DEFAULT_CUTOFF.strftime("%H:%M"),
    horizon_h: Annotated[float, Query(ge=0, le=config.MAX_HORIZON_H, description="Hours ahead (horizon mode)")] = 24,
) -> SelectionParams:
    hh, mm = cutoff.split(":")
    return SelectionParams(mode=mode, cutoff=time(int(hh), int(mm)), horizon_h=horizon_h)
