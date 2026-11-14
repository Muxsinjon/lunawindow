# Quality checklist (release gate)

Tick an item only when it has been verified, and say how it was verified.

- [ ] `npm run build` succeeds with zero TypeScript errors and `npm run lint` reports zero errors
- [ ] All unit tests pass (`npm test`), and the Playwright smoke tests (`tests/e2e/smoke_test.py`) cover: load, pick site, scrub time, compare 2 sites, Slip Analyzer, share link restores state
- [ ] Zero console errors or warnings on every screen
- [ ] Lighthouse: Accessibility ≥ 95, Performance ≥ 85, Best Practices ≥ 95
- [ ] New screenshots in `docs/screenshots/after/` at 1440 and 390, reviewed against DESIGN_SYSTEM.md
- [ ] Every curated site has a cited source
- [ ] All user-facing text is English with no typos
- [ ] No NASA logos anywhere; any AI-generated image carries a visible watermark
- [ ] The deployed URL and repo open in a private/incognito window with no login
- [ ] docs/AI_USAGE.md is up to date

## Open items needing a team decision
(filled in at the end of the pass)
