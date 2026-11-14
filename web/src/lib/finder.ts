// Mission Window Finder: evaluate candidate (site, start) pairs against user requirements.
// Pure functions over hourly visibility flags (1 h half-open samples). No React.

export interface Requirements {
  minSunPct: number
  minEarthPct: number
  /** null = not required */
  minJointPct: number | null
  maxDarkH: number
  maxBlackoutH: number
}

/** Illustrative defaults: hypothetical mission constraints, not NASA engineering standards. */
export const DEFAULT_REQ: Requirements = { minSunPct: 50, minEarthPct: 60, minJointPct: null, maxDarkH: 72, maxBlackoutH: 48 }

export type Status = 'meets' | 'partial' | 'fails' | 'insufficient'

export const STATUS_LABEL: Record<Status, string> = {
  meets: 'Meets requirements',
  partial: 'Partially meets',
  fails: 'Does not meet',
  insufficient: 'Insufficient data',
}

export interface Check {
  key: keyof Requirements
  label: string
  /** the threshold */
  limit: number
  actual: number
  unit: '%' | 'h'
  kind: 'min' | 'max'
  pass: boolean
}

export interface Span {
  startIndex: number
  hours: number
}

export interface Metrics {
  hours: number
  sunPct: number
  earthPct: number
  jointPct: number
  longestDarkH: number
  longestBlackoutH: number
  longestJointH: number
  linkInterruptions: number
  darkSpan: Span | null
  blackoutSpan: Span | null
  jointSpan: Span | null
}

export interface SiteFlags {
  siteId: string
  sun: Uint8Array
  earth: Uint8Array
}

/** Prefix sums and run lengths so each candidate costs O(number of runs), not O(hours). */
export interface Prepared {
  siteId: string
  n: number
  sunCum: Uint32Array
  earthCum: Uint32Array
  jointCum: Uint32Array
  /** run length of the same sun state starting at i */
  sunRun: Uint32Array
  earthRun: Uint32Array
  jointRun: Uint32Array
  sun: Uint8Array
  earth: Uint8Array
}

function runs(a: Uint8Array): Uint32Array {
  const n = a.length
  const r = new Uint32Array(n + 1)
  for (let i = n - 1; i >= 0; i--) r[i] = i + 1 < n && a[i + 1] === a[i] ? r[i + 1] + 1 : 1
  return r
}

export function prepare(f: SiteFlags): Prepared {
  const n = f.sun.length
  const joint = new Uint8Array(n)
  const sunCum = new Uint32Array(n + 1)
  const earthCum = new Uint32Array(n + 1)
  const jointCum = new Uint32Array(n + 1)
  for (let i = 0; i < n; i++) {
    joint[i] = f.sun[i] & f.earth[i]
    sunCum[i + 1] = sunCum[i] + f.sun[i]
    earthCum[i + 1] = earthCum[i] + f.earth[i]
    jointCum[i + 1] = jointCum[i] + joint[i]
  }
  return {
    siteId: f.siteId,
    n,
    sunCum,
    earthCum,
    jointCum,
    sunRun: runs(f.sun),
    earthRun: runs(f.earth),
    jointRun: runs(joint),
    sun: f.sun,
    earth: f.earth,
  }
}

/** Longest run with value `v` inside [i, end) plus number of such runs, skipping whole runs at a time. */
function longestIn(a: Uint8Array, run: Uint32Array, i: number, end: number, v: 0 | 1): { span: Span | null; count: number } {
  let best: Span | null = null
  let count = 0
  let j = i
  while (j < end) {
    const len = Math.min(run[j], end - j)
    if (a[j] === v) {
      count++
      if (!best || len > best.hours) best = { startIndex: j, hours: len }
    }
    j += len
  }
  return { span: best, count }
}

export function metricsAt(p: Prepared, i: number, hours: number): Metrics {
  const end = i + hours
  const dark = longestIn(p.sun, p.sunRun, i, end, 0)
  const black = longestIn(p.earth, p.earthRun, i, end, 0)
  // joint (Sun and Earth both visible) runs come from sun & earth with their own run lengths
  let jointSpan: Span | null = null
  {
    let j = i
    while (j < end) {
      const len = Math.min(p.jointRun[j], end - j)
      if ((p.sun[j] & p.earth[j]) === 1 && (!jointSpan || len > jointSpan.hours)) jointSpan = { startIndex: j, hours: len }
      j += len
    }
  }
  const pct = (cum: Uint32Array) => (100 * (cum[end] - cum[i])) / hours
  return {
    hours,
    sunPct: pct(p.sunCum),
    earthPct: pct(p.earthCum),
    jointPct: pct(p.jointCum),
    longestDarkH: dark.span?.hours ?? 0,
    longestBlackoutH: black.span?.hours ?? 0,
    longestJointH: jointSpan?.hours ?? 0,
    linkInterruptions: black.count,
    darkSpan: dark.span,
    blackoutSpan: black.span,
    jointSpan,
  }
}

export function checksFor(m: Metrics, r: Requirements): Check[] {
  const c: Check[] = [
    { key: 'minSunPct', label: 'Sunlight', limit: r.minSunPct, actual: m.sunPct, unit: '%', kind: 'min', pass: m.sunPct >= r.minSunPct },
    {
      key: 'minEarthPct',
      label: 'Earth visibility',
      limit: r.minEarthPct,
      actual: m.earthPct,
      unit: '%',
      kind: 'min',
      pass: m.earthPct >= r.minEarthPct,
    },
  ]
  if (r.minJointPct !== null)
    c.push({
      key: 'minJointPct',
      label: 'Sun and Earth together',
      limit: r.minJointPct,
      actual: m.jointPct,
      unit: '%',
      kind: 'min',
      pass: m.jointPct >= r.minJointPct,
    })
  c.push(
    {
      key: 'maxDarkH',
      label: 'Longest darkness',
      limit: r.maxDarkH,
      actual: m.longestDarkH,
      unit: 'h',
      kind: 'max',
      pass: m.longestDarkH <= r.maxDarkH,
    },
    {
      key: 'maxBlackoutH',
      label: 'Longest communication blackout',
      limit: r.maxBlackoutH,
      actual: m.longestBlackoutH,
      unit: 'h',
      kind: 'max',
      pass: m.longestBlackoutH <= r.maxBlackoutH,
    },
  )
  return c
}

/**
 * Status rule (documented in the UI):
 *  - insufficient: the mission would extend outside the supported data
 *  - meets: every active requirement passes
 *  - partial: at least one fails, but no more than half of the active requirements
 *  - fails: more than half of the active requirements fail
 */
export function statusFor(checks: Check[]): Exclude<Status, 'insufficient'> {
  const failed = checks.filter((c) => !c.pass).length
  if (failed === 0) return 'meets'
  return failed <= Math.floor(checks.length / 2) ? 'partial' : 'fails'
}

export interface Candidate {
  siteId: string
  startIndex: number
  startMs: number
  endMs: number
  status: Status
  failed: number
  checks: Check[]
  metrics: Metrics | null
}

export interface SearchInput {
  sites: Prepared[]
  /** ms of hourly sample 0 */
  t0Ms: number
  stepMs: number
  searchStartMs: number
  searchEndMs: number
  /** candidate start spacing in hours */
  everyH: number
  durationH: number
  req: Requirements
}

export function search(inp: SearchInput): Candidate[] {
  const out: Candidate[] = []
  const first = Math.ceil((inp.searchStartMs - inp.t0Ms) / inp.stepMs)
  const last = Math.floor((inp.searchEndMs - inp.t0Ms) / inp.stepMs)
  for (const p of inp.sites) {
    for (let i = first; i <= last; i += inp.everyH) {
      const startMs = inp.t0Ms + i * inp.stepMs
      const endMs = startMs + inp.durationH * inp.stepMs
      if (i < 0 || i + inp.durationH > p.n) {
        out.push({ siteId: p.siteId, startIndex: i, startMs, endMs, status: 'insufficient', failed: 0, checks: [], metrics: null })
        continue
      }
      const m = metricsAt(p, i, inp.durationH)
      const checks = checksFor(m, inp.req)
      out.push({
        siteId: p.siteId,
        startIndex: i,
        startMs,
        endMs,
        status: statusFor(checks),
        failed: checks.filter((c) => !c.pass).length,
        checks,
        metrics: m,
      })
    }
  }
  return rank(out)
}

const ORDER: Record<Status, number> = { meets: 0, partial: 1, fails: 2, insufficient: 3 }

/**
 * Transparent ranking, hard requirements first:
 *  1. status (meets > partial > does not meet > insufficient data)
 *  2. fewer failed requirements
 *  3. more time with Sun and Earth together
 *  4. shorter longest darkness
 *  5. earlier start
 */
export function rank(c: Candidate[]): Candidate[] {
  return [...c].sort(
    (a, b) =>
      ORDER[a.status] - ORDER[b.status] ||
      a.failed - b.failed ||
      (b.metrics?.jointPct ?? -1) - (a.metrics?.jointPct ?? -1) ||
      (a.metrics?.longestDarkH ?? 1e9) - (b.metrics?.longestDarkH ?? 1e9) ||
      a.startMs - b.startMs,
  )
}

/** Plain-language sentence for one check, built only from the computed numbers. */
export function checkSentence(c: Check): string {
  const a = c.unit === '%' ? `${Math.round(c.actual)} %` : `${c.actual} h`
  const l = c.unit === '%' ? `${c.limit} %` : `${c.limit} h`
  if (c.kind === 'min')
    return c.pass
      ? `${c.label} is ${a} of mission time, meeting the minimum of ${l}.`
      : `${c.label} is only ${a} of mission time, below the required minimum of ${l}.`
  return c.pass
    ? `${c.label} is ${a}, within the allowed maximum of ${l}.`
    : `This candidate exceeds the configured maximum for ${c.label.toLowerCase()}. The modeled uninterrupted period is ${a}, while the mission allows only ${l}.`
}
