# ARCHITECTURE.md — Wind Forecast Insight (UK Day-Ahead)

> Knowledge-transfer guide for the reviewing tech lead: **architecture, design, analysis, code base, key development practices**.

---

## 1. What the product does (30-second version)

A UK utility's day-ahead desk must decide **by 09:50 UK time the day before delivery** how much power to buy. Wind output is uncertain, so they rely on the national wind forecast. This app answers two questions for every delivery day of the January 2026 pilot:

1. **What was the latest wind forecast available at decision time?**
2. **How wrong do those forecasts tend to be — and by how much?** (so the desk can size a safety buffer)

Data: Elexon BMRS only — `FUELHH` (actuals, fuel type WIND) and `WINDFOR` (forecasts).

---

## 2. Architecture

```
                     ┌────────────────────────────┐
                     │ Elexon BMRS Insights API    │  public, no key
                     │  FUELHH/stream  WINDFOR/stream
                     └──────────────┬─────────────┘
                                    │ scripts/ingest.py (run once / on demand)
                                    │  chunk by day → retry → filter WIND → dedup
                                    ▼
                     ┌────────────────────────────┐
                     │ data/snapshot/*.json        │  versioned in git, immutable
                     └──────────────┬─────────────┘
                                    │ loaded at startup, indexed in memory
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│ FastAPI backend                                              │
│  routers/  → thin HTTP layer (validation, Pydantic schemas)  │
│  services/selection.py → "which forecast was available?"     │
│  services/metrics.py   → MAE, RMSE, bias, P90, …             │
│  services/repository.py→ data access (swap for DB later)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ JSON over /api/*
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ React SPA (Vite + TypeScript)                                │
│  Decision View · Accuracy View · Methodology                 │
│  TanStack Query (cache, loading/error) · Recharts            │
└─────────────────────────────────────────────────────────────┘

Runtimes:
  Local / portable : docker compose → backend(uvicorn:8000) + frontend(nginx:8080, proxies /api)
  Cloud            : Vercel → static SPA + FastAPI as Python serverless function at /api/*
```

### Why a snapshot instead of calling Elexon live?

January 2026 is historical and won't change. Serving from a committed snapshot makes the app **fast** (no upstream calls), **reliable** (demo survives an Elexon outage), **reproducible** (every reviewer sees identical numbers) and **cheap on Vercel cold starts**. The Elexon client is still a first-class module, so switching to live/scheduled ingest is a config change, not a rewrite.

---

## 3. Design

### 3.1 Layering

| Layer | Responsibility | Rule |
|-------|----------------|------|
| `routers/` | HTTP, params, status codes | No business logic |
| `services/selection.py` | Forecast-at-decision-time rule | Pure functions, no I/O → trivially testable |
| `services/metrics.py` | Error statistics | Pure functions |
| `services/repository.py` | Load & index data | Only place that knows storage format |
| `services/elexon_client.py` | Upstream HTTP | Only place that knows Elexon |

### 3.2 Key domain rule

```
For delivery day D and target time t:
  cutoff = (D − 1 day) at 09:50 UTC      # GB day-ahead auction gate closure
  forecast_used(t) = vintage with the latest publishTime ≤ cutoff
                     AND publishTime ≤ t              # drop backfill rows (see below)
                     AND t − publishTime ≤ 48 h
  error(t) = forecast_used(t) − actual(t)          # + means over-forecast
```

Alternative **horizon mode**: `publishTime ≤ t − H` (H slider 0–48 h) to study how accuracy decays with lead time.

**Data facts confirmed from a real WINDFOR response (10 Jan 2026):** 8 runs/day (02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, 22:30 UTC), hourly targets, and every run covers a fixed window from 21:00 on the previous day — so each run also contains hours that have already happened. Those rows are not forecasts; including them would make accuracy look better than it is, so they are filtered out (and unit-tested). With the 09:50 cutoff the forecast used is always the **09:30 run on D−1**, looking **14.5–37.5 h ahead**. Forecasts are hourly and actuals half-hourly, so scoring happens at each hour (24 points per day).

### 3.3 Scope interpretation

"Purchase decisions made in January 2026" → decisions on **1–31 Jan**, i.e. **delivery days 2 Jan – 1 Feb 2026**. January is GMT, so UK time = UTC throughout; code still works strictly in UTC.

### 3.4 API

Interactive OpenAPI docs at `/api/docs`. Endpoints: `health`, `meta`, `series`, `vintages`, `accuracy`, `accuracy/by-horizon`. All inputs validated against the scope window (422 otherwise).

### 3.5 Frontend

`pages/` (views) → `components/` (charts, KPI tiles, controls) → `hooks/` (one TanStack Query hook per endpoint) → `api/` (typed fetch client). State lives in the URL query string (date, mode, cutoff) so any view is shareable/bookmarkable.

---

## 4. Analysis

| Metric | Meaning for the desk |
|--------|----------------------|
| MAE | Typical miss (MW) |
| RMSE | Sensitive to large misses (imbalance cost) |
| Bias | Systematic over/under forecasting → under/over buying |
| nMAE | MAE as % of mean output — comparable across periods |
| P90 \|error\| | "9 times in 10 the miss is below X MW" → buffer size |
| Daily energy error (MWh) | Volume that would have been mis-bought |

Breakdowns: by forecast horizon, hour of day, delivery day, wind level; error histogram.
MAPE deliberately excluded — it explodes when wind is near zero.

### Findings (real data, delivery 2 Jan – 1 Feb 2026, 09:50 decision time)

Data completeness: 1,488 / 1,488 actual half-hours, 8 forecast runs every publish day, 744 / 744 hourly points scored (100 % coverage).

| Measure | Value |
|---|---|
| MAE (typical miss) | **1,996 MW** — 17.7 % of mean output (11.3 GW) |
| Bias | **+1,728 MW** — forecasts were systematically too high |
| P90 \|error\| | **4,184 MW** (P99 6,213 MW, max 6,857 MW) |
| RMSE · R² | 2,499 MW · 0.65 |
| Plausible actual range | forecast − 4.2 GW … forecast + 0.5 GW (P10–P90 of signed error) |

- **Systematic over-forecast.** The error distribution sits mostly right of zero. For the desk this means the wind forecast alone would have led to **under-buying**; a downward adjustment of roughly the bias is the first lever. (A plausible cause worth investigating with more data is wind curtailment: the forecast is of available wind, actuals are metered output. Not verified here.)
- **Error grows with lead time:** MAE 1.65 GW at 0–6 h → 2.23 GW at 36–48 h; P90 3.4 GW → 4.4 GW. The day-ahead decision (14.5–37.5 h ahead) sits in the middle of this range.
- **By hour:** misses are largest overnight/early morning (00:00–07:00, ~2.3 GW MAE), smallest in the afternoon.
- **By wind level:** largest error at high wind (> 12 GW: MAE 2.35 GW, bias +2.29 GW); medium wind is most accurate (MAE 1.58 GW).
- **Worst day:** Wed 28 Jan — forecast 267 GWh vs actual 139 GWh, **128 GWh over-forecast**. Best day: Mon 19 Jan (18 GWh gross error).

---

## 5. Code base map

```
api/index.py                 Vercel entry → imports backend app
backend/app/main.py          App factory, CORS, router registration
backend/app/config.py        Settings (cutoff, scope dates, snapshot path)
backend/app/models.py        Pydantic request/response schemas
backend/app/deps.py          Shared validated query params (mode, cutoff, horizon), scope check
backend/app/routers/         meta.py · series.py · accuracy.py
backend/app/services/        elexon_client · repository · selection · metrics
backend/scripts/ingest.py    Elexon → snapshot CLI
backend/data/snapshot/       actuals.json · forecasts.json
backend/tests/               unit (selection, metrics) + API tests; fixture = real WINDFOR response for 10 Jan 2026
frontend/src/                api · hooks · components · pages · lib
docker-compose.yml           Local full stack
vercel.json                  Routing for SPA + Python function
.github/workflows/ci.yml     Lint, test, build on every push
```

Start reading at **`services/selection.py`** — it's the heart of the product.

---

## 6. Key development practices

- **Pure core, thin edges** — business logic has no I/O, so it's unit-tested with tiny hand-made fixtures (incl. boundary: forecast published exactly at cutoff; no forecast available).
- **Typed end to end** — Pydantic on the API, TypeScript on the client.
- **Quality gates** — ruff (lint + format check), pytest, ESLint, Vitest and a production build — all run in CI on every push.
- **Reproducibility** — committed snapshot + Docker compose; one command to run.
- **Config over constants** — cutoff time and scope dates in `config.py` / env.
- **UTC everywhere** internally; UK-time labels in the UI.
- **Documented layout** — README explains every directory; this file explains the design.
- **AI assistance** disclosed in README, all code reviewed and tested by the author.

---

## 7. Trade-offs & next steps

| Chose | Over | Because |
|-------|------|---------|
| Snapshot JSON | Database | Small, immutable dataset; zero ops |
| Pure Python stats | pandas at runtime | Serverless bundle size & cold start |
| Vercel functions | Container hosting | Brief asks for Vercel; Docker kept for local parity |

Next: scheduled live ingest, more fuel types (solar), probabilistic buffer recommendation, alerting when forecast revisions are large, Postgres when data grows.
