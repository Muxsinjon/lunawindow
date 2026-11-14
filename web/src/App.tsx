import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppData, Site } from './lib/data'
import { loadAll } from './lib/data'
import { DAY, HOUR, clampTime, fmtUtc, makeCtx, nextEvent, sampleAt, summarize } from './lib/analysis'
import { customHorizon } from './lib/terrain'
import { fmtLat, fmtLon } from './lib/geometry'
import SkyChart from './components/SkyChart'
import Timeline from './components/Timeline'
import Metrics from './components/Metrics'
import SitePicker, { SiteHeader } from './components/SitePicker'
import PolarMap from './components/PolarMap'
import Compare, { type Scenario } from './components/Compare'
import SlipAnalyzer from './components/SlipAnalyzer'
import About from './components/About'

type Tab = 'site' | 'compare' | 'slip' | 'about'
const TABS: [Tab, string][] = [
  ['site', 'Site explorer'],
  ['compare', 'Compare'],
  ['slip', 'Slip analyzer'],
  ['about', 'Method & validation'],
]

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1))
  return {
    site: p.get('site') ?? undefined,
    t: p.get('t') ? Date.parse(p.get('t')!) : undefined,
    w: p.get('w') ? Number(p.get('w')) : undefined,
    tab: (p.get('tab') as Tab) ?? undefined,
  }
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadAll().then(setData, (e) => setError(String(e)))
  }, [])
  if (error) return <div className="loading">Failed to load data: {error}</div>
  if (!data) return <div className="loading">Loading NASA ephemeris and LOLA terrain…</div>
  return <Navigator data={data} />
}

function makeCustomSite(data: AppData, lat: number, lon: number): Site {
  const h = customHorizon(data, lat, lon)
  return {
    id: `custom:${lat.toFixed(4)},${lon.toFixed(4)}`,
    name: `Custom ${fmtLat(lat)}, ${fmtLon(lon)}`,
    group: 'Custom',
    lat,
    lon,
    source: 'user input',
    verify: false,
    custom: true,
    elevationM: h.elevationM,
    horizon: h.mask,
    terrainNote: `Horizon computed in your browser from LOLA terrain at ${h.resolution} resolution.`,
  }
}

function Navigator({ data }: { data: AppData }) {
  const init = useMemo(readHash, [])
  const [custom, setCustom] = useState<Site[]>(() => {
    if (init.site?.startsWith('custom:')) {
      const [la, lo] = init.site.slice(7).split(',').map(Number)
      if (isFinite(la) && isFinite(lo)) return [makeCustomSite(data, la, lo)]
    }
    return []
  })
  const sites = useMemo(() => [...data.sites.sites, ...custom], [data, custom])
  const [siteId, setSiteId] = useState(init.site && sites.some((s) => s.id === init.site) ? init.site : 'im-2')
  const [tab, setTab] = useState<Tab>(init.tab ?? 'site')
  const [windowDays, setWindowDays] = useState(init.w ?? 30)
  const now0 = clampTime(data.eph, init.t ?? Math.round(Date.now() / HOUR) * HOUR)
  const [t0, setT0] = useState(now0)
  const [t, setT] = useState(now0)
  const [playing, setPlaying] = useState(false)
  const [scenarios, setScenarios] = useState<Scenario[]>(() => [
    { key: 'a', siteId: 'im-2', t0: now0 },
    { key: 'b', siteId: 'im-2', t0: now0 + 30 * DAY },
    { key: 'c', siteId: 'connecting-ridge', t0: now0 },
    { key: 'd', siteId: 'nobile-rim-2', t0: now0 },
  ])

  const site = sites.find((s) => s.id === siteId) ?? sites[0]
  const t1 = Math.min(data.eph.endMs, t0 + windowDays * DAY)
  const ctx = useMemo(() => makeCtx(site, data.sites.azStepDeg), [site, data])
  const { samples, sum } = useMemo(() => summarize(ctx, data.eph, t0, t1), [ctx, data, t0, t1])
  const now = useMemo(() => sampleAt(ctx, data.eph, t), [ctx, data, t])
  const sunEvent = useMemo(() => nextEvent(ctx, data.eph, t, 'sun'), [ctx, data, t])
  const earthEvent = useMemo(() => nextEvent(ctx, data.eph, t, 'earth'), [ctx, data, t])

  // shareable URL
  useEffect(() => {
    const p = new URLSearchParams({ site: site.id, t: new Date(t0).toISOString(), w: String(windowDays), tab })
    history.replaceState(null, '', `#${p.toString()}`)
  }, [site.id, t0, windowDays, tab])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setT((x) => {
        const nx = x + 2 * HOUR
        if (nx > t1) {
          setPlaying(false)
          return t1
        }
        return nx
      })
    }, 40)
    return () => clearInterval(id)
  }, [playing, t1])

  const pickCustom = useCallback(
    (lat: number, lon: number) => {
      const s = makeCustomSite(data, lat, lon)
      setCustom((c) => [...c.filter((x) => x.id !== s.id).slice(-5), s])
      setSiteId(s.id)
    },
    [data],
  )

  const setStart = (ms: number) => {
    const c = clampTime(data.eph, ms)
    setT0(c)
    setT(c)
  }

  const dateValue = new Date(t0).toISOString().slice(0, 16)

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden>
            <circle cx="16" cy="16" r="13" fill="var(--ground-top)" />
            <path d="M3 19 Q9 13 14 17 T29 15 L29 29 L3 29Z" fill="var(--panel-2)" />
            <circle cx="23" cy="8" r="3" fill="var(--sun)" />
          </svg>
          <div>
            <h1>Lunar Landing Site Navigator</h1>
            <p>Terrain-aware Sun &amp; Earth visibility for landing sites and dates</p>
          </div>
        </div>
        <nav className="tabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'site' && (
        <main className="explorer">
          <aside className="side">
            <SitePicker sites={sites} selectedId={site.id} onSelect={setSiteId} onCustom={pickCustom} />
            <PolarMap data={data} sites={sites} selectedId={site.id} onPick={pickCustom} onSelect={setSiteId} />
          </aside>
          <section className="mainpane">
            <SiteHeader site={site} />
            <div className="controls row">
              <label className="lbl">
                Start (UTC)
                <input
                  type="datetime-local"
                  value={dateValue}
                  min={new Date(data.eph.meta.startMs).toISOString().slice(0, 16)}
                  max={new Date(data.eph.endMs).toISOString().slice(0, 16)}
                  onChange={(e) => {
                    const ms = Date.parse(e.target.value + ':00Z')
                    if (isFinite(ms)) setStart(ms)
                  }}
                />
              </label>
              <div className="seg" aria-label="Shift start date">
                <button onClick={() => setStart(t0 - 29.53 * DAY)} title="One lunar day earlier">
                  −1 lunar day
                </button>
                <button onClick={() => setStart(t0 - 7 * DAY)}>−7 d</button>
                <button onClick={() => setStart(t0 + 7 * DAY)}>+7 d</button>
                <button onClick={() => setStart(t0 + 29.53 * DAY)} title="One lunar day later">
                  +1 lunar day
                </button>
              </div>
              <label className="lbl">
                Window
                <select value={windowDays} onChange={(e) => setWindowDays(+e.target.value)}>
                  {[7, 14, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary"
                onClick={() => {
                  if (!playing && t >= t1) setT(t0)
                  setPlaying(!playing)
                }}
              >
                {playing ? '❚❚ Pause' : '▶ Play'}
              </button>
              <button
                className="ghost"
                onClick={() => {
                  setScenarios([...scenarios, { key: `${site.id}-${t0}-${Math.random()}`, siteId: site.id, t0 }])
                  setTab('compare')
                }}
              >
                + Compare
              </button>
            </div>
            <input
              className="scrub"
              type="range"
              min={t0}
              max={t1}
              step={HOUR}
              value={t}
              onChange={(e) => setT(+e.target.value)}
              aria-label="Time within window"
            />
            <Metrics now={now} sunEvent={sunEvent} earthEvent={earthEvent} sum={sum} windowDays={windowDays} />
            <SkyChart horizon={site.horizon} azStep={data.sites.azStepDeg} samples={samples} now={now} />
            <figure className="chart">
              <Timeline samples={samples} t0={t0} t1={t1} cursor={t} sun={sum.sun} earth={sum.earth} both={sum.both} onPick={setT} />
              <figcaption>
                Height of the <b className="sun-t">Sun</b> and <b className="earth-t">Earth</b> above the terrain horizon, and the
                resulting windows from {fmtUtc(t0, false)} to {fmtUtc(t1, false)}. Click to move the cursor.
              </figcaption>
            </figure>
          </section>
        </main>
      )}

      {tab === 'compare' && (
        <main className="pane">
          <Compare
            data={data}
            sites={sites}
            scenarios={scenarios}
            setScenarios={setScenarios}
            windowDays={windowDays}
            onOpen={(s) => {
              setSiteId(s.siteId)
              setStart(s.t0)
              setTab('site')
            }}
          />
        </main>
      )}

      {tab === 'slip' && (
        <main className="pane">
          <div className="row between slip-head">
            <SiteHeader site={site} />
            <SitePicker sites={sites} selectedId={site.id} onSelect={setSiteId} onCustom={pickCustom} />
          </div>
          <SlipAnalyzer
            data={data}
            site={site}
            t0={t0}
            onChoose={(ms) => {
              setStart(ms)
              setTab('site')
            }}
          />
        </main>
      )}

      {tab === 'about' && (
        <main className="pane">
          <About data={data} />
        </main>
      )}

      <footer className="foot">
        NASA data: JPL Horizons · LRO LOLA · PGDA lunar illumination. Built for NASA Space Apps 2026. Ephemeris{' '}
        {fmtUtc(data.eph.meta.startMs, false)} to {fmtUtc(data.eph.endMs, false)}.
      </footer>
    </div>
  )
}
