import { useMemo, useState } from 'react'
import type { Sample } from '../lib/analysis'
import { SUN_RADIUS_DEG } from '../lib/analysis'
import { fmtDeg, fmtTime } from '../lib/format'
import { horizonAt } from '../lib/geometry'
import { INFO } from '../lib/glossary'
import { usePrefs } from '../lib/prefs'
import { InfoTip, useWidth } from './ui'

interface Props {
  horizon: number[]
  azStep: number
  samples: Sample[]
  now: Sample
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N']
export const compass = (az: number) => COMPASS[Math.round((((az % 360) + 360) % 360) / 45)]

function tracks(samples: Sample[], az: (s: Sample) => number, el: (s: Sample) => number, vis: (s: Sample) => boolean) {
  const segs: { pts: [number, number][]; visible: boolean }[] = []
  let cur: { pts: [number, number][]; visible: boolean } | null = null
  let prevAz: number | null = null
  for (const s of samples) {
    const a = az(s)
    const v = vis(s)
    const wrap = prevAz !== null && Math.abs(a - prevAz) > 180
    if (!cur || cur.visible !== v || wrap) {
      if (cur && !wrap) cur.pts.push([a, el(s)])
      cur = { pts: [], visible: v }
      segs.push(cur)
    }
    cur.pts.push([a, el(s)])
    prevAz = a
  }
  return segs
}

export default function SkyChart({ horizon, azStep, samples, now }: Props) {
  const { tz } = usePrefs()
  const [box, W] = useWidth<HTMLDivElement>()
  const [hoverAz, setHoverAz] = useState<number | null>(null)
  const narrow = W < 640
  const H = Math.round(Math.max(300, Math.min(500, W * (narrow ? 0.85 : 0.42))))
  const M = { l: narrow ? 40 : 52, r: 14, t: 18, b: 40 }

  const { lo, hi } = useMemo(() => {
    let hiV = 6
    let loV = -2
    for (const h of horizon) {
      hiV = Math.max(hiV, h + 2)
      loV = Math.min(loV, h - 1)
    }
    for (const s of samples) {
      hiV = Math.max(hiV, s.sunEl + 2, s.earthEl + 3)
      loV = Math.min(loV, Math.max(s.sunEl, -6) - 1, Math.max(s.earthEl, -6) - 1)
    }
    return { lo: Math.floor(Math.max(loV, -8)), hi: Math.min(90, Math.ceil(hiV)) }
  }, [horizon, samples])

  const pw = W - M.l - M.r
  const ph = H - M.t - M.b
  const x = (az: number) => M.l + (az / 360) * pw
  const y = (el: number) => M.t + ((hi - Math.max(lo, Math.min(hi, el))) / (hi - lo)) * ph
  const pxPerDeg = ph / (hi - lo)

  const terrainPath = useMemo(() => {
    const pts = horizon.map((h, i) => `${x(i * azStep).toFixed(1)},${y(h).toFixed(1)}`)
    pts.push(`${x(360).toFixed(1)},${y(horizon[0]).toFixed(1)}`)
    return `M${x(0)},${H - M.b} L${pts.join(' L')} L${x(360)},${H - M.b} Z`
    // x/y are derived from the listed values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizon, azStep, lo, hi, W, H])

  const sunSegs = useMemo(() => tracks(samples, (s) => s.sunAz, (s) => s.sunEl, (s) => s.sunUpper > 0), [samples])
  const earthSegs = useMemo(() => tracks(samples, (s) => s.earthAz, (s) => s.earthEl, (s) => s.earthUpper > 0), [samples])

  const span = hi - lo
  const step = span > 60 ? 15 : span > 30 ? 10 : span > 14 ? 5 : span > 7 ? 2 : 1
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)
  const azTicks = narrow ? [0, 90, 180, 270, 360] : [0, 45, 90, 135, 180, 225, 270, 315, 360]

  const sunR = Math.max(5, SUN_RADIUS_DEG * pxPerDeg)
  const earthR = Math.max(6, now.earthRadiusDeg * pxPerDeg)
  const poly = (pts: [number, number][]) => pts.map(([a, e]) => `${x(a).toFixed(1)},${y(e).toFixed(1)}`).join(' ')
  const sunLit = now.sunUpper > 0
  // keep the two body labels from overlapping: push the Sun label below its disc when they collide
  const labelsClash = Math.abs(x(now.sunAz) - x(now.earthAz)) < 90 && Math.abs(y(now.sunEl) - y(now.earthEl)) < 26
  const earthUp = now.earthUpper > 0

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const az = (((e.clientX - r.left) / r.width) * W - M.l) / pw * 360
    setHoverAz(az >= 0 && az <= 360 ? az : null)
  }

  const summary =
    `Sky view at ${fmtTime(now.t, tz)}. Sun at azimuth ${now.sunAz.toFixed(0)}° (${compass(now.sunAz)}), ` +
    `${fmtDeg(now.sunEl)} above the smooth horizon; terrain there rises to ${fmtDeg(now.sunHorizon)}, so the Sun is ` +
    `${sunLit ? `${Math.round(now.sunFrac * 100)} % visible` : 'hidden'}. Earth at azimuth ${now.earthAz.toFixed(0)}°, ` +
    `${fmtDeg(now.earthEl)}; terrain ${fmtDeg(now.earthHorizon)}, so Earth is ${earthUp ? 'in view' : 'blocked'}. ` +
    `Highest terrain on the horizon: ${fmtDeg(Math.max(...horizon))}.`

  return (
    <figure className="chart-frame hero" aria-labelledby="sky-title">
      <div className="chart-head">
        <h3 id="sky-title" className="chart-title">
          View from the site <InfoTip info={INFO.sky} label="the sky view" />
        </h3>
        <div className="legend" aria-hidden>
          <span className="lg lg-sun">Sun path</span>
          <span className="lg lg-earth">Earth path</span>
          <span className="lg lg-hidden">behind terrain</span>
          <span className="lg lg-terrain">LOLA terrain</span>
        </div>
      </div>
      <div ref={box} className="chart-box">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={summary}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverAz(null)}
        >
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--c-sky-night)" />
              <stop offset="1" stopColor={sunLit ? 'var(--c-sky-day)' : 'var(--c-sky-night)'} />
            </linearGradient>
            <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--c-terrain-top)" />
              <stop offset="1" stopColor="var(--c-terrain-bottom)" />
            </linearGradient>
          </defs>
          <rect x={M.l} y={M.t} width={pw} height={ph} fill="url(#sky)" className="sky-fill" />
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'grid zero' : 'grid'} />
              <text x={M.l - 8} y={y(v) + 4} className="tick" textAnchor="end">
                {v}°
              </text>
            </g>
          ))}
          {azTicks.map((a) => (
            <g key={a}>
              <line x1={x(a)} x2={x(a)} y1={M.t} y2={H - M.b} className="grid" />
              <text x={x(a)} y={H - M.b + 16} className="tick" textAnchor="middle">
                {compass(a)}
              </text>
            </g>
          ))}
          <text x={M.l + pw / 2} y={H - 4} className="axis-title" textAnchor="middle">
            Azimuth (clockwise from north)
          </text>
          <text transform={`translate(12 ${M.t + ph / 2}) rotate(-90)`} className="axis-title" textAnchor="middle">
            Elevation
          </text>

          {sunSegs.map((s, i) => (
            <polyline key={`s${i}`} points={poly(s.pts)} className={s.visible ? 'track sun' : 'track sun hidden'} />
          ))}
          {earthSegs.map((s, i) => (
            <polyline key={`e${i}`} points={poly(s.pts)} className={s.visible ? 'track earth' : 'track earth hidden'} />
          ))}

          <path d={terrainPath} fill="url(#ground)" className="terrain" />

          <g className={earthUp ? 'body' : 'body occluded'}>
            <circle cx={x(now.earthAz)} cy={y(now.earthEl)} r={earthR} className="earth-disc" />
            <text
              x={x(now.earthAz) + (x(now.earthAz) > W - 90 ? -earthR - 6 : earthR + 6)}
              y={y(now.earthEl) + 4}
              textAnchor={x(now.earthAz) > W - 90 ? 'end' : 'start'}
              className="label earth-label"
            >
              Earth{earthUp ? '' : ' (blocked)'}
            </text>
          </g>
          <g className={sunLit ? 'body' : 'body occluded'}>
            <circle cx={x(now.sunAz)} cy={y(now.sunEl)} r={sunR * 2.2} className="sun-halo" />
            <circle cx={x(now.sunAz)} cy={y(now.sunEl)} r={sunR} className="sun-disc" />
            <text
              x={x(now.sunAz) + (labelsClash ? -sunR - 8 : sunR + 8)}
              y={labelsClash ? y(now.sunEl) + sunR + 16 : y(now.sunEl) - sunR - 4}
              textAnchor={labelsClash ? 'end' : 'start'}
              className="label sun-label"
            >
              Sun{sunLit ? '' : ' (behind terrain)'}
            </text>
          </g>

          {hoverAz !== null && (
            <g className="hover" pointerEvents="none">
              <line x1={x(hoverAz)} x2={x(hoverAz)} y1={M.t} y2={H - M.b} />
              <circle cx={x(hoverAz)} cy={y(horizonAt(horizon, azStep, hoverAz))} r={3.5} />
            </g>
          )}
        </svg>
        {hoverAz !== null && (
          <div
            className="readout num"
            style={{ left: Math.min(Math.max(x(hoverAz) + 10, 8), W - 190), top: M.t + 6 }}
            aria-hidden
          >
            <div>
              Azimuth {hoverAz.toFixed(1)}° {compass(hoverAz)}
            </div>
            <div>Terrain horizon {fmtDeg(horizonAt(horizon, azStep, hoverAz), true)}</div>
          </div>
        )}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  )
}
