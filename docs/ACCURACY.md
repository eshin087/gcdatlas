# How accurate is gcdatlas?

## The short answer

**No, it is not a carbon copy of the universe, and it should not be described as one.** It is a scientifically grounded model: the *where* and *how big* are real measurements, the *what it looks like* is a physically based artist's rendering, and time is sped up.

Suggested wording for the site or for sharing:

> Every named object is at its real position and true size, taken from star catalogues and published measurements. How each one looks is a physically based rendering in ASCII: brightness is compressed so faint things stay visible, and fast processes are sped up.

## What is real, what is approximate, what is artistic

| Topic | Status | Details |
| --- | --- | --- |
| Positions of ~2,000 bright stars | **Real** | Hipparcos catalogue positions and parallax distances. Parallax errors grow with distance: a few percent within 100 light-years, 10–30% beyond several hundred. |
| Star colours and sizes | **Real (rounded)** | Colour from measured temperature or colour index; radii for named stars from the literature. Many giant-star radii are uncertain by 10–50% (Betelgeuse, UY Scuti, Stephenson 2-18 especially). |
| Planet positions | **Real, approximate** | JPL approximate Keplerian elements: arcminute-level from 1800 to 2050, degrading outside. Moon: a low-precision lunar theory (a fraction of a degree). |
| Planet appearance | **Mixed** | Earth uses real coastlines (Natural Earth) and ice sheets; its night lights are glows around about 110 of the largest cities, scaled by population, not a satellite night map; clouds and weather are procedural. Other planets are procedural textures in their real colours and banding. |
| Satellites | **Real (live) or representative** | With live data: every active satellite from CelesTrak, propagated with two-body motion plus J2 (a few km over hours; full SGP4 is not used). Without it: representative orbital shells. The ISS and Hubble use the live elements when available. |
| Air traffic | **Simulated** | Aircraft on 55 real busy routes, timed from great-circle distances; not live flights. |
| Rocket launches | **Real schedule, illustrative ascent** | Next launches and pads from Launch Library 2; the ascent trail is a generic eastward gravity turn, not the real trajectory. |
| Nebulae | **Real position and size, artistic look** | Procedural volumes shaped after Hubble/JWST images (Pillars, Orion, Eagle, Helix…). Colours follow the familiar image palettes, which are themselves false-colour composites; the Pillars follow the JWST NIRCam palette. Their moving gas (evaporating veils, shimmering edges) is real in kind but sped up enormously: the real flows take thousands of years to change. |
| Galaxies | **Real position, distance, size and tilt; artistic structure** | Spiral arms, bars, dust lanes and star clouds are parametric models. The Milky Way's arm layout follows current radio and Gaia models, which are still debated. |
| Large-scale universe | **Illustrative** | The cosmic web and Laniakea show the right scale and character, not the real mapped filaments. |
| Black holes | **Physics-based** | Light paths are integrated through the Schwarzschild metric (lensing, shadow at 2.6 r_s, photon ring). Disks use a thin-disk temperature profile with Doppler beaming and gravitational redshift. Gaia BH1's companion is lensed with its glow widened (as stars are drawn elsewhere) so its bent image spans a character; Cygnus X-1's outer disk is a particle cloud whose points are sized to the patch of disk they stand for. Simplifications: non-spinning holes, simplified disk structure. Time-dilation readouts are exact for a static observer. |
| Binary stars, tidal disruption | **Simplified physics** | RS Ophiuchi's gas stream follows the restricted three-body equations. The star torn apart uses the "frozen-in" approximation, a star drawn about 10x too large, and a simplified circularisation of the debris. |
| Mergers and gravitational waves | **Illustrative** | Real masses and frequencies in the readouts; the spacetime ripples are exaggerated by an enormous factor to be visible. |
| Time | **Sped up** | The Solar System clock defaults to 10 minutes per second; explosions, orbits and mergers are compressed. Deep-time star drift uses straight-line proper motions (valid for roughly ±100,000 years). |
| Brightness | **Compressed** | Real brightness spans 30+ orders of magnitude; the renderer tone-maps it so both a quasar and a comet are visible. Some tiny sources (a quasar's engine, a kilonova) are drawn magnified, and the ruler shows their true size. |
| Earth's story | **Broad strokes** | Dates are standard textbook values (rounded). The globe shows each era's broad look (molten, ocean world, snowball, bare rock, green), not the ancient continents. |
| Solar System overview | **Enlarged bodies, true order** | In the whole-system view the Sun and planets are drawn enlarged so they are visible. The Sun is sized first (at least 2 character rows, at most half of Mercury's orbit); each planet is drawn at Sun size x (true radius ratio)^0.4, so the Sun is always largest and the planets keep their true order of size, but the ratios are compressed (really the Sun is 10x Jupiter, Jupiter 11x Earth; the readout says so). Planets whose orbit falls inside the enlarged Sun are hidden and named in the readout. The Sun's corona is faded while enlarged. Positions and orbits are to scale. Close up, everything is true size. |
| Star surfaces | **Physically inspired** | Stars cooler than about 7,000 K have convective surfaces; they are drawn with churning granulation and flame-like spicules at the limb, much faster than real (granules last about 10 minutes). |
| The Sun's colour | **Artistic tint** | Drawn warm yellow-orange with boiling, pulsing granulation, the way filtered solar photos look. Its real light (5,772 K) is white when seen from space; the atmosphere makes it look yellow from the ground. The readout says so. |
| New worlds (0.7.5) | **Real orbits, sped-up years** | Comets and small bodies use JPL small-body elements; exoplanet orbits keep their real sizes but their periods are shortened so you can see them move (the readout gives the real period). Planet surfaces and 'Oumuamua's shape are illustrative. Tabby's Star's dust clouds are drawn where they could be; nobody has seen them. |
| The Halo | **Fiction** | The only invented object. |
| Music | **Fiction** | Space is silent. |

## Where the numbers come from

- Stars: Hipparcos (ESA) via star-catalog-lite; d3-celestial for colours and constellation lines.
- Planets and Moon: JPL (Standish) approximate elements; IAU WGCCRE rotation models; Meeus-style lunar series.
- Earth: Natural Earth coastlines (via world-atlas); city glows from a list of large cities and their approximate populations (in `tools/gen-data.mjs`).
- Satellites: CelesTrak GP data. Launches: The Space Devs Launch Library 2.
- Named objects: NASA, ESA, ESO, the Event Horizon Telescope, LIGO, and the discovery papers (for example Gaia BH1: El-Badry et al. 2023; Cygnus X-1: Miller-Jones et al. 2021; AT2019qiz: Nicholl et al. 2020; WR 140: Lau et al. 2022).

## Rules for keeping it honest

1. Anything illustrative, magnified, simulated or sped up says so in its readout or fact.
2. Numbers in facts and readouts must match a citable source; round rather than invent precision.
3. When a measurement is disputed (distances to red supergiants, the Milky Way's arms), say so in the fact.
4. Update this table whenever something new is added that is not measured data.
