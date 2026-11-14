import { useEffect, useMemo, useRef, useState } from 'react'
import { hourly, makeCtx } from '../lib/analysis'
import { type Candidate, type Requirements, STATUS_LABEL, type Status, checkSentence, prepare, search } from '../lib/finder'
import { fmtHours, fmtPct, fmtTime, fromInputValue, toInputValue } from '../lib/format'
import { INFO } from '../lib/glossary'
import { DURATIONS } from '../lib/state'
import { DAY, HOUR, useStore } from '../lib/store'
import { MODEL_LABEL } from '../lib/visibility'
import { Icon, InfoTip } from '../components/ui'

type SortKey = 'rank' | 'start' | 'sun' | 'earth' | 'joint' | 'dark' | 'blackout'
const STATUS_ORDER: Status[] = ['meets', 'partial', 'fails', 'insufficient']

function StatusChip({ status }: { status: Status }) {
  const icon = status === 'meets' ? '✓' : status === 'partial' ? '◐' : status === 'fails' ? '✕' : '?'
  return (
    <span className={`status st-${status}`}>
      <span aria-hidden>{icon}</span> {STATUS_LABEL[status]}
    </span>
  )
}

function NumberField({
  label,
  value,
  unit,
  min,
  max,
  onChange,
  hint,
}: {
  label: string
  value: number
  unit: string
  min: number
  max: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {hint && <span className="muted">({hint})</span>}
      </span>
      <span className="num-input">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)))
          }}
        />
        <span className="unit">{unit}</span>
      </span>
    </label>
  )
}

export default function MissionFinder() {
  const store = useStore()
  const { s, set, data, sites, site } = store
  const [scope, setScope] = useState<'all' | 'pair'>('all')
  const [everyH, setEveryH] = useState(6)
  const [results, setResults] = useState<Candidate[] | null>(null)
  const [runInfo, setRunInfo] = useState<{ req: Requirements; durationDays: number; ms: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [siteFilter, setSiteFilter] = useState('all')
  const [sort, setSort] = useState<SortKey>('rank')
  const [shown, setShown] = useState(25)
  const [why, setWhy] = useState<Candidate | null>(null)
  const whyRef = useRef<HTMLElement>(null)

  const run = () => {
    setError(null)
    const span = s.searchEnd - s.searchStart
    if (!(span >= 0)) return setError('The latest start must be on or after the earliest start.')
    if (span > 366 * DAY) return setError('Please search at most one year at a time.')
    setBusy(true)
    window.setTimeout(() => {
      const t = performance.now()
      const list = (
        scope === 'all' ? sites.filter((x) => !x.custom || x.id === s.siteA || x.id === s.siteB) : [site(s.siteA), site(s.siteB)]
      ).filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)
      const prepared = list.map((x) => {
        const h = hourly(makeCtx(x, data.sites.azStepDeg), data.eph, s.vis)
        return prepare({ siteId: x.id, sun: h.sun, earth: h.earth })
      })
      const res = search({
        sites: prepared,
        t0Ms: data.eph.meta.startMs,
        stepMs: data.eph.meta.stepMs,
        searchStartMs: s.searchStart,
        searchEndMs: s.searchEnd,
        everyH,
        durationH: s.durationDays * 24,
        req: s.req,
      })
      setResults(res)
      setRunInfo({ req: s.req, durationDays: s.durationDays, ms: performance.now() - t })
      setShown(25)
      setWhy(null)
      setBusy(false)
    }, 30)
  }

  // the guided demo (and "modify constraints and recalculate") can request a run
  const lastRun = useRef(store.finderRun)
  useEffect(() => {
    if (store.finderRun !== lastRun.current) {
      lastRun.current = store.finderRun
      run()
    }
  })

  const counts = useMemo(() => {
    const c: Record<Status, number> = { meets: 0, partial: 0, fails: 0, insufficient: 0 }
    results?.forEach((r) => c[r.status]++)
    return c
  }, [results])

  const visible = useMemo(() => {
    if (!results) return []
    let r = results.filter((x) => (filter === 'all' || x.status === filter) && (siteFilter === 'all' || x.siteId === siteFilter))
    const m = (x: Candidate, f: (c: NonNullable<Candidate['metrics']>) => number, empty: number) => (x.metrics ? f(x.metrics) : empty)
    const by: Record<SortKey, ((a: Candidate, b: Candidate) => number) | null> = {
      rank: null,
      start: (a, b) => a.startMs - b.startMs,
      sun: (a, b) => m(b, (x) => x.sunPct, -1) - m(a, (x) => x.sunPct, -1),
      earth: (a, b) => m(b, (x) => x.earthPct, -1) - m(a, (x) => x.earthPct, -1),
      joint: (a, b) => m(b, (x) => x.jointPct, -1) - m(a, (x) => x.jointPct, -1),
      dark: (a, b) => m(a, (x) => x.longestDarkH, 1e9) - m(b, (x) => x.longestDarkH, 1e9),
      blackout: (a, b) => m(a, (x) => x.longestBlackoutH, 1e9) - m(b, (x) => x.longestBlackoutH, 1e9),
    }
    if (by[sort]) r = [...r].sort(by[sort]!)
    return r
  }, [results, filter, siteFilter, sort])

  // overview grid: best status per site per UTC day
  const grid = useMemo(() => {
    if (!results) return null
    const days: number[] = []
    for (let d = Math.floor(s.searchStart / DAY) * DAY; d <= s.searchEnd; d += DAY) days.push(d)
    const rows = new Map<string, (Candidate | null)[]>()
    for (const c of results) {
      if (!rows.has(c.siteId))
        rows.set(
          c.siteId,
          days.map(() => null),
        )
      const k = Math.floor((c.startMs - days[0]) / DAY)
      const cur = rows.get(c.siteId)![k]
      if (k >= 0 && k < days.length && (!cur || STATUS_ORDER.indexOf(c.status) < STATUS_ORDER.indexOf(cur.status)))
        rows.get(c.siteId)![k] = c
    }
    return { days, rows: [...rows.entries()].sort((a, b) => site(a[0]).name.localeCompare(site(b[0]).name)) }
  }, [results, s.searchStart, s.searchEnd, site])

  const setReq = (patch: Partial<Requirements>) => set({ req: { ...s.req, ...patch } })
  const openWhy = (c: Candidate) => {
    setWhy(c)
    window.setTimeout(() => whyRef.current?.focus(), 0)
  }
  const stale = runInfo && (JSON.stringify(runInfo.req) !== JSON.stringify(s.req) || runInfo.durationDays !== s.durationDays)

  return (
    <div className="workspace finder-ws">
      <aside className="rail" aria-label="Mission requirements">
        <section className="panel" aria-labelledby="req-h">
          <h2 id="req-h" className="panel-title">
            Mission requirements
          </h2>
          <p className="hint">
            Defaults are illustrative, hypothetical mission constraints chosen by you. They are not NASA engineering standards.
          </p>
          <div className="field">
            <span className="field-label">Mission duration</span>
            <div className="seg full" role="radiogroup" aria-label="Mission duration">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={s.durationDays === d}
                  className={s.durationDays === d ? 'on' : ''}
                  onClick={() => set({ durationDays: d })}
                >
                  {d} d
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="field-label">Earliest start ({s.tz === 'utc' ? 'UTC' : 'local'})</span>
            <input
              type="datetime-local"
              value={toInputValue(s.searchStart, s.tz)}
              onChange={(e) => {
                const ms = fromInputValue(e.target.value, s.tz)
                if (Number.isFinite(ms)) set({ searchStart: Math.floor(ms / HOUR) * HOUR })
              }}
            />
          </label>
          <label className="field">
            <span className="field-label">Latest start ({s.tz === 'utc' ? 'UTC' : 'local'})</span>
            <input
              type="datetime-local"
              value={toInputValue(s.searchEnd, s.tz)}
              onChange={(e) => {
                const ms = fromInputValue(e.target.value, s.tz)
                if (Number.isFinite(ms)) set({ searchEnd: Math.floor(ms / HOUR) * HOUR })
              }}
            />
          </label>
          <NumberField
            label="Minimum sunlight"
            hint="share of mission time"
            value={s.req.minSunPct}
            unit="%"
            min={0}
            max={100}
            onChange={(v) => setReq({ minSunPct: v })}
          />
          <NumberField
            label="Minimum Earth visibility"
            hint="share of mission time"
            value={s.req.minEarthPct}
            unit="%"
            min={0}
            max={100}
            onChange={(v) => setReq({ minEarthPct: v })}
          />
          <div className="field">
            <label className="toggle">
              <input
                type="checkbox"
                checked={s.req.minJointPct !== null}
                onChange={(e) => setReq({ minJointPct: e.target.checked ? 30 : null })}
              />{' '}
              Require Sun and Earth together
            </label>
            {s.req.minJointPct !== null && (
              <NumberField
                label="Minimum Sun and Earth together"
                value={s.req.minJointPct}
                unit="%"
                min={0}
                max={100}
                onChange={(v) => setReq({ minJointPct: v })}
              />
            )}
          </div>
          <NumberField
            label="Maximum uninterrupted darkness"
            value={s.req.maxDarkH}
            unit="h"
            min={0}
            max={2000}
            onChange={(v) => setReq({ maxDarkH: v })}
          />
          <NumberField
            label="Maximum communication blackout"
            value={s.req.maxBlackoutH}
            unit="h"
            min={0}
            max={2000}
            onChange={(v) => setReq({ maxBlackoutH: v })}
          />
          <div className="field">
            <span className="field-label">Sites to search</span>
            <div className="seg full" role="radiogroup" aria-label="Sites to search">
              <button
                type="button"
                role="radio"
                aria-checked={scope === 'all'}
                className={scope === 'all' ? 'on' : ''}
                onClick={() => setScope('all')}
              >
                All {sites.filter((x) => !x.custom).length} listed sites
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={scope === 'pair'}
                className={scope === 'pair' ? 'on' : ''}
                onClick={() => setScope('pair')}
              >
                Site A and B
              </button>
            </div>
          </div>
          <label className="field">
            <span className="field-label">Candidate start times</span>
            <select value={everyH} onChange={(e) => setEveryH(+e.target.value)}>
              <option value={6}>Every 6 h (00, 06, 12, 18 UTC)</option>
              <option value={24}>Once a day (00 UTC)</option>
            </select>
          </label>
          <button type="button" className="btn primary" onClick={run} disabled={busy}>
            {busy ? 'Searching…' : results ? 'Recalculate' : 'Find mission windows'}
          </button>
          {error && (
            <p className="field-error" role="alert">
              <Icon name="warn" size={16} /> {error}
            </p>
          )}
        </section>
      </aside>

      <section className="stage" aria-labelledby="finder-title">
        <div className="stage-head">
          <div>
            <h2 id="finder-title">
              Mission Window Finder <InfoTip info={INFO.slip} label="the Mission Window Finder" />
            </h2>
            <p className="lede">Where and when can a {s.durationDays}-day mission get the sunlight and Earth link it needs?</p>
            <p className="model-label">{MODEL_LABEL[s.vis]}. Hourly samples; durations in whole hours.</p>
          </div>
        </div>

        {!results ? (
          <div className="state-empty">
            <p className="state-title">Set your requirements, then select “Find mission windows”.</p>
            <p className="muted">
              Every candidate start between {fmtTime(s.searchStart, s.tz)} and {fmtTime(s.searchEnd, s.tz)} is checked against the full{' '}
              {s.durationDays}-day mission using the same NASA-derived data as the charts.
            </p>
          </div>
        ) : (
          <>
            {stale && (
              <p className="field-error" role="status">
                <Icon name="warn" size={16} /> Requirements changed since this search. Select “Recalculate” to update the results.
              </p>
            )}
            <div className="finder-summary" aria-live="polite">
              {STATUS_ORDER.map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`count-tile ${filter === st ? 'on' : ''}`}
                  onClick={() => setFilter(filter === st ? 'all' : st)}
                  aria-pressed={filter === st}
                >
                  <StatusChip status={st} />
                  <span className="count num">{counts[st]}</span>
                </button>
              ))}
              <span className="hint">
                {results.length} candidates in {Math.round(runInfo?.ms ?? 0)} ms.
              </span>
            </div>
            {counts.meets === 0 && (
              <div className="state-empty">
                <p className="state-title">No candidate satisfies all requirements within these dates.</p>
                <p className="muted">
                  Try lowering a minimum visibility threshold, allowing a longer darkness or blackout, choosing a shorter mission, or
                  widening the date range. The closest candidates are listed first below.
                </p>
              </div>
            )}

            {grid && (
              <figure className="chart-frame">
                <div className="chart-head">
                  <h3 className="chart-title">Overview: best result per site and day</h3>
                  <div className="legend" aria-hidden>
                    <span className="lgs st-meets">✓ meets</span>
                    <span className="lgs st-partial">◐ partial</span>
                    <span className="lgs st-fails">✕ does not meet</span>
                    <span className="lgs st-insufficient">? no data</span>
                  </div>
                </div>
                <div className="grid-scroll">
                  <table className="ov-grid" aria-label="Best status per site and start day">
                    <tbody>
                      {grid.rows.map(([id, cells]) => (
                        <tr key={id}>
                          <th scope="row">{site(id).name}</th>
                          {cells.map((c, k) => (
                            <td key={k}>
                              {c && (
                                <button
                                  type="button"
                                  className={`ov st-${c.status} ${why === c ? 'sel' : ''}`}
                                  title={`${site(id).name}, ${fmtTime(c.startMs, s.tz)}: ${STATUS_LABEL[c.status]}`}
                                  aria-label={`${site(id).name}, ${fmtTime(grid.days[k], s.tz, false)}: ${STATUS_LABEL[c.status]}`}
                                  onClick={() => openWhy(c)}
                                />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <figcaption>
                  Columns are start days from {fmtTime(grid.days[0], s.tz, false)} to {fmtTime(grid.days.at(-1)!, s.tz, false)}. Each square
                  shows the best candidate start that day. Select one to see why.
                </figcaption>
              </figure>
            )}

            <div className="list-tools">
              <label className="field inline">
                <span className="field-label">Show</span>
                <select value={filter} onChange={(e) => setFilter(e.target.value as Status | 'all')}>
                  <option value="all">All statuses</option>
                  {STATUS_ORDER.map((st) => (
                    <option key={st} value={st}>
                      {STATUS_LABEL[st]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field inline">
                <span className="field-label">Site</span>
                <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
                  <option value="all">All sites</option>
                  {[...new Set(results.map((r) => r.siteId))].map((id) => (
                    <option key={id} value={id}>
                      {site(id).name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field inline">
                <span className="field-label">Sort by</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="rank">Ranking (requirements first)</option>
                  <option value="start">Start date</option>
                  <option value="sun">Sunlight</option>
                  <option value="earth">Earth visibility</option>
                  <option value="joint">Sun and Earth together</option>
                  <option value="dark">Shortest darkness</option>
                  <option value="blackout">Shortest blackout</option>
                </select>
              </label>
            </div>

            <div className="table-scroll">
              <table className="results">
                <thead>
                  <tr>
                    <th scope="col">Site</th>
                    <th scope="col">Start</th>
                    <th scope="col">End</th>
                    <th scope="col">Sun</th>
                    <th scope="col">Earth</th>
                    <th scope="col">Both</th>
                    <th scope="col">Max darkness</th>
                    <th scope="col">Max blackout</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Explain</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.slice(0, shown).map((c) => (
                    <tr key={`${c.siteId}-${c.startMs}`} className={why === c ? 'sel' : ''}>
                      <td>{site(c.siteId).name}</td>
                      <td className="num">{fmtTime(c.startMs, s.tz)}</td>
                      <td className="num">{fmtTime(c.endMs, s.tz)}</td>
                      <td className="num">{c.metrics ? fmtPct(c.metrics.sunPct) : '—'}</td>
                      <td className="num">{c.metrics ? fmtPct(c.metrics.earthPct) : '—'}</td>
                      <td className="num">{c.metrics ? fmtPct(c.metrics.jointPct) : '—'}</td>
                      <td className="num">{c.metrics ? fmtHours(c.metrics.longestDarkH) : '—'}</td>
                      <td className="num">{c.metrics ? fmtHours(c.metrics.longestBlackoutH) : '—'}</td>
                      <td>
                        <StatusChip status={c.status} />
                      </td>
                      <td>
                        <button type="button" className="btn" onClick={() => openWhy(c)}>
                          Why this window?
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visible.length > shown && (
              <button type="button" className="btn" onClick={() => setShown(shown + 50)}>
                Show more ({visible.length - shown} left)
              </button>
            )}
            <p className="hint">
              Ranking: status first (meets, partially meets, does not meet, insufficient data), then fewer failed requirements, then more
              time with Sun and Earth together, then a shorter longest darkness, then the earlier start. “Partially meets” means at most
              half of the active requirements fail; more than half failing is “does not meet”.
            </p>
          </>
        )}
        {why && results && <WhyPanel c={why} all={results} innerRef={whyRef} onClose={() => setWhy(null)} />}
      </section>
    </div>
  )
}

function WhyPanel({
  c,
  all,
  innerRef,
  onClose,
}: {
  c: Candidate
  all: Candidate[]
  innerRef: React.RefObject<HTMLElement | null>
  onClose: () => void
}) {
  const store = useStore()
  const { s, set, site, data } = store
  const name = site(c.siteId).name
  const idx = (i: number | undefined) => data.eph.meta.startMs + (i ?? 0) * data.eph.meta.stepMs
  const rank = all.indexOf(c) + 1
  const bestOther = all.find((x) => x !== c && x.status === 'meets')
  const sameSiteMeets = all
    .filter((x) => x.siteId === c.siteId && x.status === 'meets')
    .sort((a, b) => Math.abs(a.startMs - c.startMs) - Math.abs(b.startMs - c.startMs))[0]
  const m = c.metrics
  const failing = c.checks.filter((x) => !x.pass)
  const critical =
    m &&
    (failing.find((x) => x.key === 'maxBlackoutH')
      ? m.blackoutSpan
      : failing.find((x) => x.key === 'maxDarkH')
        ? m.darkSpan
        : (m.darkSpan ?? m.blackoutSpan))

  const open = (ws: 'compare' | 'surface', at: number) =>
    set({
      ws,
      siteA: c.siteId,
      surfaceSite: 'A',
      missionStart: c.startMs,
      durationDays: Math.round((c.endMs - c.startMs) / DAY),
      selectedTime: at,
    })

  return (
    <section className="why" aria-labelledby="why-h" tabIndex={-1} ref={innerRef}>
      <div className="panel-head">
        <h3 id="why-h">
          Why this window? {name}, {fmtTime(c.startMs, s.tz)}
        </h3>
        <button type="button" className="btn quiet icon-only" onClick={onClose} aria-label="Close explanation">
          <Icon name="close" />
        </button>
      </div>
      <p>
        <StatusChip status={c.status} /> Ranked {rank} of {all.length} candidates.
      </p>
      {c.status === 'insufficient' ? (
        <p>
          The {Math.round((c.endMs - c.startMs) / DAY)}-day mission would run outside the supported data (
          {fmtTime(data.eph.meta.startMs, 'utc', false)} to {fmtTime(data.eph.endMs, 'utc', false)}). Missing data is never treated as
          favourable, so this start cannot be evaluated.
        </p>
      ) : (
        m && (
          <>
            <h4>Requirements</h4>
            <ul className="checks">
              {c.checks.map((x) => (
                <li key={x.key} className={x.pass ? 'pass' : 'fail'}>
                  <span aria-hidden>{x.pass ? '✓' : '✕'}</span> {checkSentence(x)}
                </li>
              ))}
            </ul>
            <h4>Most favourable period</h4>
            <p>
              {m.jointSpan
                ? `Sun and Earth are both visible for ${fmtHours(m.jointSpan.hours)} without a break, from ${fmtTime(idx(m.jointSpan.startIndex), s.tz)} to ${fmtTime(
                    idx(m.jointSpan.startIndex + m.jointSpan.hours),
                    s.tz,
                  )}.`
                : 'There is no hour in this window with both the Sun and Earth visible.'}
            </p>
            <h4>Most critical interruptions</h4>
            <ul>
              <li>
                {m.darkSpan
                  ? `Longest darkness: ${fmtHours(m.darkSpan.hours)}, from ${fmtTime(idx(m.darkSpan.startIndex), s.tz)}.`
                  : 'No darkness during this mission.'}
              </li>
              <li>
                {m.blackoutSpan
                  ? `Longest communication blackout: ${fmtHours(m.blackoutSpan.hours)}, from ${fmtTime(idx(m.blackoutSpan.startIndex), s.tz)} (${m.linkInterruptions} separate blackout${m.linkInterruptions === 1 ? '' : 's'}).`
                  : 'Earth stays in view for the whole mission.'}
              </li>
            </ul>
          </>
        )
      )}
      <h4>Compared with alternatives</h4>
      <ul>
        <li>
          {bestOther
            ? `The top-ranked candidate that meets every requirement is ${site(bestOther.siteId).name} from ${fmtTime(bestOther.startMs, s.tz)}${bestOther.metrics ? `, with Sun and Earth together ${fmtPct(bestOther.metrics.jointPct)} of the time` : ''}.`
            : 'No candidate in this search meets every requirement.'}
        </li>
        <li>
          {sameSiteMeets && sameSiteMeets !== c
            ? `At ${name}, the nearest start that meets every requirement is ${fmtTime(sameSiteMeets.startMs, s.tz)}, ${fmtHours(Math.round(Math.abs(sameSiteMeets.startMs - c.startMs) / HOUR))} ${sameSiteMeets.startMs < c.startMs ? 'earlier' : 'later'}.`
            : c.status === 'meets'
              ? `This is a start at ${name} that meets every requirement.`
              : `No start at ${name} in this search meets every requirement.`}
        </li>
      </ul>
      <h4>Assumptions</h4>
      <ul className="small">
        <li>{MODEL_LABEL[s.vis]}.</li>
        <li>Hourly samples from JPL Horizons (DE441); each sample covers the following hour; durations are whole hours (±1 h).</li>
        <li>Visibility is geometric line of sight. It does not guarantee power, a radio link, or a safe landing.</li>
      </ul>
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => open('compare', c.startMs)} disabled={!m}>
          Open in Explore and Compare
        </button>
        <button type="button" className="btn" onClick={() => open('surface', c.startMs)} disabled={!m}>
          Open in Surface View
        </button>
        <button type="button" className="btn" onClick={() => critical && open('compare', idx(critical.startIndex))} disabled={!critical}>
          Jump to the most critical interruption
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => store.openSummary({ kind: 'candidate', siteId: c.siteId, startMs: c.startMs })}
          disabled={!m}
        >
          Generate mission summary
        </button>
      </div>
    </section>
  )
}
