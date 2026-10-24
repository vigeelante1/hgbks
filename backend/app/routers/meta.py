from __future__ import annotations

from fastapi import APIRouter, Depends

from app import config
from app.deps import repo_dep
from app.models import Health, Meta
from app.services.repository import DataNotLoadedError, Repository, get_repository
from app.services.selection import days_between

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health", response_model=Health)
def health() -> Health:
    try:
        repo = get_repository()
    except DataNotLoadedError as exc:
        return Health(status="degraded", data_loaded=False, detail=str(exc))
    return Health(status="ok", data_loaded=True, snapshot_built_at=repo.meta.get("built_at"))


@router.get("/meta", response_model=Meta)
def meta(repo: Repository = Depends(repo_dep)) -> Meta:
    return Meta(
        scope_start=config.SCOPE_START,
        scope_end=config.SCOPE_END,
        delivery_days=list(days_between(config.SCOPE_START, config.SCOPE_END)),
        default_cutoff=config.DEFAULT_CUTOFF.strftime("%H:%M"),
        max_horizon_h=config.MAX_HORIZON_H,
        actual_rows=len(repo.actuals),
        forecast_rows=sum(len(v) for v in repo.forecasts.values()),
        snapshot_built_at=repo.meta.get("built_at"),
        sources=repo.meta.get("sources", []),
    )
