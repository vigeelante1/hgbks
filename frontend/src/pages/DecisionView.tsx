import { useState } from 'react'
import type { Meta, SelectionParams } from '../api/types'
import { useSeries, useVintages } from '../hooks/useApi'
import { biasMeaning, fmtDateTime, fmtDayLong, fmtHours, fmtMW, fmtMWh, fmtSignedMW } from '../lib/format'
import { DayChart, DayLegend } from '../components/charts/DayChart'
import { Card, ErrorBox, Kpi, Loading, inputClass } from '../components/ui'

/** R1: what was the latest wind forecast when the day-ahead purchase had to be made? */
export function DecisionView({ meta, date, onDate, params }: {
  meta: Meta
  date: string
  onDate: (d: string) => void
  params: SelectionParams
}) {
  const [showRuns, setShowRuns] = useState(false)
  const series = useSeries(date, params)
  const vintages = useVintages(date, showRuns)
  const days = meta.delivery_days
  const idx = days.indexOf(date)

  const s = series.data
  const pubs = s?.publish_times_used ?? []
  const horizons = s?.points.map((p) => p.horizon_h).filter((h): h is number => h != null) ?? []
  const hourly = s?.points.filter((p) => p.forecast != null && p.actual != null) ?? []
  const forecastMWh = hourly.reduce((a, p) => a + p.forecast!, 0)
  const actualMWh = hourly.reduce((a, p) => a + p.actual!, 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted">Delivery day</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{fmtDayLong(date)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`${inputClass} px-3 disabled:opacity-30`}
            disabled={idx <= 0}
            onClick={() => onDate(days[idx - 1])}
            aria-label="Previous day"
          >
            ←
          </button>
          <select className={inputClass} value={date} onChange={(e) => onDate(e.target.value)} aria-label="Delivery day">
            {days.map((d) => (
              <option key={d} value={d}>
                {fmtDayLong(d)}
              </option>
            ))}
          </select>
          <button
            className={`${inputClass} px-3 disabled:opacity-30`}
            disabled={idx >= days.length - 1}
            onClick={() => onDate(days[idx + 1])}
            aria-label="Next day"
          >
            →
          </button>
        </div>
      </div>

      {series.error ? (
        <ErrorBox error={series.error} />
      ) : !s ? (
        <Loading height="h-96" />
      ) : (
        <>
          <div className="rounded-xl bg-ink p-5 text-paper">
            {params.mode === 'cutoff' && s.decision_time ? (
              <p className="text-sm leading-relaxed">
                At the decision deadline, <span className="font-semibold">{fmtDateTime(s.decision_time)}</span>, the latest
                available wind forecast was published at{' '}
                <span className="font-semibold">{pubs.length ? pubs.map(fmtDateTime).join(', ') : '— (none available)'}</span>,
                covering this day {horizons.length ? `${fmtHours(Math.min(...horizons))} to ${fmtHours(Math.max(...horizons))}` : ''} ahead.
              </p>
            ) : (
              <p className="text-sm leading-relaxed">
                Each hour uses the latest forecast published at least{' '}
                <span className="font-semibold">{params.horizon_h} hours</span> before it ({pubs.length} forecast run
                {pubs.length === 1 ? '' : 's'} involved).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Forecast energy" value={fmtMWh(forecastMWh)} hint={`Actual ${fmtMWh(actualMWh)}`} />
            <Kpi label="Forecast − actual" value={fmtMWh(forecastMWh - actualMWh)} hint={biasMeaning(s.day_stats.bias)} />
            <Kpi label="Typical miss (MAE)" value={fmtMW(s.day_stats.mae)} hint={`Bias ${fmtSignedMW(s.day_stats.bias)}`} />
            <Kpi label="Worst hour" value={fmtMW(s.day_stats.max_abs)} hint={`${s.day_stats.n} hourly points scored`} />
          </div>

          <Card
            title="Wind generation — actual vs forecast"
            subtitle="UK national wind, MW. Times are UK time (GMT). Forecasts are hourly; actuals half-hourly."
            right={
              <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-2">
                <input type="checkbox" className="accent-ink" checked={showRuns} onChange={(e) => setShowRuns(e.target.checked)} />
                Show every forecast run
              </label>
            }
          >
            <DayChart points={s.points} vintages={showRuns ? vintages.data : undefined} />
            <div className="mt-4 border-t border-line pt-3">
              <DayLegend showRuns={showRuns} />
              <p className="mt-2 text-xs text-muted">
                The grey band shows where the actual landed 80% of the time across the whole pilot period, given the
                forecast — use its upper/lower edge to size a buffer.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
