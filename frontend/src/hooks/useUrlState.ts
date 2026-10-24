import { useCallback, useEffect, useState } from 'react'

/**
 * Keeps UI state in the URL query string so any view is shareable and survives a refresh.
 * Only non-default values are written to the URL.
 */
export function useUrlState<T extends Record<string, string>>(defaults: T) {
  const read = useCallback((): T => {
    const params = new URLSearchParams(window.location.search)
    const out = { ...defaults }
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const v = params.get(key as string)
      if (v !== null) out[key] = v as T[keyof T]
    }
    return out
    // defaults is a constant object at call sites
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [state, setState] = useState<T>(read)

  useEffect(() => {
    const onPop = () => setState(read())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [read])

  const update = useCallback(
    (patch: Partial<T>) => {
      setState((prev) => {
        const next = { ...prev, ...patch }
        const params = new URLSearchParams()
        for (const [k, v] of Object.entries(next)) {
          if (v !== defaults[k]) params.set(k, v)
        }
        const qs = params.toString()
        window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
        return next
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return [state, update] as const
}
