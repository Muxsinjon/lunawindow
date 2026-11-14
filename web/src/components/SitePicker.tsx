import { useState } from 'react'
import type { Site } from '../lib/data'
import { fmtLat, fmtLon } from '../lib/format'
import { parseLat, parseLon } from '../lib/physics/lon'
import { Icon } from './ui'

interface Props {
  sites: Site[]
  selectedId: string
  onSelect: (id: string) => void
  onCustom?: (lat: number, lon: number) => void
  customBusy?: boolean
}

export default function SitePicker({ sites, selectedId, onSelect, onCustom, customBusy }: Props) {
  const [lat, setLat] = useState('85.42 S')
  const [lon, setLon] = useState('31.6 E')
  const [err, setErr] = useState('')
  const groups = Array.from(new Set(sites.map((s) => s.group)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const la = parseLat(lat)
    const lo = parseLon(lon)
    if (la === null) return setErr('Latitude must be between 90 S and 90 N, for example "84.79 S" or "-84.79".')
    if (lo === null) return setErr('Longitude must be like "29.2 E", "150 W" or "209.9".')
    setErr('')
    onCustom?.(la, lo)
  }

  return (
    <div className="picker">
      <label className="field">
        <span className="field-label">Landing site</span>
        <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
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
      </label>
      {onCustom && (
        <form onSubmit={submit} className="custom" aria-label="Analyse custom coordinates">
          <span className="field-label">Or enter coordinates</span>
          <div className="row">
            <input aria-label="Latitude, for example 84.79 S" value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
            <input aria-label="Longitude, for example 29.2 E" value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" />
            <button type="submit" className="btn" disabled={customBusy}>
              {customBusy ? 'Computing…' : 'Analyse'}
            </button>
          </div>
          {err && (
            <p className="field-error" role="alert">
              <Icon name="warn" size={16} /> {err}
            </p>
          )}
        </form>
      )}
    </div>
  )
}

export function SiteHeader({ site }: { site: Site }) {
  return (
    <header className="site-head">
      <h2>{site.name}</h2>
      <dl className="site-facts">
        <div>
          <dt>Position</dt>
          <dd className="num">
            {fmtLat(site.lat)}, {fmtLon(site.lon)}
          </dd>
        </div>
        <div>
          <dt>Elevation</dt>
          <dd className="num">{site.elevationM.toLocaleString('en-US')} m</dd>
        </div>
        <div>
          <dt>Group</dt>
          <dd>{site.group}</dd>
        </div>
        <div className="src">
          <dt>{site.custom ? 'Terrain' : 'Source'}</dt>
          <dd>
            {site.custom ? site.terrainNote : site.source}
            {site.verify && (
              <span className="badge" title="Coordinates not yet cross-checked against a primary source">
                Needs verification
              </span>
            )}
          </dd>
        </div>
      </dl>
    </header>
  )
}
