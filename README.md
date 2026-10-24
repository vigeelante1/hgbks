# Wind Forecast Insight

A web app for a UK utility's day-ahead power-buying team. For every purchase decision made in **January 2026** it shows:

1. **The latest national wind forecast available at decision time** (09:50 UK time the day before delivery — GB day-ahead auction gate closure).
2. **How accurate those forecasts were**, quantified (MAE, RMSE, bias, P90 error, by lead time / hour / wind level / day), so the team can size a buffer for forecast error.

Data: Elexon BMRS only — `FUELHH` (actual generation, fuel type `WIND`) and `WINDFOR` (wind forecasts).

**Live app:** `<add Vercel URL here>`
**API docs:** `<Vercel URL>/api/docs`

---

## Use of AI tools

This project was built with the help of an AI assistant (Anthropic's Claude), used for analysing the brief, planning, writing code, tests and documentation. All design decisions, code and results were reviewed, run and verified by the author.

---

## How to start the application

### Option A — Docker (recommended)

Requires Docker Desktop.

```bash
docker compose up --build
```

- App: http://localhost:8080
- API + interactive docs: http://localhost:8000/api/docs

### Option B — run locally without Docker

Requires Python 3.10+ and Node 20+.

```bash
# 1) backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate     macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# 2) frontend (new terminal)
cd frontend
npm install
npm run dev            # http://localhost:5173  (proxies /api to :8000)
```

### Refreshing the data (optional)

The January 2026 data is already included in `backend/data/snapshot/`. To download it again from Elexon (needs internet, no API key, plain Python — no packages required):

```bash
python backend/scripts/ingest.py
```

### Tests and checks

```bash
cd backend  && ruff check . && pytest -q
cd frontend && npm run lint && npm test && npm run build
```

The same checks run on every push via GitHub Actions (`.github/workflows/ci.yml`).

---

## Files and directories

```
.
├── README.md                 This file
├── ARCHITECTURE.md           Architecture, design decisions, analysis findings, code walkthrough, dev practices
├── docker-compose.yml        Runs backend + frontend containers locally
├── vercel.json               Vercel deployment: static frontend + Python serverless API under /api
├── requirements.txt          Python dependencies for the Vercel function
├── api/
│   └── index.py              Vercel entry point — imports the FastAPI app from backend/
├── backend/                  Python / FastAPI
│   ├── Dockerfile
│   ├── requirements.txt      Runtime dependencies
│   ├── requirements-dev.txt  + server, tests, linter
│   ├── pyproject.toml        pytest and ruff configuration
│   ├── app/
│   │   ├── main.py           FastAPI app, CORS, router registration, /api/docs
│   │   ├── config.py         Scope dates, decision time (09:50), horizon cap, buckets
│   │   ├── models.py         Pydantic response schemas
│   │   ├── deps.py           Shared validated query parameters
│   │   ├── routers/
│   │   │   ├── meta.py       /api/health, /api/meta
│   │   │   ├── series.py     /api/series (one delivery day), /api/vintages (all forecast runs)
│   │   │   └── accuracy.py   /api/accuracy, /api/accuracy/by-horizon
│   │   └── services/
│   │       ├── repository.py Loads and indexes the data snapshot
│   │       ├── selection.py  Core rule: which forecast was available at decision time
│   │       └── metrics.py    Error statistics and breakdowns
│   ├── scripts/ingest.py     Downloads January 2026 data from Elexon into the snapshot
│   ├── data/snapshot/        actuals.json, forecasts.json, meta.json (the dataset the app serves)
│   └── tests/                Unit + API tests (fixture = real WINDFOR response for 10 Jan 2026)
├── frontend/                 React + TypeScript (Vite)
│   ├── Dockerfile, nginx.conf  Production container: static files + /api proxy
│   ├── index.html
│   └── src/
│       ├── main.tsx, App.tsx Entry, layout, tabs, URL-synced state
│       ├── api/              Typed API client and response types
│       ├── hooks/            Data fetching (TanStack Query) and URL state
│       ├── pages/            DecisionView, AccuracyView, Methodology
│       ├── components/       UI primitives, selection controls, charts (Recharts)
│       └── lib/              Formatting (UK time, MW/MWh) and chart theme
└── .github/workflows/ci.yml  Lint, test and build on every push
```

---

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Status and whether data is loaded |
| `GET /api/meta` | Scope, delivery days, defaults, data counts, sources |
| `GET /api/series?date=YYYY-MM-DD` | One delivery day: actual vs forecast used, error band |
| `GET /api/vintages?date=YYYY-MM-DD` | Every forecast run covering that day |
| `GET /api/accuracy?start=&end=` | Accuracy statistics and breakdowns |
| `GET /api/accuracy/by-horizon?start=&end=` | Error by lead time (all forecast runs) |

Selection parameters on `series` and `accuracy`: `mode=cutoff|horizon`, `cutoff=HH:MM` (default `09:50`), `horizon_h=0..48`.

---

## Deployment (Vercel)

Import the GitHub repository in Vercel and deploy with default settings — `vercel.json` configures everything: the frontend is built from `frontend/` and served statically; `api/index.py` runs the FastAPI app as a Python serverless function for all `/api/*` routes, reading the committed snapshot.

Docker is used for local and portable runs; Vercel does not run containers, so the hosted version uses its native Python and static runtimes from the same code.
