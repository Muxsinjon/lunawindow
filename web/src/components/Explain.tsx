// Explore mode: plain-language explanation of what the charts show right now.
import type { NextEvent, Sample, WindowSummary } from '../lib/analysis'
import { fmtDuration } from '../lib/format'
import { compass } from './SkyChart'

interface Props {
  siteName: string
  lat: number
  now: Sample
  sunEvent: NextEvent
  sum: WindowSummary
  windowDays: number
}

const dirWord: Record<string, string> = {
  N: 'north',
  NE: 'north-east',
  E: 'east',
  SE: 'south-east',
  S: 'south',
  SW: 'south-west',
  W: 'west',
  NW: 'north-west',
}

export default function Explain({ siteName, lat, now, sunEvent, sum, windowDays }: Props) {
  const dir = dirWord[compass(now.sunAz)]
  const polar = Math.abs(lat) > 75
  const sunLow = now.sunEl < 10
  const hiddenByHill = now.sunEl > 0 && now.sunUpper <= 0
  const lines: string[] = []

  if (hiddenByHill) {
    lines.push(
      `The Sun is ${now.sunEl.toFixed(1)}° above a perfectly flat horizon, so a simple calculator would say “daytime”. But a ridge to the ${dir} rises to ${now.sunHorizon.toFixed(1)}°, so ${siteName} is in shadow.`,
    )
  } else if (now.sunUpper > 0) {
    lines.push(
      `The Sun stands ${now.sunEl.toFixed(1)}° high in the ${dir}. Terrain in that direction reaches ${now.sunHorizon.toFixed(1)}°, so the Sun clears it by ${(now.sunMargin).toFixed(1)}°.`,
    )
    if (sunEvent.time !== null)
      lines.push(`It will slip behind the terrain in ${fmtDuration(sunEvent.time - now.t)}. That is when solar power stops.`)
  } else {
    lines.push(`The Sun is below the horizon: it is lunar night here.`)
  }
  if (polar && sunLow)
    lines.push(
      'Near the poles the Sun never climbs high. It circles around the horizon once a month, like a lamp moving along the floor, so every hill casts a shadow kilometres long. That is why moving a lander a few hundred metres can change everything.',
    )
  lines.push(
    now.earthUpper > 0
      ? `Earth hangs ${now.earthEl.toFixed(1)}° above the horizon, so the lander can talk to home directly.`
      : `Earth is hidden behind the terrain, so the lander cannot radio home directly. It would need a relay satellite.`,
  )
  lines.push(
    `Over the ${windowDays}-day window, the lander would have both sunlight and an Earth link ${Math.round(sum.bothPct)} % of the time. The longest stretch of darkness is ${fmtDuration(sum.longestDarkMs)}, so its batteries must last that long.`,
  )

  return (
    <aside className="explain" aria-label="Plain-language explanation">
      <h3>What you are seeing</h3>
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </aside>
  )
}
