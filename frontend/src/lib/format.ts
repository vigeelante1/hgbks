// All timestamps from the API are UTC. We display UK local time (GMT in January).
const UK = 'Europe/London'

export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: UK, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

export const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: UK, weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso),
  )

export const fmtDayLong = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: UK,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${iso}T12:00:00Z`))

export const fmtDateTime = (iso: string) => `${fmtTime(iso)} on ${fmtDay(iso)}`

const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export const fmtMW = (v: number | null | undefined) => (v == null ? '—' : `${nf0.format(v)} MW`)
export const fmtMWh = (v: number | null | undefined) => (v == null ? '—' : `${nf0.format(v)} MWh`)
export const fmtGW = (v: number | null | undefined) => (v == null ? '—' : `${nf1.format(v / 1000)} GW`)
export const fmtSignedMW = (v: number | null | undefined) =>
  v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf0.format(Math.abs(v))} MW`
export const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${nf1.format(v)}%`)
export const fmtNum2 = (v: number | null | undefined) => (v == null ? '—' : nf2.format(v))
export const fmtHours = (v: number | null | undefined) => (v == null ? '—' : `${nf1.format(v)} h`)
export const fmtInt = (v: number) => nf0.format(v)

/** Plain-English reading of a bias value (error = forecast − actual). */
export const biasMeaning = (bias: number | null | undefined) => {
  if (bias == null) return ''
  if (Math.abs(bias) < 50) return 'essentially unbiased'
  return bias > 0 ? 'over-forecast on average (risk of under-buying)' : 'under-forecast on average (risk of over-buying)'
}

/** Compact axis tick: 16500 -> "16.5 GW", 22000 -> "22 GW". */
export const fmtGWAxis = (v: number) => `${Number((v / 1000).toFixed(1))} GW`
