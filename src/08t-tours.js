
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
    ['ton618', 'TON 618 is one of the most massive black holes known: about 66 billion Suns, with an event horizon that would swallow the Solar System.'],
  ] },
  { id:'extreme', name:'extremes', blurb:'the biggest, hottest, fastest and farthest', stops:[
    ['stephenson218', 'Among the largest stars known. Put it where the Sun is and its surface would reach past Saturn.'],
    ['uyscuti', 'UY Scuti, another giant among giants: if it were a hollow ball, hundreds of millions of Suns would fit inside.'],
    ['r136a1', 'The heaviest star known: roughly 200 times the Sun\'s mass, shining with the light of millions of Suns.'],
    ['wr140', 'Two massive stars whose colliding winds make soot. Every eight years they puff out a new shell of dust.'],
    ['sstars', 'The fastest stars orbit the Milky Way\'s central black hole, reaching thousands of kilometres per second.'],
    ['crabpulsar', 'The densest things that are not black holes: a teaspoon of neutron star would weigh about a billion tonnes.'],
    ['magnetar', 'The strongest magnets in the universe. At a thousand kilometres this one would wipe every credit card on Earth.'],
    ['kelt9b', 'The hottest planet known: its day side reaches about 4,300 °C, hotter than many stars.'],
    ['ton618', 'One of the heaviest black holes ever measured, 66 billion times the Sun\'s mass.'],
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
];
let TOUR_ID = 'grand', TOUR_CAP = {};
function tourStops(id){ const t = TOURS.find(t => t.id === id) || TOURS[0]; return t.stops.filter(([k]) => BYKEY[k] && !BYKEY[k].marker).map(([k, cap]) => ({ i:BYKEY[k].index, cap })); }
function useTour(id){
  TOUR_ID = TOURS.some(t => t.id === id) ? id : 'grand';
  TOUR.length = 0; TOUR_CAP = {};
  for (const s of tourStops(TOUR_ID)){ TOUR.push(s.i); if (s.cap) TOUR_CAP[s.i] = s.cap; }
}
const tourName = () => (TOURS.find(t => t.id === TOUR_ID) || TOURS[0]).name;
