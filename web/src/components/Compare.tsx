import { useMemo, useState } from 'react'
import type { AppData, Site } from '../lib/data'
import { DAY, makeCtx, nextEvent, summarize } from '../lib/analysis'
import { fmtDuration, fmtTime } from '../lib/format'
import Timeline from './Timeline'

export interface Scenario {
  key: string
  siteId: string
  t0: number
}

interface Props {
  data: AppData
  sites: Site[]
  scenarios: Scenario[]
  setScenarios: (s: Scenario[]) => void
  windowDays: number
  onOpen: (s: Scenario) => void
}

export default function Compare({ data, sites, scenarios, setScenarios, windowDays, onOpen }: Props) {
  const [siteId, setSiteId] = useState(sites[0].id)
  const [date, setDate] = useState(new Date(scenarios[0]?.t0 ?? Date.now()).toISOString().slice(0, 16))

  const rows = useMemo(
    () =>
      scenarios.map((sc) => {
        const site = sites.find((s) => s.id === sc.siteId) ?? sites[0]
        const ctx = makeCtx(site, data.sites.azStepDeg)
        const t1 = sc.t0 + windowDays * DAY
        const { samples, sum } = summarize(ctx, data.eph, sc.t0, t1)
        const firstSunset = nextEvent(ctx, data.eph, sc.t0, 'sun')
        const sunUpAtStart = samples[0]?.sunMargin > 0
        return { sc, site, samples, sum, t1, firstSunset, sunUpAtStart }
      }),
    [scenarios, sites, data, windowDays],
  )

  const best = (f: (r: (typeof rows)[number]) => number, hiGood = true) => {
    const vals = rows.map(f)
    const b = hiGood ? Math.max(...vals) : Math.min(...vals)
    return (r: (typeof rows)[number]) => (rows.length > 1 && f(r) === b ? 'best' : '')
  }
  const bSun = best((r) => r.sum.sunPct)
  const bEarth = best((r) => r.sum.earthPct)
  const bBoth = best((r) => r.sum.bothPct)
  const bDark = best((r) => r.sum.longestDarkMs, false)

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const t = Date.parse(date + ':00Z')
    if (!isFinite(t)) return
    setScenarios([...scenarios, { key: `${siteId}-${t}-${Math.random()}`, siteId, t0: t }])
  }

  return (
    <section className="compare">
      <form className="row addscn" onSubmit={add}>
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)} aria-label="Site to add">
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Start (UTC)" />
        <button type="submit">+ Add scenario</button>
        <span className="muted">Each row starts at its own date: bars are aligned by days since landing.</span>
      </form>
      <div className="table" role="table">
        <div className="tr th" role="row">
          <div>Scenario</div>
          <div>Sunlit</div>
          <div>Earth</div>
          <div>Both</div>
          <div>Longest dark</div>
          <div>First {`sunset`}</div>
          <div className="wide">First {windowDays} days</div>
          <div />
        </div>
        {rows.map((r) => (
          <div className="tr" role="row" key={r.sc.key}>
            <div>
              <button className="link" onClick={() => onOpen(r.sc)}>
                {r.site.name}
              </button>
              <div className="muted small">{fmtTime(r.sc.t0)}</div>
            </div>
            <div className={bSun(r)}>{r.sum.sunPct.toFixed(0)}%</div>
            <div className={bEarth(r)}>{r.sum.earthPct.toFixed(0)}%</div>
            <div className={bBoth(r)}>{r.sum.bothPct.toFixed(0)}%</div>
            <div className={bDark(r)}>{fmtDuration(r.sum.longestDarkMs)}</div>
            <div>
              {r.sunUpAtStart && r.firstSunset.time !== null
                ? `+${fmtDuration(r.firstSunset.time - r.sc.t0)}`
                : r.sunUpAtStart || r.firstSunset.time === null
                  ? '—'
                  : `dark · sunrise +${fmtDuration(r.firstSunset.time - r.sc.t0)}`}
            </div>
            <div className="wide">
              <Timeline
                compact
                relative
                samples={r.samples}
                t0={r.sc.t0}
                t1={r.t1}
                sun={r.sum.sun}
                earth={r.sum.earth}
                both={r.sum.both}
              />
            </div>
            <div>
              <button className="ghost" aria-label="Remove scenario" onClick={() => setScenarios(scenarios.filter((s) => s.key !== r.sc.key))}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="caption">
        Lanes: <span className="sun-t">■ sunlight</span> · <span className="earth-t">■ Earth in view</span> ·{' '}
        <span className="both-t">■ both (power + direct link)</span>. Best value per column is highlighted.
      </p>
    </section>
  )
}
