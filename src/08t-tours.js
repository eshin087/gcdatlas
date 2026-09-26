
// ================================================================ guided tours: an ordered list of stops, with an optional caption per stop (story tours)
// Stops whose object does not exist are skipped, so tours can mention objects from future content packs.
const TOURS = [
  { id:'grand', name:'grand tour', blurb:'from home to the edge of the observable universe', stops:TOUR_KEYS.map(k => [k]) },
  { id:'star', name:'life of a star', blurb:'from dusty nursery to black hole', stops:[
    ['pillars', 'Stars are born in the dark. Inside cold towers of gas and dust like these, gravity pulls clumps together until their cores ignite.'],
    ['orion', 'The Orion Nebula is a stellar nursery 1,344 light-years away, lit by thousands of stars less than a million years old.'],
    ['hltau', 'A newborn star is wrapped in a flat disk of dust. The dark rings are lanes being swept clear, most likely by planets forming right now.'],
    ['sun', 'For about ten billion years a star like the Sun steadily fuses hydrogen into helium. The Sun is roughly halfway through.'],
    ['arcturus', 'When the hydrogen in its core runs out, the star swells into a red giant. Arcturus is doing this now; the Sun will in about 5 billion years.'],
    ['catseye', 'A Sun-like star ends gently, puffing its outer layers into space as a glowing planetary nebula.'],
    ['helix', 'Over thousands of years the shells spread and fade. The Helix Nebula is one of the closest, 650 light-years away.'],
    ['siriusb', 'What remains is a white dwarf: the old core, as massive as the Sun but only the size of Earth, cooling for billions of years.'],
    ['betelgeuse', 'Stars much heavier than the Sun live fast. Betelgeuse, 15 to 20 times the Sun\'s mass, is a red supergiant near the end of its life.'],
    ['etacar', 'The heaviest stars are unstable. Eta Carinae threw off this double bubble in an eruption seen from Earth in the 1840s.'],
    ['sn1987a', 'Then the core collapses in under a second and the star explodes as a supernova, briefly outshining its whole galaxy.'],
    ['crab', 'The debris keeps expanding for thousands of years. The Crab Nebula is the wreck of a supernova seen in 1054.'],
    ['veil', 'Older remnants fray into filaments. The Veil Nebula is what is left of a star that exploded about 15,000 years ago.'],
    ['crabpulsar', 'At the heart of the Crab the collapsed core survives as a neutron star: a city-sized ball spinning 30 times a second.'],
    ['magnetar', 'Some neutron stars carry magnetic fields a thousand trillion times Earth\'s. Their starquakes can be felt across the galaxy.'],
    ['gw170817', 'When two neutron stars collide, the blast forges gold and platinum and sends ripples through spacetime itself.'],
    ['cygx1', 'The heaviest stars can collapse all the way into black holes. Cygnus X-1 is one, feeding on its giant companion.'],
    ['sgra', 'Far bigger black holes sit at the centres of galaxies. Sagittarius A*, in ours, weighs 4.3 million Suns.'],
  ] },
  { id:'bh', name:'black holes', blurb:'the strangest objects in the universe', stops:[
    ['gaiabh1', 'The nearest known black hole, 1,560 light-years away. It is completely dark: we found it only because a Sun-like star circles it.'],
    ['cygx1', 'The first black hole ever identified (1971). It pulls gas off a blue supergiant into a disk hot enough to glow in X-rays.'],
    ['tde', 'Stray too close and a star is stretched into a stream of gas and swallowed: a tidal disruption, seen as a flare lasting months.'],
    ['gw150914', 'In 2015 detectors on Earth felt spacetime ripple from two black holes merging 1.3 billion light-years away.'],
    ['sstars', 'Stars whip around the centre of the Milky Way at up to 8,000 km/s, circling something invisible and enormous.'],
    ['sgra', 'Sagittarius A*: 4.3 million Suns packed inside a region smaller than Mercury\'s orbit.'],
    ['m87bh', 'M87*: 6.5 billion Suns. In 2019 it became the first black hole ever photographed.'],
    ['m87jet', 'Its jet of particles moving at almost the speed of light stretches 5,000 light-years across its galaxy.'],
    ['3c273', 'A feeding giant black hole can outshine its whole galaxy. Quasar 3C 273 is about 4 trillion times brighter than the Sun.'],
    ['ton618', 'TON 618 is one of the most massive black holes known: about 40 billion Suns, with an event horizon that would swallow the Solar System.'],
  ] },
  { id:'extreme', name:'extremes', blurb:'the biggest, hottest, fastest and farthest', stops:[
    ['stephenson218', 'Among the largest stars known. Put it where the Sun is and its surface would reach past Saturn.'],
    ['uyscuti', 'UY Scuti, another giant among giants: if it were a hollow ball, hundreds of millions of Suns would fit inside.'],
    ['r136a1', 'The heaviest star known: somewhere between 200 and 300 times the Sun\'s mass, shining with the light of about 7 million Suns.'],
    ['wr140', 'Two massive stars whose colliding winds make soot. Every eight years they puff out a new shell of dust.'],
    ['sstars', 'The fastest stars orbit the Milky Way\'s central black hole, reaching thousands of kilometres per second.'],
    ['crabpulsar', 'The densest things that are not black holes: a teaspoon of neutron star would weigh about a billion tonnes.'],
    ['magnetar', 'The strongest magnets in the universe. At a thousand kilometres this one would wipe every credit card on Earth.'],
    ['kelt9b', 'The hottest planet known: its day side reaches about 4,300 °C, hotter than many stars.'],
    ['ton618', 'One of the heaviest black holes ever measured, about 40 billion times the Sun\'s mass.'],
    ['3c273', 'The first quasar identified, and still one of the brightest objects in the sky beyond our galaxy.'],
    ['jadesz14', 'One of the most distant galaxies confirmed: its light left it about 290 million years after the Big Bang.'],
    ['bullet', 'Two galaxy clusters that crashed through each other. The gas stuck in the middle, but most of the mass flew on: dark matter.'],
    ['universe', 'The biggest thing of all: everything whose light has had time to reach us, 93 billion light-years across.'],
  ] },
  { id:'home', name:'our neighbourhood', blurb:'the Solar System and the nearest stars', stops:[
    ['earth'], ['iss'], ['moon'], ['apollo11'], ['sun'], ['parker'], ['mercury'], ['venus'], ['mars'], ['olympus'], ['perseverance'], ['ceres'], ['vesta'], ['jupiter'], ['io'], ['europa'],
    ['saturn'], ['titan'], ['enceladus'], ['uranus'], ['neptune'], ['pluto'], ['arrokoth'], ['halley'], ['voyager1'], ['oort'], ['alphacen'], ['proxima'], ['proximab'],
  ] },
  { id:'galaxies', name:'galaxies', blurb:'islands of stars, near and far', stops:[
    ['milkyway'], ['lmc'], ['smc'], ['andromeda'], ['m33'], ['sculptor'], ['m81'], ['m82'], ['m51'], ['m101'], ['m104'], ['cena'], ['antennae'], ['m87'],
    ['quintet'], ['ngc1275'], ['cartwheel'], ['hoag'], ['cosmicweb'],
  ] },
  { id:'worlds', name:'other worlds', blurb:'planets around other stars', stops:[
    ['proximab', 'The nearest known exoplanet, orbiting the nearest star. A year there lasts 11 days.'],
    ['trappist1', 'Seven Earth-sized worlds around one small red star, all closer to it than Mercury is to the Sun.'],
    ['peg51b', 'The first planet found around a Sun-like star (1995): a gas giant roasting in a four-day orbit.'],
    ['hr8799', 'Four giant planets photographed directly, circling a young star 130 light-years away.'],
    ['k218b', 'A world bigger than Earth and smaller than Neptune, possibly covered by a deep ocean under a hydrogen sky.'],
    ['kelt9b', 'The hottest planet known, so hot its atmosphere is being boiled away into space.'],
    ['cnc55e', 'A super-Earth so close to its star that its day side is probably an ocean of lava.'],
    ['kepler16b', 'A real Tatooine: a planet that orbits two suns at once.'],
  ] },
  { id:'jwst', name:'through JWST\'s eyes', blurb:'icons of the James Webb Space Telescope', stops:[
    ['jwst', 'The James Webb Space Telescope, 1.5 million km from Earth, sees the universe in infrared: through dust, and back to the first galaxies.'],
    ['pillars', 'One of its best-known pictures: the Pillars of Creation, towers of gas and dust with newborn stars glowing inside their tips.'],
    ['southernring', 'In its first images JWST showed that the dim star at the heart of the Southern Ring, the one that made this nebula, is wrapped in dust.'],
    ['carina', 'The "Cosmic Cliffs" on the edge of the Carina Nebula, where hot young stars are eating into a cloud of gas.'],
    ['wr124', 'A Wolf-Rayet star shedding its outer layers just before it dies. The ejected gas cools into clumps of glowing dust.'],
    ['casa', 'Cassiopeia A, the youngest known remnant of an exploding massive star in our galaxy, with the green curtain astronomers nicknamed the Green Monster.'],
    ['cnc55e', 'JWST also studies planets: on the lava world 55 Cancri e it found hints of an atmosphere breathed out by molten rock.'],
    ['jadesz14', 'And its deepest looks back in time: this galaxy is seen as it was only 290 million years after the Big Bang.'],
  ] },
  { id:'odd', name:'cosmic oddities', blurb:'the strange and the unexplained', stops:[
    ['oumuamua', 'The first object seen coming from another star (2017). It tumbled, sped up slightly and left forever, and we are still not sure what it was.'],
    ['halley', 'The most famous comet, back every 76 years. Next close pass: 2061.'],
    ['arrokoth', 'A world in the dark beyond Neptune: two flattened lobes that touched gently 4.5 billion years ago and stuck.'],
    ['tabby', 'A star that dims at random by up to a fifth. For a while people wondered about alien megastructures; dust is the likely answer.'],
    ['kepler16b', 'A planet with two suns, like Tatooine.'],
    ['einsteincross', 'One quasar seen four times: a galaxy in front of it bends its light along four paths.'],
    ['bootesvoid', 'A hole in the universe some 330 to 400 million light-years across, with about 60 galaxies where there should be thousands.'],
    ['elgordo', 'El Gordo, "the fat one": two of the heaviest galaxy clusters known, colliding.'],
    ['bullet', 'Another cluster collision, where the dark matter and the gas came apart: the clearest evidence that dark matter is real.'],
  ] },
  { id:'comets', name:'comets & meteors', blurb:'dirty snowballs, their tails and their dust', stops:[
    ['halley', 'The most famous comet swings past the Sun every 76 years. It was last here in 1986 and returns in 2061.'],
    ['halebopp', 'Hale-Bopp, the great comet of 1997, stayed visible to the naked eye for about 18 months. Its tails point away from the Sun.'],
    ['neowise', 'Comet NEOWISE lit up the summer of 2020 with a long, curved tail of dust.'],
    ['tsuchinshan', 'In October 2024 Earth crossed the plane of this comet\'s orbit, and its dust showed as a spike pointing toward the Sun.'],
    ['67p', 'Up close a comet is a dark, crumbly lump of ice and dust. ESA\'s Rosetta orbited this one for two years.'],
    ['sl9', 'In July 1994 the pieces of Comet Shoemaker-Levy 9 hit Jupiter, one after another, leaving dark scars the size of Earth.'],
    ['kreutz', 'Some comets dive straight through the Sun\'s corona. Most of these sungrazers boil away.'],
    ['perseids', 'Comets leave dust along their orbits. Every August Earth runs through the dust of Swift-Tuttle: the Perseid meteors.'],
    ['leonids', 'Tempel-Tuttle\'s dust makes the Leonids. When Earth hits a fresh trail they become a storm of thousands of meteors a minute.'],
    ['oumuamua', 'Some visitors come from other stars. \'Oumuamua was the first one found, in 2017.'],
    ['3iatlas', '3I/ATLAS, found in 2025, was the third. It passed the Sun and is heading back to interstellar space.'],
  ] },
];
let TOUR_ID = 'grand', TOUR_CAP = {};
function tourStops(id){ const t = TOURS.find(t => t.id === id) || TOURS[0]; return t.stops.filter(([k]) => BYKEY[k] && !BYKEY[k].marker).map(([k, cap]) => ({ i:BYKEY[k].index, cap })); }
function useTour(id){
  TOUR_ID = TOURS.some(t => t.id === id) ? id : 'grand';
  TOUR.length = 0; TOUR_CAP = {};
  for (const s of tourStops(TOUR_ID)){ TOUR.push(s.i); if (s.cap) TOUR_CAP[s.i] = s.cap; }
}
const tourName = () => (TOURS.find(t => t.id === TOUR_ID) || TOURS[0]).name;
