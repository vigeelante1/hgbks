import type { Accuracy, ByHorizon, Health, Meta, SelectionParams, Series, Vintages } from './types'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const url = `${BASE}${path}${query.size ? `?${query}` : ''}`
  const res = await fetch(url)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

const sel = (p: SelectionParams) => ({ mode: p.mode, cutoff: p.cutoff, horizon_h: p.horizon_h })

export const api = {
  health: () => get<Health>('/health'),
  meta: () => get<Meta>('/meta'),
  series: (date: string, p: SelectionParams) => get<Series>('/series', { date, ...sel(p) }),
  vintages: (date: string) => get<Vintages>('/vintages', { date }),
  accuracy: (start: string, end: string, p: SelectionParams) =>
    get<Accuracy>('/accuracy', { start, end, ...sel(p) }),
  byHorizon: (start: string, end: string) => get<ByHorizon>('/accuracy/by-horizon', { start, end }),
}
