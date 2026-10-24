"""Application settings. Everything time-related is UTC (January 2026 is GMT, so UK time == UTC)."""

from __future__ import annotations

import os
from datetime import date, time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Where the ingested snapshot lives. Overridable for tests.
DATA_DIR = Path(os.getenv("DATA_DIR", BACKEND_DIR / "data" / "snapshot"))

# Scope: purchase decisions made 1-31 Jan 2026  ->  delivery days 2 Jan - 1 Feb 2026.
SCOPE_START = date(2026, 1, 2)
SCOPE_END = date(2026, 2, 1)

# GB day-ahead auction gate closure (Nord Pool N2EX): 09:50 UK time on D-1.
DEFAULT_CUTOFF = time(9, 50)

# Forecasts further ahead than this are ignored in all analysis.
MAX_HORIZON_H = 48

# Horizon buckets (hours ahead) used for the accuracy-vs-lead-time breakdown.
HORIZON_BUCKETS: list[tuple[int, int]] = [(0, 6), (6, 12), (12, 24), (24, 36), (36, 48)]

# Actual-generation bands (MW) for the "accuracy by wind level" breakdown.
GENERATION_BANDS: list[tuple[str, float, float]] = [
    ("Low (< 5 GW)", 0, 5_000),
    ("Medium (5-12 GW)", 5_000, 12_000),
    ("High (> 12 GW)", 12_000, float("inf")),
]

HISTOGRAM_BIN_MW = 500

ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"

CORS_ORIGINS = [o for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o]
