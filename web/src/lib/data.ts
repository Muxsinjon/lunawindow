// Loads the precomputed NASA-derived data shipped in public/data (see /pipeline).

export interface EphemMeta {
  startUtc: string
  startMs: number
  stepMs: number
  count: number
  moonRadiusKm: number
  sunRadiusKm: number
  earthRadiusKm: number
  meanSunDistanceKm: number
  source: string
}

export interface Ephemeris {
  meta: EphemMeta
  /** rows x 6 : earth xyz (km, MOON_ME), sun unit xyz */
  rows: Float32Array
  endMs: number
}

export interface Site {
  id: string
  name: string
  group: string
  lat: number
  lon: number
  source: string
  verify: boolean
  elevationM: number
  horizon: number[]
  custom?: boolean
  terrainNote?: string
}

export interface SitesFile {
  azStepDeg: number
  maxDistanceKm: number
  observerHeightM: number
  terrain: string
  sites: Site[]
}

export interface PolarDemMeta {
  n: number
  scaleM: number
  offsetPx: number
  minLat: number
  source: string
}
export interface GlobalDemMeta {
  ppd: number
  rows: number
  cols: number
  source: string
}

export interface Validation {
  period: string
  worstElevationErrorDeg: number
  sites: { site: string; sun: { maxElevErrDeg: number }; earth: { maxElevErrDeg: number } }[]
  illumination?: {
    reference: string
    note: string
    sites: { site: string; oursSunPct: number; pgdaSunPct: number; oursEarthPct: number; pgdaEarthPct: number }[]
  }
  missions?: { mission: string; predicted: { event: string; utc: string }[]; sunAtLandingDeg: number; record: string }[]
}

export interface AppData {
  eph: Ephemeris
  sites: SitesFile
  polar: { meta: PolarDemMeta; h: Int16Array }
  global: { meta: GlobalDemMeta; h: Int16Array }
  pgda?: { sun: Uint8Array; earth: Uint8Array; n: number }
  validation: Validation
}

const base = `${import.meta.env.BASE_URL}data/`
const json = async <T,>(f: string): Promise<T> => {
  const r = await fetch(base + f)
  if (!r.ok) throw new Error(`${f}: ${r.status}`)
  return r.json()
}
const bin = async (f: string): Promise<ArrayBuffer> => {
  const r = await fetch(base + f)
  if (!r.ok) throw new Error(`${f}: ${r.status}`)
  return r.arrayBuffer()
}

export async function loadAll(): Promise<AppData> {
  const [meta, ephBuf, sites, pm, pb, gm, gb, validation, pgdaSun, pgdaEarth] = await Promise.all([
    json<EphemMeta>('ephem.json'),
    bin('ephem.bin'),
    json<SitesFile>('sites.json'),
    json<PolarDemMeta>('dem_polar.json'),
    bin('dem_polar.bin'),
    json<GlobalDemMeta>('dem_global.json'),
    bin('dem_global.bin'),
    json<Validation>('validation.json'),
    bin('pgda_sun.bin').catch(() => null),
    bin('pgda_earth.bin').catch(() => null),
  ])
  const rows = new Float32Array(ephBuf)
  const pgda =
    pgdaSun && pgdaEarth
      ? { sun: new Uint8Array(pgdaSun), earth: new Uint8Array(pgdaEarth), n: pm.n }
      : undefined
  return {
    eph: { meta, rows, endMs: meta.startMs + (meta.count - 1) * meta.stepMs },
    sites,
    polar: { meta: pm, h: new Int16Array(pb) },
    global: { meta: gm, h: new Int16Array(gb) },
    pgda,
    validation,
  }
}
