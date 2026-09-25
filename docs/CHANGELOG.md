# Changelog

All notable changes, newest first. Dates are UTC.

## Unreleased

## 0.7.0 · 2026-09-25

**New**
- Content packs: famous nebulae (Orion, Horsehead, Helix, Ring, Carina, Veil, the Eagle), galaxy gallery (Sculptor, Cartwheel, Hoag's Object, Stephan's Quintet, NGC 1275), extreme stars (UY Scuti, Stephenson 2-18, the Tarantula Nebula, R136a1, WR 140), the black hole zoo (Gaia BH1, Cygnus X-1, a star torn apart, GW150914).
- Tonight: *your sky* (stand at your location and look up at the real sky, in real time), and a list of what is up: Moon phase, bright planets, ISS passes over you, the next launches, meteor showers and eclipses.
- Earth's story: 4.54 billion years on one slider, with the globe changing from magma ocean to ocean world, snowball Earth, bare rock and green, and 31 milestones.
- Live Earth: every active satellite from CelesTrak (`/api/sats`), the ISS and Hubble as real objects at their real positions, the next rocket launches at their pads (`/api/launches`), illustrative ascents, and simulated air traffic on 55 real routes.
- Screensaver mode (`Z`): full screen, the interface fades, an endless shuffled tour plays with the music; can start by itself after 2, 5 or 10 idle minutes.
- Photo mode (`P`): save a picture with a caption, or copy the frame as ASCII text.
- Today's discovery (one object a day, with a streak) and a collection log with badges.
- Music: gcd radio, a generative mix of lofi, chill house and ambient with its own keys, tempos, chord progressions and melodies per track; style picker and skip.
- Flybys: sweeping camera moves past the Sun, Jupiter, Saturn, Betelgeuse, UY Scuti, Stephenson 2-18, R136a1, Sgr A*, M87*, TON 618, the Milky Way, Andromeda, the Sculptor Galaxy and the cosmic web.
- Gravity grids: the true shape of space (Flamm's paraboloid) under every black hole; the camera can now go to 1.06 Schwarzschild radii.
- The Eagle Nebula around the Pillars of Creation, with more columns and a soft edge.
- New Horizons, the ISS and Hubble have their own models.
- Feature flags (`?flags=`), documentation set (CLAUDE.md, docs/), test harness (`npm test`) and a generated content catalogue.

**Improved**
- Black hole shadows are pure black (no glow or stray dots inside).
- RS Ophiuchi: a red giant with a glowing envelope, a brighter disk and stream, and a bigger two-colour nova shell.
- Spiral galaxies: cloudier arms, pink star-forming regions, dust feathers; the Milky Way's arms carry more of the picture.
- The Halo: a star-heart in spinning containment rings, a fiery aura, random power surges with arcs and light spikes, circuit traces and a halo ring.
- Interface: selectable text, readable object titles, larger logo, text-size slider, one-line readouts, clearer tour progress bar, a highlighted *free camera* chip, travel speed in the toolbar, the ship button flies to the Halo, *resume tour*, `‹ ›` tour skipping, tour stop length, the ladder turns into the tour's track during tours, atlas sorting and filters with reset, Earth's fourth angle is now a pull-back to the Moon.

## 0.6.0 · September 2026

- Tours (seven themed tours with captions), size compare, time machine with deep-time star drift, share links.

## 0.5.0 · September 2026

- New home on GitHub and Vercel (gcdatlas.vercel.app).
- Atlas stays open with the current object highlighted; search box; settings panel; scale ladder with drag-to-zoom; star twinkle; atmospheres; the crescent Halo and ship finder; generative ambient soundtrack; travel speeds; lazy shader compilation and simulation gating for scale.

## 0.1.0 – 0.4.0

- The ASCII rendering pipeline, real star catalogue, planets from JPL elements, seamless zoom from Earth to the observable universe, the first objects (black holes, quasars, nebulae, galaxies, pulsars, mergers), the first tour, published as a claude.ai artifact.
