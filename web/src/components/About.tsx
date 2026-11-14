import type { AppData } from '../lib/data'
import MissionCheck from './MissionCheck'

const LINKS = {
  horizons: 'https://ssd.jpl.nasa.gov/horizons/',
  lola: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm',
  lolaGdr: 'http://imbrium.mit.edu/DATA/LOLA_GDR/',
  pgda: 'https://pgda.gsfc.nasa.gov/products/69',
  quickmap: 'https://quickmap.lroc.asu.edu/',
  repoValidation: 'docs/VALIDATION.md',
}

export default function About({ data }: { data: AppData }) {
  const v = data.validation
  return (
    <article className="about prose" aria-labelledby="about-title">
      <h2 id="about-title">About the data and methods</h2>
      <p className="lede">
        Every number in this tool comes from free NASA data and is checked against independent NASA references. Here is exactly how, and
        where it can be wrong.
      </p>

      <h3>How it works</h3>
      <ol>
        <li>
          <b>Where are the Sun and Earth?</b> We asked NASA/JPL Horizons (DE441) for the sub-solar and sub-Earth points on the Moon every hour from 2023 to 2031, in
          the Moon’s body-fixed frame. That is a 1.9 MB file from which the browser computes the Sun’s and Earth’s azimuth and elevation for any
          lunar coordinate, including libration (Earth’s monthly wobble in the lunar sky).
        </li>
        <li>
          <b>Where is the real horizon?</b> At the south pole the Sun skims the horizon, often less than 2° up, so a smooth-sphere horizon is
          misleading. We cast rays every 0.5° of azimuth out to {data.sites.maxDistanceKm} km over LRO LOLA laser-altimetry terrain, on a curved Moon,
          for an observer {data.sites.observerHeightM} m above the ground.
        </li>
        <li>
          <b>What does it mean for a mission?</b> Sunrise and sunset happen when the upper edge of the disc crosses that terrain line. From the
          windows we derive countdowns, percentages, the longest dark period, solar power and the landing calendar.
        </li>
      </ol>

      <h3>Datasets</h3>
      <table>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Used for</th>
            <th scope="col">Provider</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <a href={LINKS.horizons}>Horizons System API</a>, DE441
            </td>
            <td>Sun and Earth positions, hourly 2023–2031 (retrieved 2026-11-14)</td>
            <td>NASA JPL</td>
          </tr>
          <tr>
            <td>
              <a href={LINKS.lolaGdr}>LOLA gridded topography</a>: LDEM_75S_240M, LDEM_16
            </td>
            <td>Terrain horizons; the polar map hillshade</td>
            <td>NASA LRO / LOLA team, via the PDS</td>
          </tr>
          <tr>
            <td>
              <a href={LINKS.pgda}>Lunar polar illumination maps</a> (AVGVISIB, 120 m)
            </td>
            <td>Map overlays; validation of our sunlight and Earth-visibility percentages</td>
            <td>NASA GSFC PGDA (Mazarico et al. 2011, Icarus 211)</td>
          </tr>
          <tr>
            <td>Landing-site coordinates</td>
            <td>The curated site list (each site shows its source)</td>
            <td>LROC, NASA Apollo records, Artemis III site studies, ISRO, JAXA</td>
          </tr>
        </tbody>
      </table>

      <h3>Validation</h3>
      <p>
        <b>Positions.</b> Our Sun and Earth elevations match JPL Horizons’ own topocentric values to within{' '}
        <b className="num">{v.worstElevationErrorDeg.toFixed(4)}°</b> over {v.period}, across five sites. For scale, the Sun’s disc is 0.53°
        wide.
      </p>
      {v.illumination && (
        <>
          <p>
            <b>Sunlight and Earth visibility.</b> These are compared with the LOLA team’s long-term maps. {v.illumination.note}.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">Sunlit, ours</th>
                  <th scope="col">Sunlit, LOLA team</th>
                  <th scope="col">Earth visible, ours</th>
                  <th scope="col">Earth visible, LOLA team</th>
                </tr>
              </thead>
              <tbody>
                {v.illumination.sites.map((s) => (
                  <tr key={s.site}>
                    <td>{s.site}</td>
                    <td className="num">{s.oursSunPct} %</td>
                    <td className="num">{s.pgdaSunPct} %</td>
                    <td className="num">{s.oursEarthPct} %</td>
                    <td className="num">{s.pgdaEarthPct} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <MissionCheck v={v} />

      <h3>Assumptions</h3>
      <ul>
        <li>The Moon is a sphere of radius 1737.4 km, carrying LOLA terrain. There is no atmosphere, so no refraction.</li>
        <li>The observer is 2 m above the ground (a lander’s solar panels and antenna).</li>
        <li>The Sun or Earth counts as visible while any part of its disc clears the terrain. Visible % is the disc area above the horizon.</li>
        <li>Power assumes a vertical, sun-tracking panel with 30 % efficient cells. There is no thermal, dust or degradation model.</li>
        <li>An “Earth link” means Earth is above the terrain. A ground station on Earth must also see the Moon at the same time.</li>
      </ul>

      <h3>Limitations and known uncertainty</h3>
      <ul>
        <li>
          Terrain resolution is 240 m for curated polar sites, 960 m for custom polar points and about 7.6 km elsewhere. Nearby slopes and
          boulders are not resolved, so the horizon can be off by a few tenths of a degree. Near the pole that shifts sunrise or sunset by
          roughly 1–3 hours.
        </li>
        <li>The ephemeris covers 2023–2031 at 1-hour steps. Interpolation error is below 0.01°.</li>
        <li>Coordinates marked “Needs verification” still need a primary-source check.</li>
      </ul>
      <p className="muted">The full tables are in the repository at {LINKS.repoValidation}.</p>
    </article>
  )
}
