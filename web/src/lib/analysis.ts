// Sun / Earth visibility analysis for a site, terrain-aware.
import type { Ephemeris, Site } from './data'
import { type Basis, R_MOON_KM, type Vec3, azEl, enuBasis, horizonAt, unitVec, R2D } from './geometry'

export const SUN_RADIUS_DEG = 0.2666 // mean angular radius of the Sun's disc from the Moon
export const SOLAR_CONSTANT = 1361 // W/m^2 at 1 AU
export const HOUR = 3600_000
export const DAY = 24 * HOUR

export interface SiteCtx {
  site: Site
  basis: Basis
  pos: Vec3 // km
  azStep: number
}

export function makeCtx(site: Site, azStep: number): SiteCtx {
  const r = R_MOON_KM + site.elevationM / 1000
  const u = unitVec(site.lon, site.lat)
  return { site, basis: enuBasis(site.lon, site.lat), pos: [u[0] * r, u[1] * r, u[2] * r], azStep }
}

export interface Sample {
  t: number
  sunAz: number
  sunEl: number
  sunHorizon: number
  /** degrees the Sun's centre is above the local terrain horizon */
  sunMargin: number
  /** fraction of the solar disc above the terrain (0..1) */
  sunFrac: number
  earthAz: number
  earthEl: number
  earthHorizon: number
  earthMargin: number
  earthRadiusDeg: number
  earthDistKm: number
}

function rowVec(eph: Ephemeris, i: number) {
  const r = eph.rows
  const k = i * 6
  return [r[k], r[k + 1], r[k + 2], r[k + 3], r[k + 4], r[k + 5]]
}

export function inRange(eph: Ephemeris, t: number) {
  return t >= eph.meta.startMs && t <= eph.endMs
}

export function clampTime(eph: Ephemeris, t: number) {
  return Math.max(eph.meta.startMs, Math.min(eph.endMs, t))
}

/** Interpolated Earth (km) and Sun (unit) vectors at time t (ms, UTC). */
export function vectorsAt(eph: Ephemeris, t: number): { earth: Vec3; sun: Vec3 } {
  const f = (t - eph.meta.startMs) / eph.meta.stepMs
  const i = Math.max(0, Math.min(eph.meta.count - 2, Math.floor(f)))
  const w = Math.max(0, Math.min(1, f - i))
  const a = rowVec(eph, i)
  const b = rowVec(eph, i + 1)
  const v = a.map((x, k) => x * (1 - w) + b[k] * w)
  const sn = Math.hypot(v[3], v[4], v[5])
  return { earth: [v[0], v[1], v[2]], sun: [v[3] / sn, v[4] / sn, v[5] / sn] }
}

function evalVectors(ctx: SiteCtx, t: number, earth: Vec3, sun: Vec3): Sample {
  const s = azEl(sun, ctx.basis)
  const ev: Vec3 = [earth[0] - ctx.pos[0], earth[1] - ctx.pos[1], earth[2] - ctx.pos[2]]
  const e = azEl(ev, ctx.basis)
  const dist = Math.hypot(ev[0], ev[1], ev[2])
  const sh = horizonAt(ctx.site.horizon, ctx.azStep, s.az)
  const eh = horizonAt(ctx.site.horizon, ctx.azStep, e.az)
  const sunMargin = s.el - sh
  return {
    t,
    sunAz: s.az,
    sunEl: s.el,
    sunHorizon: sh,
    sunMargin,
    sunFrac: Math.max(0, Math.min(1, (sunMargin + SUN_RADIUS_DEG) / (2 * SUN_RADIUS_DEG))),
    earthAz: e.az,
    earthEl: e.el,
    earthHorizon: eh,
    earthMargin: e.el - eh,
    earthRadiusDeg: Math.asin(6371 / dist) * R2D,
    earthDistKm: dist,
  }
}

export function sampleAt(ctx: SiteCtx, eph: Ephemeris, t: number): Sample {
  const { earth, sun } = vectorsAt(eph, t)
  return evalVectors(ctx, t, earth, sun)
}

/** Samples on the ephemeris' native hourly grid between t0 and t1 (inclusive). */
export function series(ctx: SiteCtx, eph: Ephemeris, t0: number, t1: number, stride = 1): Sample[] {
  const m = eph.meta
  const i0 = Math.max(0, Math.ceil((t0 - m.startMs) / m.stepMs))
  const i1 = Math.min(m.count - 1, Math.floor((t1 - m.startMs) / m.stepMs))
  const out: Sample[] = []
  for (let i = i0; i <= i1; i += stride) {
    const v = rowVec(eph, i)
    out.push(evalVectors(ctx, m.startMs + i * m.stepMs, [v[0], v[1], v[2]], [v[3], v[4], v[5]]))
  }
  return out
}

export interface Interval {
  start: number
  end: number
}

/** Intervals where f(sample) > 0, edges refined by linear interpolation. */
export function intervals(samples: Sample[], f: (s: Sample) => number): Interval[] {
  const out: Interval[] = []
  let start: number | null = null
  for (let i = 0; i < samples.length; i++) {
    const v = f(samples[i])
    if (v > 0 && start === null) {
      if (i === 0) start = samples[0].t
      else {
        const p = f(samples[i - 1])
        start = samples[i - 1].t + ((samples[i].t - samples[i - 1].t) * -p) / (v - p)
      }
    } else if (v <= 0 && start !== null) {
      const p = f(samples[i - 1])
      out.push({ start, end: samples[i - 1].t + ((samples[i].t - samples[i - 1].t) * p) / (p - v) })
      start = null
    }
  }
  if (start !== null && samples.length) out.push({ start, end: samples[samples.length - 1].t })
  return out
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const s = Math.max(a[i].start, b[j].start)
    const e = Math.min(a[i].end, b[j].end)
    if (e > s) out.push({ start: s, end: e })
    if (a[i].end < b[j].end) i++
    else j++
  }
  return out
}

export const totalMs = (iv: Interval[]) => iv.reduce((s, x) => s + x.end - x.start, 0)

/** Next time the given margin changes sign after t (searching up to `maxDays`). */
export function nextEvent(ctx: SiteCtx, eph: Ephemeris, t: number, which: 'sun' | 'earth', maxDays = 400) {
  const key = which === 'sun' ? 'sunMargin' : 'earthMargin'
  const now = sampleAt(ctx, eph, t)
  const up = now[key] > 0
  const end = Math.min(eph.endMs, t + maxDays * DAY)
  let prev = now
  // first step to the next grid point, then hourly
  const m = eph.meta
  let i = Math.floor((t - m.startMs) / m.stepMs) + 1
  for (; m.startMs + i * m.stepMs <= end; i++) {
    const cur = sampleAt(ctx, eph, m.startMs + i * m.stepMs)
    if (cur[key] > 0 !== up) {
      const p = prev[key]
      const c = cur[key]
      const te = prev.t + ((cur.t - prev.t) * p) / (p - c)
      return { time: te, kind: up ? (which === 'sun' ? 'Sunset' : 'Earthset') : which === 'sun' ? 'Sunrise' : 'Earthrise' }
    }
    prev = cur
  }
  return { time: null as number | null, kind: up ? (which === 'sun' ? 'Sunset' : 'Earthset') : which === 'sun' ? 'Sunrise' : 'Earthrise' }
}

/** Power on a panel (W/m^2 of panel) for a given orientation, efficiency 30%. */
export function panelPower(s: Sample, orientation: 'vertical' | 'horizontal', eff = 0.3) {
  const el = Math.max(0, s.sunEl) * (Math.PI / 180)
  const cosInc = orientation === 'vertical' ? Math.cos(el) : Math.sin(el)
  return SOLAR_CONSTANT * eff * s.sunFrac * Math.max(0, cosInc)
}

export interface WindowSummary {
  sun: Interval[]
  earth: Interval[]
  both: Interval[]
  sunPct: number
  earthPct: number
  bothPct: number
  longestDarkH: number
  longestNoCommH: number
  maxSunEl: number
  avgPowerVertical: number
}

function longestGap(iv: Interval[], t0: number, t1: number) {
  let best = 0
  let cur = t0
  for (const x of iv) {
    best = Math.max(best, x.start - cur)
    cur = x.end
  }
  return Math.max(best, t1 - cur) / HOUR
}

export function summarize(ctx: SiteCtx, eph: Ephemeris, t0: number, t1: number): { samples: Sample[]; sum: WindowSummary } {
  const samples = series(ctx, eph, t0, t1)
  const sun = intervals(samples, (s) => s.sunMargin)
  const earth = intervals(samples, (s) => s.earthMargin)
  const both = intersect(sun, earth)
  const span = Math.max(1, t1 - t0)
  let p = 0
  let maxSunEl = -90
  for (const s of samples) {
    p += panelPower(s, 'vertical')
    maxSunEl = Math.max(maxSunEl, s.sunEl)
  }
  return {
    samples,
    sum: {
      sun,
      earth,
      both,
      sunPct: (100 * totalMs(sun)) / span,
      earthPct: (100 * totalMs(earth)) / span,
      bothPct: (100 * totalMs(both)) / span,
      longestDarkH: longestGap(sun, t0, t1),
      longestNoCommH: longestGap(earth, t0, t1),
      maxSunEl,
      avgPowerVertical: samples.length ? p / samples.length : 0,
    },
  }
}

/** Full-range hourly flags for the slip analyzer (cached per site). */
export interface Hourly {
  sun: Uint8Array
  earth: Uint8Array
  /** hours of uninterrupted sunlight starting at index i */
  sunRun: Uint32Array
  /** prefix sum of earth-visible hours */
  earthCum: Uint32Array
}

const hourlyCache = new Map<string, Hourly>()

export function hourly(ctx: SiteCtx, eph: Ephemeris): Hourly {
  const key = `${ctx.site.id}:${ctx.site.lat}:${ctx.site.lon}`
  const hit = hourlyCache.get(key)
  if (hit) return hit
  const n = eph.meta.count
  const sun = new Uint8Array(n)
  const earth = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const v = rowVec(eph, i)
    const s = evalVectors(ctx, 0, [v[0], v[1], v[2]], [v[3], v[4], v[5]])
    sun[i] = s.sunMargin > 0 ? 1 : 0
    earth[i] = s.earthMargin > 0 ? 1 : 0
  }
  const sunRun = new Uint32Array(n + 1)
  for (let i = n - 1; i >= 0; i--) sunRun[i] = sun[i] ? sunRun[i + 1] + 1 : 0
  const earthCum = new Uint32Array(n + 1)
  for (let i = 0; i < n; i++) earthCum[i + 1] = earthCum[i] + earth[i]
  const h = { sun, earth, sunRun, earthCum }
  hourlyCache.set(key, h)
  return h
}

export function fmtDuration(ms: number) {
  if (!isFinite(ms)) return '—'
  const neg = ms < 0
  let m = Math.round(Math.abs(ms) / 60000)
  const d = Math.floor(m / 1440)
  m -= d * 1440
  const h = Math.floor(m / 60)
  m -= h * 60
  const s = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`
  return neg ? `-${s}` : s
}

export function fmtUtc(t: number, withTime = true) {
  const d = new Date(t)
  const iso = d.toISOString()
  return withTime ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : iso.slice(0, 10)
}
