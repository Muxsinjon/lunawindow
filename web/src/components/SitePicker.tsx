import { useState } from 'react'
import type { Site } from '../lib/data'
import { fmtLat, fmtLon } from '../lib/format'

interface Props {
  sites: Site[]
  selectedId: string
  onSelect: (id: string) => void
  onCustom: (lat: number, lon: number) => void
}

export default function SitePicker({ sites, selectedId, onSelect, onCustom }: Props) {
  const [lat, setLat] = useState('-85.42')
  const [lon, setLon] = useState('31.6')
  const [err, setErr] = useState('')
  const groups = Array.from(new Set(sites.map((s) => s.group)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const la = Number(lat)
    const lo = Number(lon)
    if (!isFinite(la) || la < -90 || la > 90) return setErr('Latitude must be −90…90')
    if (!isFinite(lo) || lo < -180 || lo > 360) return setErr('Longitude must be −180…360 (east positive)')
    setErr('')
    onCustom(la, lo > 180 ? lo - 360 : lo)
  }

  return (
    <div className="picker">
      <label className="lbl" htmlFor="site">
        Landing site
      </label>
      <select id="site" value={selectedId} onChange={(e) => onSelect(e.target.value)}>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {sites
              .filter((s) => s.group === g)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <form onSubmit={submit} className="custom">
        <span className="lbl">Custom coordinates</span>
        <div className="row">
          <input aria-label="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="lat" />
          <input aria-label="Longitude (east positive)" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="lon °E" />
          <button type="submit">Go</button>
        </div>
        {err && <div className="err">{err}</div>}
      </form>
    </div>
  )
}

export function SiteHeader({ site }: { site: Site }) {
  return (
    <div className="sitehead">
      <h2>{site.name}</h2>
      <div className="muted">
        {fmtLat(site.lat)}, {fmtLon(site.lon)} · {site.elevationM.toLocaleString()} m elevation · {site.group}
        {site.verify && <span className="badge" title="Coordinates not yet cross-checked against a primary source">verify</span>}
      </div>
      <div className="src">{site.custom ? site.terrainNote : `Source: ${site.source}`}</div>
    </div>
  )
}
