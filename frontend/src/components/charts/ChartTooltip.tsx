import type { ReactNode } from 'react'

/** Shared tooltip shell: monochrome, values in ink, identity shown by the swatch beside them. */
export function TooltipBox({ title, rows }: { title: ReactNode; rows: { label: string; value: ReactNode; swatch?: ReactNode }[] }) {
  return (
    <div className="min-w-44 rounded-lg border border-line bg-paper px-3 py-2 text-xs shadow-sm">
      <div className="mb-1.5 font-semibold">{title}</div>
      <table className="w-full">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="pr-3 text-muted">
                <span className="inline-flex items-center gap-1.5">
                  {r.swatch}
                  {r.label}
                </span>
              </td>
              <td className="tabular text-right font-medium">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
