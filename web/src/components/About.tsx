import type { AppData } from '../lib/data'

export default function About({ data }: { data: AppData }) {
  const v = data.validation
  return (
    <section className="about prose">
      <h2>How it works</h2>
      <ol>
        <li>
          <b>Where are the Sun and Earth?</b> We asked NASA/JPL <b>Horizons</b> (DE441) for the sub-Earth and sub-solar points on the Moon
          every hour from 2023 to 2031, in the Moon's body-fixed frame (MOON_ME). That is 1.9 MB that lets the browser compute Sun and Earth
          azimuth/elevation for <i>any</i> lunar coordinate instantly, including libration (Earth's wobble in the lunar sky).
        </li>
        <li>
          <b>Where is the real horizon?</b> At the south pole the Sun skims the horizon (often less than 2° up), so a smooth-sphere horizon is
          misleading. We cast 720 rays out to {data.sites.maxDistanceKm} km over <b>LRO LOLA</b> laser-altimetry terrain (240 m polar grid,
          global 16 px/°), on a curved Moon, for an observer {data.sites.observerHeightM} m above the surface. Sun or Earth counts as
          visible when its centre clears that terrain silhouette.
        </li>
        <li>
          <b>What does it mean for the mission?</b> Sunlit and Earth-visible windows, countdowns to sunset and Earthset, power on a vertical
          panel, and a calendar of viable landing dates under user-set constraints.
        </li>
      </ol>

      <h2>Validation</h2>
      <h3>Geometry vs JPL Horizons topocentric az/el</h3>
      <p>
        Worst elevation difference over {v.period}: <b>{v.worstElevationErrorDeg.toFixed(4)}°</b> (the Sun's disc is 0.53° wide).
      </p>
      <table>
        <thead>
          <tr>
            <th>Site</th>
            <th>Sun max error</th>
            <th>Earth max error</th>
          </tr>
        </thead>
        <tbody>
          {v.sites.map((s) => (
            <tr key={s.site}>
              <td>{s.site}</td>
              <td>{s.sun.maxElevErrDeg.toFixed(4)}°</td>
              <td>{s.earth.maxElevErrDeg.toFixed(4)}°</td>
            </tr>
          ))}
        </tbody>
      </table>
      {v.illumination && (
        <>
          <h3>Terrain-aware visibility vs NASA LOLA illumination maps</h3>
          <p className="muted">
            Reference: {v.illumination.reference}. {v.illumination.note}.
          </p>
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Sunlit (ours)</th>
                <th>Sunlit (LOLA team)</th>
                <th>Earth visible (ours)</th>
                <th>Earth visible (LOLA team)</th>
              </tr>
            </thead>
            <tbody>
              {v.illumination.sites.map((s) => (
                <tr key={s.site}>
                  <td>{s.site}</td>
                  <td>{s.oursSunPct}%</td>
                  <td>{s.pgdaSunPct}%</td>
                  <td>{s.oursEarthPct}%</td>
                  <td>{s.pgdaEarthPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {v.missions?.map((m) => (
        <div key={m.mission}>
          <h3>Real-mission check: {m.mission}</h3>
          <p>
            Our model, with no tuning: Sun {m.sunAtLandingDeg}° up at touchdown;{' '}
            {m.predicted.map((e, i) => (
              <span key={i}>
                {i > 0 && ' → '}
                <b>{e.event}</b> {e.utc.replace('T', ' ').replace('Z', ' UTC')}
              </span>
            ))}
            .
          </p>
          <p className="muted">Public record: {m.record}</p>
        </div>
      ))}

      <h2>Data (all NASA, free and open)</h2>
      <ul>
        <li>JPL Horizons System API: Sun and Earth ephemerides (DE441).</li>
        <li>LRO LOLA gridded topography LDEM_75S_240M and LDEM_16 (NASA PDS, LOLA GDR).</li>
        <li>LOLA polar average illumination and Earth visibility maps (PGDA, Mazarico et al. 2011, Icarus 211).</li>
        <li>Landing-site coordinates: LROC, NASA Apollo records, Artemis III site studies (sources shown per site).</li>
      </ul>

      <h2>Limitations</h2>
      <ul>
        <li>Terrain resolution 240 m (curated polar sites), 960 m / ~7.6 km for custom points: local boulders and slopes are not modelled.</li>
        <li>Earth visible ≠ link closed: a ground station on Earth must also see the Moon.</li>
        <li>Power uses a simple 30%-efficient sun-tracking vertical panel; no thermal or dust model.</li>
        <li>Ephemeris covers 2023–2031 at 1-hour steps (sub-minute event timing via interpolation).</li>
      </ul>
    </section>
  )
}
