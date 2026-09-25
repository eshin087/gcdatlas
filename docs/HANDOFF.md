# Handoff: continuing gcdatlas in Claude Code

This file carries the context of the chat sessions that built gcdatlas (v0.1 to v0.7.5, September 2026) so a new Claude Code session can pick up without the old conversation. Read it together with `CLAUDE.md` (rules and commands) and `docs/CHANGELOG.md` (what changed, version by version).

## How the owner likes to work

- **No em dashes**, in replies and in anything a visitor reads. Short, concrete, plain sentences.
- **Ask when a choice is really open.** Offer 2 to 4 options with a recommended one first, then go. Do not ask about things the code or the docs already answer.
- **Local first, then GitHub.** Every change lands in the local folder (`C:\Users\eshin\Desktop\Claude Code\gcdAtlas`) before it is pushed.
- **Every version is a pull request** (branch `release/vX.Y.Z` into `main`), so any version can be rolled back with GitHub's *Revert* button on the merged PR. Check the Vercel preview of the PR before merging.
- **Show, do not tell.** Screenshot what you changed (`npm run shots`, or a small Playwright script), and test on a phone size (`npm run test:mobile`).
- **Honest about accuracy.** Real data stays real; anything illustrative says so (see `docs/ACCURACY.md`). The owner asked directly whether the site is a "carbon copy" of the universe: it is not, it is a real-data atlas drawn in ASCII.
- Reports at the end of a task: what changed, what was checked, one next step. No long recaps.

## Decisions to respect (some were reversed after trying them)

| Topic | Decision |
| --- | --- |
| Black holes | Subtle, physical look: light bending, photon ring, Doppler and gravitational colour shifts, time-dilation readouts. **No gravity grids** (added in 0.7, removed in 0.7.2 at the owner's request). No boosted lensing. Shadows are pitch black: nothing may show through them (0.7.3). |
| Tour angle progress | The ASCII bar `angle 1/4  [#####-------------]` in faint grey (a cyan bar was tried in 0.7 and reverted in 0.7.2). |
| Info panel numbers (orange) | Wrap inside the panel like the text above (a one-line version was tried in 0.7 and reverted in 0.7.3). |
| Logo | Keep the Major Mono Display font for `gcdatlas`; object titles use IBM Plex Mono. |
| Camera | A picked object loops through its tour angles by default; any drag or zoom pauses; the play / pause button (top right) and the space bar resume. |
| Phones | Dock at the bottom, info card with more / less / hide, scale ladder behind a chip, interface fades when idle (0.7.1). |
| The Halo | A long-range cruiser (0.7.4, replaced the flat crescent). The ship button only toggles its blue marker, off by default; riding along is a separate action (ride button, card, C for the cockpit). The camera folds with the ship rather than flying after it. |
| The Sun | Warm yellow-orange with a boiling surface, on purpose; ACCURACY.md and the readout say its real light is white. |
| Menus | Menu text has its own size (default 115%) on top of the page text size. |
| Navigation | Arrows beside the name = camera angles. Top-right arrows = tour stops on a tour, otherwise the scale-bar markers. Every lock-on loops its angles. |
| Travel | Default speed slow for new visitors; the chosen speed always wins (also with reduced motion); long trips pass a real object on the way (`flyTo` / `scenicWaypoint`). |
| Solar System | Sun and planets enlarged in the overview (`SYSMAG`), true size close up; the readout says so. |
| Social features | Planned only, behind the `social` flag (off). Design in `docs/ROADMAP.md`. |
| Music | Generative "gcd radio": rotating mix of lofi, chill house and ambient. |

## Current state (2026-09-25)

- **Live: v0.7.5** (PR #3 merged, commit `7855d40`). The local folder is on `main`, in sync with GitHub, with no leftover branches or uncommitted changes. The next version is **v0.7.6**.
- Every version so far is a merged PR (#1 = 0.7.3, #2 = 0.7.4, #3 = 0.7.5), so any of them can be reverted.
- Nothing is half-done. The open ideas are listed under *Open items and ideas* below.

## Where things are

- Site: https://gcdatlas.vercel.app (Vercel project `gcdatlas`, deploys `main` automatically; every PR gets a preview URL).
- Repo: `eshin087/gcdatlas`. Source in `src/`, built by `node build.mjs` into `dist/`. Serverless functions in `api/` (`/api/sats` from CelesTrak, `/api/launches` from Launch Library 2).
- Content inventory: `docs/CATALOG.md` (generated). Backlog: `docs/CONTENT.md`. Plans: `docs/ROADMAP.md`.
- Tests: `npm test` (smoke, phone layout, camera motion), `npm run test:tour` (long regression), `npm run shots -- key:view`.

## History in brief

- 0.1 to 0.4: the ASCII WebGL pipeline, real star catalogue, planets from JPL elements, seamless zoom from Earth to the observable universe, the first objects and tour.
- 0.5: GitHub and Vercel, search, atlas, settings, scale ladder, music, the Halo ship.
- 0.6: themed tours with captions, size compare, time machine, share links.
- 0.7: content packs (nebulae, galaxies, extreme stars, black hole zoo), live Earth (satellites, launches), your sky, Earth's story, screensaver, photo mode, daily discovery, collection log, flybys, docs and tests.
- 0.7.1: phone layout and idle fade. 0.7.2: back to subtle black holes and the ASCII angle bar. 0.7.3: play / pause and angle loops, pitch-black shadows, Gaia BH1 and Cygnus X-1 fixes, the Sun's ejections, Halo beams, Solar System framing, smooth arrivals. 0.7.4: ride along with the redesigned Halo (chase and cockpit), a warm boiling Sun, JWST-style Pillars, fading labels, menu text size. 0.7.5: 16 new places and two tours, scenic travel, an enlarged Solar System overview, fiery stars, angle and scale-bar arrows.

Until 0.7.5 the code was pushed through the GitHub website from a cloud session, because that session had no git credentials (the commits on GitHub for 0.7.4 and 0.7.5 are several small upload commits per version for that reason). From Claude Code on the owner's machine, use git and `gh` directly: one commit per change, one PR per version.

## How the work was done (keep doing this)

1. When a request has open choices, ask 2 to 4 multiple-choice questions with a recommended option first, then build without further check-ins.
2. Build, then look: `npm run shots -- key:view,...` and read `tests/out/sheet.png`. Tune until it looks right, and check a phone size (`--phone`).
3. For quick experiments, write throwaway Playwright scripts as `tests/_name.mjs` (they reuse `tests/lib.mjs`), and delete them before committing. `__cosmos` has test hooks: `view(key, i)`, `tick(dt)`, `land()` (finish any multi-leg flight), `render()`, `setDays(d)` (move the Solar System clock), `stepObject`, `stepAngle`, `startShipCam`.
4. Performance check for new shaders: time a frame on SwiftShader and compare with existing heavy views (the Pillars are the heaviest, about 5 s per frame in headless tests; that is normal there).
5. Before shipping new facts, have a separate agent fact-check them against NASA/ESA/STScI sources. In 0.7.5 this caught 12 errors.
6. Update `docs/CHANGELOG.md`, `docs/ACCURACY.md` (anything illustrative), `docs/CATALOG.md` (`npm run catalog`), this file and `CLAUDE.md` gotchas, and bump `package.json`. Then open the PR, check the Vercel preview and merge.
7. The final report to the owner covers what changed, what was checked and one next step. No em dashes.

## Open items and ideas

- Content still open (`docs/CONTENT.md`): Vesta, Bennu, human spaceflight sites (Apollo, Mars rovers, Parker Solar Probe, Tiangong), 51 Pegasi b, K2-18 b, planet surfaces. Some tour stops already name future keys (`apollo11`, `parker`, `olympus`, `perseverance`, `vesta`, `peg51b`, `k218b`); they are skipped until those objects exist.
- Visual polish the owner asked for and may want more of: the Milky Way and the Pillars compared with the iconic images, and more ASCII fire and motion. The Einstein Cross images are subtle against the lens galaxy.
- The scenic waypoint picker (`scenicWaypoint` in `src/08-camera.js`) only triggers on some trips. Its thresholds can be tuned so more trips pass something.
- ASCII Earth phase 2 (landmarks, city scale), live sky events phase 2 (a toast when an ISS pass or launch is minutes away), Content Security Policy (`docs/ROADMAP.md`).
- The live API functions work in production (checked 2026-09-25: 16,619 satellites, 15 launches).

## Setting up Claude Code on the owner's Windows machine

1. Install Node.js 18 or newer, Git for Windows and the GitHub CLI (`winget install GitHub.cli`), then sign in: `gh auth login`.
2. Install Claude Code (current installer: https://docs.claude.com/en/docs/claude-code) and start it inside the project folder:
   ```
   cd "C:\Users\eshin\Desktop\Claude Code\gcdAtlas"
   claude
   ```
3. Once, in the folder: `npm install` (Playwright and sharp, for the tests), then `npm test`.
4. Optional, for logs and local API testing: `npm i -g vercel`, `vercel login`, `vercel link` (pick the existing `gcdatlas` project). Deploys do not need it: pushing to GitHub deploys.
5. First message to Claude Code, for example: *"Read CLAUDE.md and docs/HANDOFF.md, run npm test, then tell me what you would do next."*

## Shipping a version from Claude Code

```
git switch -c release/v0.7.6
# change, then: node build.mjs && npm test (and screenshots for anything visual)
# bump package.json, add a docs/CHANGELOG.md entry
git add -A && git commit -m "v0.7.6: ..."
git push -u origin release/v0.7.6
gh pr create --title "v0.7.6: ..." --body "What changed, what was checked"
# open the Vercel preview from the PR, check desktop and phone, then:
gh pr merge --merge --delete-branch
git switch main && git pull
```

To roll back a version: open its merged PR on GitHub and press *Revert* (or `git revert -m 1 <merge commit>`), then merge the revert PR.
