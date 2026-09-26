# Changelog

All notable changes, newest first. Dates are UTC.

## Unreleased

## 0.7.9 · 2026-09-26

**New**
- Earth's night side shows the real lights seen from space (NASA's Black Marble satellite map): road networks, coasts, the Nile, India, the eastern US. Bright city cores burn whiter, suburbs and highways glow sodium orange, and clouds soften them.
- Weather seen from space (illustrative, sped up): tropical cyclones with spiral bands and an eye in the basins active this month, thunderstorm clusters over the stormiest places on Earth where, now and then, lightning briefly lights a patch of cloud from inside on the night side (a quick flicker of 2 to 4 strokes), Saharan dust over the Atlantic, and burning seasons glowing at night where they happen that month. The readout says what is going on.

## 0.7.8 · 2026-09-26

**New**
- Every planet has an angle from its night side looking back at the Sun, which sits just past the planet's edge at its true size, with a soft round glow: a bright core and a faint wider halo, no rays. The glare hides when a planet or moon passes in front of the Sun.
- The Solar System view zooms in much closer, until the Sun fills the screen (2.7 Sun radii from its centre); its corona returns as it nears true size.
- Betelgeuse up close: a boiling surface of dark lanes, granules and bright filaments inside its giant convection cells. Its dusty plumes now drift outward and fray, and fade out before the edge (no more ring-like boundary).
- Alpha Centauri's third angle looks past A at B, the brightest star in its sky, and follows B along its orbit.
- Locked on the Halo, the camera always trails the ship from behind (three angles: above, low to one side, pulled back) and turns with it.

**Improved**
- Galaxies: brighter, more continuous spiral arms, a soft glow between them and thin dust lanes on the inner edge of each arm.
- Faint glow and haze no longer flicker: dim areas use a steady, even pattern of characters instead of random dots that reshuffle.
- Riding the Halo: the ship shows as an engine glint from afar and fades in gradually as you fly up behind it, with a slower final glide.
- Labels never sit on the object you are looking at (locked on or free flight): no more Sgr A* text across the Galactic Centre.

**Fixed**
- Star spikes (bright nebula stars, supernova flashes, gamma-ray bursts, Eta Carinae) were never drawn: their shader did not divide by distance, so they landed off-screen. They show now.
- Betelgeuse's scale rings are gone (they distracted from the star).

## 0.7.7 · 2026-09-25

**Fixed**
- Solar System lock-on: the Sun is now always the largest body, and the planets keep their true order of size (Jupiter, Saturn, Uranus, Neptune, Earth, Venus, Mars, Mercury). Before, Jupiter and Saturn were drawn bigger than the Sun.
- Solar System zoom: zooming in never makes the Sun shrink any more; it grows gently from 4% to 10% of the screen height. The planets are drawn larger.
- The Sun is a clear disc at every zoom of the system; its corona and ejections fade while it is enlarged, so they no longer cover the inner planets.
- The Crab Nebula, the Crab Pulsar and the magnetar SGR 1806-20 were not drawn since 0.7.5 (a property name clash made their size "not a number"). They are back, and the smoke test now fails on any such object.
- Travel no longer detours to an object on the way and zooms in on it before carrying on (it looked like the camera crashed into the Orion Nebula and bounced off). A trip is one smooth flight; it only bends past something that is really in view along the route, without slowing to a stop. The motion test checks that no grand tour trip dips in and out.
- When the page lowered the detail level to keep motion smooth, it never raised it again. It now goes back to your chosen detail after 10 calm seconds, and shader compiling at start-up no longer counts as slow frames.
- Stars with our Solar System's orbits drawn around them for scale (Betelgeuse, Antares, UY Scuti, Stephenson 2-18) now say so in the readout.
- The asteroid belt dims as the view widens, so it reads as a faint ring instead of a bright blob in the middle.
- Planets whose orbits fall inside the enlarged Sun step aside, and the readout names them.

## 0.7.6 · 2026-09-25

**Fixed**
- Music starts as soon as the page loads when the browser allows it, and otherwise on the first click, tap or key press. Before, a scroll or a touch could leave it silent until a later click.
- The first track skips its quiet intro and fades in over 0.6 s instead of 3 s.

## 0.7.5 · 2026-09-25

**New**
- 16 new places: the JWST icons Cassiopeia A, WR 124, the Southern Ring and the Bubble Nebula, and the Pleiades; strange worlds Kepler-16b (two suns), 55 Cancri e (lava), KELT-9b (hottest planet) and HR 8799's four photographed giants; the wanderers Halley's Comet (tails near the Sun), 'Oumuamua, Ceres and Arrokoth; and the oddities the Einstein Cross, the Boötes Void, El Gordo and Tabby's Star.
- Two new tours: *through JWST's eyes* and *cosmic oddities*.
- Scenic travel: long trips pass something real on the way (a nebula, a cluster, a galaxy near the route), turn to look at it, then carry on.
- The Solar System view draws the Sun and planets enlarged, so you can see each of them; orbits stay to scale and the readout says how much each is enlarged. Pick a planet and it returns to true size.

**Changed**
- The arrows beside an object's name step through its camera angles. The arrows at the top right step through tour stops on a tour, and otherwise up and down the scale bar (Moon, Earth, Jupiter, the Sun, ...).
- Every lock-on loops through the object's angles, including picks from the scale bar and shared links.
- Travel speed: slow by default for new visitors; changing it mid-flight re-times the rest of the trip; the speed you pick is honoured on computers set to reduce motion.
- The Sun's surface churns like fire, with tongues of flame licking up from its edge. Other stars with boiling surfaces (cooler than about 7,000 K) get the same look in their own colours.
- The Milky Way and other spirals have golden cores, blue-white arms, pink star-forming clouds and darker dust lanes. The Milky Way's views were reframed to show it whole.
- The Pillars of Creation stand out against a darker sky when you are close.

**Fixed**
- "you are inside it away" under the Solar System's name.

## 0.7.4 · 2026-09-25

**New**
- Ride along with the Halo: the *ride* button (or *ride along* in its card, or a tap on its marker) puts the camera behind the ship, the pilot's third-person view. C switches to the cockpit on the bridge and back; scroll moves the chase camera nearer or further. When the ship folds space the camera folds with it, behind a flash, so you never lose it. Drag to take the camera; play rides again.
- The Halo is redesigned as a long-range cruiser: an armoured hull with a sharp bow, a bridge tower, swept wings, a dorsal fin and three engines, with its star-heart visible through an open reactor bay.
- Menu text size: the atlas, settings and other panels are bigger by default (115%), with their own slider in settings.
- The Sun is warm yellow-orange and its surface boils: bright granules flicker, patches swell and fade, and flame-like spicules ripple along the edge.
- The Pillars of Creation take the JWST look: translucent rust-and-gold columns with glowing orange-red edges against a blue haze. Gas peels off the lit surfaces and drifts away, the edges shimmer, and young stars glow in the tips.

**Changed**
- The ship button now only shows or hides the Halo's blue marker, and it is off by default. It no longer flies to the ship.
- Labels fade in and out instead of popping, and the orange numbers in the info panel fade in when the object changes. The panel fades in when the page opens.
- Labels of other things no longer sit on top of the object you are looking at. Its own parts (moons inside its bounds, a galaxy's companions) and things visibly in front of it keep theirs.

**Fixed**
- Objects picked from the scale ladder, a shared or reloaded link, and the end of a size compare no longer arrive paused: the camera keeps moving (a slow circle at the ladder's scale, the angle loop otherwise).
- Following the Halo between destinations no longer shows empty space: the camera stays attached to the ship through the fold.

## 0.7.3 · 2026-09-25

**New**
- Play / pause at the top right (and the space bar): pause the tour or the camera to admire a view, then carry on.
- Pick any object and, once the camera arrives, it loops through that object's tour angles by itself. Any drag or zoom pauses it; play brings it back.

**Fixed**
- Black holes are pitch black: nothing shows through a shadow any more. Lines and points behind or inside it are hidden, and so are labels. M87* and TON 618 lose their Solar System scale rings, which sat entirely inside their shadows.
- Gaia BH1 is no longer an empty black disc: its Sun-like companion's light is bent around it like the rest of the sky. From behind, the second angle follows the star so its light splits into two arcs that swing into a ring.
- Cygnus X-1's disk no longer thins out as you zoom in: it now runs continuously from the inner disk to where the stream lands, and reads as a surface at every scale.
- The Sun's coronal mass ejections were cut off by the edge of the Sun's drawing area, a cut that moved with the camera. They now fade into space, and fly straight out instead of turning with the Sun.
- The Halo's scan beams land on the side of a planet or star the ship can see, with a small glow where they hit. They stop at a black hole's shadow and never pass through the body.
- The Solar System tour stop now frames all eight orbits, then out to Saturn, then the inner planets. The orbit lines are brighter.
- Flights land on where the destination is now, not where it was at take-off: arriving at Earth from the edge of the universe no longer jumps in the last frame. Every flight glides in and settles.
- The orange numbers in the info panel wrap inside the panel again, like the text above them, and *less · hide* stay next to that text.

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
