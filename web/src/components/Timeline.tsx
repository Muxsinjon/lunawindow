import { useMemo, useRef } from 'react'
import type { Interval, Sample } from '../lib/analysis'
import { DAY } from '../lib/analysis'

interface Props {
  samples: Sample[]
  t0: number
  t1: number
  cursor?: number
  sun: Interval[]
  earth: Interval[]
  both: Interval[]
  onPick?: (t: number) => void
  compact?: boolean
  relative?: boolean
}

const W = 1000

export default function Timeline({ samples, t0, t1, cursor, sun, earth, both, onPick, compact, relative }: Props) {
  const curveH = compact ? 0 : 120
  const laneH = compact ? 12 : 16
  const gap = 6
  const top = 8
  const lanesY = top + curveH + (compact ? 0 : 10)
  const H = lanesY + 3 * (laneH + gap) + 22
  const L = compact ? 4 : 92
  const R = 10
  const pw = W - L - R
  const x = (t: number) => L + ((t - t0) / (t1 - t0)) * pw
  const ref = useRef<SVGSVGElement>(null)

  const { lo, hi } = useMemo(() => {
    let lo = -3
    let hi = 3
    for (const s of samples) {
      lo = Math.min(lo, s.sunMargin, s.earthMargin)
      hi = Math.max(hi, s.sunMargin, s.earthMargin)
    }
    return { lo: Math.max(lo, -15), hi: Math.min(hi, 90) }
  }, [samples])
  const y = (v: number) => top + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * curveH
  const line = (f: (s: Sample) => number) => samples.map((s) => `${x(s.t).toFixed(1)},${y(f(s)).toFixed(1)}`).join(' ')

  const days = (t1 - t0) / DAY
  const tickEvery = days > 60 ? 7 : days > 20 ? 2 : 1
  const ticks: number[] = []
  const firstMidnight = relative ? t0 : Math.ceil(t0 / DAY) * DAY
  for (let t = firstMidnight; t <= t1; t += tickEvery * DAY) ticks.push(t)

  const click = (e: React.MouseEvent) => {
    if (!onPick || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const t = t0 + ((px - L) / pw) * (t1 - t0)
    onPick(Math.max(t0, Math.min(t1, t)))
  }

  const lane = (iv: Interval[], i: number, cls: string, label: string) => (
    <g key={cls}>
      {!compact && (
        <text x={L - 8} y={lanesY + i * (laneH + gap) + laneH - 4} textAnchor="end" className="tick">
          {label}
        </text>
      )}
      <rect x={L} y={lanesY + i * (laneH + gap)} width={pw} height={laneH} className="lane-bg" rx={3} />
      {iv.map((v, k) => (
        <rect
          key={k}
          x={x(v.start)}
          y={lanesY + i * (laneH + gap)}
          width={Math.max(1, x(v.end) - x(v.start))}
          height={laneH}
          className={`lane ${cls}`}
          rx={3}
        >
          <title>{`${label}: ${new Date(v.start).toISOString().slice(0, 16)} → ${new Date(v.end).toISOString().slice(0, 16)} UTC`}</title>
        </rect>
      ))}
    </g>
  )

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className={`chart timeline ${onPick ? 'pickable' : ''}`}
      onClick={click}
      role="img"
      aria-label="Timeline of sunlight and Earth visibility windows"
    >
      {!compact && (
        <g>
          <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="grid zero" />
          <text x={L - 8} y={y(0) + 4} textAnchor="end" className="tick">
            terrain
          </text>
          <text x={L - 8} y={top + 10} textAnchor="end" className="tick">
            +{Math.round(hi)}°
          </text>
          <polyline points={line((s) => s.sunMargin)} className="curve sun" />
          <polyline points={line((s) => s.earthMargin)} className="curve earth" />
        </g>
      )}
      {lane(sun, 0, 'sun', 'Sunlight')}
      {lane(earth, 1, 'earth', 'Earth link')}
      {lane(both, 2, 'both', 'Both')}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={lanesY - 2} y2={H - 18} className="grid" />
          <text x={x(t)} y={H - 4} className="tick" textAnchor="middle">
            {relative ? `+${Math.round((t - t0) / DAY)}d` : new Date(t).toISOString().slice(5, 10)}
          </text>
        </g>
      ))}
      {cursor !== undefined && cursor >= t0 && cursor <= t1 && (
        <line x1={x(cursor)} x2={x(cursor)} y1={top} y2={H - 18} className="cursor" />
      )}
    </svg>
  )
}
