# gcdatlas

**The real universe, drawn entirely in ASCII.** Live at **https://gcdatlas.vercel.app**

gcdatlas is an explorable atlas of the known universe where every frame is made of printable ASCII characters. Planets are where they are today, about 2,000 naked-eye stars sit at their measured distances, and one continuous zoom takes you from Earth's surface to the edge of the observable universe.

- Denser glyphs mean more light. Colour comes from the physics: blackbody temperature, Doppler shift, emission lines.
- Black holes bend light (Schwarzschild ray tracing), galaxies collide (N-body), binary stars trade gas across the Roche lobe, neutron stars merge and ripple spacetime.
- The Halo, a starship that wanders between wonders, is the one invented thing here.

## Features

- **Search and atlas**: type in the search box (or press `/`) to find anything; the atlas stays open while you hop between places, with the current one highlighted.
- **Scale ladder**: the rungs on the right run from the Moon to the observable universe. Drag the marker to zoom; let go near a rung, or click one, to fly there at that scale.
- **Ruler**: the bar under the description equals the stated distance at the object you are looking at.
- **Settings**: detail (character size), travel speed (cinematic, quick, warp), time speed, glow, labels, star twinkle, ship finder, music and volume. Remembered between visits.
- **Soundtrack**: ambient music generated live in the browser (slow pads over a low drone, distant chimes, faint space wind), so it never repeats. Starts on your first click; `M` or the sound button turns it off.
- **The Halo**: a crescent flagship that folds space from wonder to wonder. The ship finder brackets it on screen or points to it from the screen edge; click either to follow it.

## Controls

| Input | Action |
| --- | --- |
| drag | orbit the camera |
| scroll / pinch / + - | zoom, from a moon to the observable universe |
| right-drag / shift-drag | pan |
| click or tap | fly to an object |
| `/` or the search box | find anything |
| `[` `]` | previous / next tour stop |
| W A S D, R F | fly freely |
| space | start or pause the guided tour |
| esc | close panels, then free camera |
| V · Y · T | detail · travel speed · time speed |
| G · L · M | glow · labels · music |

## Build and run

No dependencies. Node 18 or newer:

```sh
node build.mjs          # writes dist/index.html
npx serve dist          # or open dist/index.html directly
```

Vercel runs the same build (see `vercel.json`); every push to `main` redeploys the site.

## How it works

One WebGL2 page, built by concatenating `src/` in order:

| File | Role |
| --- | --- |
| `00-head.html`, `01-body.html` | styles and interface markup |
| `02-core.js` | WebGL helpers, maths, noise texture, particle buffers, the glyph atlas |
| `03-glsl-common.js` | shared shader code and the ASCII pipeline (cell, glow and composite passes) |
| `04-world.js` | units and coordinates, ephemerides, the object registry |
| `05-data.js` | generated star catalogue and textures (see `tools/`) |
| `06*.js` | the sky, the Milky Way, galaxies, the cosmic web |
| `o*.js` | objects, one family per file |
| `07*.js` | the Halo, comets, meteors and other transient events; `07m-music.js` is the soundtrack |
| `08-camera.js` | camera, flights, tour, input |
| `09-render.js` | frame rendering, labels, atlas, scale ladder, main loop |

The rendering pipeline: the scene is ray-marched into an HDR buffer at twice the character grid, each cell picks a glyph by measured ink coverage (or an edge glyph `- / | \` along silhouettes), a soft glow is blurred underneath, and the glyphs are composited at full resolution.

Large distances stay precise because the camera is positioned relative to the object it is looking at, never in absolute coordinates on the GPU.

## Adding an object

New objects can go in `src/objects/` (loaded after the built-in `o*.js` files, in name order). An object is one `addObj({...})` call, or `addStar`, `addBody` or `addGalaxy` for the common kinds:

```js
addStar({ key:'vega', name:'Vega', type:'A0V star · Lyra', group:'stars',
  fact:'One or two true, vivid sentences.',
  pos:radec(hms(18,36,56.3), dms(38,47,1), 25), R:2.36, T:9602,
  views:[{ d:[0, 0.3, 1], k:2.2, hold:9, drift:0.03 }] });
```

- `pos` is in light-years (heliocentric galactic coordinates); `radec(raHours, decDegrees, distanceLy)` converts catalogue positions.
- `views` are the tour's camera angles: `d` direction in the object's frame, `k` distance in object radii, `off` look-at offset, `hold` seconds, `drift` slow orbit speed. Give every object one close, dramatic angle.
- `group` puts it in the atlas (`solar`, `stars`, `nebulae`, `galaxies`, `cosmic`, `travel`); `aka` adds search words.

It scales: shaders compile only when an object is about to be seen (in the background where the browser supports it), CPU simulations pause while their object is off screen, distant objects draw as single glowing points, and the renderer trims ray-march steps before lowering detail on slower devices.

## Data and credits

- Star positions and parallaxes: Hipparcos, via [star-catalog-lite](https://www.npmjs.com/package/star-catalog-lite)
- Star colours, constellation lines and the Milky Way outline: [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn
- Earth's coastlines: [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas)
- Planet orbits: JPL approximate Keplerian elements; body orientations: IAU WGCCRE

To regenerate `src/05-data.js`: `cd tools && npm install && npm run all`.
