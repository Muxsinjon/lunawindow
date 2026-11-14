import { useMemo } from 'react'
import type { Sample } from '../lib/analysis'
import { SUN_RADIUS_DEG, fmtUtc } from '../lib/analysis'

interface Props {
  horizon: number[]
  azStep: number
  samples: Sample[]
  now: Sample
}

const W = 1000
const H = 380
const M = { l: 44, r: 12, t: 16, b: 30 }

function tracks(samples: Sample[], az: (s: Sample) => number, el: (s: Sample) => number, vis: (s: Sample) => boolean) {
  // split polylines at azimuth wrap and at visibility changes
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
    loV = Math.max(loV, -8)
    return { lo: Math.floor(loV), hi: Math.min(90, Math.ceil(hiV)) }
  }, [horizon, samples])

  const pw = W - M.l - M.r
  const ph = H - M.t - M.b
  const x = (az: number) => M.l + (az / 360) * pw
  const y = (el: number) => M.t + ((hi - Math.max(lo, Math.min(hi, el))) / (hi - lo)) * ph
  const pxPerDeg = ph / (hi - lo)

  const terrain = useMemo(() => {
    const pts = horizon.map((h, i) => `${x(i * azStep).toFixed(1)},${y(h).toFixed(1)}`)
    pts.push(`${x(360).toFixed(1)},${y(horizon[0]).toFixed(1)}`)
    return `M${x(0)},${H - M.b} L${pts.join(' L')} L${x(360)},${H - M.b} Z`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizon, azStep, lo, hi])

  const sunSegs = useMemo(() => tracks(samples, (s) => s.sunAz, (s) => s.sunEl, (s) => s.sunMargin > 0), [samples])
  const earthSegs = useMemo(
    () => tracks(samples, (s) => s.earthAz, (s) => s.earthEl, (s) => s.earthMargin > 0),
    [samples],
  )

  const ticks: number[] = []
  const span = hi - lo
  const step = span > 60 ? 15 : span > 30 ? 10 : span > 14 ? 5 : span > 7 ? 2 : 1
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)

  const sunR = Math.max(5, SUN_RADIUS_DEG * pxPerDeg)
  const earthR = Math.max(6, now.earthRadiusDeg * pxPerDeg)
  const poly = (pts: [number, number][]) => pts.map(([a, e]) => `${x(a).toFixed(1)},${y(e).toFixed(1)}`).join(' ')

  return (
    <figure className="chart sky">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sky panorama: Sun and Earth paths against the terrain horizon">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--sky-top)" />
            <stop offset="1" stopColor="var(--sky-bottom)" />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--ground-top)" />
            <stop offset="1" stopColor="var(--ground-bottom)" />
          </linearGradient>
          <radialGradient id="sunglow">
            <stop offset="0" stopColor="#fff6d8" />
            <stop offset="0.55" stopColor="var(--sun)" />
            <stop offset="1" stopColor="var(--sun)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x={M.l} y={M.t} width={pw} height={ph} fill="url(#sky)" />
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'grid zero' : 'grid'} />
            <text x={M.l - 6} y={y(v) + 4} className="tick" textAnchor="end">
              {v}°
            </text>
          </g>
        ))}
        {[0, 45, 90, 135, 180, 225, 270, 315, 360].map((a) => (
          <g key={a}>
            <line x1={x(a)} x2={x(a)} y1={M.t} y2={H - M.b} className="grid" />
            <text x={x(a)} y={H - M.b + 18} className="tick" textAnchor="middle">
              {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'][a / 45]}
            </text>
          </g>
        ))}

        {sunSegs.map((s, i) => (
          <polyline key={`s${i}`} points={poly(s.pts)} className={s.visible ? 'track sun' : 'track sun hidden'} />
        ))}
        {earthSegs.map((s, i) => (
          <polyline key={`e${i}`} points={poly(s.pts)} className={s.visible ? 'track earth' : 'track earth hidden'} />
        ))}

        <path d={terrain} fill="url(#ground)" className="terrain" />

        {/* current positions (drawn on top of terrain, dimmed when occluded) */}
        <g opacity={now.earthMargin > 0 ? 1 : 0.35}>
          <circle cx={x(now.earthAz)} cy={y(now.earthEl)} r={earthR} className="earth-disc" />
          <text x={x(now.earthAz) + earthR + 6} y={y(now.earthEl) + 4} className="label earth-label">
            Earth {now.earthMargin > 0 ? '' : '(blocked)'}
          </text>
        </g>
        <g opacity={now.sunMargin > 0 ? 1 : 0.35}>
          <circle cx={x(now.sunAz)} cy={y(now.sunEl)} r={sunR * 2.4} fill="url(#sunglow)" />
          <circle cx={x(now.sunAz)} cy={y(now.sunEl)} r={sunR} className="sun-disc" />
          <text x={x(now.sunAz) + sunR + 8} y={y(now.sunEl) - 6} className="label sun-label">
            Sun {now.sunMargin > 0 ? '' : '(below terrain)'}
          </text>
        </g>
        <text x={W - M.r - 4} y={M.t + 14} textAnchor="end" className="tick">
          {fmtUtc(now.t)}
        </text>
      </svg>
      <figcaption>
        360° view from the site. The grey silhouette is the real horizon from LRO LOLA laser altimetry. Lines show where
        the <b className="sun-t">Sun</b> and <b className="earth-t">Earth</b> travel over the selected window (faded = hidden
        behind terrain). Vertical scale is stretched.
      </figcaption>
    </figure>
  )
}
