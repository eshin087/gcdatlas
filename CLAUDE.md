# CLAUDE.md: working on gcdatlas

This file is read automatically by Claude Code at the start of every session. It is the short, authoritative guide to how this project is built and changed. Longer explanations live in `docs/`. **New session? Read `docs/HANDOFF.md` first**: the owner's preferences, decisions that were tried and reversed, and how to ship.

## Start here

State on 2026-09-25: **v0.7.5 is live** and `main` is in sync, so the next release is **v0.7.6**. Read `docs/HANDOFF.md`, which covers the owner's preferences, decisions not to undo, how the work is done and the open ideas. Then run `npm install` (first time only) and `npm test`. Use git and `gh` directly: branch `release/vX.Y.Z`, open a PR, check the Vercel preview, then merge with a merge commit.

## What this is

gcdatlas (https://gcdatlas.vercel.app, repo `eshin087/gcdatlas`) is a single-page WebGL2 atlas of the universe rendered entirely as ASCII characters. Real positions, distances and sizes; physically based, artistic rendering. It is meant to be a long-term project that keeps growing (more objects, an ASCII Earth, social features later) without breaking what exists.

## Golden rules

1. **Never break the build or the page.** Run `node build.mjs` (it syntax-checks the bundle) and `npm test` before every commit. Look at screenshots of anything visual you touched (`npm run shots -- key:view`).
2. **One self-contained page.** No runtime frameworks, no bundler, no external JS/CSS at runtime (Google Fonts is the only exception, and the page must still work without it). Everything is concatenated by `build.mjs`.
3. **New features ship behind a flag** (`FLAGS` in `src/04-world.js`, see `docs/FEATURE_FLAGS.md`) when they are experimental, touch the network, or could be scrapped. Default experimental flags to `false`.
4. **Performance is a feature.** Keep 60 fps on a mid-range laptop. Objects compile shaders lazily, CPU sims only run while visible (`sim` + `simActive`), far objects are single impostor dots. Never add per-frame work that scales with the total object count beyond a cheap loop.
5. **Honesty about accuracy.** Real data stays real; anything illustrative, magnified, sped up or simulated says so in its readout or fact. Update `docs/ACCURACY.md` when you add something that is not measured data.
6. **Privacy.** Nothing about the visitor leaves their device. Settings, location, collection log and daily streak live in `localStorage` under `gcdatlas.*`. The only network calls are the fonts and our own `/api/*` functions.
7. **Writing style for anything a visitor reads**: short, concrete, true sentences; no em dashes; plain words over jargon; numbers with units.

## Commands

```sh
node build.mjs                 # build dist/index.html (+ dist/artifact.html); fails on syntax errors
npm test                       # smoke test + phone layout test (tests/smoke.mjs, tests/mobile.mjs)
npm run test:mobile            # just the phone layout (390 x 844 and 844 x 390)
npm run test:tour              # long tour regression (tests/tour.mjs)
npm run shots -- sun:0,crab:1  # screenshots into tests/out/ (+ a contact sheet)
npm run catalog                # regenerate docs/CATALOG.md from the built page
npx vercel dev                 # local server with the /api functions
```

Tests need `npm install` once (dev dependencies: playwright, sharp). Headless Chromium runs WebGL through SwiftShader, which is slow: simulations run at a lower frame rate in tests, so use `__cosmos.simulate(seconds)` or step `o.update()` for deterministic checks.

## Architecture in one screen

- `build.mjs` concatenates `src/**/*.js` in rank order into one IIFE (opened in `02-core.js`, closed in `99-close.js`). Order: core (02) → GLSL (03) → world (04) → data (05) → sky/galaxies (06*) → objects (`o*.js`, then `src/objects/*`) → extras/music (07*) → camera/tours (08*) → render/UI (09*) → close (99).
- Rendering: each object is a ray-marched volume inside a bounding sphere (`prog`, drawn by `drawVolume`) and/or particle systems (`particles`). The scene renders to an HDR buffer at 2x the character grid; `FS_CELL` picks a glyph per cell; a blur adds glow; `FS_FINAL` composites glyphs. Opaque unlit cells are marked void (no glow bleeds into black hole shadows).
- Camera: focus-relative (the camera position is stored relative to the object it looks at), so light-years and metres coexist. Flights use van Wijk–Nuij paths. `SKYV` switches to the planetarium camera.
- Objects: `addObj({...})` and helpers (`addStar`, `addBody`, `addGalaxy`, `namedStar`, `addProbe`). Required: `key`, `name`, `type`, `group`, `pos` (light-years, galactic frame) or `parent`+`offset`, `rad`, `views`. See `docs/ARCHITECTURE.md` → "Object definition".
- UI state: `SET` (settings, persisted), `FLAGS` (feature flags), `tour`, `orbit`, `cam`. Test hooks on `window.__cosmos`.

## Adding content (the most common task)

1. Check `docs/CATALOG.md` (generated) and the backlog in `docs/CONTENT.md` so you do not duplicate an object.
2. Put new objects in a pack file under `src/objects/` (e.g. `p5-exoplanets.js`). Reuse shared shaders where possible; a new shader is fine but keep ray-march loops bounded (`uLod` scales steps).
3. Give every object: a true one- or two-sentence `fact`, a `readout` with a real number, 2–3 `views` (one close and dramatic), `aka` search words, and a `sortKey`.
4. Build, screenshot every view, run `npm test`, then `npm run catalog` and commit the updated `docs/CATALOG.md`.

## Workflow (see docs/SDLC.md)

- **Every version is a pull request** (`release/vX.Y.Z` into `main`, merge commit) so it can be reverted in one click. Work goes to the local folder first, then the branch is pushed. Vercel builds a preview for every PR; check it on desktop and phone before merging.
- Update `docs/CHANGELOG.md` under "Unreleased" with every user-visible change.
- `main` is always deployable; releases are tagged `vX.Y.Z` (bump `package.json`).

## Gotchas

- Do not name a local variable `P` inside object files: `P` is the global shader program registry (`P.blackhole`, `P.ptBasic`…). This has bitten before (black holes silently vanished).
- Labels show and hide with the `on` class (CSS fades them); do not set `style.visibility` on them. Labels of other objects are kept off the locked object's disc (`overFocus` in `updateLabels`).
- The Halo has its own camera (`shipCam` in `08-camera.js`): while riding, `updateShipCam` replaces the orbit camera, and any flight or manual input hands the camera back.
- Objects added after start-up need a label element (`labelEls[o.index]`) because labels are created once at init.
- `afterFrame` (in `09-render.js`) runs once right after a frame is drawn; use it to read the canvas (photo mode).
- WebGL points/lines are not depth-tested against volumes. Black holes are handled for every particle system (`uHole` in `particleVS`); for other opaque bodies hide what should be behind them in the vertex shader (see the satellites in `src/objects/e1-earth-live.js`).
- A volume is only drawn inside the screen rectangle around its bounding sphere (`rad`). Anything a shader draws beyond `rad` gets cut along that rectangle, which moves with the camera: fade effects out before they reach the bound (see the Sun's coronal mass ejections).
- Long flights go through `flyTo` (it may add a leg past a real object, `scenicWaypoint`); tests should wait with `__cosmos.land()`, not a fixed flight duration. Objects that should never be a waypoint set `noWaypoint`.
- In the Solar System overview bodies are enlarged (`SYSMAG`, `o.mag`); use `o.rad*magOf(o)` for anything drawn or picked on screen, and `o.rad` for physics.
- Picked objects play their views in a loop (`show` in `08-camera.js`); give every object views that work one after another, not only as tour stops.
- The artifact build (`dist/artifact.html`) runs without `/api`, so live features must degrade gracefully.
- Phones get their own layout (dock, info card, scale chip; `src/09h-ui.js`). The breakpoint is `COMPACT_MQ` in `src/04-world.js` and the matching `@media` blocks at the end of `00-head.html`; change both together. Anything new that sits at the bottom of the screen on a phone should stack above `var(--dock-h)` + `var(--sheet-h)`, and anything that should fade when idle goes in the `body.ui-idle` rule.
