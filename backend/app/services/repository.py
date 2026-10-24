"""Loads the ingested snapshot and indexes it for fast lookups.

This is the only module that knows how data is stored. Swapping JSON for a database
later only means changing this file.
"""

from __future__ import annotations

import json
from bisect import insort
from dataclasses import dataclass, field
from datetime import datetime
from functools import lru_cache
from pathlib import Path

from app import config


def parse_ts(value: str) -> datetime:
    """Parse an Elexon ISO timestamp ('2026-01-10T09:30:00Z') into an aware UTC datetime."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class DataNotLoadedError(RuntimeError):
    """Raised when the snapshot has not been ingested yet."""


@dataclass
class Repository:
    # Actual wind generation (MW) per 30-min start time.
    actuals: dict[datetime, float] = field(default_factory=dict)
    # For every target start time: all forecast vintages as (publish_time, MW), sorted by publish_time.
    forecasts: dict[datetime, list[tuple[datetime, float]]] = field(default_factory=dict)
    meta: dict = field(default_factory=dict)

    @classmethod
    def from_records(cls, actual_rows: list[dict], forecast_rows: list[dict], meta: dict | None = None) -> Repository:
        repo = cls(meta=meta or {})
        for row in actual_rows:
            repo.actuals[parse_ts(row["startTime"])] = float(row["generation"])
        for row in forecast_rows:
            target = parse_ts(row["startTime"])
            insort(repo.forecasts.setdefault(target, []), (parse_ts(row["publishTime"]), float(row["generation"])))
        return repo

    @classmethod
    def from_dir(cls, directory: Path) -> Repository:
        actuals_path = directory / "actuals.json"
        forecasts_path = directory / "forecasts.json"
        if not actuals_path.exists() or not forecasts_path.exists():
            raise DataNotLoadedError(
                f"Snapshot not found in {directory}. Run `python backend/scripts/ingest.py` first."
            )
        meta_path = directory / "meta.json"
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        return cls.from_records(
            json.loads(actuals_path.read_text()),
            json.loads(forecasts_path.read_text()),
            meta,
        )


@lru_cache(maxsize=1)
def get_repository() -> Repository:
    """Load once per process (one cold start on Vercel)."""
    return Repository.from_dir(config.DATA_DIR)
