// Display formatting per docs/DESIGN_SYSTEM.md. Every number carries its unit.
import { toLon180 } from './physics/lon'

export type TimeZoneMode = 'utc' | 'local'

const NBSP = ' '

export function fmtDeg(v: number, signed = false): string {
  const s = Math.abs(v) < 0.05 ? 0 : v
  return `${signed && s > 0 ? '+' : ''}${s.toFixed(1)}°`
}

export function fmtLat(lat: number): string {
  return `${Math.abs(lat).toFixed(3)}°${NBSP}${lat < 0 ? 'S' : 'N'}`
}

export function fmtLon(lon: number): string {
  const l = toLon180(lon)
  return `${Math.abs(l).toFixed(3)}°${NBSP}${l < 0 ? 'W' : 'E'}`
}

export function fmtPct(v: number): string {
  return `${Math.round(v)}${NBSP}%`
}

/** "3 d 4 h", "17 h 54 min", "12 min". */
export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  const neg = ms < 0
  const totalMin = Math.round(Math.abs(ms) / 60000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin - d * 1440) / 60)
  const m = totalMin - d * 1440 - h * 60
  const s = d > 0 ? `${d}${NBSP}d ${h}${NBSP}h` : h > 0 ? `${h}${NBSP}h ${m}${NBSP}min` : `${m}${NBSP}min`
  return neg ? `−${s}` : s
}

export function fmtKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)}${NBSP}km` : `${Math.round(km).toLocaleString('en-US')}${NBSP}km`
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** "2026-11-15 05:54 UTC" or local "2026-11-15 10:54 GMT+5". */
export function fmtTime(t: number, mode: TimeZoneMode = 'utc', withTime = true): string {
  const d = new Date(t)
  if (mode === 'utc') {
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    return withTime ? `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC` : date
  }
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (!withTime) return date
  const tz =
    new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? 'local'
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())} ${tz}`
}

/** Value for <input type="datetime-local"> in the chosen zone. */
export function toInputValue(t: number, mode: TimeZoneMode): string {
  const d = new Date(t)
  if (mode === 'utc') return d.toISOString().slice(0, 16)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse a datetime-local value in the chosen zone → epoch ms (NaN if invalid). */
export function fromInputValue(v: string, mode: TimeZoneMode): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return NaN
  return mode === 'utc' ? Date.parse(`${v}:00Z`) : new Date(`${v}:00`).getTime()
}
