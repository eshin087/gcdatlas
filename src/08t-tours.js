
// ================================================================ guided tours: an ordered list of stops, with an optional caption per stop (story tours)
// Stops whose object does not exist are skipped, so tours can mention objects from future content packs.
const TOURS = [
  { id:'grand', name:'grand tour', blurb:'from home to the edge of the observable universe', stops:TOUR_KEYS.map(k => [k]) },
  // (deal: its stops are picked by dealRandom each time it starts, and again at its last stop; no captions, the card has each place's fact)
  { id:'random', name:'random tour', blurb:'a new mix of places every time', deal:true, stops:[] },
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
    // (apollo11, parker, olympus and perseverance are places still to come, docs/CONTENT.md: tourStops leaves out a key with no object, so
    // the tour and the Halo tour skip them until they exist)
    ['earth'], ['iss'], ['moon'], ['apollo11'], ['sun'], ['parker'], ['mercury'], ['venus'], ['mars'], ['olympus'], ['perseverance'], ['ceres'], ['vesta'], ['jupiter'], ['io'], ['europa'],
    ['saturn'], ['titan'], ['enceladus'], ['uranus'], ['neptune'], ['pluto'], ['arrokoth'], ['halley'], ['voyager1'], ['oort'], ['alphacen'], ['proxima'], ['proximab'],
  ] },
  // (0.15.0: the famous places on Earth with their own layers, e9p-earth-places.js, west round the world; not listed without the real Earth)
  { id:'earth', name:'wonders of Earth', blurb:'mountains, deserts, coasts, ice and what people built, up close', stops:PLC.tour.map(k => [k]) },
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
    ['leonids', 'Tempel-Tuttle\'s dust makes the Leonids. When Earth hits a fresh trail they become a storm: in 1966, thousands of meteors a minute.'],
    ['oumuamua', 'Some visitors come from other stars. \'Oumuamua was the first one found, in 2017.'],
    ['3iatlas', '3I/ATLAS, found in 2025, was the third. It passed the Sun and is heading back to interstellar space.'],
  ] },
  // (0.16.0: every Messier object in the atlas, found by the m number in its aka, in the order of a one-night Messier marathon; it grows as
  // content packs add the rest of the checklist, docs/CATALOG.md)
  { id:'messier', name:'Messier marathon', blurb:'every Messier object in the atlas, in one night\'s order', stops:messierStops() },
];
// The order observers take the 110 on a marathon night in March, roughly west to east as the sky turns: Don Machholz's search sequence for
// 20 to 40 degrees north, as SEDS publishes it (http://www.messier.seds.org/xtra/marathon/marath1.txt).
function messierStops(){
  const ORDER = [77, 74, 33, 31, 32, 110, 52, 103, 76, 34, 45, 79, 42, 43, 78, 1, 35, 37, 36, 38, 41, 93, 47, 46, 50, 48, 44, 67, 95, 96, 105, 65, 66, 81, 82,
    97, 108, 109, 40, 106, 94, 63, 51, 101, 102, 53, 64, 3, 98, 99, 100, 85, 84, 86, 87, 89, 90, 88, 91, 58, 59, 60, 49, 61, 104, 68, 83, 5, 13, 92, 57, 56, 29,
    39, 27, 71, 107, 12, 10, 14, 9, 4, 80, 19, 62, 6, 7, 11, 26, 16, 17, 18, 24, 25, 23, 21, 20, 8, 28, 22, 69, 70, 54, 55, 75, 15, 2, 72, 73, 30];
  // (an m number read the way the search reads it, CAT_RE in 09-render.js: whole, so WR 124's "m1-67" is not M1)
  const mOf = o => new Set([...(o.aka || '').toLowerCase().matchAll(/(?:^|[^\w+\-\/.])(?:m|messier)\s*(\d+)(?![\w+\-])/g)].map(m => +m[1]));
  const own = OBJ.filter(o => o.atlas !== false && !o.marker && o.group && o.views).map(o => [o, mOf(o)]), stops = [];
  for (const n of ORDER){ const hit = own.find(([, ms]) => ms.has(n)); if (hit && !stops.some(([k]) => k === hit[0].key)) stops.push([hit[0].key]); }
  stops[0] && stops[0].push('Around the new Moon in March or early April, from a dark site about 25 degrees north of the equator, all 110 Messier objects can be seen in a single night. Marathoners take them in this order, from the west at dusk to the east before dawn.');
  return stops;
}
let TOUR_ID = 'grand', TOUR_CAP = {};
let TOUR_GEN = 0;   // goes up whenever TOUR is rebuilt (the tour track on the scale bar keys on it: a new deal of the same length has new names)
function tourStops(id){ const t = TOURS.find(t => t.id === id) || TOURS[0]; return t.stops.filter(([k]) => BYKEY[k] && !BYKEY[k].marker).map(([k, cap]) => ({ i:BYKEY[k].index, cap })); }
let nextDeal = null;   // a random tour dealt ahead, a small step per frame (dealAhead)
// first: a dealt tour starts with this place (a shared link); from: the place a dealt tour sets off from (default: where the camera is);
// stops: its stops, if they are given
function useTour(id, first, from, stops){
  const prev = TOUR_ID === id ? new Set(TOUR) : new Set();   // (a new deal of the same tour avoids the places just played: see dealAvoid)
  TOUR_ID = TOURS.some(t => t.id === id) ? id : 'grand';
  const t = TOURS.find(t => t.id === TOUR_ID);
  if (t.deal){ const f = first && tourable(first) ? first : null, at = f ? null : from || hereObj(); t.stops = stops || (!f && takeDeal(at)) || dealRandom(at, f, prev); }
  TOUR.length = 0; TOUR_CAP = {}; TOUR_GEN++; nextDeal = null;
  for (const s of tourStops(TOUR_ID)){ TOUR.push(s.i); if (s.cap) TOUR_CAP[s.i] = s.cap; }
}
const tourName = () => (TOURS.find(t => t.id === TOUR_ID) || TOURS[0]).name;
const tourDeals = () => !!(TOURS.find(t => t.id === TOUR_ID) || TOURS[0]).deal;
// the last stop of the random tour goes on to 12 new places, starting from there (usually dealt ahead already: see dealAhead)
function dealAgain(from){ useTour(TOUR_ID, null, from); toast(tourName() + ' · ' + TOUR.length + ' new places'); }
// A deal takes a few milliseconds (tens on a slow phone), too long for the frame a trip sets off in. So a random tour is dealt ahead, a
// small step per frame: the next 12 while the random tour's last stop plays or waits paused, and a first one from where you are while the
// list of tours is open. Positions are relative to the camera's focus, so a deal that is still going starts again if the focus changes. A
// deal that is not finished when it is needed is finished then (takeDeal); if none fits, useTour deals on the spot.
function dealAhead(){
  if (flight || shipCam.on) return;
  const k = TOUR.length - 1, last = k >= 0 && tourDeals() && tour.obj === TOUR[k] && (tour.on ? tour.phase !== 'fly' : tour.last === tour.obj && orbit.lock === tour.obj);
  if (last) dealStep(OBJ[tour.obj]); else if (!toursEl.hidden) dealStep(hereObj());
}
const toursEl = $('#tours');
// (the places a new random tour leaves out: those the random tour just played, as useTour's prev)
const dealAvoid = () => new Set(tourDeals() ? TOUR : []);
function dealStep(from){
  const d = nextDeal;
  if (d && d.gen === TOUR_GEN && d.from === from && (d.stops || d.focus === cam.focus)){ if (!d.stops){ const r = d.it.next(); if (r.done) d.stops = r.value; } return; }
  nextDeal = { gen:TOUR_GEN, from, focus:cam.focus, it:dealSteps(from, null, dealAvoid()), stops:null };
}
// the stops dealt ahead from this place, finished now if the deal is still going; null if none fits
function takeDeal(from){
  const d = nextDeal; if (!d || d.gen !== TOUR_GEN || d.from !== from || !(d.stops || d.focus === cam.focus)) return null;
  if (!d.stops){ let r; do r = d.it.next(); while (!r.done); d.stops = r.value; }
  return d.stops;
}
const hereObj = () => OBJ[flight ? cam.focus : orbit.lock >= 0 ? orbit.lock : cam.focus];

// ---------------------------------------------------------------- the random tour: 12 places from the whole atlas, a new mix every time
// A weighted walk. Places you have not seen come first (SEEN stays on your device): a place you have seen is only picked when no unseen one
// is left to pick, or when the trip to every unseen one is at most a tenth as likely as the best trip to a seen place (RANDOM_W.defer; so
// with only a few unseen places left, the tour reaches them through places seen before, not by zooming out to the whole universe and back
// for each one). Among those, each next stop is picked at random, but less often when the trip there pulls the view far back and
// closes in again (back: the widest view on the way against the wider end, x0.03 past 100,000 times, x0.1 past 10,000, x0.3 past 1,000,
// x0.6 past 100; and x0.2 more for a trip over the galactic pole, isScenic, the rule of startFlight), and less often when it would be a
// third place of one kind in a row (x0.4). No place twice (see samePlace), at most 3 from one atlas category, never the place it sets off
// from as the first stop, and no trip that would fly through a third object (tripClear).
// Measured over 440 trips of 40 deals from Earth at cinematic speed: 2% pull back more than 100,000 times and 9% more than 1,000 times
// (the grand tour: 7% and 30%; places picked blindly: 29% and 47%); 21% go over the galactic pole (grand tour 43%, blindly 57%); 10.9 s
// a trip on average (grand tour 9.5 s, blindly 13.1 s), and about 6 of the atlas's kinds of place in each deal. With only 6 places left
// unseen, on the flight paths of 40 deals from Earth: 10% pull back more than 1,000 times and 3% more than 100,000 times (a new visitor:
// 8% and 3%; unseen places strictly first: 23% and 13%), and a deal still reaches 5.6 of the 6.
const RANDOM_N = 12, RANDOM_W = { back:[[1e5, 0.03], [1e4, 0.1], [1e3, 0.3], [1e2, 0.6]], far:0.2, sameCat:0.4, run:2, defer:0.1 };
// (a seed of its own from Math.random: the shared rnd() starts from a fixed seed, so every visitor would get the same "random" tour)
let RSEED = (Math.random()*4294967296) >>> 0;
const rrnd = () => { let t = RSEED = (RSEED + 0x6D2B79F5) >>> 0; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };   // (mulberry32)
// what a tour may visit: a real place with views that you can pick: in the atlas, or picked in the sky ('your sky' and the naked-eye stars
// are backdrops, not places; the comets cannot be picked in the sky while you are away from them, but they are in the atlas). Not fiction:
// not the Halo or anything that belongs to it (its drone), nor anything marked fiction:true. (One rule for the random tour, the
// screensaver and today's discovery.)
const isFiction = o => !!(o.fiction || o.key === 'halo' || (o.parent && isFiction(o.parent)));
// (noTour: rockets on their pads launch when you visit them, so tours, the screensaver and today's discovery leave them out)
const tourable = o => !!(o && o.views && o.views.length) && !o.hidden && !o.marker && !o.noTour && (o.atlas !== false || !o.noPick) && !isFiction(o);
// two stops are the same place when one sits at the other's centre (the Crab and its pulsar, M87 and its black hole, the Sun and the Oort
// cloud), or when one belongs to the other or both belong to the same body (Earth, the Moon and the ISS; Jupiter and Io; a star and its
// planet). The Sun's family is too big for that: its planets and comets are places of their own, unless one sits on or just above the Sun
// (a probe grazing it). The observable universe and the cosmic web are centred on us, so they are nobody's place.
const aroundUs = o => o.rad >= 1e9;
const kinOf = (c, p) => c.parent === p && (p.key !== 'sun' || V.len(c.offset) < 4*p.rad);
function samePlace(a, b){
  if (a === b) return true;
  if (aroundUs(a) || aroundUs(b)) return false;
  return V.len(V.sub(a.pos, b.pos)) < 4*Math.min(a.rad, b.rad) || kinOf(a, b) || kinOf(b, a) || (!!a.parent && a.parent === b.parent && kinOf(a, a.parent) && kinOf(b, b.parent));
}
// the places the random tour deals from: the atlas, as far as a tour may visit it
const tourPool = () => atlasRows.map(r => r.o).filter(tourable);
// one end of a trip: the point a place's first tour angle looks at, and how far away that angle sits
const tripEnd = o => { const vp = viewParams(o, tourViews(o)[0]); return { p:V.add(frel(o), vp.off), d:vp.dist }; };
// the trip from end A to end B as startFlight would fly it: how much less often to pick it (1 for a smooth trip)
function tripWeight(A, B){
  const path = vwPath(V.len(V.sub(B.p, A.p)), A.d, B.d, 1.3), wMax = pathWidest(path), back = wMax/Math.max(A.d, B.d);
  let x = isScenic(path, A.d, B.d, wMax) ? RANDOM_W.far : 1;
  for (const [k, f] of RANDOM_W.back) if (back > k){ x *= f; break; }
  return x;
}
// from: where it sets off (never a stop, and the first stop is never the same place; it weighs the first trip), first: the first stop if it
// must be one (a shared link), avoid: object indices to leave out (the stops just played). Returns the stops as [key] rows.
function dealRandom(from, first, avoid, n = RANDOM_N){ const it = dealSteps(from, first, avoid, n); let r; do r = it.next(); while (!r.done); return r.value; }
// (the same in small steps: dealAhead spreads it over frames)
function* dealSteps(from, first, avoid, n = RANDOM_N){
  const pool = tourPool(), cat = pool.map(catOf), out = [], per = {}, vps = new Map(), list = clearList();
  const same = new Uint8Array(pool.length), take = o => { out.push(o); per[catOf(o)] = (per[catOf(o)] || 0) + 1; pool.forEach((c, i) => { if (samePlace(o, c)) same[i] = 1; }); };   // (same: one place with a stop already taken)
  const at = o => { let v = vps.get(o); if (!v){ v = tripEnd(o); vps.set(o, v); } return v; }, tripW = (a, b) => tripWeight(at(a), at(b));
  const pick = (w, t) => { let r = rrnd()*t, j = -1; for (let i = 0; i < w.length; i++) if (w[i] > 0){ j = i; if ((r -= w[i]) < 0) break; } return j; };
  if (first) take(first);
  yield 0;   // (pauses for dealAhead: after setting up, every 40 places weighed, and after each trip put back)
  let relax = 0;   // (with nothing left to pick: first allow the places just played, then more than 3 from a category)
  while (out.length < n){
    const p = out.length ? out[out.length - 1] : from, k = out.length, w = [], seen = [];
    // (the kind of the last stops, if the last RANDOM_W.run of them are all of one kind)
    const run = k >= RANDOM_W.run && out.slice(k - RANDOM_W.run).every(o => catOf(o) === catOf(out[k - 1])) ? catOf(out[k - 1]) : null;
    for (let i = 0; i < pool.length; i++){
      const c = pool[i];
      let x = same[i] || c === from || (relax < 1 && avoid.has(c.index)) || (relax < 2 && (per[cat[i]] || 0) >= 3) || (k === 0 && from && samePlace(from, c)) ? 0 : 1;
      if (x && p){ x *= tripW(p, c); if (cat[i] === run) x *= RANDOM_W.sameCat; }
      w.push(x); seen.push(SEEN.has(c.key));
      if (i % 40 === 39) yield out.length;
    }
    // (unseen places first, unless the trip there is much rougher: an unseen place waits with the seen ones when it weighs at most
    // RANDOM_W.defer of the best seen place. Within a tier, a trip that would fly through something on the way is put back and another
    // one picked)
    let best = 0; for (let i = 0; i < w.length; i++) if (seen[i] && w[i] > best) best = w[i];
    const tier = w.map((x, i) => seen[i] || x <= best*RANDOM_W.defer ? 1 : 0);
    let j = -1;
    for (const s of [0, 1]){
      const ws = w.map((x, i) => tier[i] === s ? x : 0); let left = ws.reduce((a, b) => a + b, 0);
      while (left > 0){ const i = pick(ws, left); if (i < 0) break; if (!p || tripClear(p, pool[i], list)){ j = i; break; } left -= ws[i]; ws[i] = 0; yield out.length; }
      if (j >= 0) break;
    }
    // (every trip from here would: take one anyway, unseen first, rather than end the tour early)
    for (const s of [0, 1]){ if (j >= 0) break; const ws = w.map((x, i) => tier[i] === s ? x : 0), t = ws.reduce((a, b) => a + b, 0); if (t > 0) j = pick(ws, t); }
    if (j < 0){ if (relax++ < 2) continue; break; }
    take(pool[j]);
    yield out.length;
  }
  return out.map(o => [o.key]);
}
