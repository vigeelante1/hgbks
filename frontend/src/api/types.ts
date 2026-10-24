// Mirrors backend/app/models.py

export type Mode = 'cutoff' | 'horizon'

export interface SelectionParams {
  mode: Mode
  cutoff: string // HH:MM UTC
  horizon_h: number
}

export interface Health {
  status: string
  data_loaded: boolean
  detail?: string | null
  snapshot_built_at?: string | null
}

export interface Meta {
  scope_start: string
  scope_end: string
  delivery_days: string[]
  default_cutoff: string
  max_horizon_h: number
  units: string
  actual_rows: number
  forecast_rows: number
  snapshot_built_at: string | null
  sources: string[]
}

export interface Stats {
  n: number
  mae: number | null
  rmse: number | null
  bias: number | null
  nmae_pct: number | null
  p10: number | null
  p90_signed: number | null
  p50: number | null
  p90: number | null
  p99: number | null
  max_abs: number | null
  r2: number | null
  mean_actual: number | null
}

export interface CompactStats {
  n: number
  mae: number | null
  rmse: number | null
  bias: number | null
  p90: number | null
}

export interface SeriesPoint {
  t: string
  actual: number | null
  forecast: number | null
  publish_time: string | null
  horizon_h: number | null
  error: number | null
  range_low: number | null
  range_high: number | null
}

export interface Series {
  date: string
  mode: Mode
  decision_time: string | null
  publish_times_used: string[]
  points: SeriesPoint[]
  day_stats: Stats
}

export interface Vintages {
  date: string
  vintages: { publish_time: string; points: { t: string; forecast: number }[] }[]
}

export interface Accuracy {
  start: string
  end: string
  mode: Mode
  stats: Stats
  coverage_pct: number
  by_hour: (CompactStats & { hour: number })[]
  by_day: (CompactStats & {
    date: string
    energy_error_mwh: number
    abs_energy_error_mwh: number
    forecast_mwh: number
    actual_mwh: number
  })[]
  by_band: (CompactStats & { band: string })[]
  histogram: { from_mw: number; to_mw: number; count: number }[]
}

export interface ByHorizon {
  start: string
  end: string
  rows: (CompactStats & { bucket: string; from_h: number; to_h: number })[]
}
