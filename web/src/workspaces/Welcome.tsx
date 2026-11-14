import { makeCtx, sampleAt } from '../lib/analysis'
import { useStore } from '../lib/store'
import { useWidth } from '../components/ui'

/** Landing screen. The hero silhouette is the real LOLA horizon of Nobile Rim 2 (not decorative art). */
export default function Welcome() {
  const { set, site, startDemo, data } = useStore()
  const nobile = site('nobile-rim-2')
  const [box, W] = useWidth<HTMLDivElement>(1200)
  const H = Math.round(Math.min(300, Math.max(180, W * 0.24)))
  const lo = -4
  const hi = 10
  const y = (el: number) => 20 + ((hi - el) / (hi - lo)) * (H - 20)
  const n = nobile.horizon.length
  const pts = nobile.horizon.map((h, i) => `${((i / n) * W).toFixed(1)},${y(h).toFixed(1)}`)
  // real Sun and Earth positions three hours before the ridge sunset on 2026-11-22 (same data as the charts)
  const now = sampleAt(makeCtx(nobile, data.sites.azStepDeg), data.eph, Date.parse('2026-11-22T00:40:00Z'))
  const xAz = (az: number) => (az / 360) * W
  return (
    <div className="welcome">
      <div ref={box} className="welcome-hero" aria-hidden>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <rect width={W} height={H} className="sv-sky" />
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="sv-zero" />
          <circle cx={xAz(now.sunAz)} cy={y(now.sunEl)} r={8} className="sv-sun" />
          <circle cx={xAz(now.earthAz)} cy={y(now.earthEl)} r={11} className="sv-earth-lit" />
          <path d={`M0,${H} L${pts.join(' L')} L${W},${y(nobile.horizon[0])} L${W},${H}Z`} className="sv-ground" />
        </svg>
        <p className="hero-cap">
          Real 360° horizon of Nobile Rim 2 (Artemis III candidate) from LRO LOLA, with the Sun and Earth where they are on 2026-11-22 00:40
          UTC. The Sun sets behind this ridge three hours later, while still about 6.4° above a flat horizon. Vertical scale exaggerated.
        </p>
      </div>
      <div className="welcome-body">
        <h1>LunaWindow — Find the Right Place and Time to Land on the Moon</h1>
        <p className="tagline">Explore. Compare. Plan. Experience.</p>
        <p className="lede">
          Explore lunar landing sites, investigate sunlight and Earth visibility, identify favorable mission windows, and experience the
          Moon from the surface.
        </p>
        <div className="entry">
          <button type="button" className="entry-card" onClick={() => set({ ws: 'compare' })}>
            <span className="entry-title">Explore landing sites</span>
            <span className="entry-text">You already have candidate sites. Compare two of them over a mission period, hour by hour.</span>
          </button>
          <button type="button" className="entry-card" onClick={() => set({ ws: 'finder' })}>
            <span className="entry-title">Plan a lunar mission</span>
            <span className="entry-text">You know your mission’s needs. Find which sites and dates meet them, and see why.</span>
          </button>
        </div>
        <button type="button" className="btn primary" onClick={startDemo}>
          Try the guided demo
        </button>
        <p className="hint">
          A preliminary decision-support tool built with NASA data (JPL Horizons, LRO LOLA). It does not certify landing safety. No account
          needed.
        </p>
      </div>
    </div>
  )
}
