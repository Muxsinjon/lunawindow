import { describe, expect, it } from 'vitest'
import { parseHash, toHash } from './url'

describe('shareable URL state', () => {
  it('round-trips the full view state', () => {
    const s = {
      site: 'nobile-rim-2',
      start: Date.parse('2026-11-14T00:00:00Z'),
      cursor: Date.parse('2026-11-22T00:40:00Z'),
      windowDays: 14,
      tab: 'compare' as const,
      mode: 'explore' as const,
      tz: 'local' as const,
    }
    expect(parseHash(toHash(s))).toEqual(s)
  })
  it('keeps custom-site ids with commas and colons', () => {
    const h = toHash({
      site: 'custom:-88.6947,309.0939',
      start: 0,
      cursor: 0,
      windowDays: 30,
      tab: 'site',
      mode: 'planner',
      tz: 'utc',
    })
    expect(parseHash(h).site).toBe('custom:-88.6947,309.0939')
  })
  it('ignores junk', () => {
    expect(parseHash('#w=-3&tab=nope&mode=x&t=notadate')).toEqual({
      site: undefined,
      start: undefined,
      cursor: undefined,
      windowDays: undefined,
      tab: undefined,
      mode: undefined,
      tz: undefined,
    })
  })
})
