// ================================================================ places on the Moon (0.27.0, the "surfaces" pack of docs/CONTENT.md; owner's picks: nine places, landers as small
// models, a tour): the six Apollo landing sites, Hadley Rille, Tycho and Copernicus. Each is an object of its own standing on the turning Moon
// (its middle at the real ground, a landing site's at its lander), listed under the Moon in the atlas, found by the search, marked on the
// Moon's globe, with its framings, fact and readout; the ground round it is drawn from NASA's LRO data (m3-moon-detail.js). A flight to one
// comes down over its horizon (never through the Moon), and as it nears the Moon the atlas clock eases to the place's morning, the Sun low
// in the east as the crews saw it, so the relief casts long shadows. The landers' descent stages are drawn as models at their real spots
// (FS_MOON_ENV) and labelled as models.
const MPL = (() => {
  const on = FLAGS.realMoon, R = 1737.4;   // (km)
  const unit = (la, lo) => [Math.cos(la*DEG)*Math.cos(lo*DEG), Math.sin(la*DEG), -Math.cos(la*DEG)*Math.sin(lo*DEG)];
  // la, lo: the place's middle (a landing site's lander: LROC's coordinates of 28 July 2016, Wagner et al. 2017, Icarus 283, 92); site: its layers in
  // MOON_DETAIL; lm: its lander (name, and how it is turned, degrees); sun: the light it is shown in (elevation, morning or evening);
  // views: [east, up, south] toward the camera, distance (m), the point looked at (m east, up, north of the middle); h0: the ground's height
  // (m above the 1,737.4 km sphere) until the layers are in; size: km across (the IAU's), where a place has one
  const DEF = [
    { key:'apollo11', name:'Tranquility Base', type:'Apollo 11 landing site on the Moon', la:0.67416, lo:23.47314, site:'apollo11', h0:-1926,
      lm:{ name:'Eagle', yaw:0 }, sun:{ el:11, am:true }, tags:['human'],
      cap:'Apollo 11, July 1969: Neil Armstrong and Buzz Aldrin land Eagle on the Sea of Tranquility, the first people to walk on another world.',
      aka:'apollo 11 apollo11 eagle armstrong aldrin collins tranquillity base sea of tranquility mare tranquillitatis first moon landing landing site',
      fact:'Neil Armstrong and Buzz Aldrin landed here in the lunar module Eagle on 20 July 1969, the first people to walk on another world. They spent about two and a half hours outside; Eagle\'s descent stage still stands where they left it.',
      ro:'landed 20 July 1969 · 2 h 31 min outside · 21.5 kg of rock and soil brought home',
      views:[[[-0.3, 0.18, 0.94], 900, [0, 0, 0]], [[-0.55, 0.62, 0.56], 32000, [0, 0, 4000]], [[0.42, 0.11, 0.9], 38, [0, 1.2, 0]]] },
    { key:'apollo12', name:'Apollo 12 landing site', type:'in the Ocean of Storms, on the Moon', la:-3.0128, lo:-23.4219, site:'apollo12', h0:-1422,
      lm:{ name:'Intrepid', yaw:0 }, sun:{ el:6, am:true }, tags:['human'],
      cap:'Apollo 12, November 1969: Pete Conrad and Alan Bean land within walking distance of Surveyor 3, a robot lander that got there two and a half years before them.',
      aka:'apollo 12 apollo12 intrepid conrad bean gordon ocean of storms oceanus procellarum surveyor 3 surveyor crater pete\'s parking lot landing site',
      fact:'Pete Conrad and Alan Bean landed the lunar module Intrepid here on 19 November 1969, about 160 m from Surveyor 3, a robot lander that had touched down in April 1967. They walked to it and brought pieces of it home.',
      ro:'landed 19 November 1969 · 7 h 45 min outside in two walks · 34.3 kg of rock and soil brought home',
      views:[[[0.15, 0.22, 0.96], 600, [50, 0, -40]], [[0.1, 0.55, 0.83], 30000, [0, 0, 3000]], [[0.5, 0.12, 0.86], 32, [0, 1.2, 0]]] },
    { key:'apollo14', name:'Apollo 14 landing site', type:'at Fra Mauro, on the Moon', la:-3.64589, lo:-17.47194, site:'apollo14', h0:-1062,
      lm:{ name:'Antares', yaw:0 }, sun:{ el:10, am:true }, tags:['human'],
      cap:'Apollo 14, February 1971: Alan Shepard and Edgar Mitchell land in the Fra Mauro hills and haul their tools toward Cone crater.',
      aka:'apollo 14 apollo14 antares shepard mitchell roosa fra mauro cone crater golf landing site',
      fact:'Alan Shepard and Edgar Mitchell landed Antares here in the Fra Mauro hills on 5 February 1971 and climbed toward the rim of Cone crater, about 340 m wide, pulling their tools on a cart. Before leaving, Shepard hit two golf balls.',
      ro:'landed 5 February 1971 · 9 h 22 min outside in two walks · 42.3 kg of rock and soil brought home',
      views:[[[-0.6, 0.35, 0.72], 900, [1155, 30, 646]], [[0.1, 0.55, 0.83], 30000, [0, 0, 3000]], [[0.5, 0.12, 0.86], 34, [0, 1.2, 0]]] },
    { key:'apollo15', name:'Apollo 15 landing site', type:'at Hadley-Apennine, on the Moon', la:26.13239, lo:3.63330, site:'apollo15', h0:-1931,
      lm:{ name:'Falcon', yaw:0 }, sun:{ el:12, am:true }, tags:['human'],
      cap:'Apollo 15, July 1971: David Scott and James Irwin land between the Apennine mountains and Hadley Rille, and drive the first lunar rover.',
      aka:'apollo 15 apollo15 falcon scott irwin worden hadley apennine rover lunar roving vehicle genesis rock landing site',
      fact:'David Scott and James Irwin landed Falcon here on 30 July 1971, between the Apennine mountains and Hadley Rille, and drove the first lunar rover. Among the 77 kg of rock they brought home is the Genesis Rock, a piece of the Moon\'s early crust.',
      ro:'landed 30 July 1971 · 18 h 35 min outside in three drives · 27.9 km driven',
      views:[[[-0.25, 0.4, 0.88], 7000, [-800, 0, 500]], [[0.1, 0.45, 0.89], 45000, [0, 0, 10000]], [[0.5, 0.12, 0.86], 34, [0, 1.2, 0]]] },
    { key:'hadley', name:'Hadley Rille', type:'a lava channel on the Moon', la:26.1077, lo:3.5479, site:'apollo15', h0:-2240, sun:{ el:20, am:true },
      cap:'Hadley Rille, which Apollo 15 drove to: a channel probably cut by flowing lava, winding along the foot of the Apennine mountains.',
      aka:'rima hadley hadley rille apollo 15 lava channel sinuous rille apennine mons hadley',
      fact:'A winding channel 116 km long, about 1.2 km wide and up to about 300 m deep, probably cut by flowing lava more than 3 billion years ago. Apollo 15\'s crew drove to its edge and sampled the layers of rock in its wall.',
      ro:'116 km long · about 1.2 km wide · about 300 m deep by the Apollo 15 site',
      views:[[[0.2, 0.45, 0.87], 6000, [0, 0, 0]], [[-0.3, 0.7, 0.65], 25000, [0, 0, 2000]], [[0.573, 0.035, 0.818], 1832, [-400, 52, 500]]] },
    { key:'apollo16', name:'Apollo 16 landing site', type:'at Descartes, on the Moon', la:-8.9734, lo:15.5011, site:'apollo16', h0:8,
      lm:{ name:'Orion', yaw:0 }, sun:{ el:15, am:true }, tags:['human'],
      cap:'Apollo 16, April 1972: John Young and Charles Duke land in the central highlands, the only Apollo landing there.',
      aka:'apollo 16 apollo16 orion young duke mattingly descartes cayley north ray crater highlands landing site',
      fact:'John Young and Charles Duke landed Orion here on 21 April 1972 (UTC), the only landing in the Moon\'s central highlands. They expected volcanic rock and found mostly breccias, rocks smashed and welded together by impacts.',
      ro:'landed 21 April 1972 (UTC) · 20 h 14 min outside in three drives · 95.7 kg of rock and soil brought home',
      views:[[[-0.3, 0.3, 0.9], 2000, [-440, -100, 4900]], [[0.15, 0.4, 0.9], 22000, [0, 0, 4500]], [[0.5, 0.12, 0.86], 34, [0, 1.2, 0]]] },
    { key:'apollo17', name:'Apollo 17 landing site', type:'in the valley of Taurus-Littrow, on the Moon', la:20.1911, lo:30.7723, site:'apollo17', h0:-2626,
      lm:{ name:'Challenger', yaw:0 }, sun:{ el:13, am:true }, tags:['human'],
      cap:'Apollo 17, December 1972: Gene Cernan and Harrison Schmitt land in a valley between massifs two kilometres high, the last people on the Moon so far.',
      aka:'apollo 17 apollo17 challenger cernan schmitt evans taurus littrow valley shorty crater orange soil massif landing site',
      fact:'Gene Cernan and Harrison Schmitt, a geologist, landed Challenger in the valley of Taurus-Littrow on 11 December 1972, the last people to walk on the Moon so far. At Shorty crater they found orange soil, beads of volcanic glass.',
      ro:'landed 11 December 1972 · 22 h 4 min outside in three drives · 110.5 kg of rock and soil brought home',
      views:[[[0.3, 0.12, -0.95], 6000, [-1500, 300, -2000]], [[-0.55, 0.5, 0.67], 32000, [0, 0, 2000]], [[0.5, 0.12, 0.86], 34, [0, 1.2, 0]]] },
    { key:'tycho', name:'Tycho', type:'a young crater on the Moon', la:-43.31, lo:-11.36, site:'tycho', h0:-1560, sun:{ el:25, am:true }, size:85.3,
      cap:'Tycho, about 108 million years old: one of the youngest big craters on the near side, its bright rays splashed across the Moon.',
      aka:'tycho crater central peak rays surveyor 7 tycho brahe',
      fact:'One of the youngest big craters on the Moon\'s near side, 85 km wide and 4.8 km deep, thought to be about 108 million years old. Its bright rays reach across much of the near side. Surveyor 7 landed in 1968 on the rock it threw out, about 28 km north of its rim.',
      ro:'85 km wide · 4.8 km deep · central peak about 2 km high · about 108 million years old',
      views:[[[0.05, 0.42, 0.9], 110000, [0, -1500, 0]], [[0.3, 0.8, 0.5], 150000, [0, 0, 0]], [[-0.066, 0.062, 0.996], 9035, [92, -1500, -963]]] },
    { key:'copernicus', name:'Copernicus', type:'a crater on the Moon', la:9.62, lo:-20.08, site:'copernicus', h0:-3376, sun:{ el:20, am:true }, size:96.1,
      cap:'Copernicus, about 800 million years old: 96 km across, its walls stepped in terraces, its floor crowned with mountains.',
      aka:'copernicus crater central peaks terraces rays',
      fact:'A crater 96 km wide and about 800 million years old, with terraced walls and a cluster of mountains in the middle. Its age comes from glass in Apollo 12\'s soil thought to have been thrown out by the impact.',
      ro:'96 km wide · 3.8 km deep · central peaks up to about 1.2 km high · about 800 million years old',
      views:[[[-0.45, 0.35, 0.82], 100000, [0, 0, 0]], [[-0.3, 0.8, 0.5], 160000, [0, 0, 0]], [[-0.8, 0.12, 0.58], 7000, [-5413, 500, -3488]]] },
  ];
  const sites = typeof MOON_DETAIL !== 'undefined' ? MOON_DETAIL.sites : [];
  const places = on ? DEF : [];
  const metres = m => Math.round(m).toLocaleString('en-US') + ' m';
  const llTxt = (la, lo) => Math.abs(la).toFixed(2) + '° ' + (la >= 0 ? 'N' : 'S') + ', ' + Math.abs(lo).toFixed(2) + '° ' + (lo >= 0 ? 'E' : 'W');
  // the credit for the ground while it shows
  const credit = 'ground: NASA LRO (LROC NAC and WAC images, LOLA and SLDEM2015 heights, NAC terrain models)';
  // the Sun at a place at a moment of the atlas clock (the clock put back after): elevation (degrees) and whether it is in the east
  function sunAt(p, days){
    const d0 = ssDays; ssDays = days; earth.update(0); moon.update(0);
    const L = M3.applyT(moon.rot, sunDirFrom(moon)), el = Math.asin(clamp(V.dot(L, p.u), -1, 1))/DEG, east = V.dot(L, p.F.e) > 0;
    ssDays = d0; earth.update(0); moon.update(0);
    return { el, east };
  }
  // the moment of the atlas clock nearest now (within half a lunar day either way) when the Sun stands as the place asks: low in the
  // morning at the landing sites, as the crews saw it
  function dayFor(p){
    let best = ssDays, bs = 1e9;
    for (let k=-15;k<=15;k+=0.125){ const s = sunAt(p, ssDays + k), sc = Math.abs(s.el - p.sun.el) + (s.east === p.sun.am ? 0 : 50) + Math.abs(k)*0.03; if (sc < bs){ bs = sc; best = ssDays + k; } }
    for (let k=-0.125;k<=0.125;k+=1/96){ const t = best + k, s = sunAt(p, t), sc = Math.abs(s.el - p.sun.el) + (s.east === p.sun.am ? 0 : 50); if (sc < bs - 1e-9){ bs = sc; best = t; } }
    return best;
  }
  // the camera stays a little above the ground under it, and 1.5 m clear of the lander's top (3.4 m) within 6 m of it at a landing site
  function clearGround(o){
    const dM = orbit.dist/KM, offL = M3.applyT(o.R0, V.mul(orbit.off, 1/KM));
    for (let k=0;k<3;k++){
      const d = sphL(orbit.yaw, orbit.pitch), eL = V.add(offL, V.mul(d, dM)), eye = V.add(V.mul(o.u, R + o.hNow/1000), M3.apply(o.F.M, eL));
      const lmN = o.place.lm && Math.hypot(eL[0], eL[2])*1000 < 6 ? 4.9 : 0;
      const r = V.len(eye), g = MDT.heightAt(eye, o.siteS), need = ((g == null ? o.hNow : g) + Math.max(2.5, lmN, orbit.dist/KM*1000*0.015))/1000 - (r - R);
      if (!(need > 0)) break;
      orbit.pitch = Math.min(orbit.pitch + need/Math.max(dM, 0.001)*1.05, 1.5);
    }
  }
  const objs = [];
  places.forEach((p, i) => {
    p.u = unit(p.la, p.lo); p.F = enuOf(p.u); p.siteS = MDT.sites.find(s => s.key === p.site) || null;
    // (the ground under its middle, from the tool, for a place whose layers are centred on it)
    const S = sites.find(s => s.key === p.site); if (S && S.h0 != null && p.site === p.key) p.h0 = S.h0;
    const rad = KM;   // (1 km: views give distances in km)
    const views = p.views.map(([d, dist, look]) => { const off = [look[0]/1000, look[1]/1000, -look[2]/1000]; return { d:V.norm(d), k:dist/1000, off:() => off, hold:11, drift:0.012 }; });
    const o = addObj({ key:p.key, name:p.name, label:p.name, type:p.type, group:'solar', tags:p.tags || [], parent:moon, offset:[0, 0, 0], rad, layer:3,
      noImpostor:true, pxMin:1, visFn:() => 1, noLabel:true, noWaypoint:true, labelRange:0, labelDisc:0.001, minZoom:p.lm ? 0.012 : 0.002, sortKey:1.0011 + i*1e-5,
      ...(p.size ? { sizeR:p.size/2*KM } : {}), camFrame(){ return this.R0; },
      atlasDist:'on the Moon', surfOf:moon, moonSpot:true, aka:p.aka, fact:p.fact, views, tourViews:[0, 2], R0:M3.I(),
      readout(){ const ln = [llTxt(p.la, p.lo) + ' · ' + p.ro]; if (MENV.on && MENV.site && MENV.site.key === p.site && MENV.alt < 200) ln.push(credit); return ln.join('\n'); },
      update(){ placeOn(this, p); }, flyIn(vp, done){ return flyIn(this, p, vp, done); } });
    o.place = p; o.u = p.u; o.F = p.F; o.siteS = p.siteS; o.hNow = p.h0;
    p.obj = o; objs.push(o);
    // its lander: a label at the descent stage's top, said to be a model (the model itself is drawn by FS_MOON_ENV)
    if (p.lm) p.lmObj = addObj({ key:p.key + '-lm', name:p.lm.name + '\'s descent stage', label:p.lm.name + ' (model)', type:'a model of the lunar module\'s descent stage', group:'travel', parent:moon,
      offset:[0, 0, 0], rad:5e-3*KM, layer:3, noPick:true, atlas:false, noTour:true, noWaypoint:true, noImpostor:true, pxMin:1, visFn:() => 1, labelRange:2.5*KM, R0:M3.I(),
      update(){ this.offset = V.mul(M3.apply(moon.rot, V.mul(p.u, R + (o.hNow + 3.4)/1000)), KM); this.pos = V.add(moon.pos, this.offset); this.hidden = !(MENV.on && MENV.site && MENV.site.key === p.site); } });
  });
  // where a place stands now: on the turning Moon, at its ground (eased as finer heights come in)
  function placeOn(o, p){
    // (without the maps, offline, the ground is the bare sphere: the place stands on it)
    const g = MDT.heightAt(V.mul(p.u, R), o.siteS), h = g == null ? (MGL.ready() ? p.h0 : 0) : g;
    o.hNow = Math.abs(o.hNow - h) > 500 ? h : o.hNow + (h - o.hNow)*0.1;
    o.offset = V.mul(M3.apply(moon.rot, V.mul(p.u, R + o.hNow/1000)), KM); o.pos = V.add(moon.pos, o.offset);
    o.R0 = M3.mul(moon.rot, p.F.M);
    // (scrolling out, from about 2,200 km up the camera goes over to the whole Moon: riseTo, 08-camera.js; 0.27.13)
    if (orbit.lock === o.index && !flight && !LCAM.on && !SKYV.on && !riseTo(o, moon, R, 1.25*R)){ orbit.frame = o.R0; clearGround(o); }
  }
  // the lander for the ground drawn round a site: where it stands in the site's frame (m), its feet's height, how it is turned
  function landerOf(S, F){
    const p = places.find(q => q.site === S.key && q.lm); if (!p) return null;
    const c = M3.applyT(F.M, V.mul(V.sub(V.mul(p.u, R), V.mul(S.c, R)), 1000)), g = MDT.heightAt(V.mul(p.u, R), S);
    return { x:c[0], z:c[2], h:(g == null ? (MGL.ready() ? p.h0 : 0) : g), yaw:p.lm.yaw*DEG };
  }
  // a flight to a place: straight there when the camera is above its horizon, else first round to above it (through the Moon otherwise);
  // the clock eases to the place's morning once the camera is near the Moon (from far away the Moon would race round Earth meanwhile)
  let pendDay = null, pend = null;
  function flyIn(o, p, vp, done){
    if (o.leg2){ o.leg2 = false; return false; }
    MGL.want = true; MDT.want = o.siteS;
    if (orbit.lock !== o.index) pendDay = { o, at:dayFor(p) };
    const up = M3.apply(moon.rot, p.u), rel = V.sub(cam.rel, frel(o)), el = V.dot(V.norm(rel), up);
    if (el > 0.1 && V.len(rel) < 6*R*KM) return false;
    const yp = () => { const d = M3.applyT(camFrameOf(moon), M3.apply(moon.rot, p.u)); return [Math.atan2(d[0], d[2]), Math.asin(clamp(d[1], -0.999, 0.999))]; };
    const [yaw, pitch] = yp();
    pend = o; startFlight(moon, { yaw, pitch, dist:R*KM*2.4, track:yp }, () => { pend = null; o.leg2 = true; if (vp.offFn) vp.off = vp.offFn(); flyTo(o, vp, done); });
    return true;
  }
  // once a tick: start easing the clock when a flight to a place is near the Moon; keep the place's layers wanted while it is the one
  let lastLock = -1;
  function tick(){
    if (pend && (!flight || flight.obj !== moon)) pend = null;
    // (a place opened without a flight, from a shared link: in the lunar night, the clock eases to its morning as a flight's would)
    if (orbit.lock !== lastLock){ lastLock = orbit.lock; const o = OBJ[orbit.lock];
      if (o && o.moonSpot && !flight && !pendDay && sunAt(o.place, ssDays).el < 2) dayTo(dayFor(o.place), 2.5); }
    if (pendDay){ const o = pendDay.o, d = V.len(V.sub(cam.rel, frel(moon)))/KM;
      if ((orbit.lock === o.index && !flight) || d < 30*R){ dayTo(pendDay.at, d < 3*R ? 2.5 : 3.5); pendDay = null; }
      else if (!flight || (flight.obj !== o && flight.obj !== moon)) pendDay = null; }
    const lk = OBJ[orbit.lock], fo = flight ? flight.obj : null, mine = lk && lk.moonSpot ? lk : fo && fo.moonSpot ? fo : pend;
    MDT.want = mine ? mine.siteS : null; MGL.want = !!mine;
  }
  // (while a place on the Moon is visited or flown to, the clock runs in real time, as near a launch pad: the shadows stay put)
  const hold = () => { const o = OBJ[orbit.lock]; return !!(o && o.moonSpot && !flight) || !!(flight && (flight.obj.moonSpot || (pend && flight.obj === moon))); };
  const D = on ? addObj({ key:'moon-director', name:'moon director', type:'', group:'travel', parent:moon, offset:[0, 0, 0], rad:1e-3*KM, hidden:true, noPick:true, atlas:false, noLabel:true, noTour:true, noImpostor:true,
    update(dt){ tick(); if (!FLAGS.spacex && !FLAGS.realEarth){ dayStep(dt); } } }) : null;
  return { places, objs, landerOf, hold, sunAt, dayFor, tour:places.map(p => p.key), caps:Object.fromEntries(places.map(p => [p.key, p.cap])), byKey:k => places.find(p => p.key === k) || null,
    dbg:() => ({ env:MENV.on ? MENV.site.key : null, alt:+MENV.alt.toFixed(3), fade:+MENV.fade.toFixed(3), layers:MENV.layers, ready:MDT.ready, map:MGL.state }) };
})();
