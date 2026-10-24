"""Forecast error statistics. Pure functions over lists of `Pair`.

error = forecast - actual  (MW).  Positive = over-forecast.
MAPE is deliberately not used: it explodes when wind output is near zero.
"""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Callable, Iterable

from app import config
from app.services.selection import Pair


def percentile(values: list[float], q: float) -> float:
    """Linear-interpolation percentile (same as numpy's default). q in [0, 100]."""
    if not values:
        return math.nan
    ordered = sorted(values)
    pos = (len(ordered) - 1) * q / 100
    lo, hi = math.floor(pos), math.ceil(pos)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo)


def summarize(pairs: list[Pair]) -> dict:
    """Headline accuracy numbers for a set of pairs."""
    n = len(pairs)
    if n == 0:
        keys = (
            "mae",
            "rmse",
            "bias",
            "nmae_pct",
            "p10",
            "p90_signed",
            "p50",
            "p90",
            "p99",
            "max_abs",
            "r2",
            "mean_actual",
        )
        return {"n": 0, **dict.fromkeys(keys)}
    errors = [p.error for p in pairs]
    abs_errors = [abs(e) for e in errors]
    actuals = [p.actual for p in pairs]
    mean_actual = sum(actuals) / n
    mae = sum(abs_errors) / n
    ss_res = sum(e * e for e in errors)
    ss_tot = sum((a - mean_actual) ** 2 for a in actuals)
    return {
        "n": n,
        "mae": mae,
        "rmse": math.sqrt(ss_res / n),
        "bias": sum(errors) / n,
        "nmae_pct": 100 * mae / mean_actual if mean_actual else None,
        # Signed error percentiles -> plausible range of the actual around a forecast.
        "p10": percentile(errors, 10),
        "p90_signed": percentile(errors, 90),
        # Absolute error percentiles -> "9 times in 10 the miss is below X MW".
        "p50": percentile(abs_errors, 50),
        "p90": percentile(abs_errors, 90),
        "p99": percentile(abs_errors, 99),
        "max_abs": max(abs_errors),
        "r2": 1 - ss_res / ss_tot if ss_tot else None,
        "mean_actual": mean_actual,
    }


def _group(pairs: Iterable[Pair], key: Callable[[Pair], object]) -> dict[object, list[Pair]]:
    groups: dict[object, list[Pair]] = defaultdict(list)
    for p in pairs:
        groups[key(p)].append(p)
    return groups


def _compact(stats: dict) -> dict:
    return {k: stats[k] for k in ("n", "mae", "rmse", "bias", "p90")}


def by_hour(pairs: list[Pair]) -> list[dict]:
    groups = _group(pairs, lambda p: p.target.hour)
    return [{"hour": h, **_compact(summarize(groups[h]))} for h in sorted(groups)]


def by_day(pairs: list[Pair]) -> list[dict]:
    """Per delivery day, including the energy (MWh) that would have been mis-bought.

    Pairs are hourly (WINDFOR resolution), so each error (MW) stands for 1 hour of energy.
    """
    groups = _group(pairs, lambda p: p.target.date())
    rows = []
    for day in sorted(groups):
        ps = groups[day]
        rows.append(
            {
                "date": day.isoformat(),
                **_compact(summarize(ps)),
                "energy_error_mwh": sum(p.error for p in ps),
                "abs_energy_error_mwh": sum(abs(p.error) for p in ps),
                "forecast_mwh": sum(p.forecast for p in ps),
                "actual_mwh": sum(p.actual for p in ps),
            }
        )
    return rows


def by_band(pairs: list[Pair]) -> list[dict]:
    rows = []
    for label, lo, hi in config.GENERATION_BANDS:
        ps = [p for p in pairs if lo <= p.actual < hi]
        rows.append({"band": label, **_compact(summarize(ps))})
    return rows


def by_horizon(pairs: list[Pair]) -> list[dict]:
    rows = []
    for lo, hi in config.HORIZON_BUCKETS:
        ps = [p for p in pairs if lo <= p.horizon_h < hi or (hi == config.MAX_HORIZON_H and p.horizon_h == hi)]
        rows.append({"bucket": f"{lo}-{hi} h", "from_h": lo, "to_h": hi, **_compact(summarize(ps))})
    return rows


def histogram(pairs: list[Pair], bin_mw: int = config.HISTOGRAM_BIN_MW) -> list[dict]:
    if not pairs:
        return []
    counts: dict[int, int] = defaultdict(int)
    for p in pairs:
        counts[math.floor(p.error / bin_mw)] += 1
    lo, hi = min(counts), max(counts)
    return [{"from_mw": b * bin_mw, "to_mw": (b + 1) * bin_mw, "count": counts.get(b, 0)} for b in range(lo, hi + 1)]
