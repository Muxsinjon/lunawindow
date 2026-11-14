import { useMemo, useState } from 'react'
import type { AppData, Site } from '../lib/data'
import { DAY, hourly, makeCtx } from '../lib/analysis'
import { fmtTime } from '../lib/format'
import { INFO } from '../lib/glossary'
import { usePrefs } from '../lib/prefs'
import { Icon, InfoTip } from './ui'

interface Props {
  data: AppData
  site: Site
  t0: number
  onChoose: (t: number) => void
}

interface DayCell {
  day: number // ms at 00:00 UTC
  bestHour: number | null // ms
  sunDays: number
  earthPct: number
  ok: boolean
}

export default function SlipAnalyzer({ data, site, t0, onChoose }: Props) {
  const { tz } = usePrefs()
  const [months, setMonths] = useState(12)
  const [minSunDays, setMinSunDays] = useState(6)
  const [missionDays, setMissionDays] = useState(10)
  const [minEarthPct, setMinEarthPct] = useState(60)

  const ctx = useMemo(() => makeCtx(site, data.sites.azStepDeg), [site, data])
  const hr = useMemo(() => hourly(ctx, data.eph), [ctx, data])

  const { cells, firstOk } = useMemo(() => {
    const m = data.eph.meta
    const start = Math.floor(t0 / DAY) * DAY
    const end = Math.min(data.eph.endMs - missionDays * DAY, start + months * 30.44 * DAY)
    const mh = Math.round(missionDays * 24)
    const cells: DayCell[] = []
    let firstOk: DayCell | null = null
    for (let d = start; d < end; d += DAY) {
      let best: DayCell = { day: d, bestHour: null, sunDays: 0, earthPct: 0, ok: false }
      const i0 = Math.round((d - m.startMs) / m.stepMs)
      for (let k = 0; k < 24; k++) {
        const i = i0 + k
        if (i < 0 || i + mh >= m.count) continue
        // landing requires sunlight AND a direct Earth link at touchdown
        if (!hr.sun[i] || !hr.earth[i]) continue
        const sunDays = hr.sunRun[i] / 24
        const earthPct = (100 * (hr.earthCum[i + mh] - hr.earthCum[i])) / mh
        const ok = sunDays >= minSunDays && earthPct >= minEarthPct
        const better = (ok && !best.ok) || (ok === best.ok && sunDays + earthPct / 100 > best.sunDays + best.earthPct / 100)
        if (better) best = { day: d, bestHour: m.startMs + i * m.stepMs, sunDays, earthPct, ok }
      }
      cells.push(best)
      if (best.ok && !firstOk && d >= t0 - DAY) firstOk = best
    }
    return { cells, firstOk }
  }, [hr, data, t0, months, minSunDays, missionDays, minEarthPct])

  const byMonth = useMemo(() => {
    const g = new Map<string, DayCell[]>()
    for (const c of cells) {
      const k = new Date(c.day).toISOString().slice(0, 7)
      if (!g.has(k)) g.set(k, [])
      g.get(k)!.push(c)
    }
    return Array.from(g.entries())
  }, [cells])

  const okCount = cells.filter((c) => c.ok).length
  const maxSun = Math.max(14, ...cells.map((c) => c.sunDays))
  const color = (c: DayCell) => {
    if (c.bestHour === null) return 'var(--c-surface)'
    const t = Math.min(1, c.sunDays / maxSun)
    return `color-mix(in oklab, var(--c-sun) ${Math.round(12 + 78 * t)}%, var(--c-surface))`
  }
  const after = cells.find((c) => c.ok && c.day >= t0 + 30 * DAY)

  const slider = (label: string, value: string, min: number, max: number, step: number, v: number, set: (n: number) => void) => (
    <label className="slider">
      <span>
        {label} <b className="num">{value}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(+e.target.value)} aria-valuetext={value} />
    </label>
  )

  return (
    <section className="slip" aria-labelledby="slip-title">
      <div className="view-head">
        <div>
          <h2 id="slip-title">
            Landing calendar <InfoTip info={INFO.slip} label="the landing calendar" />
          </h2>
          <p className="lede">
            When can you land at {site.name}? Set the mission’s needs, and every day that works lights up. Use it when a launch slips.
          </p>
        </div>
      </div>
      <div className="slip-controls panel">
        {slider('Mission length', `${missionDays} d`, 1, 28, 1, missionDays, setMissionDays)}
        {slider('Uninterrupted sun after landing, at least', `${minSunDays} d`, 0, 20, 1, minSunDays, setMinSunDays)}
        {slider('Earth in view during the mission, at least', `${minEarthPct} %`, 0, 100, 5, minEarthPct, setMinEarthPct)}
        {slider('Look ahead', `${months} months`, 1, 36, 1, months, setMonths)}
      </div>
      <div className="slip-summary">
        <div className="tile">
          <div className="tile-label">Viable landing days</div>
          <div className="tile-value num">
            {okCount} <span className="unit">of {cells.length}</span>
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Next viable landing</div>
          {firstOk?.bestHour ? (
            <button type="button" className="link tile-link num" onClick={() => onChoose(firstOk.bestHour!)}>
              {fmtTime(firstOk.bestHour, tz)}
            </button>
          ) : (
            <div className="tile-value">None in range</div>
          )}
          {firstOk && <div className="tile-sub num">{firstOk.sunDays.toFixed(1)} d of uninterrupted sun</div>}
        </div>
        <div className="tile">
          <div className="tile-label">If the launch slips a month</div>
          {after?.bestHour ? (
            <button type="button" className="link tile-link num" onClick={() => onChoose(after.bestHour!)}>
              {fmtTime(after.bestHour, tz)}
            </button>
          ) : (
            <div className="tile-value">No window</div>
          )}
          {after && <div className="tile-sub num">{after.sunDays.toFixed(1)} d of uninterrupted sun</div>}
        </div>
      </div>
      <div className="cal" role="grid" aria-label={`Landing calendar for ${site.name}: ${okCount} viable days`}>
        <div className="cal-row head" role="row">
          <div />
          {Array.from({ length: 31 }, (_, i) => (
            <div key={i} className="dnum num" role="columnheader">
              {i + 1}
            </div>
          ))}
        </div>
        {byMonth.map(([month, days]) => {
          const first = new Date(days[0].day).getUTCDate()
          return (
            <div className="cal-row" key={month} role="row">
              <div className="mlabel" role="rowheader">
                {new Date(days[0].day).toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })}
              </div>
              {Array.from({ length: first - 1 }, (_, i) => (
                <div key={`p${i}`} />
              ))}
              {days.map((c) => (
                <button
                  type="button"
                  key={c.day}
                  className={`cell ${c.ok ? 'ok' : 'no'}`}
                  style={{ background: color(c) }}
                  disabled={!c.bestHour}
                  onClick={() => c.bestHour && onChoose(c.bestHour)}
                  title={
                    c.bestHour
                      ? `${fmtTime(c.bestHour, tz)}: ${c.sunDays.toFixed(1)} d of uninterrupted sun, Earth in view ${c.earthPct.toFixed(0)} % of the mission${c.ok ? '. Meets all constraints.' : '.'}`
                      : `${fmtTime(c.day, 'utc', false)}: no hour with both the Sun and Earth up`
                  }
                  aria-label={`${fmtTime(c.day, 'utc', false)}, ${c.ok ? 'viable' : 'not viable'}${c.bestHour ? `, ${c.sunDays.toFixed(1)} days of sun` : ''}`}
                >
                  {c.ok && <Icon name="check" size={12} />}
                </button>
              ))}
            </div>
          )
        })}
      </div>
      <p className="caption">
        Each square is one UTC day. Brighter amber means more days of uninterrupted sunlight after the best touchdown hour (touchdown needs both
        the Sun and Earth above the terrain). Squares with a tick meet every constraint. Select a day to open it in the explorer.
      </p>
    </section>
  )
}
