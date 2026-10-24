import type { ReactNode } from 'react'

export function Card({ title, subtitle, children, right }: {
  title?: string
  subtitle?: ReactNode
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-line bg-paper p-5">
      {(title || right) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="tabular mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.value ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-subtle'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'h-9 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-ink tabular'

export function Loading({ label = 'Loading…', height = 'h-64' }: { label?: string; height?: string }) {
  return (
    <div className={`flex ${height} items-center justify-center rounded-lg bg-subtle text-xs text-muted animate-pulse`}>
      {label}
    </div>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div role="alert" className="rounded-lg border border-ink p-4 text-sm">
      <div className="font-semibold">Couldn’t load data</div>
      <div className="mt-1 text-ink-2">{message}</div>
    </div>
  )
}

export function Legend({ items }: { items: { label: string; swatch: ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          {i.swatch}
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export const LineSwatch = ({ color, dashed }: { color: string; dashed?: boolean }) => (
  <svg width="22" height="8" aria-hidden>
    <line x1="1" y1="4" x2="21" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
  </svg>
)

export const BoxSwatch = ({ color }: { color: string }) => (
  <span aria-hidden className="inline-block h-2.5 w-4 rounded-sm" style={{ background: color }} />
)
