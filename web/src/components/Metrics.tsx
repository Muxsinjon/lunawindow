import type { Sample, WindowSummary } from '../lib/analysis'
import { fmtDuration, fmtUtc, panelPower } from '../lib/analysis'

interface Props {
  now: Sample
  sunEvent: { time: number | null; kind: string }
  earthEvent: { time: number | null; kind: string }
  sum: WindowSummary
  windowDays: number
}

function Countdown({ ev, now }: { ev: { time: number | null; kind: string }; now: number }) {
  if (ev.time === null) return <span className="muted">none in range</span>
  return (
    <span title={fmtUtc(ev.time)}>
      {fmtDuration(ev.time - now)} <span className="muted">· {fmtUtc(ev.time)}</span>
    </span>
  )
}

export default function Metrics({ now, sunEvent, earthEvent, sum, windowDays }: Props) {
  const sunUp = now.sunMargin > 0
  const earthUp = now.earthMargin > 0
  const pv = panelPower(now, 'vertical')
  const verdict =
    sum.bothPct >= 50 ? 'good' : sum.bothPct >= 25 ? 'marginal' : 'poor'
  return (
    <div className="metrics">
      <div className={`card status ${sunUp ? 'on sun-on' : 'off'}`}>
        <div className="k">Sun</div>
        <div className="v">{sunUp ? (now.sunFrac < 1 ? `${Math.round(now.sunFrac * 100)}% of disc visible` : 'Fully lit') : 'Dark'}</div>
        <div className="d">
          {now.sunEl.toFixed(2)}° elevation · {now.sunMargin >= 0 ? '+' : ''}
          {now.sunMargin.toFixed(2)}° vs terrain
        </div>
        <div className="d">
          {sunEvent.kind} in <Countdown ev={sunEvent} now={now.t} />
        </div>
      </div>
      <div className={`card status ${earthUp ? 'on earth-on' : 'off'}`}>
        <div className="k">Earth (direct link)</div>
        <div className="v">{earthUp ? 'In view' : 'Blocked'}</div>
        <div className="d">
          {now.earthEl.toFixed(2)}° elevation · {now.earthMargin >= 0 ? '+' : ''}
          {now.earthMargin.toFixed(2)}° vs terrain
        </div>
        <div className="d">
          {earthEvent.kind} in <Countdown ev={earthEvent} now={now.t} />
        </div>
      </div>
      <div className="card">
        <div className="k">Power now</div>
        <div className="v">{pv.toFixed(0)} W/m²</div>
        <div className="d">vertical sun-tracking panel, 30% cells</div>
        <div className="d">window avg {sum.avgPowerVertical.toFixed(0)} W/m²</div>
      </div>
      <div className={`card verdict ${verdict}`}>
        <div className="k">Next {windowDays} days</div>
        <div className="v">
          {sum.bothPct.toFixed(0)}% <span className="unit">ops time</span>
        </div>
        <div className="d">
          ☀ {sum.sunPct.toFixed(0)}% sunlit · 🜨 {sum.earthPct.toFixed(0)}% Earth in view
        </div>
        <div className="d">
          longest dark {fmtDuration(sum.longestDarkH * 3600_000)} · no-link {fmtDuration(sum.longestNoCommH * 3600_000)}
        </div>
      </div>
    </div>
  )
}
