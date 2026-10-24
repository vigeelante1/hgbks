import type { ReactNode } from 'react'
import type { Meta } from '../api/types'
import { fmtDateTime, fmtDayLong, fmtInt } from '../lib/format'
import { Card } from '../components/ui'

const Item = ({ term, children }: { term: string; children: ReactNode }) => (
  <div className="grid gap-1 border-b border-line py-3 last:border-0 md:grid-cols-[200px_1fr] md:gap-6">
    <dt className="text-sm font-medium">{term}</dt>
    <dd className="text-sm leading-relaxed text-ink-2">{children}</dd>
  </div>
)

export function Methodology({ meta }: { meta: Meta }) {
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Methodology</h1>

      <Card title="Scope">
        <dl>
          <Item term="Question answered">
            For each day-ahead purchase decision, what wind forecast was available — and how far off was it?
          </Item>
          <Item term="Pilot period">
            Purchase decisions made in January 2026, i.e. delivery days {fmtDayLong(meta.scope_start)} to{' '}
            {fmtDayLong(meta.scope_end)} (the decision for a day is made the day before).
          </Item>
          <Item term="Decision time">
            09:50 UK time on the day before delivery: gate closure of the GB day-ahead auction. Adjustable in the
            controls. In January UK time equals UTC (GMT), so there are no daylight-saving shifts.
          </Item>
          <Item term="Data">
            Great Britain national wind generation from Elexon BMRS only — actuals from FUELHH (fuel type WIND,
            half-hourly) and forecasts from WINDFOR (hourly, 8 runs a day). {fmtInt(meta.actual_rows)} actual
            half-hours and {fmtInt(meta.forecast_rows)} forecast values.
            {meta.snapshot_built_at && <> Snapshot taken {fmtDateTime(meta.snapshot_built_at)}.</>}
          </Item>
        </dl>
      </Card>

      <Card title="Which forecast counts">
        <dl>
          <Item term="At decision time">
            For every hour of the delivery day we take the most recently published forecast at or before the decision
            time. With a 09:50 deadline this is the 09:30 run on the day before, which looks 14.5–37.5 hours ahead.
          </Item>
          <Item term="Hours ahead">
            Alternative view: for each hour, the most recent forecast published at least H hours before it. Shows how
            accuracy changes with lead time.
          </Item>
          <Item term="Excluded values">
            Each WINDFOR run also republishes hours that have already passed; these are not forecasts and are ignored.
            Forecasts more than 48 hours ahead are ignored.
          </Item>
          <Item term="Matching">
            Forecasts are hourly, actuals half-hourly; each forecast is compared with the actual for the half-hour
            starting on the hour (24 comparisons per day).
          </Item>
        </dl>
      </Card>

      <Card title="Accuracy measures">
        <dl>
          <Item term="Error">Forecast − actual, in MW. Positive means more wind was forecast than arrived, so the desk would have bought too little.</Item>
          <Item term="MAE">Average size of the miss, ignoring direction.</Item>
          <Item term="RMSE">Like MAE but gives large misses more weight — they are the costly ones in imbalance.</Item>
          <Item term="Bias">Average signed error: a persistent lean towards over- or under-forecasting.</Item>
          <Item term="P90 |error|">90% of hours had a miss smaller than this — a direct input for sizing a safety buffer.</Item>
          <Item term="nMAE">MAE as a share of average wind output, comparable across periods. (MAPE is not used: it breaks down when wind is near zero.)</Item>
          <Item term="Error range band">
            On the daily chart, the band is the forecast shifted by the 10th and 90th percentile errors seen across the
            whole pilot period. It is computed on the same period it is drawn on (in-sample), so treat it as indicative.
          </Item>
        </dl>
      </Card>

      <Card title="Sources">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
          {meta.sources.map((s) => (
            <li key={s} className="break-all font-mono text-xs">{s}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
