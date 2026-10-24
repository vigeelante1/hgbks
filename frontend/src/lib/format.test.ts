import { describe, expect, it } from 'vitest'
import { biasMeaning, fmtMW, fmtSignedMW, fmtTime } from './format'

describe('format', () => {
  it('shows UTC timestamps as UK time (GMT in January)', () => {
    expect(fmtTime('2026-01-10T09:30:00Z')).toBe('09:30')
  })

  it('formats MW with sign', () => {
    expect(fmtMW(12443.4)).toBe('12,443 MW')
    expect(fmtSignedMW(-250)).toBe('−250 MW')
    expect(fmtSignedMW(250)).toBe('+250 MW')
    expect(fmtMW(null)).toBe('—')
  })

  it('explains bias in buying terms', () => {
    expect(biasMeaning(400)).toContain('under-buying')
    expect(biasMeaning(-400)).toContain('over-buying')
    expect(biasMeaning(10)).toBe('essentially unbiased')
  })
})
