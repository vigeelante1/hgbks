import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ByHorizon } from '../../api/types'
import { fmtGWAxis, fmtInt, fmtMW, fmtSignedMW } from '../../lib/format'
import { chart } from '../../lib/theme'
import { TooltipBox } from './ChartTooltip'
import { BoxSwatch } from '../ui'

/** Error vs lead time: typical (MAE) and bad-day (P90) misses per horizon bucket. */
export function HorizonChart({ rows }: { rows: ByHorizon['rows'] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis dataKey="bucket" tick={{ fontSize: chart.font.size, fill: chart.axis }} tickLine={false} axisLine={{ stroke: chart.grid }} />
          <YAxis tickFormatter={fmtGWAxis} tick={{ fontSize: chart.font.size, fill: chart.axis }} tickLine={false} axisLine={false} width={64} />
          <Tooltip
            cursor={{ fill: '#f6f6f6' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const r = payload[0].payload as ByHorizon['rows'][number]
              return (
                <TooltipBox
                  title={`${r.bucket} ahead`}
                  rows={[
                    { label: 'MAE', value: fmtMW(r.mae), swatch: <BoxSwatch color={chart.bar} /> },
                    { label: 'P90 |error|', value: fmtMW(r.p90), swatch: <BoxSwatch color={chart.barMuted} /> },
                    { label: 'Bias', value: fmtSignedMW(r.bias) },
                    { label: 'Points', value: fmtInt(r.n) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="mae" fill={chart.bar} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={36} />
          <Bar dataKey="p90" fill={chart.barMuted} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
