# Content: what exists, what is next

## What is already in the atlas

**`docs/CATALOG.md` is the source of truth.** It is generated from the built page (`npm run catalog`), so it cannot drift from the code: every object with its key, name, group, category, distance, true size, number of camera angles, whether it has a flyby, and the file it is defined in. Check it before adding anything, and regenerate it after.

## How to add a pack

1. Pick objects from the backlog below and mark them *in progress* here.
2. Create `src/objects/pN-name.js`. One pack per theme. Reuse helpers (`namedStar`, `addGalaxy`, `addBody`, `addProbe`, `clusterPS`, `orbitLine`) and shared shaders before writing new ones.
3. Every object: real position (`radec` with catalogue RA/Dec and distance), true size, a sourced fact, a readout with numbers, 2–3 views including one close and dramatic, `aka` search words, a `sortKey`. Big objects: add them to `FLYBY_OBJ` in `src/objects/z8-flybys.js`.
4. Consider: a tour stop (`src/08t-tours.js`), a ship destination (`SHIP_TARGETS` in `src/07-extras.js`), a ladder rung (`LADDER` in `src/09-render.js`) for iconic scales.
5. Screenshot every view, `npm test`, `npm run catalog`, changelog line.

## Backlog

Status: `planned`, `in progress`, `done` (then it appears in CATALOG.md and can be removed from here).

### Small worlds · planned
| Object | Notes |
| --- | --- |
| Ceres | dwarf planet in the asteroid belt; Occator's bright salt spots |
| Vesta | Rheasilvia impact basin with its central peak |
| Bennu | rubble-pile asteroid sampled by OSIRIS-REx |
| Arrokoth | contact binary in the Kuiper belt (New Horizons, 2019) |
| Halley's Comet | orbit to 2061 perihelion; dust and ion tails |
| 'Oumuamua | the first interstellar object (2017), on its hyperbolic path |

### Human spaceflight · planned
| Object | Notes |
| --- | --- |
| Apollo landing sites | markers on the Moon (11, 12, 14, 15, 16, 17) |
| Perseverance | Jezero crater, Mars (18.44°N, 77.45°E) |
| Curiosity | Gale crater, Mars (4.59°S, 137.44°E) |
| Parker Solar Probe | orbit with 6.9 million km perihelia; the fastest human-made object |
| Tiangong | model (currently label only via live data) |

### Exoplanets · planned
| Object | Notes |
| --- | --- |
| 51 Pegasi b | the first planet around a Sun-like star (1995) |
| HR 8799 | four directly imaged giant planets |
| K2-18 b | sub-Neptune in the habitable zone; JWST chemistry |
| KELT-9 b | the hottest known planet (~4,300 °C day side) |
| 55 Cancri e | lava world |
| Kepler-16 b | the real "Tatooine": orbits two stars |

### Planet surfaces · planned
| Object | Notes |
| --- | --- |
| Olympus Mons | low flyover view on Mars |
| Valles Marineris | canyon system |
| Io's plumes | volcanic plumes rising 300 km |
| Lunar craters | Tycho and Copernicus close-ups |

### Earth, closer · planned (see ROADMAP: ASCII Earth phase 2)
| Object | Notes |
| --- | --- |
| Landmarks | Pyramids of Giza, Eiffel Tower, Burj Khalifa, Great Wall, Statue of Liberty |
| Cities | brighter, more detailed night lights for the 50 largest cities |

### Deep sky ideas · planned
| Object | Notes |
| --- | --- |
| Sombrero, Whirlpool detail passes | dust ring, pink HII regions (partly done in 0.7) |
| Crab Nebula filaments | pulsar wind nebula glow |
| Omega Nebula, Lagoon Nebula, Butterfly Nebula | more famous nebulae |
| Phoenix Cluster, El Gordo | galaxy clusters |
| Hercules–Corona Borealis Great Wall | biggest structure claim (with the caveat that it is debated) |
| Magnetar SGR 1935+2154 | fast radio burst source |
