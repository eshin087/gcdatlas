# Content: what exists, what is next

## What is already in the atlas

**`docs/CATALOG.md` is the source of truth.** It is generated from the built page (`npm run catalog`), so it cannot drift from the code: every object with its key, name, group, category, distance, true size, number of camera angles, whether it has a flyby, and the file it is defined in. Check it before adding anything, and regenerate it after. Its section "Drawn, not in the atlas" lists the real objects the page draws but the atlas hides (`atlas:false`: M32 and M110 by Andromeda, NGC 3628, parts such as Alpha Centauri B and the Quintet's galaxies): to show one, take out its `atlas:false` instead of adding it again.

Three checks stop a duplicate (0.19.1): `addObj` throws on a key already taken, so the page does not start and every test fails; the smoke test fails when two listed objects hold one Messier, NGC, IC or Caldwell number in `aka` (`catClash` in `09-render.js`); and `npm run catalog` fails on the same, or when two listed objects match one checklist row. A part (M87*, the Pillars) leaves its parent's number out of its `aka`.

## The checklists the atlas follows (owner, 2026-10-04)

Deep-sky objects come from two public lists, so the atlas grows in a consistent, trackable order:

- **Messier** (110 objects, the classic list; SEDS, messier.seds.org) first, then
- **Caldwell** (109 objects, Patrick Moore, 1995: the bright objects Messier missed, both hemispheres).

Both lists are in `tools/data/deep-sky.mjs`. `npm run catalog` matches them against every object's `aka` and writes a done and missing table for each at the end of `docs/CATALOG.md`: an object counts once its `aka` holds the number (`m27`, `ngc 6853`; a Caldwell row counts by its NGC or IC number, or a `c63` in `aka`). So the missing rows are the to-do list, and nothing has to be ticked off by hand.

**SIMBAD** (CDS, simbad.cds.unistra.fr) is the authority for names, catalogue numbers and positions: take RA and Dec in degrees from it (`simbadPos` in `src/objects/p8-messier.js`) and put every Messier, NGC and IC number it lists for the object in `aka`. Distances and sizes come from the best current measurement (Gaia DR3 inside the Milky Way, Baumgardt & Vasiliev for globular clusters, Cosmicflows-4 or a direct method for galaxies), named in the readout and in `docs/ACCURACY.md`.

Everything the two lists do not cover stays on our own curated backlog below: black holes, planets of other stars, the Solar System, explosions, the largest structures, human-made things and Earth (`docs/EARTH_PLAN.md`).

## How to add a pack

1. Pick about 20 objects: from the empty checklist rows in `docs/CATALOG.md`, or from the curated backlog below. Mark the pack *in progress* here.
2. Create `src/objects/pN-name.js`. One pack per theme. Reuse helpers before writing new ones: `addGalaxy` (06g-galaxies.js) with `galAt` / `discR0` for a real position angle and tilt, `addGlobular`, `gaiaOpenCluster` (an open cluster from its Gaia members; its data from `tools/cluster-stars.mjs`), the star-nursery shader `FS_NURSERY` (p8-messier.js; kinds 0 to 3), `addRingPN` and `clusterPS` (p1-nebulae.js), `namedStar`, `addBody`, `addProbe`. A pack that draws from `rnd()` saves `seed` at its start and puts it back at its end.
3. Every object: real position (SIMBAD), true size, a sourced fact, a readout with numbers, 2 or 3 views including one close and dramatic, `aka` search words with its catalogue numbers (`m31 ngc 224`), a `sortKey`. Big objects: add them to `FLYBY_OBJ` in `src/objects/z8-flybys.js`.
   - Atlas place: `group` is its one heading (`GROUPS` in `src/09-render.js`: solar, comets, stars, worlds, nebulae, galaxies, cosmic, travel). `tags` put it in more kinds (`CATS`, the grid of filters in the atlas): `moons` (moons and small worlds), `events` (explosions and collisions), `clusters` (star clusters), `human` (human-made; `addProbe` adds it). Planets of other stars go in `worlds` (`exoPlanet` does this). When an object is not what its heading says, `atlasKind` sets its main kind (the S-stars sit under Galaxies & black holes but are `stars`); do not use `kind`, which is the surface shader's number on planets and moons.
4. Have a separate agent research the numbers and check the facts against NASA, ESA, SIMBAD and the papers before shipping (in 0.16.0 this corrected the distance or size of more than half of the 20).
5. Consider: a tour stop (`src/08t-tours.js`; Messier objects join the Messier marathon by themselves), a ship destination (`SHIP_TARGETS` in `src/07-extras.js`), a ladder rung (`LADDER` in `src/09-render.js`) for iconic scales.
6. Screenshot every view, `npm test`, `npm run catalog`, changelog line, patch notes.

## Backlog

Status: `planned`, `in progress`, `done` (then it appears in CATALOG.md and can be removed from here).

### From the checklists · planned (one pull request each, about 20 objects)
After 0.21.0, 28 Messier objects are left. In the order to take them:

| Pack | Objects |
| --- | --- |
| Messier 4: galaxies and the rest | the Virgo Cluster's M49, M58, M59, M60, M61, M85, M88, M89, M90, M91, M98, M99, M100; M94, M95, M96, M105, M102, M108, M109; the open clusters M18, M21, M26, M48, M50, M93 (a line each now: add them to `LIST` in `tools/cluster-stars.mjs`, run it, and call `gaiaOpenCluster`); the double star M40 and the asterism M73 |
| Caldwell 1: southern showpieces | 47 Tucanae (C106), the Jewel Box (C94), the Coalsack (C99), the Southern Pleiades (C102), the Wishing Well (C91), NGC 6397 (C86), NGC 6752 (C93), the Running Chicken (C100), NGC 3201 (C79), NGC 1851 (C73) |
| Caldwell 2: northern nebulae | the Double Cluster (C14), the North America Nebula (C20), the Crescent (C27), the Rosette (C49, C50), the Cocoon (C19), the Iris (C4), the Cave (C9), the Flaming Star (C31), Hubble's Variable Nebula (C46) |
| Caldwell 3: planetary nebulae | the Saturn Nebula (C55), the Eskimo (C39), the Ghost of Jupiter (C59), the Blue Snowball (C22), the Bug or Butterfly (C69), the Skull (C56), the Bow-Tie (C2), the Blinking Planetary (C15) |
| Caldwell 4: galaxies | the Needle (C38), NGC 891 (C23), the Whale (C32), the Fireworks (C12), the Hidden Galaxy (C5), NGC 1097 (C67), NGC 4945 (C83), NGC 300 (C70), NGC 55 (C72), the Spindle (C53) |

### Done in 0.23.0 (surfaces in `src/o00-sun.js`, the moons in `src/o10-planet.js`, the pairs in `src/o12-stars.js`)
Tethys, Dione and Rhea listed, each with a surface of its own (their features at the IAU gazetteer's positions) and its real place along its orbit; Capella and Spica listed, drawn as the pairs they are on their real orbits (with Capella Ab and Spica B, drawn, not listed).

### Done in 0.21.0 (`src/objects/p9b-messier3.js`)
The other 25 globular clusters, so all 29 of Messier's are in: M2, M5, M9, M10, M12, M14, M15 (with the planetary nebula Pease 1), M19, M28, M30, M53, M54, M55, M56, M62, M68, M69, M70, M71, M72, M75, M79, M80, M92, M107, each shaped by its measured core, half-light radius, ellipticity, metallicity and horizontal branch (`glob3Stars`). Listed in the atlas: Ganymede, Callisto, Canopus, Tau Ceti and the eight Local Group dwarfs of 06g-galaxies.js (the Sagittarius, Fornax, Sculptor and Draco dwarfs, Leo I, Barnard's Galaxy NGC 6822 (C57), IC 1613 (C51) and WLM), each drawn as what it is (`DWARF_LOOK`). Still drawn but not listed: Tethys, Dione and Rhea (one shared icy surface, without the features their texts name) and Capella and Spica (each a pair of stars, drawn as one).

### Done in 0.18.0 (`src/objects/p9-messier2.js`)
M76, M78, M24 (and NGC 6603, drawn, not listed), M6, M23, M25, M29, M34, M35, M36, M37, M38, M39, M41, M46, M47, M52, M67, M103; every open cluster drawn from its Gaia members (`gaiaCluster`).

### Done in 0.16.0 (`src/objects/p8-messier.js`)
The checklists and the Messier marathon tour; M27, M97, M20, M17, M44, M11, M7, M3, M4, M22, M63, M64, M83, M77, M65, M66 (and NGC 3628, drawn, not listed), M106, M74, M84, M86.

### Done in 0.9.0 (`src/objects/p7-places.js`, Mimas in `src/o10-planet.js`)
Vesta, Bennu, Mimas and its crater Herschel, 51 Pegasi b, K2-18 b, HD 189733 b, Gaia BH3, T Coronae Borealis, the Lagoon Nebula, the Great Hercules Cluster (M13); the Other worlds heading and the moons, events, clusters and human-made chips.

### Curated · planned (beyond the checklists; the version numbers they were first planned under were used for other releases)
| Pack | Objects |
| --- | --- |
| human reach | Parker Solar Probe, Tiangong (its elements already come from `/api/sats`), our radio bubble (about 212 light-years across, worked out from the date; its star count computed once), the Arecibo message on its way to M13 (illustrative), a "human reach" tour. (The Tesla Roadster with Starman was done in 0.9.5, with SpaceX's rockets.) |
| surfaces | a terrain shader for patches you can fly low over; Olympus Mons, Tranquility Base and the other landing sites, Perseverance in Jezero, Valles Marineris, Io's and Enceladus's plumes (both readouts already mention them), Didymos and Dimorphos |
| the biggest things | Laniakea (real Cosmicflows-4 flows), the Virgo Cluster (its Messier galaxies come in Messier 4), the Hercules-Corona Borealis Great Wall (labelled debated), Porphyrion, GRB 221009A, the heliosphere |

### Comets and meteors · first pack done in 0.8.1 (`src/objects/p6-comets.js`), more planned
| Object | Notes |
| --- | --- |
| 2I/Borisov | the second interstellar object (2019), a clearly active comet |
| Tempel 1 and Wild 2 | Deep Impact's crater (2005) and Stardust's sample (2004) |
| Comet Lovejoy (C/2011 W3) | the Kreutz sungrazer that survived the Sun, then broke up. Overlaps: "lovejoy" is already in the Kreutz sungrazers' `aka` (`kreutz`, p6-comets.js), and its replay already shows a big one surviving now and then. Make it its own object only with its own orbit and look, and then take "lovejoy" out of `kreutz`'s `aka` |
| Geminids and 3200 Phaethon | a meteor shower from an asteroid-like parent |
| Orionids and Eta Aquariids | the two showers from Halley's Comet (its orbit is already drawn) |

### Human spaceflight · planned (see "human reach" and "surfaces" above)
| Object | Notes |
| --- | --- |
| Apollo landing sites | markers on the Moon (11, 12, 14, 15, 16, 17) |
| Perseverance | Jezero crater, Mars (18.44°N, 77.45°E) |
| Curiosity | Gale crater, Mars (4.59°S, 137.44°E) |
| Parker Solar Probe | its closest passes, 6.1 million km from the Sun's surface; the fastest object ever built |
| Tiangong | model (currently label only via live data) |

### Other worlds · ideas (the NASA Exoplanet Archive is their reference)
| Object | Notes |
| --- | --- |
| TOI-700 d, LHS 1140 b | temperate rocky worlds |
| WASP-76 b | the planet where it may rain iron |

### Planet surfaces · planned (the IAU Gazetteer of Planetary Nomenclature is their reference)
| Object | Notes |
| --- | --- |
| Olympus Mons | low flyover view on Mars |
| Valles Marineris | canyon system |
| Io's plumes | volcanic plumes rising 300 km |
| Lunar craters | Tycho and Copernicus close-ups |

### Earth, closer
Planned and tracked in `docs/EARTH_PLAN.md` (the real Earth, its cities and famous places, live data).

### Deep sky ideas beyond the checklists · planned
| Object | Notes |
| --- | --- |
| Sombrero, Whirlpool detail passes | dust ring, pink HII regions (partly done in 0.7) |
| Crab Nebula filaments | pulsar wind nebula glow |
| Phoenix Cluster | galaxy cluster (El Gordo is done) |
| Hercules–Corona Borealis Great Wall | biggest structure claim (with the caveat that it is debated) |
| Magnetar SGR 1935+2154 | fast radio burst source |
