# Quality checklist (release gate)

Each ticked item was verified on 2026-11-14; the evidence follows each item.

- [x] `npm run build` succeeds with zero TypeScript errors and `npm run lint` reports zero errors. Evidence: `tsc -p .` clean, ESLint clean, Prettier check clean.
- [x] All unit tests pass (`npm test`: 41/41), and the Playwright smoke tests (`tests/e2e/smoke_test.py`: 8/8) cover load, pick site, scrub time, compare 2 sites, landing calendar, share link restores state, the data page, and tooltip, playback, map click and theme. They pass on both the React dev build and the Preact production build.
- [x] Zero console errors or warnings on every screen (`smoke_test.py` and `screenshots.py` both assert this).
- [x] Lighthouse: Accessibility ≥ 95 (100 mobile, 100 desktop), Performance ≥ 85 (mobile 91–92; desktop median 97, with one cold-run outlier of 77), Best Practices ≥ 95 (100). Measured on the production build with gzip, as GitHub Pages serves it. Reports are in `docs/lighthouse/`.
- [x] New screenshots in `docs/screenshots/after/` at 1440 and 390, reviewed against DESIGN_SYSTEM.md. The fixes from that review are in commit `87eed75`. One open item: the day ticks touch at the right edge of compact lanes at 390 px (P2).
- [x] Every curated site has a cited source, enforced by a unit test (`validation.test.ts`, "data contract"). Three sites carry a visible "Needs verification" badge.
- [x] All user-facing text is in English with no typos: cspell over the components, the HTML and the docs flags only proper nouns, identifiers and consistent British spellings.
- [x] No NASA logos anywhere. The favicon and OG image are original hand-coded SVG drawn from our own LOLA data. No AI-generated images are used, so no watermark is needed.
- [ ] The deployed URL and repo open in a private/incognito window with no login. **Blocked:** there is no public GitHub repo yet (team decision). The workflows are ready.
- [x] docs/AI_USAGE.md is up to date.

## Open items needing a team decision
1. **Publish:** create the public GitHub repo (which account or org?). Rename the branch to `main`, push, and enable Pages via "GitHub Actions". Then add the live URL to the README and check it in a private window.
2. **Git identity:** commits use a placeholder author. Set your real name and email, then rewrite the author on this branch before pushing.
3. **Team section** in the README: names and roles.
4. **Three flagged coordinates** (SLIM, Chang'e 4, Shackleton floor): verify them in LROC QuickMap, or drop them.
5. **AI disclosure wording:** the Space Apps rule is that AI must not generate the solution idea. Confirm that `docs/AI_USAGE.md` describes how your team actually worked.
