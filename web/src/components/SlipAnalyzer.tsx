import { useMemo, useState } from 'react'
import type { AppData, Site } from '../lib/data'
import { DAY, HOUR, fmtUtc, hourly, makeCtx } from '../lib/analysis'

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
    if (c.bestHour === null) return 'var(--cell-none)'
    const t = Math.min(1, c.sunDays / maxSun)
    return `color-mix(in oklab, var(--sun) ${Math.round(15 + 85 * t)}%, var(--panel-2))`
  }

  return (
    <section className="slip">
      <div className="slip-controls">
        <label>
          Mission length <b>{missionDays} d</b>
          <input type="range" min={1} max={28} value={missionDays} onChange={(e) => setMissionDays(+e.target.value)} />
        </label>
        <label>
          Continuous sun after landing ≥ <b>{minSunDays} d</b>
          <input type="range" min={0} max={20} value={minSunDays} onChange={(e) => setMinSunDays(+e.target.value)} />
        </label>
        <label>
          Earth in view during mission ≥ <b>{minEarthPct}%</b>
          <input type="range" min={0} max={100} step={5} value={minEarthPct} onChange={(e) => setMinEarthPct(+e.target.value)} />
        </label>
        <label>
          Look ahead <b>{months} months</b>
          <input type="range" min={1} max={36} value={months} onChange={(e) => setMonths(+e.target.value)} />
        </label>
      </div>
      <div className="slip-summary">
        <div>
          <span className="k">Viable landing days</span>
          <b>{okCount}</b> of {cells.length}
        </div>
        <div>
          <span className="k">Next viable landing</span>
          {firstOk?.bestHour ? (
            <button className="link" onClick={() => onChoose(firstOk.bestHour!)}>
              {fmtUtc(firstOk.bestHour)} → {firstOk.sunDays.toFixed(1)} d of sun
            </button>
          ) : (
            <b>none in range</b>
          )}
        </div>
        <div>
          <span className="k">If you slip by a month</span>
          {(() => {
            const after = cells.find((c) => c.ok && c.day >= t0 + 30 * DAY)
            return after?.bestHour ? (
              <button className="link" onClick={() => onChoose(after.bestHour!)}>
                next window {fmtUtc(after.bestHour, false)}
              </button>
            ) : (
              <b>no window</b>
            )
          })()}
        </div>
      </div>
      <div className="cal" role="grid" aria-label="Landing date calendar">
        <div className="cal-row head">
          <div />
          {Array.from({ length: 31 }, (_, i) => (
            <div key={i} className="dnum">
              {i + 1}
            </div>
          ))}
        </div>
        {byMonth.map(([month, days]) => {
          const first = new Date(days[0].day).getUTCDate()
          return (
            <div className="cal-row" key={month} role="row">
              <div className="mlabel">{new Date(days[0].day).toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</div>
              {Array.from({ length: first - 1 }, (_, i) => (
                <div key={`p${i}`} />
              ))}
              {days.map((c) => (
                <button
                  key={c.day}
                  className={`cell ${c.ok ? 'ok' : 'no'}`}
                  style={{ background: color(c) }}
                  onClick={() => c.bestHour && onChoose(c.bestHour)}
                  title={
                    c.bestHour
                      ? `${fmtUtc(c.bestHour)}\n${c.sunDays.toFixed(1)} days of continuous sun\nEarth in view ${c.earthPct.toFixed(0)}% of mission${c.ok ? '\n✓ meets constraints' : ''}`
                      : `${fmtUtc(c.day, false)}: no hour with both Sun and Earth up`
                  }
                  aria-label={`${fmtUtc(c.day, false)} ${c.ok ? 'viable' : 'not viable'}`}
                />
              ))}
            </div>
          )
        })}
      </div>
      <p className="caption">
        Each square is a UTC day. Colour = days of uninterrupted sunlight after the best touchdown hour that day (touchdown needs Sun{' '}
        <i>and</i> Earth above the terrain). Outlined squares meet all constraints. Click a day to open it. Hourly resolution ({HOUR / 3600_000} h),
        terrain-aware.
      </p>
    </section>
  )
}
