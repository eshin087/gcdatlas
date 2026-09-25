
// ================================================================ Earth, live: every active satellite, the next rocket launches, air traffic, the ISS and Hubble
// Satellites and launches come from /api/sats and /api/launches (small serverless functions that fetch CelesTrak and
// Launch Library 2 and cache the result at the edge). If they cannot be reached (offline, or this page runs somewhere else),
// the representative satellite shells drawn by the Earth object stay, and nothing else changes.
const EARTH_R = 6371, EARTH_B = 7135.5;   // km; Earth's bounding radius (the unit of its particle systems)
// real orbits on the GPU: two-body motion plus the J2 drift of node and perigee, from one shared reference time
const PB_SATR = `
vec3 satCol(float g){ return g < 0.5 ? vec3(0.72, 0.76, 0.88) : g < 1.5 ? vec3(0.6, 0.8, 1.) : g < 2.5 ? vec3(0.5, 1., 0.85) : g < 3.5 ? vec3(0.6, 1., 0.6) : g < 4.5 ? vec3(1., 0.8, 0.45) : g < 5.5 ? vec3(1.) : g < 6.5 ? vec3(1., 0.6, 0.9) : vec3(0.8, 0.7, 1.); }
void body(out vec3 p, out float br, out vec3 col){
  float a = aP.x, inc = aP.y, e = aC.x, g = aC.z, t = uQ0.x;
  float n = sqrt(398600.4418/(a*a*a)), pp = a*(1. - e*e), k = 1.5*1.08263e-3*(6378.137/pp)*(6378.137/pp)*n;
  float raan = aP.z - k*cos(inc)*t, argp = aC.y + 0.5*k*(5.*cos(inc)*cos(inc) - 1.)*t;
  float M = mod(aP.w + n*t, 6.2831853), E = M;
  for(int i=0;i<6;i++) E -= (E - e*sin(E) - M)/(1. - e*cos(E));
  float nu = 2.*atan(sqrt(1. + e)*sin(E*0.5), sqrt(1. - e)*cos(E*0.5)), r = a*(1. - e*cos(E)), u = argp + nu;
  vec3 q = r*vec3(cos(u)*cos(raan) - sin(u)*cos(inc)*sin(raan), cos(u)*sin(raan) + sin(u)*cos(inc)*cos(raan), sin(u)*sin(inc));
  p = vec3(q.y, q.z, q.x)/7135.5;   // equatorial (x to the equinox, z north) -> Earth's frame (x toward RA 90, y north, z toward RA 0)
  col = satCol(g); br = g > 4.5 && g < 5.5 ? 3. : (g > 3.5 && g < 4.5 ? 0.9 : 0.55);
  // nothing shows through the Earth
  vec3 w = uRel + uRot*(p*uRad); float lw = length(w);
  if(lw > length(uRel) && length(cross(uRel, w/lw)) < uRad*uQ0.w) br = 0.;
  br *= uQ0.z;
}`;
P.ptSatR = program(particleVS(PB_SATR), FS_POINT);
const earthLive = (() => {
  const L = { sats:null, satRef:0, satCount:0, launches:[], planes:null, status:'representative', named:{} };
  const onWeb = /^https?:$/.test(location.protocol) && !/claude|usercontent|anthropic/.test(location.hostname);
  const inWindow = () => Math.abs(jdNow() - JD_NOW) < 30 && !(EARTH_ERA.ya > 69);   // real orbits are only meaningful near today (and not in Earth's past)
  { const repr = earth.particles.find(s => s.prog === 'ptSat'); if (repr) repr.show = () => !(EARTH_ERA.ya > 69) && (!L.sats || !inWindow()); }
  // ---- satellites
  function applySats(j){
    const n = j.count, ps = makePS(n), d = j.data;
    for (let i=0;i<n;i++){ ps.a.set([d[i*7], d[i*7+1], d[i*7+2], d[i*7+3]], i*4); ps.c.set([d[i*7+4], d[i*7+5], d[i*7+6], 1], i*4); }
    ps.upload('ac');
    L.sats = ps; L.satCount = n; L.satRef = Date.parse(j.ref)/86400000 + 2440587.5; L.status = 'live';
    for (const [name, idx] of j.named || []) L.named[name] = d.slice(idx*7, idx*7 + 7);
    // swap the representative shells for the real thing
    earth.particles.push({ ps, prog:'ptSatR', mode:3, sb:0.4, size:1.5, rot:() => earth.R0, rad:EARTH_B*KM,
      q0:() => [(jdNow() - L.satRef)*86400, 0, 1 - smooth(1.5e-8, 6e-8, orbit.dist), 6371/7135.5], show:inWindow });
    L.updated = new Date(j.ref);
  }
  // ---- the ISS and Hubble as real objects, placed from their live elements (or typical ones until those arrive)
  const MU = 398600.4418;
  function elemPos(el, jd){
    const [a, inc, raan0, M0, e, argp0] = el, t = (jd - (el.ref || L.satRef || JD_NOW))*86400;
    const n = Math.sqrt(MU/(a*a*a)), pp = a*(1 - e*e), k = 1.5*1.08263e-3*(6378.137/pp)**2*n;
    const raan = raan0 - k*Math.cos(inc)*t, argp = argp0 + 0.5*k*(5*Math.cos(inc)**2 - 1)*t;
    const M = (M0 + n*t) % (2*Math.PI); let E = M; for (let i=0;i<6;i++) E -= (E - e*Math.sin(E) - M)/(1 - e*Math.cos(E));
    const nu = 2*Math.atan2(Math.sqrt(1 + e)*Math.sin(E/2), Math.sqrt(1 - e)*Math.cos(E/2)), r = a*(1 - e*Math.cos(E)), u = argp + nu;
    const q = [r*(Math.cos(u)*Math.cos(raan) - Math.sin(u)*Math.cos(inc)*Math.sin(raan)), r*(Math.cos(u)*Math.sin(raan) + Math.sin(u)*Math.cos(inc)*Math.cos(raan)), r*Math.sin(u)*Math.sin(inc)];
    return V.mul(M3.apply(earth.R0, [q[1], q[2], q[0]]), KM);
  }
  const typical = { iss:[6795, 51.64*DEG, 1, 0, 0.0004, 0], hubble:[6900, 28.47*DEG, 2, 1, 0.0002, 0], tiangong:[6750, 41.47*DEG, 4, 2, 0.0005, 0] };
  typical.iss.ref = typical.hubble.ref = typical.tiangong.ref = JD_NOW;
  function craft(key, name, label, type, kind, radKm, fact, readout, nameRe){
    const o = addProbe({ key, name, label, type, kind, parent:earth, offset:[0, 0, 0], rad:radKm*KM, sortKey:1.00001, labelRange:3e-4, labelMin:1e-9, distEarth:'in orbit around Earth', minZoom:1.4,
      fact, readout,
      views:[{ d:[0.6, 0.35, 0.7], k:2.4, hold:8, drift:0.05 }, { d:[-0.5, 0.7, 0.4], k:3.2, hold:7, drift:0.04 }],
      update(){
        const live = Object.keys(L.named).find(n => nameRe.test(n)), el = live ? Object.assign(L.named[live].slice(), { ref:L.satRef }) : typical[key];
        this.offset = elemPos(el, jdNow()); this.pos = V.add(earth.pos, this.offset);
        const up = V.norm(this.offset); this.R0 = frameY(up, [0, 0, 1]); this.rot = this.R0;
      } });
    o.update(); return o;
  }
  craft('iss', 'International Space Station', 'ISS', 'crewed space station · 420 km up, 16 orbits a day', 3, 0.058,
    'The largest thing humans have built in space: a football pitch of solar wings and modules, lived in continuously since November 2000. It circles Earth every 93 minutes at 28,000 km/h.',
    () => 'orbit 51.6° to the equator · 16 sunrises a day\n' + (L.status === 'live' ? 'position from today\'s tracking data (CelesTrak)' : 'typical orbit (live tracking data not loaded)'), /^ISS \(ZARYA\)/);
  craft('hubble', 'Hubble Space Telescope', 'Hubble', 'space telescope · 530 km up since 1990', 4, 0.0075,
    'A school-bus-sized telescope above the blur of the atmosphere. In 35 years it has measured the expansion of the universe and looked back to galaxies 13 billion years old.',
    () => '2.4 m mirror · one orbit every 95 minutes\n' + (L.status === 'live' ? 'position from today\'s tracking data' : 'typical orbit'), /^HST$/);
  // ---- launches: the next ones on the calendar, marked at their pads
  const PADS = [];
  function padMarker(l){
    const la = l.lat*DEG, lo = l.lon*DEG, local = [Math.cos(la)*Math.cos(lo), Math.sin(la), -Math.cos(la)*Math.sin(lo)];
    const o = addObj({ key:'launch-' + PADS.length, name:l.rocket || l.name, label:'', type:'rocket launch', layer:3, parent:earth, offset:[0, 0, 0], rad:EARTH_R*0.004*KM, marker:true, noPick:true, noImpostor:true, atlas:false,
      labelRange:6e-8, labelMin:1.2e-9, labelClass:'launch',
      update(){ this.offset = M3.apply(earth.rot, V.mul(local, EARTH_R*1.004*KM)); this.pos = V.add(earth.pos, this.offset); } });
    o.launch = l; o.update(); PADS.push(o); return o;
  }
  const fmtT = ms => { const s = Math.abs(ms)/1000, d = Math.floor(s/86400), h = Math.floor(s/3600) % 24, m = Math.floor(s/60) % 60; return (ms < 0 ? 'T+' : 'T-') + (d ? d + 'd ' : '') + (d || h ? h + 'h ' : '') + m + 'm'; };
  function labelLaunches(){
    const now = (jdNow() - 2440587.5)*86400000;
    for (const o of PADS){ const l = o.launch, txt = `${(l.rocket || l.name).split('|')[0].trim()} · ${fmtT(now - Date.parse(l.net))}`; if (o.label !== txt){ o.label = txt; if (labelEls[o.index]) labelEls[o.index].textContent = txt; } }
  }
  function applyLaunches(j){
    const seen = new Set();
    L.launches = (j.launches || []).filter(l => Date.parse(l.net) > Date.now() - 3600e3).slice(0, 12);
    for (const l of L.launches){ const k = l.lat.toFixed(1) + ',' + l.lon.toFixed(1); if (seen.has(k) || PADS.length >= 6) continue; seen.add(k); padMarker(l); }
    // markers made after start-up need label elements
    for (const o of PADS){ if (labelEls[o.index]) continue; const b = document.createElement('button'); b.className = 'lab launch'; b.tabIndex = -1; $('#labels').appendChild(b); labelEls[o.index] = b; }
    labelLaunches(); setInterval(labelLaunches, 1000);
  }
  // ---- an illustrative ascent now and then, from the pad of a real upcoming launch
  const ASC = 90, asc = makePS(ASC), st = { t:99, site:null };
  asc.upload('ac');
  function ascentPoint(site, s){   // a gravity turn toward the east, 0 -> 210 km up and ~1,500 km downrange over s = 0..1
    const la = site.lat*DEG, lo = site.lon*DEG, up = [Math.cos(la)*Math.cos(lo), Math.sin(la), -Math.cos(la)*Math.sin(lo)];
    const east = V.norm(V.cross([0, 1, 0], up)), alt = 210*Math.pow(s, 0.8), down = 1500*s*s;
    const pos = V.add(V.mul(up, EARTH_R + alt), V.mul(east, -down));
    return V.mul(V.norm(pos), (EARTH_R + alt)/EARTH_B);
  }
  earth.particles.push({ ps:asc, prog:'ptBasic', mode:3, sb:1.2, size:2.2, rot:() => earth.rot, rad:EARTH_B*KM, show:() => st.t < 14 && inWindow(),
    vis:() => 1 - smooth(4e-9, 2e-8, orbit.dist) });
  function updateAscent(dt){
    st.t += dt;
    const near = (orbit.lock === earth.index || cam.focus === earth.index) && orbit.dist < 2e-8;
    if (st.t > 45 && near && L.launches.length){ st.t = 0; st.site = L.launches[Math.floor(Math.random()*Math.min(L.launches.length, 6))];
      toast(`illustrative ascent · ${st.site.rocket || 'rocket'} from ${st.site.site || st.site.pad}`); }
    if (st.t >= 14 || !st.site) return;
    const s = st.t/12;
    for (let i=0;i<ASC;i++){
      const f = i/(ASC - 1), si = Math.max(0, s - (1 - f)*0.35);   // a trail behind the head
      const p = ascentPoint(st.site, Math.min(si, 1)), head = i === ASC - 1, b = head ? 3 : 0.9*f*f*Math.max(0, 1 - (st.t - 12)/2);
      asc.a.set([p[0], p[1], p[2], s > 1 && head ? 0 : b], i*4);
      const c = head ? [1, 0.95, 0.85] : V.lerp([0.6, 0.6, 0.7], [1, 0.7, 0.35], f); asc.c.set([c[0], c[1], c[2], 0], i*4);
    }
    asc.upload('ac');
  }
  // ---- air traffic: illustrative flights on real busy routes (positions are simulated; free live flight feeds are too limited)
  const AIRPORTS = { ATL:[33.64, -84.43], LAX:[33.94, -118.41], ORD:[41.98, -87.9], DFW:[32.9, -97.04], DEN:[39.86, -104.67], JFK:[40.64, -73.78], SFO:[37.62, -122.38], SEA:[47.45, -122.31], MIA:[25.79, -80.29],
    YYZ:[43.68, -79.63], MEX:[19.44, -99.07], GRU:[-23.43, -46.47], BOG:[4.7, -74.15], SCL:[-33.39, -70.79], LHR:[51.47, -0.45], CDG:[49.01, 2.55], FRA:[50.04, 8.56], AMS:[52.31, 4.77], MAD:[40.47, -3.56],
    IST:[41.26, 28.74], DXB:[25.25, 55.36], DOH:[25.27, 51.61], DEL:[28.56, 77.1], BOM:[19.09, 72.87], SIN:[1.36, 103.99], BKK:[13.69, 100.75], HKG:[22.31, 113.91], PVG:[31.14, 121.81], PEK:[40.08, 116.58],
    ICN:[37.46, 126.44], NRT:[35.77, 140.39], HND:[35.55, 139.78], SYD:[-33.94, 151.18], MEL:[-37.67, 144.84], AKL:[-37.01, 174.79], JNB:[-26.14, 28.24], CAI:[30.12, 31.41], ADD:[8.98, 38.8], NBO:[-1.32, 36.93], HNL:[21.32, -157.92] };
  const ROUTES = 'JFK-LHR JFK-CDG ATL-LAX ORD-LAX LAX-SFO LAX-JFK SEA-SFO DFW-ORD DEN-LAX MIA-JFK YYZ-LHR LHR-DXB CDG-DXB FRA-SIN LHR-SIN DXB-DEL DXB-BOM DOH-LHR IST-FRA MAD-GRU GRU-SCL BOG-MIA MEX-LAX JFK-GRU SIN-SYD HKG-SIN PVG-NRT PEK-PVG ICN-NRT HND-SIN HKG-LAX NRT-SFO SYD-MEL SYD-AKL AKL-LAX BKK-HKG DEL-BOM JNB-DXB CAI-JED ADD-DXB NBO-LHR LHR-JFK AMS-JFK FRA-ORD CDG-JFK HNL-LAX HNL-NRT SIN-LHR DXB-SYD PEK-FRA IST-DXB MAD-MEX LHR-JNB ICN-LAX SFO-SIN'.split(' ')
    .map(r => r.split('-')).filter(([a, b]) => AIRPORTS[a] && AIRPORTS[b]);
  const unit = ([la, lo]) => [Math.cos(la*DEG)*Math.cos(lo*DEG), Math.sin(la*DEG), -Math.cos(la*DEG)*Math.sin(lo*DEG)];
  const PER = 7, planes = makePS(ROUTES.length*PER*2), legs = [];
  ROUTES.forEach(([a, b]) => { const A = unit(AIRPORTS[a]), B = unit(AIRPORTS[b]), ang = Math.acos(clamp(V.dot(A, B), -1, 1)), hrs = ang*EARTH_R/850 + 0.6;
    for (let k=0;k<PER*2;k++) legs.push({ A:k % 2 ? B : A, B:k % 2 ? A : B, ang, hrs, ph:Math.random() }); });
  for (let i=0;i<legs.length;i++) planes.c.set([1, 0.78, 0.4, 0], i*4);
  earth.particles.push({ ps:planes, prog:'ptBasic', mode:3, sb:0.55, size:1.4, rot:() => earth.rot, rad:EARTH_B*KM, show:() => FLAGS.planes && inWindow(), vis:() => 1 - smooth(1.2e-9, 4e-9, orbit.dist) });
  function updatePlanes(){
    const hours = (jdNow() - JD_NOW)*24, rs = (EARTH_R + 11)/EARTH_B;
    for (let i=0;i<legs.length;i++){
      const g = legs[i], f = (hours/g.hrs + g.ph) % 1, s = Math.sin(g.ang);
      const w1 = Math.sin((1 - f)*g.ang)/s, w2 = Math.sin(f*g.ang)/s, p = V.add(V.mul(g.A, w1), V.mul(g.B, w2));
      const on = f < 0.97 ? 0.9 + 0.1*Math.sin(hours*400 + i) : 0;
      planes.a.set([p[0]*rs, p[1]*rs, p[2]*rs, on], i*4);
    }
    planes.upload('a');
  }
  // ---- wire into Earth's update and readout
  const prevUpdate = earth.update;
  earth.update = function(dt){ prevUpdate.call(this, dt); if (orbit.dist < 6e-9 && (cam.focus === earth.index || orbit.lock === earth.index)) updatePlanes(); updateAscent(dt); };
  const prevRead = earth.readout;
  earth.readout = () => {
    const d = orbit.dist/earth.rad, next = L.launches.find(l => Date.parse(l.net) > (jdNow() - 2440587.5)*86400000);
    if (d < 6 && d >= 2 && L.status === 'live') return `${L.satCount.toLocaleString('en-US')} active satellites, live from CelesTrak · colours: Starlink blue, navigation green, geostationary gold\n` + (next ? `next launch: ${next.name} · ${next.site || next.pad}` : 'yellow dots near the ground are illustrative air traffic on real routes');
    if (d < 2) return 'yellow dots: illustrative air traffic on 55 of the busiest routes\n' + (L.status === 'live' ? `${L.satCount.toLocaleString('en-US')} satellites overhead (live orbits)` : 'satellites shown as their typical orbital shells');
    return prevRead();
  };
  // ---- fetch (only when served from our own site)
  const get = (url, ms) => Promise.race([fetch(url, { cache:'default' }).then(r => r.ok ? r.json() : Promise.reject(r.status)), new Promise((_, rej) => setTimeout(() => rej('timeout'), ms))]);
  if (onWeb && FLAGS.live){
    setTimeout(() => {
      get('/api/sats', 20000).then(applySats).catch(e => console.info('satellites: showing representative orbits (' + e + ')'));
      if (FLAGS.launches) get('/api/launches', 15000).then(applyLaunches).catch(e => console.info('launches unavailable (' + e + ')'));
    }, 2500);
  }
  return L;
})();

// ---------------------------------------------------------------- your backyard: a point on the turning Earth where the planetarium camera stands
const backyard = addObj({ key:'backyard', name:'Your sky', label:'', type:'the sky from where you are, right now', layer:3, parent:earth, offset:[0, 0, 0], rad:0.5*KM,
  noPick:true, noImpostor:true, atlas:false, noLabel:true, minZoom:1, sortKey:1,
  fact:'Drag to look around. The stars, planets and Moon are where they really are in your sky at this moment; the ground below is the real Earth turning beneath you.',
  update(){ const la = (SKYV.lat || 0)*DEG, lo = (SKYV.lon || 0)*DEG; this.offset = M3.apply(earth.rot, V.mul([Math.cos(la)*Math.cos(lo), Math.sin(la), -Math.cos(la)*Math.sin(lo)], EARTH_R*KM)); this.pos = V.add(earth.pos, this.offset); },
  views:[{ d:[0, 1, 0], k:1, hold:9, drift:0 }], readout:() => SKYV.readout ? SKYV.readout() : '' });
SKYV.site = backyard;
