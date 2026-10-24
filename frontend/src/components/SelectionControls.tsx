import type { Mode, SelectionParams } from '../api/types'
import { Field, Segmented, inputClass } from './ui'

/** The "which forecast?" controls, shared by both views. */
export function SelectionControls({ value, onChange, maxHorizon }: {
  value: SelectionParams
  onChange: (patch: Partial<SelectionParams>) => void
  maxHorizon: number
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Forecast used">
        <Segmented<Mode>
          label="Forecast selection mode"
          value={value.mode}
          onChange={(mode) => onChange({ mode })}
          options={[
            { value: 'cutoff', label: 'At decision time' },
            { value: 'horizon', label: 'Hours ahead' },
          ]}
        />
      </Field>

      {value.mode === 'cutoff' ? (
        <Field label="Decision time (D−1, UK)">
          <input
            type="time"
            className={`${inputClass} w-32`}
            value={value.cutoff}
            onChange={(e) => e.target.value && onChange({ cutoff: e.target.value })}
          />
        </Field>
      ) : (
        <Field label={`Forecast made ≥ ${value.horizon_h} h ahead`}>
          <input
            type="range"
            min={0}
            max={maxHorizon}
            step={1}
            value={value.horizon_h}
            onChange={(e) => onChange({ horizon_h: Number(e.target.value) })}
            className="h-9 w-56 accent-ink"
            aria-label="Hours ahead"
          />
        </Field>
      )}
    </div>
  )
}
