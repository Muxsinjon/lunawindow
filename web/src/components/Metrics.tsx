import type { NextEvent, Sample, WindowSummary } from '../lib/analysis'
import { panelPower } from '../lib/analysis'
import { fmtDeg, fmtDuration, fmtPct, fmtTime } from '../lib/format'
import { INFO } from '../lib/glossary'
import { usePrefs } from '../lib/prefs'
import { Chip, InfoTip } from './ui'

interface Props {
  now: Sample
  sunEvent: NextEvent
  earthEvent: NextEvent
  sum: WindowSummary
  windowDays: number
}

function Countdown({ ev, now }: { ev: NextEvent; now: number }) {
  const { tz } = usePrefs()
  if (ev.time === null) return <span className="muted">no {ev.kind.toLowerCase()} before the data ends</span>
  return (
    <span>
      {ev.kind} in <b className="num">{fmtDuration(ev.time - now)}</b>
      <span className="muted num"> at {fmtTime(ev.time, tz)}</span>
    </span>
  )
}

/** Status strip: the at-a-glance answer, sitting directly above the hero chart. */
export function StatusStrip({ now, sunEvent, earthEvent }: Omit<Props, 'sum' | 'windowDays'>) {
  const sunLit = now.sunUpper > 0
  const earthUp = now.earthUpper > 0
  const partial = sunLit && now.sunFrac < 0.999
  return (
    <div className="status-strip" aria-live="polite">
      <div className="status-item">
        {sunLit ? (
          <Chip kind="sun">{partial ? `Partly sunlit, ${fmtPct(now.sunFrac * 100)} of disc` : 'Sunlit'}</Chip>
        ) : (
          <Chip kind="none" icon="sun">
            Dark
          </Chip>
        )}
        <Countdown ev={sunEvent} now={now.t} />
      </div>
      <div className="status-item">
        {earthUp ? (
          <Chip kind="earth">Earth link ✓</Chip>
        ) : (
          <Chip kind="none" icon="earth">
            No Earth link
          </Chip>
        )}
        <Countdown ev={earthEvent} now={now.t} />
      </div>
      {sunLit && earthUp ? (
        <Chip kind="both">Power and link</Chip>
      ) : (
        <Chip kind="warn">{!sunLit && !earthUp ? 'No power, no link' : !sunLit ? 'On batteries' : 'No direct link'}</Chip>
      )}
    </div>
  )
}

export default function Metrics({ now, sum, windowDays }: Props) {
  const pv = panelPower(now)
  return (
    <div className="tiles">
      <div className="tile">
        <div className="tile-label">
          Sun above terrain <InfoTip info={INFO.sun} label="Sun above terrain" />
        </div>
        <div className="tile-value num">{fmtDeg(now.sunMargin, true)}</div>
        <div className="tile-sub num">
          {fmtDeg(now.sunEl)} above the smooth horizon, terrain {fmtDeg(now.sunHorizon)}
        </div>
      </div>
      <div className="tile">
        <div className="tile-label">
          Earth above terrain <InfoTip info={INFO.earth} label="Earth above terrain" />
        </div>
        <div className="tile-value num">{fmtDeg(now.earthMargin, true)}</div>
        <div className="tile-sub num">
          {fmtDeg(now.earthEl)} elevation, {fmtPct(now.earthFrac * 100)} of disc visible
        </div>
      </div>
      <div className="tile">
        <div className="tile-label">
          Solar power now <InfoTip info={INFO.power} label="solar power" />
        </div>
        <div className="tile-value num">
          {Math.round(pv)} <span className="unit">W/m²</span>
        </div>
        <div className="tile-sub num">window average {Math.round(sum.avgPowerVertical)} W/m²</div>
      </div>
      <div className="tile">
        <div className="tile-label">
          Operations window, next {windowDays} d <InfoTip info={INFO.ops} label="operations window" />
        </div>
        <div className="tile-value num">{fmtPct(sum.bothPct)}</div>
        <div className="tile-sub num">
          sunlit {fmtPct(sum.sunPct)}, Earth in view {fmtPct(sum.earthPct)}
        </div>
      </div>
      <div className="tile">
        <div className="tile-label">
          Longest dark period <InfoTip info={INFO.dark} label="longest dark period" />
        </div>
        <div className="tile-value num">{fmtDuration(sum.longestDarkMs)}</div>
        <div className="tile-sub">within the {windowDays}-day window</div>
      </div>
      <div className="tile">
        <div className="tile-label">
          Longest without Earth link <InfoTip info={INFO.noLink} label="longest period without Earth link" />
        </div>
        <div className="tile-value num">{fmtDuration(sum.longestNoLinkMs)}</div>
        <div className="tile-sub">within the {windowDays}-day window</div>
      </div>
    </div>
  )
}
