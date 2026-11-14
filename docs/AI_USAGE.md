# AI usage log

This log supports the Space Apps "Use of Super Intelligence (SI)" disclosure.

**Tool:** Claude (Anthropic), used as a coding and research assistant inside Claude Code.

**What the team did:** the team chose the challenge, the concept (terrain-aware Sun/Earth visibility, slip analysis, the validation approach) and the priorities. The AI implemented and debugged code, searched documentation, and drafted docs on request. Every number in the app is computed from NASA data and checked against independent NASA references (`docs/VALIDATION.md`). No AI-generated images, audio or video are used in the app; the favicon and OG image are hand-coded SVG.

| Date (UTC) | Task | Files |
|---|---|---|
| 2026-11-14 | Researched the challenge statement, judging guide, submission guide and five team-supplied YouTube transcripts; drafted the team plan | `PLAN.md` |
| 2026-11-14 | Wrote the Horizons ephemeris fetcher (sub-Earth and sub-solar points in MOON_ME) | `pipeline/fetch_ephemeris.py` |
| 2026-11-14 | Wrote the lunar geometry module and the cross-check against Horizons topocentric az/el | `pipeline/lunar_geom.py`, `pipeline/validate_ephemeris.py` |
| 2026-11-14 | Wrote the LOLA horizon-mask generator and browser DEM export; curated the site list with sources | `pipeline/horizon_mask.py`, `pipeline/sites.py` |
| 2026-11-14 | Compared against the PGDA illumination maps and exported the overlays | `pipeline/validate_illumination.py`, `pipeline/export_overlays.py` |
| 2026-11-14 | Chandrayaan-3 mission check | `pipeline/validate_missions.py` |
| 2026-11-14 | Built the React web app: explorer, sky chart, timeline, metrics, polar map, compare, slip analyzer, method page | `web/src/**` |
| 2026-11-14 | Wrote the README, .gitignore and launch config | `README.md`, `.gitignore`, `.claude/launch.json` |
| 2026-11-14 | Audited the codebase and took before screenshots | `AUDIT.md`, `docs/screenshots/before/*`, `tests/e2e/screenshots.py` |
| 2026-11-14 | Wrote the project rules, design system, quality checklist and this log | `CLAUDE.md`, `docs/DESIGN_SYSTEM.md`, `docs/QUALITY_CHECKLIST.md`, `docs/AI_USAGE.md` |
