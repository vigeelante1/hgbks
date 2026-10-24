import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ReactNode } from 'react'
import { chart } from '../../lib/theme'
import { TooltipBox } from './ChartTooltip'

export interface BarDatum {
  label: string
  value: number | null
  tooltip: { label: string; value: ReactNode }[]
  muted?: boolean
}

/** Single-series bar chart with rounded data-ends and a per-bar tooltip. */
export function SimpleBarChart({ data, yFormat, height = 'h-56', zeroLine = false, labelInterval = 0 }: {
  data: BarDatum[]
  yFormat: (v: number) => string
  height?: string
  zeroLine?: boolean
  labelInterval?: number
}) {
  return (
    <div className={`${height} w-full`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis
            dataKey="label"
            interval={labelInterval}
            tick={{ fontSize: chart.font.size, fill: chart.axis }}
            tickLine={false}
            axisLine={{ stroke: chart.grid }}
          />
          <YAxis
            tickFormatter={yFormat}
            tick={{ fontSize: chart.font.size, fill: chart.axis }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          {zeroLine && <ReferenceLine y={0} stroke={chart.axis} />}
          <Tooltip
            cursor={{ fill: '#f6f6f6' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as BarDatum
              return <TooltipBox title={d.label} rows={d.tooltip} />
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={44}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.muted ? chart.barMuted : chart.bar} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
