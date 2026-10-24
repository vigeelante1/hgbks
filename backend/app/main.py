"""FastAPI application entry point (local: uvicorn app.main:app, Vercel: api/index.py)."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.routers import accuracy, meta, series

app = FastAPI(
    title="Wind Forecast Insight API",
    description="UK national wind forecasts vs actuals (Elexon BMRS) for day-ahead purchase decisions, January 2026.",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(meta.router)
app.include_router(series.router)
app.include_router(accuracy.router)
