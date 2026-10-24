from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.services.repository import Repository

FIXTURES = Path(__file__).parent / "fixtures"


def ts(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


@pytest.fixture(scope="session")
def real_windfor_rows() -> list[dict]:
    """Real WINDFOR stream response: all runs published on 10 Jan 2026 (584 rows, 8 runs)."""
    return json.loads((FIXTURES / "windfor_2026-01-10.json").read_text())


@pytest.fixture(scope="session")
def flat_actual_rows() -> list[dict]:
    """TEST-ONLY synthetic actuals: a flat 10,000 MW every half-hour on 11 Jan 2026.

    Real actuals come from FUELHH at ingest time; this just gives the real forecasts something to be scored against.
    """
    start = ts("2026-01-11T00:00:00")
    return [
        {"startTime": (start + timedelta(minutes=30 * i)).strftime("%Y-%m-%dT%H:%M:%SZ"), "generation": 10_000}
        for i in range(48)
    ]


@pytest.fixture(scope="session")
def real_repo(real_windfor_rows, flat_actual_rows) -> Repository:
    return Repository.from_records(flat_actual_rows, real_windfor_rows)
