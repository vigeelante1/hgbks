import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { SelectionParams } from '../api/types'

// Data is a fixed historical snapshot, so results never go stale within a session.
const forever = { staleTime: Infinity, gcTime: 30 * 60_000 }

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: api.meta, ...forever })

export const useSeries = (date: string | undefined, p: SelectionParams) =>
  useQuery({
    queryKey: ['series', date, p],
    queryFn: () => api.series(date!, p),
    enabled: !!date,
    placeholderData: (prev) => prev,
    ...forever,
  })

export const useVintages = (date: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['vintages', date],
    queryFn: () => api.vintages(date!),
    enabled: !!date && enabled,
    ...forever,
  })

export const useAccuracy = (start: string | undefined, end: string | undefined, p: SelectionParams) =>
  useQuery({
    queryKey: ['accuracy', start, end, p],
    queryFn: () => api.accuracy(start!, end!, p),
    enabled: !!start && !!end,
    placeholderData: (prev) => prev,
    ...forever,
  })

export const useByHorizon = (start: string | undefined, end: string | undefined) =>
  useQuery({
    queryKey: ['by-horizon', start, end],
    queryFn: () => api.byHorizon(start!, end!),
    enabled: !!start && !!end,
    placeholderData: (prev) => prev,
    ...forever,
  })
