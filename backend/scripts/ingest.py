"""Download January-2026 wind actuals and forecasts from Elexon BMRS into a local snapshot.

Usage (from the repo root, any Python 3.10+, no extra packages needed):
    python backend/scripts/ingest.py

Writes backend/data/snapshot/{actuals,forecasts,meta}.json.

Sources (public, no API key):
    FUELHH/stream  - actual half-hourly generation by fuel type (we keep fuelType == WIND)
    WINDFOR/stream - national wind forecasts; one row per (publishTime, startTime)
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config  # noqa: E402

# Forecast publish window: wide enough for the 48 h horizon analysis of the first delivery day,
# through the end of the last delivery day.
FORECAST_PUBLISH_FROM = datetime(2025, 12, 30, tzinfo=timezone.utc)
FORECAST_PUBLISH_TO = datetime.combine(config.SCOPE_END + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)

# Only keep targets inside the delivery-day scope.
TARGET_FROM = datetime.combine(config.SCOPE_START, datetime.min.time(), tzinfo=timezone.utc)
TARGET_TO = FORECAST_PUBLISH_TO

MAX_RETRIES = 5


def iso_z(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def get_json(path: str, params: dict[str, str]) -> list[dict]:
    url = f"{config.ELEXON_BASE_URL}{path}?{urllib.parse.urlencode(params)}"
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(
                url, headers={"Accept": "application/json", "User-Agent": "wind-forecast-insight/1.0"}
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            # Stream endpoints return a plain list; non-stream ones wrap it in {"data": [...]}.
            return body["data"] if isinstance(body, dict) else body
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt < MAX_RETRIES:
                wait = 2**attempt
                print(f"  HTTP {exc.code}, retrying in {wait}s ...")
                time.sleep(wait)
                continue
            raise SystemExit(
                f"Request failed ({exc.code}): {url}\n{exc.read().decode('utf-8', 'ignore')[:500]}"
            ) from exc
        except urllib.error.URLError as exc:
            if attempt < MAX_RETRIES:
                time.sleep(2**attempt)
                continue
            raise SystemExit(f"Network error for {url}: {exc}") from exc
    raise SystemExit(f"Gave up on {url}")


def fetch_actuals() -> list[dict]:
    """FUELHH by settlement date (publish filters can't be combined with settlement-date filters)."""
    latest: dict[str, dict] = {}
    day = config.SCOPE_START
    while day <= config.SCOPE_END:
        rows = get_json(
            "/datasets/FUELHH/stream",
            {
                "settlementDateFrom": day.isoformat(),
                "settlementDateTo": day.isoformat(),
                "fuelType": "WIND",
            },
        )
        wind = [r for r in rows if r.get("fuelType") == "WIND"]
        print(f"  actuals  {day}: {len(wind):3d} rows")
        for r in wind:
            key = r["startTime"]
            if key not in latest or r.get("publishTime", "") >= latest[key].get("publishTime", ""):
                latest[key] = r
        day += timedelta(days=1)

    out = []
    for r in latest.values():
        t = parse_ts(r["startTime"])
        if TARGET_FROM <= t < TARGET_TO:
            out.append(
                {
                    "startTime": iso_z(t),
                    "generation": r["generation"],
                    "settlementDate": r.get("settlementDate"),
                    "settlementPeriod": r.get("settlementPeriod"),
                    "publishTime": r.get("publishTime"),
                }
            )
    return sorted(out, key=lambda r: r["startTime"])


def fetch_forecasts() -> list[dict]:
    """WINDFOR by publish time, one day per request. Empty replies are valid (no run in that window)."""
    unique: dict[tuple[str, str], dict] = {}
    start = FORECAST_PUBLISH_FROM
    while start < FORECAST_PUBLISH_TO:
        end = start + timedelta(days=1)
        rows = get_json(
            "/datasets/WINDFOR/stream",
            {
                "publishDateTimeFrom": iso_z(start),
                "publishDateTimeTo": iso_z(end),
            },
        )
        runs = sorted({r["publishTime"] for r in rows})
        print(f"  forecast {start.date()}: {len(rows):4d} rows, {len(runs)} runs")
        for r in rows:
            p = parse_ts(r["publishTime"])
            # Guard: without valid filters the API silently returns the *latest* forecast instead.
            if not (start <= p <= end):
                raise SystemExit(f"publishTime {r['publishTime']} outside requested window {start}-{end}; aborting.")
            t = parse_ts(r["startTime"])
            if TARGET_FROM <= t < TARGET_TO:
                unique[(iso_z(p), iso_z(t))] = {
                    "publishTime": iso_z(p),
                    "startTime": iso_z(t),
                    "generation": r["generation"],
                }
        start = end
    return sorted(unique.values(), key=lambda r: (r["publishTime"], r["startTime"]))


def quality_report(actuals: list[dict], forecasts: list[dict]) -> dict:
    have = {r["startTime"] for r in actuals}
    missing = []
    t = TARGET_FROM
    while t < TARGET_TO:
        if iso_z(t) not in have:
            missing.append(iso_z(t))
        t += timedelta(minutes=30)
    runs_per_day: dict[str, int] = {}
    for p in sorted({r["publishTime"] for r in forecasts}):
        runs_per_day[p[:10]] = runs_per_day.get(p[:10], 0) + 1
    return {"missing_actual_half_hours": missing, "forecast_runs_per_publish_day": runs_per_day}


def main() -> None:
    out_dir = config.DATA_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    print("Fetching actual wind generation (FUELHH) ...")
    actuals = fetch_actuals()
    print("Fetching wind forecasts (WINDFOR) ...")
    forecasts = fetch_forecasts()
    if not actuals or not forecasts:
        raise SystemExit("No data returned - check your internet connection and the Elexon API status.")

    report = quality_report(actuals, forecasts)
    meta = {
        "built_at": iso_z(datetime.now(timezone.utc)),
        "scope": {"delivery_from": config.SCOPE_START.isoformat(), "delivery_to": config.SCOPE_END.isoformat()},
        "forecast_publish_window": [iso_z(FORECAST_PUBLISH_FROM), iso_z(FORECAST_PUBLISH_TO)],
        "counts": {"actuals": len(actuals), "forecasts": len(forecasts)},
        "sources": [
            f"{config.ELEXON_BASE_URL}/datasets/FUELHH/stream (fuelType=WIND)",
            f"{config.ELEXON_BASE_URL}/datasets/WINDFOR/stream",
        ],
        "quality": report,
    }
    (out_dir / "actuals.json").write_text(json.dumps(actuals, separators=(",", ":")))
    (out_dir / "forecasts.json").write_text(json.dumps(forecasts, separators=(",", ":")))
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2))

    print(f"\nDone -> {out_dir}")
    print(f"  actuals:   {len(actuals)} half-hours (missing {len(report['missing_actual_half_hours'])})")
    print(f"  forecasts: {len(forecasts)} rows across {sum(report['forecast_runs_per_publish_day'].values())} runs")


if __name__ == "__main__":
    main()
