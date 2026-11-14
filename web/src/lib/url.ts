// Shareable view state in the URL hash. Pure parse/serialize helpers (unit-tested).
import type { TimeZoneMode } from './format'
import type { Mode } from './prefs'

export type Tab = 'site' | 'compare' | 'slip' | 'about'
export const TABS: Tab[] = ['site', 'compare', 'slip', 'about']

export interface ViewState {
  site?: string
  start?: number
  cursor?: number
  windowDays?: number
  tab?: Tab
  mode?: Mode
  tz?: TimeZoneMode
}

export function parseHash(hash: string): ViewState {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const time = (k: string) => {
    const v = p.get(k)
    if (!v) return undefined
    const ms = Date.parse(v)
    return Number.isFinite(ms) ? ms : undefined
  }
  const w = Number(p.get('w'))
  const tab = p.get('tab') as Tab | null
  const mode = p.get('mode')
  const tz = p.get('tz')
  return {
    site: p.get('site') ?? undefined,
    start: time('t'),
    cursor: time('at'),
    windowDays: Number.isFinite(w) && w > 0 && w <= 365 ? w : undefined,
    tab: tab && TABS.includes(tab) ? tab : undefined,
    mode: mode === 'explore' || mode === 'planner' ? mode : undefined,
    tz: tz === 'local' || tz === 'utc' ? tz : undefined,
  }
}

export function toHash(s: Required<ViewState>): string {
  const p = new URLSearchParams({
    site: s.site,
    t: new Date(s.start).toISOString().slice(0, 16) + 'Z',
    at: new Date(s.cursor).toISOString().slice(0, 16) + 'Z',
    w: String(s.windowDays),
    tab: s.tab,
    mode: s.mode,
    tz: s.tz,
  })
  return `#${p.toString()}`
}
