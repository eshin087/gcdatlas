# Architecture

How gcdatlas is put together, for anyone (human or Claude) changing it.

## 1. Build

`build.mjs` has no dependencies. It reads every `src/*.js` and `src/objects/*.js`, sorts them by rank, concatenates them into one script, checks the syntax with `vm.Script`, and writes:

- `dist/index.html`: the website (doctype, meta tags, favicon, `00-head.html` styles, `01-body.html` markup, the script).
- `dist/artifact.html`: the same page without the document wrapper, for embedding as a claude.ai artifact.

Rank order: `02` core → `03` shared GLSL → `04` world → `05` data → `06*` sky, galaxies, universe → `o*.js` built-in objects → `src/objects/*` packs → `07*` extras and music → `08*` camera and tours → `09*` render and interface → `99-close.js`. The whole bundle is one IIFE: `02-core.js` opens it, `99-close.js` closes it, so every file shares one scope without leaking globals (test hooks are exported deliberately on `window.__cosmos`).

Serverless functions in `api/` are deployed by Vercel alongside the static page. Files in `api/_lib/` are shared helpers, not endpoints.

## 2. Coordinates and precision

- World units are light-years in a heliocentric galactic frame. `radec(raHours, decDeg, distLy)` converts catalogue positions.
- Every object has `pos` (world) or `parent` + `offset` (relative, updated each frame). `rad` is its bounding radius; `R0` its orientation frame.
- The camera is **focus-relative**: `cam.focus` is an object index and `cam.rel` is the camera position relative to that object. Every frame each object gets `o.rel = frel(o) - cam.rel`, a small vector even when the universe spans 10^11 light-years. The GPU never sees absolute coordinates, so a space station 50 m across and a galaxy cluster share one scene without precision loss.

## 3. Rendering pipeline (per frame)

1. **Background** (`FS_BG`): the star field and distant galaxies seen from the camera's position (inside the Milky Way the band of the galaxy comes from a texture). Writes zero alpha.
2. **Objects**, far to near (sorted by layer, then distance). For each visible object:
   - `drawVolume`: a full-screen-rect draw clipped to the object's bounding sphere, running the object's fragment shader (`prog`). Shaders ray-march or ray-trace inside the unit sphere (`localRay`), accumulate emission and transmittance, and output colour plus coverage (`outCol`). Black holes integrate null geodesics; stars, planets, nebulae and galaxies are procedural volumes.
   - Particle systems (`particles`): points and lines with per-system vertex programs (`particleVS(body)`), for stars in galaxies, gas streams, debris, satellites, orbit lines, grids.
   - Distant objects collapse into **impostor dots** (a single batched draw); farther dots are flushed before each opaque volume so shadows cover them.
3. **Cell pass** (`FS_CELL`): the HDR scene is sampled at the character grid (it is rendered at 2x). Each cell picks a glyph from a ramp ordered by measured ink coverage, or a directional glyph (`- / | \`) along silhouettes; faint haze is dithered so it shimmers. Opaque unlit cells are marked **void** (glyph 255): no glyph and no glow.
4. **Glow**: a separable blur of the tone-mapped scene.
5. **Final** (`FS_FINAL`): glyphs from the atlas texture, coloured per cell, over the glow.
6. `afterFrame` hook: runs once right after drawing (used by photo mode to read the canvas and the glyph grid).

The glyph atlas is built from printable ASCII in the page font at the current cell size; detail levels change the cell size.

## 4. Performance and scaling

- **Lazy shader compilation** (`program()`, `progReady()`): programs compile the first time their object is about to be seen, in the background where `KHR_parallel_shader_compile` exists. Until ready, the object shows as its impostor dot.
- **Visibility-gated simulation**: objects with `sim` only run `update()` while visible, locked or being toured (`simActive`).
- **Level of detail**: ray-march step counts scale with on-screen size (`uLod`) and with `LODK`, which the main loop lowers automatically on slow devices before it ever raises the character size.
- **Impostors**: anything smaller than a few pixels is one glowing point in one batched draw.
- Adding objects costs almost nothing while they are off screen: a position update and a distance check.

## 5. Object definition

```js
addObj({
  key:'crab', name:'Crab Nebula', label:'Crab', type:'supernova remnant · M1', group:'nebulae',  // group: solar, comets, stars, nebulae, galaxies, cosmic, travel
  fact:'One or two true sentences a visitor reads.',
  pos:radec(hms(5,34,31.9), dms(22,0,52), 6500), rad:5.5, R0:facingEarth(pos, [0,0,1], 0),
  prog:program(VS_RECT, FS_MY_SHADER),           // optional volume shader
  setU(pr){ gl.uniform4f(pr.u.uP0, ...); },       // per-frame uniforms (uP0..uP4)
  particles:[{ ps, prog:'ptBasic', mode:1, sb:1, size:1.6 }],
  views:[{ d:[0,0.2,1], k:1.6, hold:9, drift:0.02 }, { d:[...], k:0.6, off:[...], hold:8, drift:0.03 }],
  update(dt){ ... }, sim:state,                   // optional CPU simulation (paused while not visible)
  readout:() => 'a live line of numbers\na second line',
  aka:'search words', sortKey:6500, minZoom:0.1, pxMin:6, farColor:[1,0.8,0.6], farLum:0.5, labelRange:3e4,
});
```

Views: `d` direction in the object frame, `k` distance in bounding radii, `off` look-at offset, `hold` seconds, `drift` orbit speed. A view with `to:{...}` is a camera move (flyby) played over its hold; `offW:'dist'` keeps the subject in frame on long pull-backs.

Helpers: `addStar`, `namedStar`, `addBody` (planets and moons with IAU rotation), `addGalaxy` (parametric spiral/elliptical/ring), `addProbe` (spacecraft models), `addMarker` (labels only), `clusterPS`, `makeSpikes`, `orbitLine`, `addComet` and `addShower` (`src/objects/p6-comets.js`).

Objects that stand for a past moment or a replay (the comets frozen at their best, Shoemaker-Levy 9, the Kreutz sungrazers) only show while you visit them: `presence(o, [...])` eases `o.present` toward 1 when the camera is about the object, and `inRange` hides it otherwise. Such an object can give `distNow()` (light-years from Earth today), which the atlas and the catalogue use instead of its drawn position.

## 6. Camera, flights, tours

- `orbit` (yaw, pitch, dist, target, frame) drives the camera around the locked object; `applyOrbit()` builds the basis. `skyCamera()` replaces it in planetarium mode.
- `startFlight(o, viewParams)` flies with a van Wijk–Nuij zoom-and-pan path; duration depends on the travel setting.
- Tours (`08t-tours.js`): named lists of stops with captions. `tourGo`, `updateTour` (holds and swings between views, plays flyby moves), `stopTour` remembers `tour.last` for *resume tour*.

## 7. Interface modules

- `09-render.js`: HUD, labels (with occlusion and interface avoidance), ruler, scale ladder (and its tour-track mode), atlas (sort/filter/search), settings, compare, time machine, share links, main loop.
- `09f-features.js`: collection log and badges, today's discovery, screensaver, photo mode.
- `09g-sky.js`: your sky (planetarium), tonight's events, Earth's story.
- `08-camera.js` also holds the *angle loop* (`show`, `startShow`, `updateShow`, `resumeShow`) that plays a picked object's views round and round, `togglePlay` behind the play / pause button and the space bar (`motion.last` remembers whether play brings back the tour or the loop), and view `track()` for angles that follow a moving direction. Flights re-aim at the destination's current position every frame (`Bnow`) and ease to a stop.
- Particles (`particleVS` in `03-glsl-common.js`) hide anything behind or inside the black hole with the biggest shadow on screen (`uHole`, chosen each frame by `pickHole`), and a body can set `pSize` so points grow with the patch they stand for.
- `09h-ui.js`: interface comfort. The info panel's three states (full, compact, hidden; `I`), the phone layout (dock, swipeable info card, scale chip that opens the ladder, `--dock-h`/`--sheet-h` measured for everything that stacks above them), fading the interface when idle (`SET.fadeUI`; the first tap after a fade only wakes it, via `wakeTapAt`), and re-framing on phones: `viewShift` turns the camera slightly in `setBasis` so the object sits in the middle of the space the interface leaves free. The phone breakpoint lives in `COMPACT_MQ` (`src/04-world.js`) and must match the CSS media queries in `00-head.html`.
- `07m-music.js`: the generative soundtrack (a 16th-note sequencer with a small synthesiser; styles lofi, house, ambient).

## 8. Live data

- `/api/sats`: fetches CelesTrak's active satellites (OMM JSON), converts each to 7 numbers at a shared reference time (`api/_lib/orbits.js`), cached 6 h at the edge. The page animates them on the GPU with two-body motion plus J2 drift.
- `/api/launches`: next launches from Launch Library 2, cached 1 h.
- The page only calls these when served over http(s) from its own origin, with a timeout, and falls back to representative data. See `docs/SECURITY.md`.

## 9. State and persistence

`localStorage` keys (all prefixed `gcdatlas.`): `settings`, `atlas`, `seen`, `badges`, `dailyLog`, `dailySeen`, `where`, `flags`. Nothing is sent to a server.
