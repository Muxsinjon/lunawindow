# Audit: Lunar Landing Site Navigator (before the professional pass)

Date: 2026-11-14. Branch `pro-upgrade`, baseline commit `c23d8eb`.
Screenshots: `docs/screenshots/before/` (explorer, compare, slip, about × 1440 and 390 px wide). No console errors or warnings were seen on any screen.

## 1. What exists and works (MVP map)

| MVP item | Status | Where |
|---|---|---|
| Site picker: curated sites plus custom coordinates | ✅ 17 sites with sources; custom lat/lon; click on the polar map | `SitePicker.tsx`, `PolarMap.tsx` |
| Date/time picker plus scrubber | ✅ UTC datetime input, ±7 d and ±1 lunar day buttons, range scrubber, play | `App.tsx` |
| Horizon sky chart | ✅ terrain silhouette (LOLA), Sun and Earth tracks, current discs | `SkyChart.tsx` |
| Metrics card | ✅ Sun and Earth state, countdowns, power, window percentages | `Metrics.tsx` |
| Compare mode with swimlanes | ✅ multiple scenarios aligned by days since landing; best value per column | `Compare.tsx` |
| Extra: Slip analyzer (landing-date calendar) | ✅ constraints, next viable date, slip by a month | `SlipAnalyzer.tsx` |
| Extra: method and validation page | ✅ Horizons cross-check, PGDA comparison, Chandrayaan-3 | `About.tsx`, `pipeline/validate_*.py` |
| Data pipeline | ✅ Horizons → ephemeris; LOLA → horizon masks and browser DEMs; PGDA overlays | `pipeline/` |

## 2. Missing or broken

- **Physics convention:** sunrise and sunset use the Sun's *centre*, not the upper limb. Earth visibility also uses the centre, with no partial-disc percentage. The partial-Sun fraction is a linear approximation, not the true circular-segment area.
- Longitude is stored as −180..180 in `sites.json`. The data contract will be 0–360 east-positive.
- There is no local-time toggle; the app is UTC only.
- There are no unit tests, no lint or format setup and no CI.
- There is no Planner/Explore mode, no onboarding, no "Copy link" button, no keyboard shortcuts and no tooltips that explain metrics.
- The default view opens on a site in darkness, so the core insight (a ridge hides a Sun that is above the flat horizon) needs explaining before anyone sees it.
- Compare shows no deltas against a baseline.
- There is no error boundary, skeleton loader or retry. If data loading fails, the user gets a bare text line.
- No favicon, Open Graph tags or OG image.
- The URL hash is read only on first load, so the back button and edited links don't restore state.
- Not deployed. There is no GitHub Pages workflow and no repo remote.

## 3. Ranked issues

### P0: blocks the demo or makes the science wrong
1. **Science:** visibility uses the disc centre. It must use the upper limb (sunrise/sunset), report partial-disc percentages for both Sun and Earth, and use the exact segment-area formula.
2. **Science:** physics functions have no unit tests, so the Validity claims rest on scripts only.
3. **Demo:** the default scenario opens in darkness and doesn't show the "ridge hides the Sun" moment within the first 5 seconds.
4. **Robustness:** there is no error boundary. One chart exception blanks the whole app the night before judging.
5. **Deploy:** there is no public URL yet (needs a team decision: GitHub account or org). Workflow files are missing.

### P1: looks amateur or confuses users
6. **Visual:** the type and colour system is a generic dark template: all-caps tracked labels, "A · B · C" meta strings, monospace body text in cards, a near-black background. It looks like a default dashboard rather than an instrument. There is no light theme.
7. **Visual:** the sky chart is not the hero. It sits below the cards at about 45% of the viewport height, with no axis titles, legend or hover readout. The Sun label overlaps the terrain.
8. **UX:** the metric cards are dense, monospace and wrap badly at 1440. They have no status chips and no tooltips. "Ops time" is unexplained jargon.
9. **Phone (390 px):** the charts shrink to unreadable size (axis text about 4 px), the tabs wrap onto two lines and the scrubber is far from the chart.
10. **Colour/accessibility:** Sun amber versus Both green is weakly distinguishable for deuteranopes. Lanes use colour only, with no pattern or label.
11. **Accessibility:** the charts have no text summary, the map pins have only colour state and there are no keyboard shortcuts. The scrubber has no value text.
12. **Compare:** the compact lane ticks are about 7 px (illegible), there are no ▲/▼ deltas and the "first sunset" column mixes two meanings.
13. **Map:** the brown sunlight ramp looks muddy and has no legend or scale.
14. **Time:** UTC only, with no local-time toggle.
15. **URL:** the mode and theme aren't encoded, there's no Copy link button and there's no hashchange handling.

### P2: nice to have
16. 3D shadow time-lapse (Three.js). Not built.
17. Ground-station (DSN) visibility.
18. Higher-resolution near-field terrain (LOLA 20 m or 5 m site DEMs) for curated polar sites.
19. Ephemeris beyond 2031, or a SPICE fallback.
20. Exporting scenarios as CSV or PDF.
21. Translations (all UI text is English as required, so this is optional).

## 4. Performance and bundle (before)
- JS: 258.5 kB (81.9 kB gzip). CSS: 9.2 kB (2.6 kB gzip). It is one chunk with no code splitting.
- Data: 7.4 MB, all fetched up front: ephemeris 1.9 MB, polar DEM 1.8 MB, global DEM 2.1 MB, PGDA overlays 1.8 MB, sites 80 kB. The DEMs and overlays are only needed for the map and custom sites, so they should be lazy-loaded.
- No runtime calls to Horizons. Everything is precomputed. ✅
- A custom-site horizon takes about 0.4 s on the main thread. That's acceptable; a Web Worker would be a P2.

## 5. Code quality
- Physics is reasonably separated (`lib/geometry.ts`, `lib/analysis.ts`, `lib/terrain.ts`), but the panel-power and formatting helpers are mixed into `analysis.ts`.
- There is no `any` anywhere. Strict TypeScript is on.
- Some hard-coded colours remain inside SVG and canvas code (`#fff`, `#000a`, the map ramp), bypassing tokens.
- The `react-hooks/exhaustive-deps` comment in `SkyChart.tsx` references a lint rule that isn't installed.

## 6. Screenshot review notes (before)
- **explorer-1440:** the strongest screen, but generic. The caps labels and middle-dot strings read as template chrome. The Sun label is drawn over the ridge. The metric cards carry four lines of 13 px monospace each. There is a lot of empty space under the map in the left rail.
- **explorer-390:** the charts are unreadable. Time controls sit three blocks away from the chart they control.
- **compare-1440:** the table works, but the swimlane ticks are illegible. Two-line "dark · sunrise +17h 54m" cells. Half the page is empty.
- **slip-390:** the calendar is cropped at day 12 with only a hidden horizontal scroll. The month labels take a third of the width.
- **about:** readable but plain. The validation tables are good content with weak presentation.

## Status of fixes
See `docs/QUALITY_CHECKLIST.md` and the commit log on branch `pro-upgrade`. Items needing a team decision are listed at the end of that file.
