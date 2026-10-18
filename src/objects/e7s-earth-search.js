// ================================================================ places on Earth (phase 2 of docs/EARTH_PLAN.md): the search also finds cities (GeoNames), mountains, regions and
// waters (Natural Earth), from the list EARTH_NAMES names, fetched the first time a search is typed. Picking one flies down to it: a place is
// one of two objects, set to it and used in turn (a flight always goes from one to the other), standing on the turning Earth like a launch
// pad, with angles that suit its kind: oblique ones that let mountains stand up, and one from overhead. Mountains and regions are flown to by
// day (the clock eases to the afternoon there, as for a launch); cities keep the clock, so at night their lights show. A link to one carries
// the place itself (g=), so it opens there. Since 0.15.0 the famous places with their own layers (e9p-earth-places.js) have an object each,
// dressed by the same code: a row that names one of them (ownHooks) flies to that object, and a spot set to one (spotHooks) is dressed the same.
const EPL = (() => {
  const can = typeof EARTH_NAMES !== 'undefined' && FLAGS.realEarth && /^https?:$/.test(location.protocol) && typeof fetch === 'function';
  const R = 6371, unit = (la, lo) => [Math.cos(la*DEG)*Math.cos(lo*DEG), Math.sin(la*DEG), -Math.cos(la*DEG)*Math.sin(lo*DEG)];
  const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let data = null, names = null, ctry = null, state = 0, turn = 0, pend = null; const spotHooks = [], ownHooks = [], findHooks = [];
  const onLoad = [];
  function load(){
    if (!can || state) return; state = 1;
    fetch('earth/' + EARTH_NAMES.file).then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => { data = j; names = j.p.map(r => fold(r[0])); ctry = {}; for (const k in j.cc) ctry[k] = fold(j.cc[k]); state = 2; onLoad.forEach(f => f()); })
      .catch(e => { state = 3; console.info('places on Earth: names not loaded (' + e + ')'); });
  }
  // how big a place is, for the ranking: people, height or size
  const big = r => r[1] === 'c' || r[1] === 'C' ? Math.log10(r[4]) + (r[1] === 'C' ? 1.2 : 0) : r[1] === 'm' ? 3 + r[4]/1500 : 3.5 + Math.log10(r[4])*0.8;
  // up to n places whose name (or country) has a word starting with each word typed, the best first: the whole name typed, then names that
  // start with it, then the biggest (Paris before Paris, Texas)
  function find(q, n = 6){
    if (!can) return [];
    const qq = fold(q).trim(), words = qq.split(/[\s,]+/).filter(Boolean); if (qq.length < 2 || !words.length) return [];
    const hit = (s, w) => s.startsWith(w) || s.includes(' ' + w) || s.includes('-' + w) || s.includes('(' + w);
    // (the famous places with their own layers first, by their names and other names, also before the list is in: e9p-earth-places.js)
    const out = []; for (const f of findHooks) out.push(...f(words, qq, hit));
    if (!names){ load(); return out.sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]); }
    for (let i=0;i<names.length;i++){
      const nm = names[i], r = data.p[i], c = r[5] ? ctry[r[5]] || '' : '';
      if (!words.every(w => hit(nm, w) || (c && hit(c, w)))) continue;
      out.push([(nm === qq ? 100 : nm.startsWith(qq) ? 40 : 0) + big(r), r]);
    }
    out.sort((a, b) => b[0] - a[0]);
    // (one row a place: a name that leads to a famous place already listed goes)
    const res = [], had = new Set();
    for (const [, r] of out){ const m = ownOf(r); if (m){ if (had.has(m.obj)) continue; had.add(m.obj); } res.push(r); if (res.length >= n) break; }
    return res;
  }
  // the famous place with its own object a row names, if any: { obj, vi } (the object, and the angle to start from)
  function ownOf(r){ for (const f of ownHooks){ const m = r && f(r); if (m) return m; } return null; }
  const people = p => p >= 1e6 ? (p/1e6).toFixed(p >= 1e7 ? 0 : 1) + ' million' : Math.round(p/1000)*1000 >= 1000 ? Math.round(p/1000).toLocaleString('en-US') + ',000' : String(p);
  const metres = m => Math.round(m).toLocaleString('en-US') + ' m';
  const llTxt = (la, lo) => Math.abs(la).toFixed(2) + '° ' + (la >= 0 ? 'N' : 'S') + ', ' + Math.abs(lo).toFixed(2) + '° ' + (lo >= 0 ? 'E' : 'W');
  // famous places, listed by the atlas's "on Earth" kind without a search (rows as in the names list, from it; their countries below)
  const PICKS = {
    mountains:[["Mount Everest","m",27.98,86.881,8848],["K2","m",35.882,76.513,8611],["Aconcagua","m",-32.656,-70.016,6959],["Denali","m",63.069,-151.007,6194],["Mount Kilimanjaro","m",-3.076,37.353,5895],
      ["Mount Elbrus","m",43.355,42.439,5642],["Vinson Massif","m",-78.529,-85.634,4892],["Mont Blanc","m",45.834,6.865,4807],["Matterhorn","m",45.938,7.73,4478],["Mount Rainier","m",46.85,-121.76,4392],
      ["Mauna Kea","m",19.82,-155.468,4205],["Mount Fuji","m",35.358,138.731,3776],["Mount Etna","m",37.755,14.995,3322]],
    regions:[["Sahara","r",19.834,13.707,6447,"","desert"],["Himalayas","r",29.64,88.631,2592,"","mountain range"],["Andes","r",-35.649,-72.596,10487,"","mountain range"],["Alps","r",46.172,10.979,1004,"","mountain range"],
      ["Rocky Mountains","r",46.092,-113.647,3453,"","mountain range"],["Tibetan Plateau","r",33.914,90.757,3258,"","plateau"],["Grand Canyon","r",36.191,-112.718,285,"","gorge"],["Great Rift Valley","r",6.322,38.854,2785,"","valley"],
      ["Amazon basin","r",-1.989,-53.96,5523,"","basin"],["Nile Delta","r",31.103,31.047,245,"","delta"],["Gobi Desert","r",41.767,104.437,2420,"","desert"],["Atacama Desert","r",-23.57,-70.028,1265,"","desert"],
      ["Namib","r",-20.091,13.652,1695,"","desert"],["Kalahari Desert","r",-23.686,19.272,2284,"","desert"],["Patagonia","r",-49.687,-71.584,3952,"","region"]],
    islands:[["Greenland","i",73.04,-42.42,2944,"","island"],["Iceland","i",65.347,-19.872,591,"","island"],["Madagascar","i",-17.738,46.775,1772,"","island"],["Hawaii","i",19.615,-155.579,165,"","island group"],
      ["Galapagos Islands","i",-0.628,-90.573,375,"","island group"],["Svalbard","i",77.991,21.629,931,"","island group"]],
    waters:[["Great Barrier Reef","w",-21.536,150.373,3080,"","reef"],["Mediterranean Sea","w",36.891,17.864,3545,"","sea"],["Caribbean Sea","w",15.371,-76.083,3682,"","sea"],["Red Sea","w",20.049,39.078,2008,"","sea"],
      ["Persian Gulf","w",27.105,51.56,1144,"","gulf"],["Gulf of Mexico","w",27.61,-89.568,2164,"","gulf"],["Bay of Bengal","w",18.434,88.054,3266,"","bay"],["Strait of Gibraltar","w",35.992,-5.633,85,"","strait"]],
    // (wonders built by people: the famous places add theirs, e9p-earth-places.js; an empty kind is not listed)
    wonders:[],
    cities:[["Tokyo","C",35.69,139.692,9733276,"JP"],["Shanghai","c",31.222,121.458,24874500,"CN"],["Beijing","C",39.908,116.397,18960744,"CN"],["Istanbul","c",41.014,28.95,15701602,"TR"],["Lagos","c",6.454,3.395,15388000,"NG"],
      ["Mumbai","c",19.073,72.883,12691836,"IN"],["São Paulo","c",-23.547,-46.636,12400232,"BR"],["Mexico City","C",19.428,-99.128,12294193,"MX"],["Moscow","C",55.752,37.618,10381222,"RU"],["Cairo","C",30.063,31.25,9606916,"EG"],
      ["London","C",51.509,-0.126,8961989,"GB"],["New York City","c",40.714,-74.006,8804190,"US"],["Hong Kong","c",22.278,114.175,7396076,"CN"],["Rio de Janeiro","c",-22.906,-43.182,6747815,"BR"],["Sydney","c",-33.868,151.207,5638830,"AU"],
      ["Singapore","C",1.29,103.85,5638700,"SG"],["Rome","C",41.894,12.483,2750000,"IT"],["San Francisco","c",37.775,-122.419,873965,"US"],["Cape Town","c",-33.926,18.423,4772846,"ZA"],["Los Angeles","c",34.052,-118.244,3820914,"US"],["Las Vegas","c",36.175,-115.137,641903,"US"],["Dubai","c",25.077,55.309,3790000,"AE"],["Paris","C",48.853,2.349,2138551,"FR"]],
  };
  const PICK_CC = { IT:'Italy', JP:'Japan', US:'United States', GB:'United Kingdom', FR:'France', AE:'United Arab Emirates', CN:'China', IN:'India', BR:'Brazil', EG:'Egypt', AU:'Australia', MX:'Mexico', TR:'Turkey', SG:'Singapore', ZA:'South Africa', NG:'Nigeria', RU:'Russia', HK:'Hong Kong' };
  // a result in words: [what it is, the short line in the list]
  function about(r){
    const cn = r[5] ? (data && data.cc[r[5]]) || PICK_CC[r[5]] || '' : '';
    if (r[1] === 'c' || r[1] === 'C') return [(r[1] === 'C' ? 'the capital of ' : 'a city in ') + (cn || 'its country'), cn || 'city'];
    if (r[1] === 'm') return [r[6] ? 'a ' + r[6] : 'a mountain', metres(r[4])];
    return ['a' + (/^[aeiou]/.test(r[6] || '') ? 'n ' : ' ') + (r[6] || (r[1] === 'i' ? 'island' : 'region')), r[6] || (r[1] === 'w' ? 'water' : 'region')];
  }
  // ---------------------------------------------------------------- the two place objects
  const VIEWS = {
    // (mountains: from the south-east and low, looking up at it; closer from the west; then from high above)
    m:[{ d:[0.62, 0.3, 0.72], k:13, hold:12, drift:0.012 }, { d:[-0.78, 0.15, 0.6], k:6, hold:10, drift:0.015 }, { d:[0.1, 0.75, 0.65], k:24, hold:10, drift:0.01 }],
    c:[{ d:[0.5, 0.42, 0.75], k:9, hold:11, drift:0.015 }, { d:[-0.6, 0.22, 0.77], k:4.5, hold:10, drift:0.02 }, { d:[0.05, 1, 0.1], k:14, hold:9, drift:0.008 }],
    r:[{ d:[0.3, 0.6, 0.75], k:2.4, hold:12, drift:0.01 }, { d:[-0.2, 0.3, 0.93], k:1.6, hold:10, drift:0.012 }, { d:[0, 1, 0.1], k:3.2, hold:10, drift:0.008 }],
  };
  const spots = [0, 1].map(i => addObj({ key:'earth-place-' + i, name:'a place on Earth', label:'', type:'a place on Earth', group:'travel', parent:earth, offset:[0, 0, 0],
    rad:4*KM, layer:3, noPick:true, atlas:false, noLabel:true, noTour:true, noWaypoint:true, noImpostor:true, pxMin:1, visFn:() => 1, labelRange:0, minZoom:0.3,
    distEarth:'here on Earth', earthSpot:true, views:VIEWS.c, R0:M3.I(),
    place:{ la:0, lo:0, h:0, row:null, kind:'c' }, readout(){ return readout(this); }, update(){ placeSpot(this); }, flyIn(vp, done){ return flyIn(this, vp, done); } }));
  // where it stands now: on the turning Earth, at the height of the ground as drawn (the tiles' heights once they are in)
  function placeSpot(o){
    // (a city with its own layers stands at its centre's ground, where its framings were measured; a famous place at sea level under its
    // middle, where its framings were measured from)
    const P = o.place, g = o.iconic || o.city ? null : ETL.heightAt(P.la*DEG, P.lo*DEG), h = o.iconic ? 0 : o.city ? o.city.ele || 0 : g != null ? (P.kind === 'm' ? Math.max(g, P.h*0.8) : g) : P.h;
    o.hNow = o.hNow == null || Math.abs(o.hNow - h) > 2000 ? h : o.hNow + (h - o.hNow)*0.1;
    const u = unit(P.la, P.lo), F = enuOf(u);
    o.offset = V.mul(M3.apply(earth.rot, V.mul(u, R + o.hNow/1000)), KM); o.pos = V.add(earth.pos, o.offset);
    o.R0 = M3.mul(earth.rot, F.M); o.up = u; o.F = F;
    // locked on it, the camera turns with the Earth, and stays above the ground under it (and 150 m clear)
    if (orbit.lock === o.index && !flight && !LCAM.on && !SKYV.on){ orbit.frame = o.R0; clearGround(o); }
  }
  function clearGround(o){
    const P = o.place, dKm = orbit.dist/KM;
    // (the camera circles the point it looks at, which a framing may set km away from the place's middle: a famous place's peaks and coasts)
    const offF = M3.applyT(earth.rot, V.mul(orbit.off, 1/KM));
    for (let k=0;k<3;k++){
      const d = sphL(orbit.yaw, orbit.pitch), eyeF = V.add(V.add(V.mul(o.up, R + o.hNow/1000), offF), V.add(V.add(V.mul(o.F.e, d[0]*dKm), V.mul(o.up, d[1]*dKm)), V.mul(o.F.n, -d[2]*dKm)));
      // (the tiles' ground, or a city's or launch site's own heights with the buildings on it, where they are in)
      const r = V.len(eyeF), la = Math.asin(eyeF[1]/r), lo = Math.atan2(-eyeF[2], eyeF[0]), g0 = ETL.heightAt(la, lo), g1 = EDT.heightAt(eyeF), g = g1 != null ? Math.max(g1, g0 || 0) : g0;
      const need = ((g == null ? 0 : g) + 150)/1000 - (r - R);   // (km the eye is under where it should be)
      if (!(need > 0)) break;
      orbit.pitch = Math.min(orbit.pitch + need/Math.max(dKm, 0.1)*1.05, 1.5);
    }
  }
  // the credit for the ground in view: the layers drawn under the camera (a famous place's, a city's or a pad's, e3-earth-detail.js), or the maps
  const groundTxt = () => EDT.creditNow() || 'ground: NASA Blue Marble and GEBCO, about 2.4 km a pixel';
  function readout(o){
    const P = o.place, r = P.row;
    // (a famous place with its own layers: e9p-earth-places.js)
    if (o.dressRO) return o.dressRO();
    // (moved over the ground by hand: where it is, and the city's time and weather when it is over one)
    if (!r) return [llTxt(P.la, P.lo) + (o.hNow != null ? ' · ground ' + metres(o.hNow) + ' above sea level' : ''), o.city && typeof ECT !== 'undefined' ? ECT.nowLine(o.city) : '',
      o.city ? EDT.credit(o.city.ed, true) : groundTxt()].filter(Boolean).join('\n');
    const what = r[1] === 'c' || r[1] === 'C' ? `about ${people(r[4])} people` : r[1] === 'm' ? `${metres(r[4])} above sea level` : `its outline spans about ${Math.round(r[4]).toLocaleString('en-US')} km`;
    // (a city with its own layers: its time and weather, and the credit for its photos and buildings)
    if (o.city) return [`${llTxt(P.la, P.lo)} · about ${people(o.city.facts.population.n)} people`, o.readoutExtra ? o.readoutExtra() : '', EDT.credit(o.city.ed, true)].filter(Boolean).join('\n');
    return `${llTxt(P.la, P.lo)} · ${what}\n${r[1] === 'c' || r[1] === 'C' ? 'name: GeoNames (CC BY 4.0)' : 'name: Natural Earth'} · ${groundTxt()}`;
  }
  // set a place object to a result
  function setSpot(o, r){
    const [name, kind, la, lo, n] = r, k = kind === 'C' ? 'c' : kind === 'm' ? 'm' : kind === 'c' ? 'c' : 'r', [what] = about(r);
    o.place = { la, lo, la0:la, lo0:lo, h:kind === 'm' ? n : 0, row:r, kind:k }; o.hNow = null; o.city = null; o.readoutExtra = null; o.iconic = null; o.dressRO = null; o.tourViews = null; o.dayAt = null;
    o.name = name; o.type = what;
    o.rad = (k === 'm' ? 3 : k === 'c' ? 5 : clamp(n*0.35, 20, 2000))*KM; o.minZoom = k === 'r' ? 0.05 : 0.3;
    o.views = VIEWS[k];
    o.fact = k === 'c' ? `${name} is ${what}, with about ${people(n)} people (GeoNames).` :
      k === 'm' ? `${name} rises ${metres(n)} above sea level (Natural Earth). Its shape here comes from GEBCO's heights at about 2 km a pixel, so smaller peaks and ridges are smoothed; the clouds are illustrative.` :
      `${name} is ${what}. Natural Earth's outline of it spans about ${Math.round(n).toLocaleString('en-US')} km.`;
    // (later files dress it up: a city with its own layers, e9c-earth-cities.js)
    for (const f of spotHooks) f(o, r);
    placeSpot(o);
  }
  // ---------------------------------------------------------------- moving over the ground by hand (0.13.0, owner: navigating near the ground
  // should be easy and smooth, like Google Earth): a drag, the wheel toward the cursor, WASD and the arrows move the place the camera looks at,
  // so the ground follows the mouse. Once it has gone more than a few km from the place it was set to, it is "over" the nearest famous place
  function panKm(o, dN, dE){
    if (o.own) o = handoff(o);
    const P = o.place; P.la = clamp(P.la + dN/R/DEG, -85, 85); P.lo = ((P.lo + dE/(R*Math.cos(P.la*DEG))/DEG + 540) % 360) - 180;
    const away = V.len(V.sub(V.mul(unit(P.la, P.lo), R), V.mul(unit(P.la0, P.lo0), R)));
    if (P.row && away > Math.max(8, 4*o.rad/KM)){
      P.row = null; o.city = null; o.readoutExtra = null; o.iconic = null; o.dressRO = null; o.tourViews = null; o.dayAt = null; o.hNow = null;
      o.type = 'a place on Earth'; o.fact = 'Drag to move over the ground, right-drag to turn and tilt, scroll toward a spot to go closer. Search or pick a place to fly there.';
      o.views = [{ d:sphL(orbit.yaw, orbit.pitch), k:orbit.dist/o.rad, hold:30, drift:0 }];
    }
    // (moved by hand: named after the nearest famous place, as it goes)
    if (!P.row){ const near = nearest(P.la*DEG, P.lo*DEG, 400);
      const nm = near ? 'over ' + near.row[0].replace(/^the /, '') + (near.km > 15 ? ' (' + Math.round(near.km/5)*5 + ' km away)' : '') : 'a place on Earth';
      if (nm !== o.name){ o.name = nm; if (typeof setInfo === 'function' && infoObj === o.index) setInfo(o.index); } }
    // (over one of the five cities: its time and weather in the readout)
    if (!P.row && typeof ECT !== 'undefined'){ const c = ECT.match(P.la, P.lo, null); if (c !== o.city){ o.city = c; } }
    placeSpot(o);
  }
  // a move of the mouse by (dx, dy) CSS pixels, as ground: the place moves the other way, so the ground under the mouse follows it
  function panPx(o, dx, dy){
    if (o.own) o = handoff(o);
    const s = 2*tanY/viewHcss*orbit.dist/KM, up = M3.apply(earth.rot, o.up);
    const flat = v => V.sub(v, V.mul(up, V.dot(v, up))), rt = V.norm(flat(cam.right)), f0 = flat(cam.fwd), fw = V.len(f0) > 0.05 ? V.norm(f0) : V.norm(flat(cam.up));
    const d = V.add(V.mul(rt, -dx*s), V.mul(fw, dy*s/Math.max(Math.sin(Math.max(orbit.pitch, 0.05)), 0.25)));
    panKm(o, V.dot(d, M3.apply(earth.rot, o.F.n)), V.dot(d, M3.apply(earth.rot, o.F.e)));
  }
  // the famous place nearest a point (radians), within maxKm: { row, km }
  const ALL_PICKS = Object.values(PICKS).flat();
  function nearest(la, lo, maxKm){
    const u = V.mul([Math.cos(la)*Math.cos(lo), Math.sin(la), -Math.cos(la)*Math.sin(lo)], R); let best = null, bd = maxKm;
    for (const r of ALL_PICKS){ const d = V.len(V.sub(u, V.mul(unit(r[2], r[3]), R))); if (d < bd){ bd = d; best = r; } }
    return best ? { row:best, km:bd } : null;
  }
  // fly down to a result: straight there when the camera is above the place's horizon, else first round to above it (a flight that
  // started on the far side would go through the Earth)
  function go(r){
    if (!r) return;
    // (a famous place with its own object: to it, at the angle the row asks for)
    const m = ownOf(r); if (m){ goWith(m.obj, null, m.vi); return; }
    const o = spots[turn]; turn ^= 1;
    if (orbit.lock === o.index){ const p = spots[turn]; turn ^= 1; return goWith(p, r); }
    goWith(o, r);
  }
  function goWith(o, r, vi = 0){
    stopTour(false); show.on = show.pending = false; if (LCAM.on) stopLaunchCam(true, true);
    if (r) setSpot(o, r);
    lockOn(o.index, vi);   // (flyTo asks flyIn first)
  }
  // a flight to a place object (flyTo asks first): by day, as for a launch (cities keep the clock, so their lights show at night); straight
  // there when the camera is above the place's horizon, else first to about 6,000 km over the place, Earth below, the place turning with it,
  // then down (a flight that started on the far side would go through the Earth). True when it has taken the flight over
  function flyIn(o, vp, done){
    if (o.leg2){ o.leg2 = false; return false; }
    // (only when coming from elsewhere: a click on the place you are at, or another of its angles, keeps the clock)
    // (a famous place: lit from the side for the angle it arrives at, e9p-earth-places.js)
    if (o.place.kind !== 'c' && orbit.lock !== o.index) dayTo(o.dayAt ? o.dayAt(vp) : afternoonAt({ up:o.up }), 3);
    const up = M3.apply(earth.rot, o.up), rel = V.sub(cam.rel, frel(o)), el = V.dot(V.norm(rel), up);
    if (el > 0.08 && V.len(rel) < 30*R*KM) return false;
    const yp = () => { const d = M3.applyT(camFrameOf(earth), M3.apply(earth.rot, o.up)); return [Math.atan2(d[0], d[2]), Math.asin(clamp(d[1], -0.999, 0.999))]; };
    const [yaw, pitch] = yp();
    pend = o; startFlight(earth, { yaw, pitch, dist:R*KM*1.95, track:yp }, () => { pend = null; o.leg2 = true; if (vp.offFn) vp.off = vp.offFn(); flyTo(o, vp, done); });
    return true;
  }
  // a famous place's own object stays where it is: moved by hand, the camera goes over to a spot dressed the same, standing on the same point
  // (so nothing moves on the screen), and that one moves
  function handoff(o){
    const s = spots[turn]; turn ^= 1;
    setSpot(s, o.place.row);
    if (cam.focus === o.index){ const D = frel(s); cam.rel = V.sub(cam.rel, D); orbit.target = V.sub(orbit.target, D); cam.focus = s.index; }
    orbit.lock = s.index; orbit.frame = camFrameOf(s);
    if (infoObj === o.index) setInfo(s.index);
    return s;
  }
  // a link: the place itself (latitude, longitude, kind, n, then the name), checked
  const hashOf = o => o.own ? '' : o.place.row ? [o.place.la, o.place.lo, o.place.row[1], o.place.row[4], o.place.row[5] || '', o.place.row[6] || ''].join(',') + ',' + o.name : '';
  function fromHash(o, s){
    if (o.own) return true;   // (a famous place's own object: its key is enough)
    const f = (s || '').split(','); if (f.length < 7) return false;
    const la = +f[0], lo = +f[1], n = +f[3], kind = f[2];
    if (!(Math.abs(la) <= 90 && Math.abs(lo) <= 180 && isFinite(n) && /^[cCmriw]$/.test(kind))) return false;
    const name = f.slice(6).join(',').slice(0, 80), cc = f[4].slice(0, 2).toUpperCase(), what = f[5].slice(0, 30);
    // (the country's name comes with the list; until then a city just says it is a city)
    setSpot(o, [name, kind, la, lo, n, cc, what]);
    if (cc){ load(); onLoad.push(() => { if (o.place.row && o.place.row[5] === cc){ setSpot(o, o.place.row); if (infoObj === o.index) setInfo(o.index); } }); }
    return true;
  }
  // (while a place on Earth is visited, or flown to, the clock runs in real time, as near a launch pad: at the atlas's usual pace the
  // afternoon it was flown to turned to night on the way)
  const hold = () => { const o = OBJ[orbit.lock]; return !!(o && o.earthSpot && !flight) || !!(flight && (flight.obj.earthSpot || (pend && flight.obj === earth))); };
  return { can, find, go, about, load, spots, hashOf, fromHash, onLoad, hold, PICKS, ALL_PICKS, spotHooks, ownHooks, findHooks, ownOf, panPx, panKm, nearest, setSpot, placeSpot, flyIn, llTxt, metres,
    VIEWS, get state(){ return state; } };
})();
