import type { Mode, SelectionParams } from './api/types'
import { useMeta } from './hooks/useApi'
import { useUrlState } from './hooks/useUrlState'
import { SelectionControls } from './components/SelectionControls'
import { ErrorBox, Loading } from './components/ui'
import { DecisionView } from './pages/DecisionView'
import { AccuracyView } from './pages/AccuracyView'
import { Methodology } from './pages/Methodology'
import { fmtDateTime } from './lib/format'

type View = 'decision' | 'accuracy' | 'method'

const TABS: { id: View; label: string }[] = [
  { id: 'decision', label: 'Decision view' },
  { id: 'accuracy', label: 'Accuracy' },
  { id: 'method', label: 'Methodology' },
]

const DEFAULTS = {
  view: 'decision',
  date: '2026-01-15',
  start: '2026-01-02',
  end: '2026-02-01',
  mode: 'cutoff',
  cutoff: '09:50',
  horizon: '24',
}

export default function App() {
  const meta = useMeta()
  const [url, setUrl] = useUrlState(DEFAULTS)
  const view = url.view as View
  const params: SelectionParams = { mode: url.mode as Mode, cutoff: url.cutoff, horizon_h: Number(url.horizon) }

  const setParams = (p: Partial<SelectionParams>) =>
    setUrl({
      ...(p.mode && { mode: p.mode }),
      ...(p.cutoff && { cutoff: p.cutoff }),
      ...(p.horizon_h != null && { horizon: String(p.horizon_h) }),
    })

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div aria-hidden className="grid h-8 w-8 place-items-center rounded-md bg-ink">
              <svg viewBox="0 0 32 32" className="h-5 w-5">
                <path d="M5 20c4-8 8 4 12-4s4-4 8-2" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Wind Forecast Insight</div>
              <div className="text-xs text-muted">GB day-ahead purchasing · January 2026 pilot</div>
            </div>
          </div>
          <nav className="flex gap-1" aria-label="Views">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setUrl({ view: t.id })}
                aria-current={view === t.id ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  view === t.id ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-subtle'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {meta.error ? (
          <ErrorBox error={meta.error} />
        ) : !meta.data ? (
          <Loading height="h-96" />
        ) : (
          <div className="flex flex-col gap-6">
            {view !== 'method' && (
              <div className="rounded-xl border border-line bg-subtle px-4 py-3">
                <SelectionControls value={params} onChange={setParams} maxHorizon={meta.data.max_horizon_h} />
              </div>
            )}
            {view === 'decision' && (
              <DecisionView meta={meta.data} date={url.date} onDate={(date) => setUrl({ date })} params={params} />
            )}
            {view === 'accuracy' && (
              <AccuracyView meta={meta.data} start={url.start} end={url.end} onRange={setUrl} params={params} />
            )}
            {view === 'method' && <Methodology meta={meta.data} />}
          </div>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted md:px-6">
          Data: Elexon BMRS (FUELHH, WINDFOR)
          {meta.data?.snapshot_built_at && <> · snapshot {fmtDateTime(meta.data.snapshot_built_at)}</>} · times in UK time
        </div>
      </footer>
    </div>
  )
}
