import type { Meta, SelectionParams } from '../api/types'
import { useAccuracy, useByHorizon } from '../hooks/useApi'
import {
  biasMeaning,
  fmtDay,
  fmtGW,
  fmtGWAxis,
  fmtInt,
  fmtMW,
  fmtMWh,
  fmtNum2,
  fmtPct,
  fmtSignedMW,
} from '../lib/format'
import { chart } from '../lib/theme'
import { SimpleBarChart } from '../components/charts/BarChartCard'
import { HorizonChart } from '../components/charts/HorizonChart'
import { BoxSwatch, Card, ErrorBox, Field, Kpi, Legend, Loading, inputClass } from '../components/ui'

/** R2: how accurate are the forecasts, quantitatively? */
export function AccuracyView({ meta, start, end, onRange, params }: {
  meta: Meta
  start: string
  end: string
  onRange: (patch: { start?: string; end?: string }) => void
  params: SelectionParams
}) {
  const acc = useAccuracy(start, end, params)
  const hz = useByHorizon(start, end)
  const a = acc.data
  const st = a?.stats

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted">Forecast accuracy</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {fmtDay(start)} – {fmtDay(end)} 2026
          </h1>
        </div>
        <div className="flex items-end gap-3">
          <Field label="From">
            <select className={inputClass} value={start} onChange={(e) => onRange({ start: e.target.value })}>
              {meta.delivery_days.filter((d) => d <= end).map((d) => (
                <option key={d} value={d}>{fmtDay(d)}</option>
              ))}
            </select>
          </Field>
          <Field label="To">
            <select className={inputClass} value={end} onChange={(e) => onRange({ end: e.target.value })}>
              {meta.delivery_days.filter((d) => d >= start).map((d) => (
                <option key={d} value={d}>{fmtDay(d)}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {acc.error ? (
        <ErrorBox error={acc.error} />
      ) : !a || !st ? (
        <Loading height="h-96" />
      ) : (
        <>
          <div className="rounded-xl bg-ink p-5 text-paper">
            <p className="text-sm leading-relaxed">
              {params.mode === 'cutoff'
                ? `Using the forecast available at ${params.cutoff} UK the day before, `
                : `Using forecasts made at least ${params.horizon_h} h ahead, `}
              the wind forecast was within <span className="font-semibold">±{fmtMW(st.p90)}</span> of the actual for 90% of
              hours, with a typical miss of <span className="font-semibold">{fmtMW(st.mae)}</span>
              {st.nmae_pct != null && <> ({fmtPct(st.nmae_pct)} of average output)</>}. It was{' '}
              <span className="font-semibold">{biasMeaning(st.bias)}</span> ({fmtSignedMW(st.bias)}).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Kpi label="MAE" value={fmtMW(st.mae)} hint="Typical miss" />
            <Kpi label="RMSE" value={fmtMW(st.rmse)} hint="Weights big misses" />
            <Kpi label="Bias" value={fmtSignedMW(st.bias)} hint="+ = over-forecast" />
            <Kpi label="P90 |error|" value={fmtMW(st.p90)} hint={`P99 ${fmtMW(st.p99)}`} />
            <Kpi label="nMAE" value={fmtPct(st.nmae_pct)} hint={`Mean output ${fmtGW(st.mean_actual)}`} />
            <Kpi label="R²" value={fmtNum2(st.r2)} hint={`${fmtInt(st.n)} points · ${fmtPct(a.coverage_pct)} coverage`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card
              title="Error grows with lead time"
              subtitle="Every forecast run, grouped by how many hours ahead it was made. Not affected by the selection above."
            >
              {hz.error ? <ErrorBox error={hz.error} /> : hz.data ? <HorizonChart rows={hz.data.rows} /> : <Loading height="h-56" />}
              <div className="mt-3 border-t border-line pt-3">
                <Legend
                  items={[
                    { label: 'MAE (typical miss)', swatch: <BoxSwatch color={chart.bar} /> },
                    { label: 'P90 |error| (bad hour)', swatch: <BoxSwatch color={chart.barMuted} /> },
                  ]}
                />
              </div>
            </Card>

            <Card title="Typical miss by hour of day" subtitle="MAE per delivery hour (UK time).">
              <SimpleBarChart
                yFormat={fmtGWAxis}
                labelInterval={2}
                data={a.by_hour.map((h) => ({
                  label: `${String(h.hour).padStart(2, '0')}:00`,
                  value: h.mae,
                  tooltip: [
                    { label: 'MAE', value: fmtMW(h.mae) },
                    { label: 'Bias', value: fmtSignedMW(h.bias) },
                    { label: 'P90 |error|', value: fmtMW(h.p90) },
                  ],
                }))}
              />
            </Card>

            <Card title="Distribution of errors" subtitle="Forecast − actual, in 500 MW bins. Right of zero = over-forecast.">
              <SimpleBarChart
                yFormat={(v) => fmtInt(v)}
                labelInterval={3}
                data={a.histogram.map((b) => ({
                  label: `${(b.from_mw / 1000).toFixed(1)}`,
                  value: b.count,
                  muted: b.to_mw <= 0,
                  tooltip: [
                    { label: 'Error range', value: `${fmtSignedMW(b.from_mw)} to ${fmtSignedMW(b.to_mw)}` },
                    { label: 'Hours', value: fmtInt(b.count) },
                  ],
                }))}
              />
              <p className="mt-2 text-xs text-muted">X axis in GW. Grey = under-forecast, black = over-forecast.</p>
            </Card>

            <Card title="Accuracy by wind level" subtitle="Grouped by actual national wind output.">
              <table className="tabular w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="py-2 font-medium">Wind level</th>
                    <th className="py-2 text-right font-medium">Hours</th>
                    <th className="py-2 text-right font-medium">MAE</th>
                    <th className="py-2 text-right font-medium">Bias</th>
                    <th className="py-2 text-right font-medium">P90</th>
                  </tr>
                </thead>
                <tbody>
                  {a.by_band.map((b) => (
                    <tr key={b.band} className="border-b border-line last:border-0">
                      <td className="py-2">{b.band}</td>
                      <td className="py-2 text-right">{fmtInt(b.n)}</td>
                      <td className="py-2 text-right">{fmtMW(b.mae)}</td>
                      <td className="py-2 text-right">{fmtSignedMW(b.bias)}</td>
                      <td className="py-2 text-right">{fmtMW(b.p90)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <Card title="Day by day" subtitle="Energy is the sum of hourly values (MWh). Positive error = forecast higher than actual = desk would have under-bought.">
            <div className="max-h-[28rem] overflow-auto">
              <table className="tabular w-full text-sm">
                <thead className="sticky top-0 bg-paper">
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="py-2 font-medium">Delivery day</th>
                    <th className="py-2 text-right font-medium">Forecast</th>
                    <th className="py-2 text-right font-medium">Actual</th>
                    <th className="py-2 text-right font-medium">Net error</th>
                    <th className="py-2 text-right font-medium">Gross error</th>
                    <th className="py-2 text-right font-medium">MAE</th>
                  </tr>
                </thead>
                <tbody>
                  {a.by_day.map((d) => (
                    <tr key={d.date} className="border-b border-line last:border-0 hover:bg-subtle">
                      <td className="py-2">{fmtDay(d.date)}</td>
                      <td className="py-2 text-right">{fmtMWh(d.forecast_mwh)}</td>
                      <td className="py-2 text-right">{fmtMWh(d.actual_mwh)}</td>
                      <td className="py-2 text-right">{fmtMWh(d.energy_error_mwh)}</td>
                      <td className="py-2 text-right">{fmtMWh(d.abs_energy_error_mwh)}</td>
                      <td className="py-2 text-right">{fmtMW(d.mae)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
