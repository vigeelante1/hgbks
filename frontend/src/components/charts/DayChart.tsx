import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SeriesPoint, Vintages } from '../../api/types'
import { fmtGWAxis, fmtMW, fmtSignedMW, fmtTime, fmtHours, fmtDateTime } from '../../lib/format'
import { chart } from '../../lib/theme'
import { TooltipBox } from './ChartTooltip'
import { BoxSwatch, Legend, LineSwatch } from '../ui'

interface Row {
  t: string
  actual: number | null
  forecast: number | null
  band: [number, number] | null
  error: number | null
  horizon_h: number | null
  publish_time: string | null
  [vintage: `v${number}`]: number | undefined
}

/** One delivery day: actual (solid black) vs forecast used (dashed grey) with the typical-error band. */
export function DayChart({ points, vintages }: { points: SeriesPoint[]; vintages?: Vintages }) {
  const rows: Row[] = points.map((p) => ({
    t: p.t,
    actual: p.actual,
    forecast: p.forecast,
    band: p.range_low != null && p.range_high != null ? [p.range_low, p.range_high] : null,
    error: p.error,
    horizon_h: p.horizon_h,
    publish_time: p.publish_time,
  }))

  const runs = vintages?.vintages ?? []
  if (runs.length) {
    const index = new Map(rows.map((r) => [new Date(r.t).getTime(), r]))
    runs.forEach((run, i) =>
      run.points.forEach((pt) => {
        const row = index.get(new Date(pt.t).getTime())
        if (row) row[`v${i}`] = pt.forecast
      }),
    )
  }

  return (
    <div className="h-80 w-full" role="img" aria-label="Line chart of actual and forecast wind generation for the selected day">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={fmtTime}
            interval={7}
            tick={{ fontSize: chart.font.size, fill: chart.axis }}
            tickLine={false}
            axisLine={{ stroke: chart.grid }}
          />
          <YAxis
            tickFormatter={fmtGWAxis}
            tick={{ fontSize: chart.font.size, fill: chart.axis }}
            tickLine={false}
            axisLine={false}
            width={64}
            domain={[0, 'auto']}
          />
          <Tooltip content={<DayTooltip />} cursor={{ stroke: chart.axis, strokeDasharray: '2 3' }} />
          <Area
            dataKey="band"
            stroke="none"
            fill={chart.band}
            fillOpacity={1}
            connectNulls
            isAnimationActive={false}
            activeDot={false}
          />
          {runs.map((run, i) => (
            <Line
              key={run.publish_time}
              dataKey={`v${i}`}
              stroke={chart.vintage}
              strokeWidth={1}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          <Line
            dataKey="forecast"
            stroke={chart.forecast}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            dataKey="actual"
            stroke={chart.actual}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DayLegend({ showRuns }: { showRuns: boolean }) {
  const items = [
  { label: 'Actual', swatch: <LineSwatch color={chart.actual} /> },
  { label: 'Forecast used', swatch: <LineSwatch color={chart.forecast} dashed /> },
  { label: 'Typical error range (P10–P90)', swatch: <BoxSwatch color={chart.band} /> },
  ...(showRuns ? [{ label: 'Other forecast runs', swatch: <LineSwatch color={chart.vintage} /> }] : []),
  ]
  return <Legend items={items} />
}

function DayTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  return (
    <TooltipBox
      title={`${fmtTime(r.t)} UK`}
      rows={[
        { label: 'Actual', value: fmtMW(r.actual), swatch: <LineSwatch color={chart.actual} /> },
        { label: 'Forecast', value: fmtMW(r.forecast), swatch: <LineSwatch color={chart.forecast} dashed /> },
        ...(r.error != null ? [{ label: 'Error', value: fmtSignedMW(r.error) }] : []),
        ...(r.publish_time
          ? [
              { label: 'Published', value: fmtDateTime(r.publish_time) },
              { label: 'Ahead', value: fmtHours(r.horizon_h) },
            ]
          : []),
      ]}
    />
  )
}
