# gcdatlas

**The real universe, drawn entirely in ASCII.** Live at **https://gcdatlas.vercel.app**

gcdatlas is an explorable atlas of the known universe where every frame is made of printable ASCII characters. Planets are where they are today, about 2,000 naked-eye stars sit at their measured distances, every active satellite circles the Earth, and one continuous zoom takes you from a city street's worth of sky to the edge of the observable universe.

- Denser glyphs mean more light. Colour comes from the physics: blackbody temperature, Doppler shift, emission lines.
- Black holes bend light (Schwarzschild ray tracing) above the true shape of their curved space (Flamm's paraboloid). Galaxies collide, binary stars trade gas, a star is torn apart, two black holes merge and ripple spacetime.
- The Halo, a long-range cruiser with a captured star for a heart, is the one invented thing here. Ride along behind it, or from its bridge.

How accurate is it? See [docs/ACCURACY.md](docs/ACCURACY.md). The short version: positions, distances and sizes are real; the look of each object is a physically based artist's rendering.

## Features

| | |
| --- | --- |
| **Atlas and search** | Type in the search box (or press `/`). Sort by distance, size or name, filter by kind (black holes, nebulae…), see what you have not visited yet, reset in one click. |
| **Tours** | Guided tours with captions. The play / pause button at the top right stops the camera so you can look around, and brings it back. `‹ ›` next to *tours* skip stops; while a tour plays the right-hand scale becomes the tour's track. Break away and *resume tour* takes you back. Choose how long each stop lasts. |
| **Flybys** | Sweeping camera moves past the giants (the Sun, UY Scuti, TON 618, the Milky Way…) that show their scale. |
| **Scale ladder** | Drag the marker to zoom from the Moon to the observable universe; let go near a name to fly there. |
| **Time machine** | Run the Solar System clock forwards or back, jump years, or drag deep time to watch the constellations change over ±200,000 years. |
| **Tonight** | *Your sky*: stand at your location and look up at the real sky. What is up tonight: Moon phase, bright planets, ISS passes, launches, meteor showers, eclipses. |
| **Earth's story** | 4.54 billion years on one slider: magma ocean, snowball Earth, the first forests, the asteroid, the first humans, today. |
| **Live Earth** | Every active satellite from CelesTrak's tracking data, the ISS and Hubble at their real positions, the next rocket launches at their pads, air traffic on real routes (simulated). |
| **Screensaver** | Full screen, the interface fades, an endless shuffled tour plays with the music (`Z`). Can start by itself after a few idle minutes. |
| **Photo mode** | Frame a shot, save it as a picture or copy it as ASCII text (`P`). |
| **Today's discovery** | One object a day, the same for everyone, with a streak. |
| **Collection log** | Ticks off what you have seen, with badges. Stored only on your device. |
| **Music** | gcd radio: a generative mix of lofi, chill house and ambient, synthesised live so it never loops. Pick a style or skip a track. |
| **Share** | Links reproduce your exact view, tour and date. |
| **Calm interface** | Fades after a few quiet seconds (sooner on tours) and comes back with any touch. The info panel can be full, compact or hidden (`I`). |
| **Phones** | A thumb-sized dock, the details as a card you can expand, shrink or swipe away, the scale ladder behind a chip, and the camera frames the object in the space left free. Works upright and on its side. |

## Controls

| Input | Action |
| --- | --- |
| drag | orbit the camera (in *your sky*: look around) |
| scroll / pinch / + - | zoom |
| right-drag / shift-drag | pan |
| click or tap | fly to an object; once there it loops through its best angles until you take the camera |
| `/` | search |
| `[` `]` | previous / next tour stop |
| W A S D, R F | fly freely |
| space or ❚❚ / ▶ (top right) | pause or play: the tour, or the angle loop of an object you picked |
| esc | close panels, then free camera |
| V · Y · T | detail · travel speed · time speed |
| G · L · M | glow · labels · music |
| Z · P · B | screensaver · photo mode · your sky |

## Build and run

```sh
node build.mjs          # writes dist/index.html (no dependencies, Node 18+)
npx serve dist          # or open dist/index.html directly (live data needs the /api functions, see below)
npx vercel dev          # the site plus the /api functions, as in production
```

Vercel runs the same build (see `vercel.json`); every push to `main` redeploys the site, and every pull request gets its own preview URL.

Tests (Playwright, headless Chromium):

```sh
npm install             # dev dependencies only: playwright, sharp
npm test                # smoke test: loads, renders every object, no errors
npm run test:tour       # plays the grand tour for 1,000 simulated seconds
npm run shots -- sun:0,ton618:1     # screenshots of any objects / angles into tests/out/
npm run catalog         # regenerates docs/CATALOG.md, the list of everything implemented
```

## Where things are

| Path | Role |
| --- | --- |
| `src/00-head.html`, `src/01-body.html` | styles and interface markup |
| `src/02-core.js` … `src/04-world.js` | WebGL helpers, shared shader code and the ASCII pipeline, units, ephemerides, settings, feature flags, the object registry |
| `src/05-data.js` | generated star catalogue and textures (`tools/`) |
| `src/06*.js`, `src/o*.js` | the sky, galaxies, the cosmic web, and the built-in objects (one family per file) |
| `src/objects/` | content packs and add-ons (nebulae, galaxies, extreme stars, the black hole zoo, flybys, live Earth) |
| `src/07*.js` | the Halo, transient events, music |
| `src/08*.js` | camera, flights, tours, input |
| `src/09*.js` | rendering, interface, atlas, features (screensaver, photo, collection, tonight, Earth's story) |
| `api/` | serverless functions: `/api/sats` (CelesTrak), `/api/launches` (Launch Library 2) |
| `tests/`, `tools/` | test harness, catalogue and data generators |
| `docs/` | architecture, accuracy, workflow, testing, security, roadmap, changelog, content catalogue |

Start with [CLAUDE.md](CLAUDE.md) (working conventions) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Data and credits

- Star positions and parallaxes: Hipparcos, via [star-catalog-lite](https://www.npmjs.com/package/star-catalog-lite); colours, constellation lines and the Milky Way outline: [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn
- Earth's coastlines: [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas)
- Planet orbits: JPL approximate Keplerian elements; body orientations: IAU WGCCRE
- Satellites: [CelesTrak](https://celestrak.org/) general perturbations data; launches: [The Space Devs](https://thespacedevs.com/) Launch Library 2
- Object facts and measurements: NASA, ESA, ESO and the published literature (see docs/ACCURACY.md)
