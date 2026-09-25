
// ================================================================ tonight: your own sky (planetarium), what is happening up there, and Earth's story
// ---------------------------------------------------------------- where you are (kept on this device only)
const CITIES = [['London', 51.51, -0.13], ['New York', 40.71, -74.01], ['Los Angeles', 34.05, -118.24], ['Toronto', 43.65, -79.38], ['Mexico City', 19.43, -99.13], ['São Paulo', -23.55, -46.63],
  ['Cairo', 30.04, 31.24], ['Lagos', 6.52, 3.38], ['Mumbai', 19.08, 72.88], ['Singapore', 1.35, 103.82], ['Tokyo', 35.68, 139.69], ['Seoul', 37.57, 126.98], ['Sydney', -33.87, 151.21]];
{ const box = $('#skyCities'); for (const [n, la, lo] of CITIES){ const b = document.createElement('button'); b.textContent = n; b.dataset.lat = la; b.dataset.lon = lo; box.appendChild(b); } }
const where = store.get('where', null);
if (where){ SKYV.lat = where.lat; SKYV.lon = where.lon; SKYV.place = where.name; }
function setWhere(lat, lon, name){ SKYV.lat = lat; SKYV.lon = lon; SKYV.place = name; store.set('where', { lat:+lat.toFixed(2), lon:+lon.toFixed(2), name }); $('#skyPlaces').hidden = true; refreshEvents(); }
$('#skyCities').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.loc === 'here'){
    if (!navigator.geolocation){ toast('this browser cannot share its location · pick a city'); return; }
    toast('asking your browser for your location…');
    navigator.geolocation.getCurrentPosition(p => { setWhere(p.coords.latitude, p.coords.longitude, 'your location'); if (SKYV.want) enterSky(); },
      () => toast('location not shared · pick the nearest city instead'), { maximumAge:3.6e6, timeout:15000 });
    return;
  }
  setWhere(+b.dataset.lat, +b.dataset.lon, b.textContent); if (SKYV.want) enterSky();
});
const fmtLatLon = (la, lo) => `${Math.abs(la).toFixed(1)}°${la >= 0 ? 'N' : 'S'} ${Math.abs(lo).toFixed(1)}°${lo >= 0 ? 'E' : 'W'}`;
const localTime = jd => new Date((jd - 2440587.5)*86400000 + (SKYV.lon || 0)/15*3.6e6).toISOString().slice(11, 16);   // mean solar time at your longitude

// ---------------------------------------------------------------- positions in your sky at any moment
const earthFrameAt = jd => bodyFrame(0, 90, 190.147 + 360.9856235*(jd - 2451545));
function observerAt(jd, lat = SKYV.lat, lon = SKYV.lon){
  const la = lat*DEG, lo = lon*DEG, R = earthFrameAt(jd);
  const up = M3.apply(R, [Math.cos(la)*Math.cos(lo), Math.sin(la), -Math.cos(la)*Math.sin(lo)]);
  const pole = M3.apply(earth.R0, [0, 1, 0]), north = V.norm(V.sub(pole, V.mul(up, V.dot(pole, up)))), east = V.norm(V.cross(north, up));
  return { up, north, east, pos:V.mul(up, 6371*KM) };
}
function altAz(ob, vec){   // vec: direction or offset from the observer, world frame
  const d = V.norm(vec), alt = Math.asin(clamp(V.dot(d, ob.up), -1, 1)), az = Math.atan2(V.dot(d, ob.east), V.dot(d, ob.north));
  return { alt:alt/DEG, az:((az/DEG) + 360) % 360 };
}
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compass = az => COMPASS[Math.round(az/22.5) % 16];
const sunFromEarth = jd => V.mul(planetPos(PLANET_EL.earth, jd), -1);
const bodyFromEarth = (key, jd) => key === 'moon' ? moonGeo(jd) : V.sub(planetPos(PLANET_EL[key], jd), planetPos(PLANET_EL.earth, jd));

// ---------------------------------------------------------------- planetarium mode
let skyPrevRate = null;
function enterSky(){
  if (SKYV.lat == null){ SKYV.want = true; togglePanel('timem', true); $('#skyPlaces').hidden = false; toast('pick where you are first'); return; }
  SKYV.want = false;
  if (SAVER.on) stopSaver(); if (document.body.classList.contains('photo')) stopPhoto(); if (cmp) endCompare(false);
  stopTour(false); tween = null; flyMove = null; flight = null;
  togglePanel(null, false); toggleAtlas(false); closeStory(true);
  skyPrevRate = ssRate; ssRate = 1/86400;   // the sky turns in real time
  ssDays = (Date.now()/86400000 + 2440587.5) - JD_NOW;   // and shows right now
  SKYV.on = true; document.body.classList.add('sky');
  backyard.update(); orbit.yaw = -Math.PI; orbit.pitch = 0.5;
  setInfo(backyard.index); $('#skyBar').hidden = false; $('#skyWhere').textContent = (SKYV.place || '') + ' · ' + fmtLatLon(SKYV.lat, SKYV.lon);
  earth.noLabel = true; updateModeUI();
  toast('drag to look around · the sky above ' + (SKYV.place || 'you') + ', right now');
}
function exitSky(){
  if (!SKYV.on) return;
  SKYV.on = false; document.body.classList.remove('sky'); $('#skyBar').hidden = true; earth.noLabel = false;
  if (skyPrevRate != null) ssRate = skyPrevRate;
  // leave from where you stand: a camera a couple of km up, so the flight rises smoothly back out to the globe
  orbit.dist = orbit.distT = 2000*KM; orbit.target = V.add(cam.rel, V.mul(cam.fwd, 2000*KM));
  orbit.lock = -1; lockOn(earth.index);
}
SKYV.readout = () => {
  if (!SKYV.on) return '';
  const jd = jdNow(), ob = observerAt(jd), sun = altAz(ob, sunFromEarth(jd));
  const sky = sun.alt > 0 ? 'the Sun is up: in real life the daylight would hide these stars' : sun.alt > -12 ? 'twilight' : 'night: the stars you see here are the ones above you';
  return `${SKYV.place || ''} ${fmtLatLon(SKYV.lat, SKYV.lon)} · ${localTime(jd)} local · ${sky}\nlooking ${compass(((SKYV.az || 0)/DEG + 360) % 360)}, ${Math.round((SKYV.alt || 0)/DEG)}° up`;
};
$('#btnSky').addEventListener('click', enterSky);
$('#skyExit').addEventListener('click', exitSky);
$('#skyBar').addEventListener('click', e => { const b = e.target.closest('[data-dir]'); if (!b) return; const v = b.dataset.dir;
  if (v === 'up'){ orbit.pitch = 1.5; } else { orbit.yaw = -(+v)*DEG; orbit.pitch = 0.3; } });
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (SKYV.on && k === 'escape'){ e.stopImmediatePropagation(); e.preventDefault(); exitSky(); }
  else if (k === 'b' && !SAVER.on && FLAGS.backyard){ e.preventDefault(); SKYV.on ? exitSky() : enterSky(); }
}, { capture:true });
// anything that flies somewhere else ends the planetarium first
{ const prevLock = lockOn; lockOn = function(i, v){ if (SKYV.on && i !== backyard.index){ SKYV.on = false; document.body.classList.remove('sky'); $('#skyBar').hidden = true; earth.noLabel = false; if (skyPrevRate != null) ssRate = skyPrevRate;
  orbit.dist = orbit.distT = 2000*KM; orbit.target = V.add(cam.rel, V.mul(cam.fwd, 2000*KM)); } return prevLock(i, v); }; }

// ---------------------------------------------------------------- what is happening up there
// meteor showers peak on (almost) the same dates every year; eclipses are listed from published predictions
const SHOWERS = [['Quadrantids', 1, 3], ['Lyrids', 4, 22], ['Eta Aquariids', 5, 6], ['Perseids', 8, 12], ['Draconids', 10, 8], ['Orionids', 10, 21], ['Leonids', 11, 17], ['Geminids', 12, 14], ['Ursids', 12, 22]];
const ECLIPSES = [['2027-08-02', 'total solar eclipse', 'Spain, North Africa, Egypt: over six minutes of totality at Luxor'], ['2028-01-12', 'partial lunar eclipse', 'visible from the Americas, Europe and Africa'],
  ['2028-07-22', 'total solar eclipse', 'Australia and New Zealand, through Sydney'], ['2028-12-31', 'total lunar eclipse', 'Europe, Africa, Asia and Australia'],
  ['2029-06-26', 'total lunar eclipse', 'one of the longest of the century, seen from the Americas, Europe and Africa'], ['2030-06-01', 'annular solar eclipse', 'North Africa, Europe and Russia'],
  ['2030-11-25', 'total solar eclipse', 'southern Africa and Australia']];
const SYNODIC = 29.530588, NEW0 = 2451550.26;
function moonInfo(jd){
  const age = ((jd - NEW0) % SYNODIC + SYNODIC) % SYNODIC, lit = (1 - Math.cos(2*Math.PI*age/SYNODIC))/2;
  const name = age < 1.5 || age > 28 ? 'new Moon' : age < 6.4 ? 'waxing crescent' : age < 8.4 ? 'first quarter' : age < 13.8 ? 'waxing gibbous' : age < 15.8 ? 'full Moon' : age < 21.1 ? 'waning gibbous' : age < 23.1 ? 'last quarter' : 'waning crescent';
  const toFull = ((14.765 - age) % SYNODIC + SYNODIC) % SYNODIC;
  return { age, lit, name, toFull };
}
const fmtIn = days => days < 1/24 ? 'now' : days < 1 ? `in ${Math.round(days*24)} h` : days < 45 ? `in ${Math.round(days)} days` : `in ${Math.round(days/30.4)} months`;
const dateOf = jd => new Date((jd - 2440587.5)*86400000);
function issPasses(jd0){
  // visible passes: the station at least 15° up, lit by the Sun, while your sky is dark
  const el = typeof earthLive !== 'undefined' && earthLive.status === 'live' ? Object.entries(earthLive.named).find(([n]) => /^ISS \(ZARYA\)/.test(n)) : null;
  if (!el || SKYV.lat == null) return [];
  const out = []; let inPass = false, best = null;
  for (let m = 0; m < 24*60; m += 0.5){
    const jd = jd0 + m/1440, ob = observerAt(jd), iss = Object.assign(el[1].slice(), { ref:earthLive.satRef });
    const rel = V.sub(earthLiveISS(iss, jd), ob.pos), aa = altAz(ob, rel), sun = altAz(ob, sunFromEarth(jd));
    const lit = V.dot(V.norm(earthLiveISS(iss, jd)), V.norm(sunFromEarth(jd))) > -0.35;
    const vis = aa.alt > 15 && sun.alt < -6 && lit;
    if (vis){ if (!inPass){ inPass = true; best = { jd, alt:aa.alt, az:aa.az }; } else if (aa.alt > best.alt) best = { jd, alt:aa.alt, az:aa.az }; }
    else if (inPass){ inPass = false; out.push(best); if (out.length >= 3) break; }
  }
  return out;
}
function earthLiveISS(el, jd){   // same two-body + J2 motion as the ISS object, geocentric world offset
  const [a, inc, raan0, M0, e, argp0] = el, t = (jd - el.ref)*86400, n = Math.sqrt(398600.4418/(a*a*a)), pp = a*(1 - e*e), k = 1.5*1.08263e-3*(6378.137/pp)**2*n;
  const raan = raan0 - k*Math.cos(inc)*t, argp = argp0 + 0.5*k*(5*Math.cos(inc)**2 - 1)*t, M = (M0 + n*t) % (2*Math.PI); let E = M; for (let i=0;i<6;i++) E -= (E - e*Math.sin(E) - M)/(1 - e*Math.cos(E));
  const nu = 2*Math.atan2(Math.sqrt(1 + e)*Math.sin(E/2), Math.sqrt(1 - e)*Math.cos(E/2)), r = a*(1 - e*Math.cos(E)), u = argp + nu;
  const q = [r*(Math.cos(u)*Math.cos(raan) - Math.sin(u)*Math.cos(inc)*Math.sin(raan)), r*(Math.cos(u)*Math.sin(raan) + Math.sin(u)*Math.cos(inc)*Math.cos(raan)), r*Math.sin(u)*Math.sin(inc)];
  return V.mul(M3.apply(earth.R0, [q[1], q[2], q[0]]), KM);
}
function planetsTonight(jd0){
  if (SKYV.lat == null) return [];
  // the next dark hour: step forward until the Sun is 12° down, then look at each planet over the following 4 hours
  let jd = jd0; for (let h = 0; h < 30; h++){ const ob = observerAt(jd); if (altAz(ob, sunFromEarth(jd)).alt < -12) break; jd += 1/24; }
  const out = [];
  for (const key of ['venus', 'mars', 'jupiter', 'saturn', 'mercury']){
    let best = null;
    for (let h = 0; h <= 4; h += 0.5){ const t = jd + h/24, ob = observerAt(t); if (altAz(ob, sunFromEarth(t)).alt > -10) continue; const aa = altAz(ob, bodyFromEarth(key, t)); if (!best || aa.alt > best.alt) best = Object.assign(aa, { t }); }
    if (best && best.alt > 12) out.push({ key, ...best });
  }
  return out;
}
function refreshEvents(){
  const box = $('#events'), jd = (Date.now()/86400000) + 2440587.5, items = [];
  const mi = moonInfo(jd);
  items.push({ when:'tonight', t:`${mi.name} · ${Math.round(mi.lit*100)}% lit`, s:mi.toFull < 1 ? 'full tonight' : `full Moon ${fmtIn(mi.toFull)}`, go:'moon' });
  for (const p of planetsTonight(jd)) items.push({ when:localTime(p.t) + ' local', t:`${BYKEY[p.key].name} is up`, s:`${Math.round(p.alt)}° high in the ${compass(p.az)}`, go:p.key });
  for (const p of issPasses(jd)) items.push({ when:dateOf(p.jd).toLocaleString([], { weekday:'short', hour:'2-digit', minute:'2-digit' }), t:'the ISS passes over', s:`up to ${Math.round(p.alt)}° high, look ${compass(p.az)} · a bright moving star`, go:'iss' });
  const lau = typeof earthLive !== 'undefined' ? earthLive.launches : [];
  for (const l of lau.slice(0, 3)) items.push({ when:fmtIn((Date.parse(l.net) - Date.now())/86400000), t:`launch: ${l.name}`, s:`${l.provider ? l.provider + ' · ' : ''}${l.site || l.pad}`, go:'earth' });
  const y = new Date().getUTCFullYear();
  const sh = SHOWERS.map(([n, m, d]) => { let t = Date.UTC(y, m - 1, d); if (t < Date.now() - 2*864e5) t = Date.UTC(y + 1, m - 1, d); return { n, t }; }).sort((a, b) => a.t - b.t).slice(0, 2);
  for (const s of sh) items.push({ when:fmtIn((s.t - Date.now())/864e5), t:`${s.n} meteor shower peaks`, s:'best after midnight, away from city lights', go:null });
  for (const [d, what, where] of ECLIPSES.filter(([d]) => Date.parse(d) > Date.now()).slice(0, 2)) items.push({ when:d, t:what, s:where, go:what.includes('solar') ? 'sun' : 'moon' });
  if (SKYV.lat == null) items.push({ when:'', t:'set your location', s:'for planets and ISS passes over you', go:'__where' });
  box.textContent = '';
  for (const it of items){
    const b = document.createElement('button'); b.className = 'ev';
    b.innerHTML = '<span class="ew"></span><span class="et"></span>'; b.querySelector('.ew').textContent = it.when;
    const et = b.querySelector('.et'); et.textContent = it.t; const sm = document.createElement('small'); sm.textContent = it.s; et.appendChild(sm);
    b.addEventListener('click', () => { if (it.go === '__where'){ $('#skyPlaces').hidden = false; return; } if (it.go && BYKEY[it.go]) goTo(BYKEY[it.go].index); });
    box.appendChild(b);
  }
}
{ const prev = togglePanel; togglePanel = function(id, on){ prev(id, on); if (on && id === 'timem') refreshEvents(); }; }
setInterval(() => { if (!$('#timem').hidden) refreshEvents(); }, 60000);

// ---------------------------------------------------------------- Earth's story: 4.54 billion years on one slider
// [years ago, name, what happened]; ages are the usual textbook values, rounded
const STORY = [
  [4.54e9, 'Earth forms', 'Dust and rock around the young Sun clump into a planet covered in an ocean of magma.'],
  [4.5e9, 'The Moon is born', 'A Mars-sized world, Theia, strikes Earth. The debris thrown into orbit gathers into the Moon.'],
  [4.4e9, 'The first oceans', 'The crust cools and water rains out of the steam-filled sky: tiny zircon crystals still record it.'],
  [3.7e9, 'First life', 'Single-celled microbes appear in the oceans. For the next three billion years, life stays microscopic.'],
  [2.4e9, 'The Great Oxidation', 'Photosynthesising microbes fill the air with oxygen, poisoning much of the life that came before.'],
  [2e9, 'Complex cells', 'Cells with a nucleus evolve, the ancestors of every plant, fungus and animal.'],
  [7.2e8, 'Snowball Earth', 'Ice spreads almost from pole to pole and stays for millions of years.'],
  [5.38e8, 'The Cambrian explosion', 'Animals with eyes, shells and legs appear in a geological blink.'],
  [4.7e8, 'Plants reach land', 'The first mosses creep onto bare rock; the continents slowly turn green.'],
  [3.85e8, 'The first forests', 'Trees with roots and wood spread across the land.'],
  [2.52e8, 'The Great Dying', 'Volcanic eruptions in Siberia kill about 90% of species in the ocean: the worst extinction of all.'],
  [2.3e8, 'Dinosaurs', 'Dinosaurs appear, and the first mammals soon after, small and nocturnal.'],
  [6.6e7, 'The asteroid', 'A 10 km asteroid hits Mexico. The non-bird dinosaurs die out and mammals inherit the Earth.'],
  [2.3e6, 'The first humans', 'Homo habilis, the first of our genus, makes stone tools in East Africa.'],
  [1e6, 'Fire', 'Early humans learn to control fire, and later to cook, to see at night and to keep warm.'],
  [3e5, 'Homo sapiens', 'Our own species appears in Africa.'],
  [6e4, 'Out of Africa', 'Modern humans spread across Asia, then Australia, Europe and finally the Americas.'],
  [4.5e4, 'The first art', 'People paint animals and hands on cave walls.'],
  [1.2e4, 'Farming', 'Agriculture begins in the Fertile Crescent, and villages, then cities, follow.'],
  [5.2e3, 'Writing', 'Writing is invented in Mesopotamia: history begins.'],
  [4.5e3, 'The pyramids', 'The Great Pyramid of Giza is built.'],
  [585, 'The printing press', 'Around 1440 printing with movable type spreads knowledge across Europe.'],
  [417, 'The telescope', 'In 1609 Galileo points a telescope at the sky and sees the moons of Jupiter.'],
  [146, 'Electric light', 'From the 1880s cities begin to glow at night.'],
  [123, 'Flight', 'In 1903 the Wright brothers fly for 12 seconds.'],
  [69, 'The first satellite', 'In 1957 Sputnik 1 beeps its way around the Earth.'],
  [65, 'The first person in space', 'In 1961 Yuri Gagarin orbits the Earth once.'],
  [57, 'People on the Moon', 'In 1969 Apollo 11 lands; twelve people walk on the Moon by 1972.'],
  [36, 'Hubble', 'In 1990 the Hubble Space Telescope is launched.'],
  [26, 'The ISS is lived in', 'Since November 2000 there have always been people living in space.'],
  [0, 'Today', 'About eight billion people, ten thousand working satellites, and a view of the whole universe.'],
];
// a fourth-power scale: deep time gets room, and so does the last 5,000 years of human history
const AGE = 4.54e9, sToYa = s => AGE*Math.pow(1 - s/1000, 4), yaToS = ya => 1000*(1 - Math.pow(Math.max(ya, 0)/AGE, 0.25));
const fmtYa = ya => ya < 1 ? 'today' : ya < 1e4 ? `${Math.round(ya).toLocaleString('en-US')} years ago` : ya < 1e6 ? `${Math.round(ya/1000).toLocaleString('en-US')},000 years ago` : ya < 1e9 ? `${+(ya/1e6).toPrecision(3)} million years ago` : `${+(ya/1e9).toPrecision(3)} billion years ago`;
function eraOf(ya){
  if (ya > 4.0e9) return 3 + smooth(4.0e9, 4.4e9, ya);            // molten, cooling into
  if (ya > 2.4e9) return 2 + smooth(2.4e9, 2.6e9, ya);            // an ocean world under an orange haze
  if (ya > 6.35e8) return 1 + smooth(6.35e8, 6.5e8, ya)*(1 - smooth(7.05e8, 7.2e8, ya));   // bare continents, and snowball Earth
  return smooth(3.8e8, 4.7e8, ya);                                // land plants turn the continents green
}
{ const ticks = $('#stTicks'); for (const [ya, n] of STORY){ const i = document.createElement('i'); i.style.left = (yaToS(ya)/10).toFixed(2) + '%'; i.title = n; ticks.appendChild(i); } }
let storyOn = false, storyPlay = false, storyS = 1000;
function setStory(s){
  storyS = clamp(s, 0, 1000); $('#storyTime').value = storyS;
  const ya = sToYa(storyS); let m = STORY[0]; for (const e of STORY) if (e[0] >= ya - 0.5) m = e;
  $('#stWhen').textContent = fmtYa(ya);
  if ($('#stName').textContent !== m[1]){ $('#stName').textContent = m[1]; $('#stText').textContent = m[2]; }
  EARTH_ERA.era = eraOf(ya); EARTH_ERA.lights = ya < 146 ? smooth(146, 40, ya) : 0; EARTH_ERA.ya = ya;
}
function openStory(){
  if (SKYV.on) exitSky(); togglePanel(null, false);
  storyOn = true; $('#story').hidden = false;
  if (orbit.lock !== earth.index || flight) lockOn(earth.index, 0);
  setStory(storyS);
}
function closeStory(quiet){ if (!storyOn) return; storyOn = false; storyPlay = false; $('#storyPlay').textContent = 'play'; $('#story').hidden = true; EARTH_ERA.era = 0; EARTH_ERA.lights = 1; EARTH_ERA.ya = 0; }
$('#btnStory').addEventListener('click', openStory);
$('#storyClose').addEventListener('click', () => closeStory());
$('#storyTime').addEventListener('input', e => { storyPlay = false; $('#storyPlay').textContent = 'play'; setStory(+e.target.value); });
$('#storyPlay').addEventListener('click', () => { storyPlay = !storyPlay; if (storyPlay && storyS >= 999) setStory(0); $('#storyPlay').textContent = storyPlay ? 'pause' : 'play'; });
{ const prev = updateHUD; updateHUD = function(dt){ prev(dt); if (storyOn && storyPlay){ setStory(storyS + dt*14); if (storyS >= 1000){ storyPlay = false; $('#storyPlay').textContent = 'play'; } } }; }
Object.assign(window.__cosmos, { enterSky, exitSky, openStory, setStory, refreshEvents, SKYV, observerAt, altAz });
$('#btnSky').hidden = !FLAGS.backyard; $('#btnStory').hidden = !FLAGS.earthStory;
