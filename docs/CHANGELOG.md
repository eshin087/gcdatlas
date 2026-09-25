# Changelog

All notable changes, newest first. Dates are UTC.

## Unreleased

## 0.7.2 · 2026-09-25

**Back to the subtle look**
- Black holes are shown by their own physics again: light bending around them, the photon ring, and the colour and brightness shifts of the disk (Doppler beaming and gravitational redshift). The blue gravity grids and their settings switch are gone.
- GW150914 is two dark shadows spiralling together, seen only through the starlight they bend, without the grid. Gaia BH1's lensing is no longer boosted.
- The tour's angle progress is the ASCII bar again: `angle 1/4  [#####-------------]`.
- Kept from 0.7: pure-black shadows (no stray glow or dots inside) and zooming in to 1.06 Schwarzschild radii.

## 0.7.1 · 2026-09-25

**Phones**
- A dock of six big buttons at the bottom (atlas, tours, time, ship, sound, settings) that always fits the screen.
- The object's details are a card above the dock. It starts compact (name, distance, tour progress); tap *more*, tap its grip or swipe up for the facts, numbers and ruler; *hide* or swipe down puts it away and leaves a small *i* pill to bring it back. The choice is remembered.
- The scale ladder folds away behind a chip at the top right showing the current scale (or the tour stop). Tap it to open the ladder; it closes by itself after you pick a rung or tap elsewhere.
- The camera re-frames the object into the space the card, atlas or a panel leaves free, instead of hiding it behind them.
- *Resume tour* sits in the card; choosing a tour closes the tours panel so you can watch it; atlas filters scroll sideways so the list keeps its room; landscape puts the card on the left and panels on the right.

**Everywhere**
- The interface fades after a few quiet seconds (sooner during a tour), leaving just the object's name; move the mouse, tap or press a key to bring it back. The first tap only wakes it, so a tour keeps playing. Settings → interface: never fade, slowly, quickly. New objects get time to be read before their facts fade, and resting the mouse on the text keeps it.
- The info panel has *less* and *hide* on desktop too (`I` cycles full, compact, hidden).

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
