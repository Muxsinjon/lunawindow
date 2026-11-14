// Sun / Earth visibility analysis for a site, terrain-aware. Pure functions (no React).
import type { Ephemeris, Site } from './data'
import { type Basis, type Vec3, azEl, enuBasis, horizonAt, unitVec } from './geometry'
import {
  R_EARTH_KM,
  R_MOON_KM,
  SUN_RADIUS_DEG,
  angularRadiusDeg,
  discFractionAbove,
  upperLimbMargin,
} from './physics/disc'
import { type Interval, firstCrossing, intersect, longestGap, percentCovered, positiveIntervals } from './physics/windows'

export { SUN_RADIUS_DEG }
export type { Interval }
export const SOLAR_CONSTANT = 1361 // W/m² at 1 AU
export const PANEL_EFFICIENCY = 0.3
export const HOUR = 3_600_000
export const DAY = 24 * HOUR
export const LUNAR_DAY = 29.530589 * DAY // synodic month

export interface SiteCtx {
  site: Site
  basis: Basis
  pos: Vec3 // km, MOON_ME
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
  /** Sun centre height above the terrain horizon (deg). */
  sunMargin: number
  /** Upper-limb clearance (deg); > 0 means sunlit (any part of the disc visible). */
  sunUpper: number
  /** Fraction of the solar disc area above the terrain (0..1). */
  sunFrac: number
  earthAz: number
  earthEl: number
  earthHorizon: number
  earthMargin: number
  earthUpper: number
  earthFrac: number
  earthRadiusDeg: number
  earthDistKm: number
}

function rowVec(eph: Ephemeris, i: number): [Vec3, Vec3] {
  const r = eph.rows
  const k = i * 6
  return [
    [r[k], r[k + 1], r[k + 2]],
    [r[k + 3], r[k + 4], r[k + 5]],
  ]
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
  const [ea, sa] = rowVec(eph, i)
  const [eb, sb] = rowVec(eph, i + 1)
  const lerp = (a: Vec3, b: Vec3): Vec3 => [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w]
  const s = lerp(sa, sb)
  const n = Math.hypot(s[0], s[1], s[2])
  return { earth: lerp(ea, eb), sun: [s[0] / n, s[1] / n, s[2] / n] }
}

/** Evaluate Sun/Earth geometry at a site for given body-fixed vectors. */
export function evalVectors(ctx: SiteCtx, t: number, earth: Vec3, sun: Vec3): Sample {
  const s = azEl(sun, ctx.basis)
  const ev: Vec3 = [earth[0] - ctx.pos[0], earth[1] - ctx.pos[1], earth[2] - ctx.pos[2]]
  const e = azEl(ev, ctx.basis)
  const dist = Math.hypot(ev[0], ev[1], ev[2])
  const eR = angularRadiusDeg(R_EARTH_KM, dist)
  const sh = horizonAt(ctx.site.horizon, ctx.azStep, s.az)
  const eh = horizonAt(ctx.site.horizon, ctx.azStep, e.az)
  const sunMargin = s.el - sh
  const earthMargin = e.el - eh
  return {
    t,
    sunAz: s.az,
    sunEl: s.el,
    sunHorizon: sh,
    sunMargin,
    sunUpper: upperLimbMargin(sunMargin, SUN_RADIUS_DEG),
    sunFrac: discFractionAbove(sunMargin, SUN_RADIUS_DEG),
    earthAz: e.az,
    earthEl: e.el,
    earthHorizon: eh,
    earthMargin,
    earthUpper: upperLimbMargin(earthMargin, eR),
    earthFrac: discFractionAbove(earthMargin, eR),
    earthRadiusDeg: eR,
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
    const [e, s] = rowVec(eph, i)
    out.push(evalVectors(ctx, m.startMs + i * m.stepMs, e, s))
  }
  return out
}

export type Body = 'sun' | 'earth'
const upper = (b: Body) => (s: Sample) => (b === 'sun' ? s.sunUpper : s.earthUpper)

/** Visibility intervals (upper limb above terrain) for a body. */
export function visibleIntervals(samples: Sample[], body: Body): Interval[] {
  const f = upper(body)
  return positiveIntervals(samples.map((s) => ({ t: s.t, v: f(s) })))
}

export interface NextEvent {
  time: number | null
  kind: 'Sunrise' | 'Sunset' | 'Earthrise' | 'Earthset'
}

/** Next rise/set (upper-limb crossing of the terrain horizon) after t, searching up to maxDays. */
export function nextEvent(ctx: SiteCtx, eph: Ephemeris, t: number, body: Body, maxDays = 400): NextEvent {
  const f = upper(body)
  const now = sampleAt(ctx, eph, t)
  const up = f(now) > 0
  const kind: NextEvent['kind'] =
    body === 'sun' ? (up ? 'Sunset' : 'Sunrise') : up ? 'Earthset' : 'Earthrise'
  const end = Math.min(eph.endMs, t + maxDays * DAY)
  const m = eph.meta
  let prev = { t, v: f(now) }
  // walk the hourly grid in chunks to keep memory small
  for (let i = Math.floor((t - m.startMs) / m.stepMs) + 1; m.startMs + i * m.stepMs <= end; i++) {
    const [e, s] = rowVec(eph, i)
    const cur = { t: m.startMs + i * m.stepMs, v: f(evalVectors(ctx, 0, e, s)) }
    const c = firstCrossing([prev, cur])
    if (c) return { time: c.time, kind }
    prev = cur
  }
  return { time: null, kind }
}

/** Power per m² of panel, 30 % cells, using the visible fraction of the solar disc. */
export function panelPower(s: Sample, orientation: 'vertical' | 'horizontal' = 'vertical', eff = PANEL_EFFICIENCY) {
  const el = (Math.max(0, s.sunEl) * Math.PI) / 180
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
  longestDarkMs: number
  longestNoLinkMs: number
  maxSunEl: number
  avgPowerVertical: number
}

export function summarize(ctx: SiteCtx, eph: Ephemeris, t0: number, t1: number): { samples: Sample[]; sum: WindowSummary } {
  const samples = series(ctx, eph, t0, t1)
  return { samples, sum: summarizeSamples(samples, t0, t1) }
}

/** Pure summary of a sample series over [t0, t1]. */
export function summarizeSamples(samples: Sample[], t0: number, t1: number): WindowSummary {
  const sun = visibleIntervals(samples, 'sun')
  const earth = visibleIntervals(samples, 'earth')
  const both = intersect(sun, earth)
  let p = 0
  let maxSunEl = -90
  for (const s of samples) {
    p += panelPower(s)
    maxSunEl = Math.max(maxSunEl, s.sunEl)
  }
  return {
    sun,
    earth,
    both,
    sunPct: percentCovered(sun, t0, t1),
    earthPct: percentCovered(earth, t0, t1),
    bothPct: percentCovered(both, t0, t1),
    longestDarkMs: longestGap(sun, t0, t1),
    longestNoLinkMs: longestGap(earth, t0, t1),
    maxSunEl,
    avgPowerVertical: samples.length ? p / samples.length : 0,
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
    const [e, s] = rowVec(eph, i)
    const x = evalVectors(ctx, 0, e, s)
    sun[i] = x.sunUpper > 0 ? 1 : 0
    earth[i] = x.earthUpper > 0 ? 1 : 0
  }
  const sunRun = new Uint32Array(n + 1)
  for (let i = n - 1; i >= 0; i--) sunRun[i] = sun[i] ? sunRun[i + 1] + 1 : 0
  const earthCum = new Uint32Array(n + 1)
  for (let i = 0; i < n; i++) earthCum[i + 1] = earthCum[i] + earth[i]
  const h = { sun, earth, sunRun, earthCum }
  hourlyCache.set(key, h)
  return h
}
