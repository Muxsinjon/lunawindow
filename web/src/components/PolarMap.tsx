import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppData, Site } from '../lib/data'
import { polarLatLon, polarXY } from '../lib/terrain'

interface Props {
  data: AppData
  sites: Site[]
  selectedId: string
  onPick: (lat: number, lon: number) => void
  onSelect: (id: string) => void
}

type Layer = 'terrain' | 'sun' | 'earth'
const EXTENTS = { '80°S': -80, '85°S': -85, '88°S': -88 } as const

function ramp(v: number, layer: Layer): [number, number, number] {
  const t = v / 100
  if (layer === 'sun') {
    // dark → amber → pale yellow
    return [Math.round(20 + 235 * Math.min(1, t * 1.25)), Math.round(16 + 200 * t * t), Math.round(30 + 80 * t * t * t)]
  }
  return [Math.round(15 + 60 * t), Math.round(25 + 140 * t), Math.round(45 + 210 * t)]
}

export default function PolarMap({ data, sites, selectedId, onPick, onSelect }: Props) {
  const [layer, setLayer] = useState<Layer>('sun')
  const [extent, setExtent] = useState<keyof typeof EXTENTS>('85°S')
  const canvas = useRef<HTMLCanvasElement>(null)
  const { n, scaleM, offsetPx } = data.polar.meta
  const rhoMax = polarXY(EXTENTS[extent], 0).y // metres from pole (positive)
  const halfPx = Math.ceil(Math.abs(rhoMax) / scaleM)
  const size = 2 * halfPx

  const shade = useMemo(() => {
    const h = data.polar.h
    const out = new Float32Array(n * n)
    // hillshade, light from upper-left
    for (let r = 1; r < n - 1; r++)
      for (let c = 1; c < n - 1; c++) {
        const dx = (h[r * n + c + 1] - h[r * n + c - 1]) / (2 * scaleM)
        const dy = (h[(r - 1) * n + c] - h[(r + 1) * n + c]) / (2 * scaleM)
        const s = 0.55 + 0.9 * (-dx * 0.7 + dy * 0.7) / Math.sqrt(1 + dx * dx + dy * dy)
        out[r * n + c] = Math.max(0, Math.min(1.2, s))
      }
    return out
  }, [data, n, scaleM])

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    cv.width = size
    cv.height = size
    const ctx = cv.getContext('2d')!
    const img = ctx.createImageData(size, size)
    const c0 = Math.round(offsetPx - halfPx)
    const ov = layer === 'terrain' ? null : data.pgda?.[layer]
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) {
        const rr = c0 + r
        const cc = c0 + c
        const k = (r * size + c) * 4
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue
        const s = shade[rr * n + cc]
        let rgb: [number, number, number] = [150 * s, 146 * s, 140 * s]
        if (ov) {
          const v = ov[rr * n + cc]
          if (v !== 255) {
            const col = ramp(v, layer)
            const m = 0.35 + 0.65 * Math.min(1, s)
            rgb = [col[0] * m, col[1] * m, col[2] * m]
          }
        }
        img.data[k] = rgb[0]
        img.data[k + 1] = rgb[1]
        img.data[k + 2] = rgb[2]
        img.data[k + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
  }, [shade, layer, size, halfPx, offsetPx, n, data])

  const toPx = (lat: number, lon: number) => {
    const { x, y } = polarXY(lat, lon)
    return { px: (x / scaleM + halfPx) / size, py: (-y / scaleM + halfPx) / size }
  }

  const click = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    const fy = (e.clientY - r.top) / r.height
    const x = (fx * size - halfPx) * scaleM
    const y = -(fy * size - halfPx) * scaleM
    const { lat, lon } = polarLatLon(x, y)
    if (lat <= EXTENTS[extent] + 0.01) onPick(lat, lon)
  }

  const polarSites = sites.filter((s) => s.lat <= EXTENTS[extent])
  return (
    <div className="polarmap">
      <div className="row between">
        <div className="seg" role="radiogroup" aria-label="Map layer">
          {(['sun', 'earth', 'terrain'] as Layer[]).map((l) => (
            <button key={l} className={layer === l ? 'on' : ''} onClick={() => setLayer(l)} role="radio" aria-checked={layer === l}>
              {l === 'sun' ? 'Sunlight %' : l === 'earth' ? 'Earth view %' : 'Terrain'}
            </button>
          ))}
        </div>
        <select value={extent} onChange={(e) => setExtent(e.target.value as keyof typeof EXTENTS)} aria-label="Map extent">
          {Object.keys(EXTENTS).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </div>
      <div className="mapbox" onClick={click} title="Click anywhere to analyse a custom site">
        <canvas ref={canvas} />
        {polarSites.map((s) => {
          const { px, py } = toPx(s.lat, s.lon)
          return (
            <button
              key={s.id}
              className={`pin ${s.id === selectedId ? 'sel' : ''} ${s.custom ? 'custom' : ''}`}
              style={{ left: `${px * 100}%`, top: `${py * 100}%` }}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(s.id)
              }}
              title={s.name}
              aria-label={s.name}
            />
          )
        })}
        <span className="maplabel n">0°</span>
        <span className="maplabel e">90°E</span>
        <span className="maplabel s">180°</span>
        <span className="maplabel w">90°W</span>
      </div>
      <p className="caption">
        {layer === 'terrain'
          ? 'LOLA topography (hillshade), south pole to ' + extent + '.'
          : `Long-term average ${layer === 'sun' ? 'sunlight' : 'Earth visibility'} (LOLA team, Mazarico et al. 2011). Brighter = more.`}{' '}
        <b>Click anywhere</b> to analyse that spot. A few hundred metres can change everything.
      </p>
    </div>
  )
}
