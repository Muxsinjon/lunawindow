import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import type { AppData, Site, Terrain } from './lib/data'
import { loadCore, loadTerrain } from './lib/data'
import { DAY, HOUR, LUNAR_DAY, clampTime, makeCtx, nextEvent, sampleAt, summarize } from './lib/analysis'
import { type TimeZoneMode, fmtLat, fmtLon, fmtTime, fromInputValue, toInputValue } from './lib/format'
import { INFO } from './lib/glossary'
import { normalizeLon360 } from './lib/physics/lon'
import { type Mode, PrefsContext, storageGet, storageSet } from './lib/prefs'
import { customHorizon } from './lib/terrain'
import { type Theme, applyTheme } from './lib/theme'
import { type Tab, parseHash, toHash } from './lib/url'
import Header, { Mark } from './components/Header'
import SkyChart from './components/SkyChart'
import Timeline, { LanePatterns } from './components/Timeline'
import Metrics, { StatusStrip } from './components/Metrics'
import SitePicker, { SiteHeader } from './components/SitePicker'
import Explain from './components/Explain'
import MissionCheck from './components/MissionCheck'
import Onboarding from './components/Onboarding'
import { ErrorBoundary, Icon, InfoTip, Skeleton } from './components/ui'
import type { Scenario } from './components/Compare'

const Compare = lazy(() => import('./components/Compare'))
const SlipAnalyzer = lazy(() => import('./components/SlipAnalyzer'))
const About = lazy(() => import('./components/About'))
const PolarMap = lazy(() => import('./components/PolarMap'))

/** Preloaded story: on 2026-11-22 the Sun sets at Nobile Rim 2 while still 6.4° above a flat horizon. */
const DEFAULT = {
  site: 'nobile-rim-2',
  start: Date.parse('2026-11-14T00:00:00Z'),
  cursor: Date.parse('2026-11-22T00:40:00Z'),
  windowDays: 14,
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [theme, setThemeState] = useState<Theme>(() => (storageGet('llsn.theme') === 'light' ? 'light' : 'dark'))
  useEffect(() => applyTheme(theme), [theme])
  const setTheme = (t: Theme) => {
    storageSet('llsn.theme', t)
    setThemeState(t)
  }
  const fetchCore = useCallback(() => loadCore().then(setData, (e: Error) => setError(e.message)), [])
  useEffect(() => {
    void fetchCore()
  }, [fetchCore])
  const load = () => {
    setError(null)
    void fetchCore()
  }

  if (error)
    return (
      <div className="boot">
        <div className="state-error" role="alert">
          <Icon name="warn" size={22} />
          <div>
            <p className="state-title">The mission data didn't load.</p>
            <p className="muted">{error}. Check your connection, then try again.</p>
            <button type="button" className="btn primary" onClick={load}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  if (!data) return <BootSkeleton />
  return <Navigator data={data} theme={theme} setTheme={setTheme} />
}

function BootSkeleton() {
  return (
    <div className="app" aria-busy="true" aria-label="Loading NASA ephemeris and terrain">
      <header className="topbar">
        <div className="brand">
          <Mark />
          <div>
            <h1>Lunar Landing Site Navigator</h1>
            <p>Loading JPL Horizons ephemeris and LOLA terrain…</p>
          </div>
        </div>
      </header>
      <div className="explorer">
        <aside className="rail">
          <Skeleton h={64} />
          <Skeleton h={140} />
          <Skeleton h={300} />
        </aside>
        <section className="stage">
          <Skeleton h={56} w="60%" />
          <Skeleton h={40} />
          <Skeleton h={420} r="var(--r-lg)" />
          <Skeleton h={180} />
        </section>
      </div>
    </div>
  )
}

function makeCustomSite(t: Terrain, lat: number, lon: number): Site {
  const lon360 = normalizeLon360(lon)
  const h = customHorizon(t, lat, lon360)
  return {
    id: `custom:${lat.toFixed(4)},${lon360.toFixed(4)}`,
    name: `Custom spot ${fmtLat(lat)}, ${fmtLon(lon360)}`,
    group: 'Custom',
    lat,
    lon: lon360,
    source: 'user input',
    verify: false,
    custom: true,
    elevationM: h.elevationM,
    horizon: h.mask,
    terrainNote: `Horizon computed in your browser from LOLA terrain at ${h.resolution} resolution (coarser than curated sites).`,
  }
}

function Navigator({ data, theme, setTheme }: { data: AppData; theme: Theme; setTheme: (t: Theme) => void }) {
  const init = useMemo(() => parseHash(window.location.hash), [])
  const [custom, setCustom] = useState<Site[]>([])
  const [customBusy, setCustomBusy] = useState(false)
  const sites = useMemo(() => [...data.sites.sites, ...custom], [data, custom])
  const [siteId, setSiteId] = useState(init.site ?? DEFAULT.site)
  const [tab, setTab] = useState<Tab>(init.tab ?? 'site')
  const [mode, setMode] = useState<Mode>(init.mode ?? 'planner')
  const [tz, setTz] = useState<TimeZoneMode>(init.tz ?? 'utc')
  const [windowDays, setWindowDays] = useState(init.windowDays ?? DEFAULT.windowDays)
  const [t0, setT0] = useState(clampTime(data.eph, init.start ?? DEFAULT.start))
  const [t, setT] = useState(clampTime(data.eph, init.cursor ?? init.start ?? DEFAULT.cursor))
  const [playing, setPlaying] = useState(false)
  const [scenarios, setScenarios] = useState<Scenario[]>(() => [
    { key: 'a', siteId: 'nobile-rim-2', t0: DEFAULT.start },
    { key: 'b', siteId: 'nobile-rim-2', t0: DEFAULT.start + 30 * DAY },
    { key: 'c', siteId: 'connecting-ridge', t0: DEFAULT.start },
    { key: 'd', siteId: 'im-2', t0: DEFAULT.start },
  ])

  // restore a custom site from a shared link (needs terrain)
  const addCustom = useCallback(async (lat: number, lon: number) => {
    setCustomBusy(true)
    try {
      const terrain = await loadTerrain()
      const s = makeCustomSite(terrain, lat, lon)
      setCustom((c) => [...c.filter((x) => x.id !== s.id).slice(-5), s])
      setSiteId(s.id)
    } finally {
      setCustomBusy(false)
    }
  }, [])
  useEffect(() => {
    if (!init.site?.startsWith('custom:')) return
    const [la, lo] = init.site.slice(7).split(',').map(Number)
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return
    loadTerrain().then(
      (terrain) => {
        const s = makeCustomSite(terrain, la, lo)
        setCustom((c) => [...c.filter((x) => x.id !== s.id), s])
        setSiteId(s.id)
      },
      () => setSiteId(DEFAULT.site),
    )
  }, [init])

  const site = sites.find((s) => s.id === siteId) ?? (siteId.startsWith('custom:') ? null : sites[0])
  const t1 = Math.min(data.eph.endMs, t0 + windowDays * DAY)
  const tc = Math.max(t0, Math.min(t1, t))

  // URL ← state
  useEffect(() => {
    if (!site) return
    const h = toHash({ site: site.id, start: t0, cursor: tc, windowDays, tab, mode, tz })
    if (h !== window.location.hash) window.history.replaceState(null, '', h)
  }, [site, t0, tc, windowDays, tab, mode, tz])

  // state ← URL (edited links, back/forward)
  useEffect(() => {
    const on = () => {
      const s = parseHash(window.location.hash)
      if (s.site && !s.site.startsWith('custom:')) setSiteId(s.site)
      if (s.tab) setTab(s.tab)
      if (s.mode) setMode(s.mode)
      if (s.tz) setTz(s.tz)
      if (s.windowDays) setWindowDays(s.windowDays)
      if (s.start !== undefined) setT0(clampTime(data.eph, s.start))
      if (s.cursor !== undefined) setT(clampTime(data.eph, s.cursor))
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [data])

  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, [])
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(
      () =>
        setT((x) => {
          const nx = x + (reduced ? 6 : 2) * HOUR
          if (nx >= t1) {
            setPlaying(false)
            return t1
          }
          return nx
        }),
      reduced ? 250 : 50,
    )
    return () => window.clearInterval(id)
  }, [playing, t1, reduced])

  // keyboard: ←/→ 1 h, Shift+←/→ 1 day, Space play/pause (explorer only, never while typing)
  useEffect(() => {
    if (tab !== 'site') return
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const d = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? DAY : HOUR)
        setPlaying(false)
        setT((x) => Math.max(t0, Math.min(t1, x + d)))
      } else if (e.key === ' ' && tag !== 'BUTTON') {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [tab, t0, t1])

  const setStart = (ms: number) => {
    const c = clampTime(data.eph, ms)
    setT0(c)
    setT(c)
  }

  const prefs = useMemo(() => ({ mode, tz }), [mode, tz])

  return (
    <PrefsContext.Provider value={prefs}>
      <div className={`app mode-${mode}`}>
        <a href="#view" className="skip">
          Skip to content
        </a>
        <LanePatterns />
        <Header tab={tab} setTab={setTab} mode={mode} setMode={setMode} tz={tz} setTz={setTz} theme={theme} setTheme={setTheme} />
        <main id="view" tabIndex={-1}>
          <div role="tabpanel" id="view-panel" aria-labelledby={`tab-${tab}`}>
            {tab === 'site' &&
              (site ? (
                <ErrorBoundary label="The site explorer">
                  <Explorer
                    data={data}
                    site={site}
                    sites={sites}
                    t0={t0}
                    t1={t1}
                    t={tc}
                    setT={(x) => {
                      setPlaying(false)
                      setT(x)
                    }}
                    setStart={setStart}
                    windowDays={windowDays}
                    setWindowDays={setWindowDays}
                    playing={playing}
                    togglePlay={() => {
                      if (!playing && tc >= t1) setT(t0)
                      setPlaying(!playing)
                    }}
                    setSiteId={setSiteId}
                    addCustom={addCustom}
                    customBusy={customBusy}
                    theme={theme}
                    onCompare={() => {
                      setScenarios([...scenarios, { key: `${site.id}-${t0}-${Date.now()}`, siteId: site.id, t0 }])
                      setTab('compare')
                    }}
                  />
                </ErrorBoundary>
              ) : (
                <div className="stage pad">
                  <Skeleton h={420} r="var(--r-lg)" />
                </div>
              ))}
            <Suspense
              fallback={
                <div className="pad">
                  <Skeleton h={360} />
                </div>
              }
            >
              {tab === 'compare' && (
                <ErrorBoundary label="The comparison">
                  <div className="pad">
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
                  </div>
                </ErrorBoundary>
              )}
              {tab === 'slip' && site && (
                <ErrorBoundary label="The landing calendar">
                  <div className="pad">
                    <div className="slip-pick">
                      <SitePicker sites={sites} selectedId={site.id} onSelect={setSiteId} />
                    </div>
                    <SlipAnalyzer
                      data={data}
                      site={site}
                      t0={t0}
                      onChoose={(ms) => {
                        setT0(clampTime(data.eph, ms - DAY))
                        setT(clampTime(data.eph, ms))
                        setTab('site')
                      }}
                    />
                  </div>
                </ErrorBoundary>
              )}
              {tab === 'about' && (
                <ErrorBoundary label="The data and methods page">
                  <div className="pad">
                    <About data={data} />
                  </div>
                </ErrorBoundary>
              )}
            </Suspense>
          </div>
        </main>
        <footer className="foot">
          <p>
            Built for the NASA Space Apps Challenge 2026 with free NASA data: JPL Horizons, LRO LOLA and the LOLA polar illumination maps.
            Ephemeris {fmtTime(data.eph.meta.startMs, tz, false)} to {fmtTime(data.eph.endMs, tz, false)}. Not an official NASA product.
          </p>
        </footer>
      </div>
    </PrefsContext.Provider>
  )
}

interface ExplorerProps {
  data: AppData
  site: Site
  sites: Site[]
  t0: number
  t1: number
  t: number
  setT: (t: number) => void
  setStart: (t: number) => void
  windowDays: number
  setWindowDays: (d: number) => void
  playing: boolean
  togglePlay: () => void
  setSiteId: (id: string) => void
  addCustom: (lat: number, lon: number) => Promise<void>
  customBusy: boolean
  theme: Theme
  onCompare: () => void
}

function Explorer(p: ExplorerProps) {
  const { data, site, t0, t1, t } = p
  const ctx = useMemo(() => makeCtx(site, data.sites.azStepDeg), [site, data])
  const { samples, sum } = useMemo(() => summarize(ctx, data.eph, t0, t1), [ctx, data, t0, t1])
  const now = useMemo(() => sampleAt(ctx, data.eph, t), [ctx, data, t])
  const sunEvent = useMemo(() => nextEvent(ctx, data.eph, t, 'sun'), [ctx, data, t])
  const earthEvent = useMemo(() => nextEvent(ctx, data.eph, t, 'earth'), [ctx, data, t])
  return (
    <PrefsContext.Consumer>
      {({ tz, mode }) => (
        <div className="explorer">
          <aside className="rail" aria-label="Site and time">
            <section className="panel" aria-label="Choose a site">
              <SitePicker
                sites={p.sites}
                selectedId={site.id}
                onSelect={p.setSiteId}
                onCustom={(la, lo) => void p.addCustom(la, lo)}
                customBusy={p.customBusy}
              />
            </section>
            <section className="panel" aria-label="Choose dates">
              <label className="field">
                <span className="field-label">Window starts ({tz === 'utc' ? 'UTC' : 'local time'})</span>
                <input
                  type="datetime-local"
                  value={toInputValue(t0, tz)}
                  min={toInputValue(data.eph.meta.startMs, tz)}
                  max={toInputValue(data.eph.endMs, tz)}
                  onChange={(e) => {
                    const ms = fromInputValue(e.target.value, tz)
                    if (Number.isFinite(ms)) p.setStart(ms)
                  }}
                />
              </label>
              <div className="seg full" aria-label="Shift the window">
                <button type="button" onClick={() => p.setStart(t0 - LUNAR_DAY)} title="One lunar day (29.5 days) earlier">
                  −1 lunar day
                </button>
                <button type="button" onClick={() => p.setStart(t0 - DAY)}>
                  −1 d
                </button>
                <button type="button" onClick={() => p.setStart(t0 + DAY)}>
                  +1 d
                </button>
                <button type="button" onClick={() => p.setStart(t0 + LUNAR_DAY)} title="One lunar day (29.5 days) later">
                  +1 lunar day
                </button>
              </div>
              <label className="field">
                <span className="field-label">Window length</span>
                <select value={p.windowDays} onChange={(e) => p.setWindowDays(+e.target.value)}>
                  {[7, 14, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              </label>
            </section>
            <Suspense fallback={<Skeleton h={360} />}>
              <ErrorBoundary label="The map">
                <PolarMap
                  sites={p.sites}
                  selectedId={site.id}
                  theme={p.theme}
                  onSelect={p.setSiteId}
                  onPick={(lat, lon) => void p.addCustom(lat, lon)}
                />
              </ErrorBoundary>
            </Suspense>
            <MissionCheck v={data.validation} compact />
          </aside>

          <section className="stage" aria-label="Analysis">
            <div className="stage-head">
              <SiteHeader site={site} />
              <button type="button" className="btn" onClick={p.onCompare}>
                Add to comparison
              </button>
            </div>
            <Onboarding />
            <StatusStrip now={now} sunEvent={sunEvent} earthEvent={earthEvent} />
            <SkyChart horizon={site.horizon} azStep={data.sites.azStepDeg} samples={samples} now={now} />
            <div className="scrub-row">
              <button
                type="button"
                className="btn primary"
                onClick={p.togglePlay}
                aria-label={p.playing ? 'Pause' : 'Play through the window'}
              >
                <Icon name={p.playing ? 'pause' : 'play'} />
                {p.playing ? 'Pause' : 'Play'}
              </button>
              <input
                className="scrub"
                type="range"
                min={t0}
                max={t1}
                step={HOUR}
                value={t}
                onChange={(e) => p.setT(+e.target.value)}
                aria-label="Time within the window"
                aria-valuetext={fmtTime(t, tz)}
              />
              <output className="scrub-time num" aria-live="off">
                {fmtTime(t, tz)}
              </output>
            </div>
            {mode === 'explore' && (
              <Explain siteName={site.name} lat={site.lat} now={now} sunEvent={sunEvent} sum={sum} windowDays={p.windowDays} />
            )}
            <figure className="chart-frame">
              <div className="chart-head">
                <h3 className="chart-title">
                  Sunlight and Earth link over {p.windowDays} days <InfoTip info={INFO.timeline} label="the timeline" />
                </h3>
                <div className="legend" aria-hidden>
                  <span className="lg lg-sun">Sunlight</span>
                  <span className="lg lg-earth">Earth link</span>
                  <span className="lg lg-both">Both</span>
                </div>
              </div>
              <Timeline
                samples={samples}
                t0={t0}
                t1={t1}
                cursor={t}
                sun={sum.sun}
                earth={sum.earth}
                both={sum.both}
                onPick={p.setT}
                label="Window"
              />
              <figcaption>
                The lines show how high the Sun and Earth stand above the terrain (the dashed line). Select a point to move the time cursor.
              </figcaption>
            </figure>
            <Metrics now={now} sunEvent={sunEvent} earthEvent={earthEvent} sum={sum} windowDays={p.windowDays} />
          </section>
        </div>
      )}
    </PrefsContext.Consumer>
  )
}
