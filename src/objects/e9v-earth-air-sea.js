// ================================================================ the cities alive, part 2 (0.14.0): planes at the airports and boats on the
// water, as points of light drawn over the ground (drawEnv calls EAS.draw right after it, as points are not depth-tested; each point is
// tested against the heights on the CPU a few times a second, so a boat behind a block or a plane behind a hill is hidden).
//
// Planes (owner's pick: simulated, on the real runways, into the real wind): each airport of the city near the camera (EARTH_CITIES airports,
// OpenStreetMap runways) has a slot every 3600/PEAK seconds for an arrival and one for a departure, each flown or not by the local hour
// (busy by day, a few at night). Each flight uses the runways facing into the wind at its own time (the city's hourly weather, Open-Meteo,
// /api/weather), so a change of wind never moves a plane in the air. Arrivals fly a straight 3 degree approach from 19 km out at 72 m/s,
// touch down 300 m past the threshold and slow down; departures roll, lift off at 78 m/s and climb out straight at about 7 degrees. Lights:
// landing lights (brightest when the plane faces you), a red beacon, white strobes; by day a silver speck. Positions are made up, timings
// typical; the readout says so.
// 0.17.0 (owner: "i haven't seen any airplanes yet"; picks: larger plane shapes, routes over the city, contrails up high, a small label): each
// arrival first flies an inbound leg from 30 km past the city side at 3,000 m, curving onto the final approach 19 km out (so many cross the
// city); each departure climbs out straight for two minutes, then curves away toward a heading of its own, up to 7,000 m; airliners pass over
// at 10,500 m (12 an hour). Each plane is drawn as a plane shape (lines: fuselage, wings, tail) at least three times its size and at least
// four pixels long, so it shows from 15 km; planes above 5,000 m leave a fading white trail by day; the three nearest have a small label.
//
// Boats (owner's pick: on the real ferry routes and rivers): every ferry route of the city (OpenStreetMap, `sea` in EARTH_CITIES) carries
// boats back and forth with a minute at each end, spaced along it, at a speed for the city (the Seine's tour boats about 3.5 m/s, the
// Thames Clippers about 9); short crossings at 2.5 m/s. From 6:00 to midnight, a quarter of them at night. A white light at night, a white
// speck by day. They ride on the water as drawn (sea level).
const EAS = (() => {
  const can = /^https?:$/.test(location.protocol), R = 6371000;
  // arrivals an hour at the busiest hours, from each airport's yearly movements (2024, rounded; illustrative), and the share kept at night
  const PEAK = { JFK:30, LGA:26, EWR:28, HND:36, NRT:20, DXB:26, DWC:3, LHR:36, LGW:20, LCY:5, STN:14, LTN:10, CDG:34, ORY:17,
    HKG:30, SFO:24, OAK:9, SYD:22, FCO:22, CIA:4, LAX:32, BUR:7, GIG:8, SDU:9, LAS:34 };
  const NIGHT = { DXB:0.75, JFK:0.3, HND:0.25, HKG:0.35, LAX:0.25, LAS:0.3 };
  // the prevailing wind (degrees, where it comes from) for calm hours, when runways are used as usual
  const CALM = { newyork:310, tokyo:20, dubai:300, london:250, paris:250, hongkong:90, sanfrancisco:290, sydney:180, rome:250, losangeles:250, rio:150, lasvegas:220 };
  const BOATV = { newyork:8, tokyo:7, dubai:5, london:9, paris:3.5, hongkong:7, sanfrancisco:10, sydney:8, rome:3, losangeles:8, rio:8, lasvegas:4 };
  const S = { city:null, ap:[], routes:[], state:0, pts:[], n:0, vis:new Float32Array(1024), visAt:new Float32Array(1024), vi:0, line:'', seen:0 };
  const MAXP = 2048, ps = makePS(MAXP), MAXL = 1024, ls = makePS(MAXL);
  // (the planes' shapes, as lines: about four times the light of a point to read as characters)
  const lspec = { ps:ls, prog:'lnBasic', lines:true, mode:3, sb:1, size:1, rel:() => S.rel, rot:() => S.rot, rad:1e-3*KM, count:() => S.nl };
  const SHORT = { JFK:'JFK', LGA:'LaGuardia', EWR:'Newark', HND:'Haneda', NRT:'Narita', DXB:'Dubai International', DWC:'Al Maktoum', LHR:'Heathrow', LGW:'Gatwick', LCY:'London City',
    STN:'Stansted', LTN:'Luton', CDG:'Charles de Gaulle', ORY:'Orly',
    HKG:'Hong Kong International', SFO:'SFO', OAK:'Oakland', SYD:'Sydney Airport', FCO:'Fiumicino', CIA:'Ciampino', LAX:'LAX', BUR:'Burbank', GIG:'Galeão', SDU:'Santos Dumont', LAS:'Harry Reid' };
  const OVER = 12;   // (airliners passing over the city an hour, at cruising height)
  const spec = { ps, prog:'ptBasic', mode:3, sb:1, size:4.5,   // (4.5 px: a light must fill a character's cell of the scene, two by two pixels, or it averages away)
    rel:() => S.rel, rot:() => S.rot, rad:1e-3*KM, count:() => S.n };
  const hsh = (a, b) => { let x = Math.sin(a*12.9898 + b*78.233)*43758.5453; return x - Math.floor(x); };
  // a city's frame: x east, y up, z south, metres from its centre at sea level; the ground curves away as in FS_SX_ENV
  const loc = (c, la, lo, alt) => { const e = (lo - c.lo)*DEG*R*Math.cos(c.la*DEG), n = (la - c.la)*DEG*R; return [e, alt - (e*e + n*n)/(2*R), -n]; };
  function setup(c){
    S.city = c; S.ap = []; S.routes = [];
    for (const a of c.airports || []){
      const rw = a.runways.map(r => { const A = loc(c, r.a[1], r.a[2], 0), B = loc(c, r.b[1], r.b[2], 0);
        return { r, ends:[[A, B, r.a[0]], [B, A, r.b[0]]].map(([P, Q, des]) => { const d = V.norm(V.sub(Q, P)); return { P, d, hdg:(Math.atan2(d[0], -d[2])/DEG + 360) % 360, des, len:r.len }; }) }; });
      S.ap.push({ a, rw, peak:PEAK[a.iata] || 8, night:NIGHT[a.iata] || 0.06, ele:a.ele || 0, use:new Map() });
    }
    S.state = 1;
    if (c.sea && can) fetch('earth/cities/' + c.sea.file).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(buf => {
      if (S.city !== c) return;
      const b = new Uint8Array(buf), dv = new DataView(buf), nL = dv.getUint32(4, true), nP = dv.getUint32(8, true), unit = dv.getFloat32(12, true), po = 16 + 4*(nL + 1), ao = po + 4*nP;
      let total = 0;
      for (let i=0;i<nL;i++){
        if (b[ao + i] !== 0) continue;   // (ferry routes only)
        const s0 = dv.getUint32(16 + 4*i, true), s1 = dv.getUint32(20 + 4*i, true), pts = [], cum = [0];
        for (let k=s0;k<s1;k++){ const x = dv.getInt16(po + 4*k, true)*unit, y = dv.getInt16(po + 4*k + 2, true)*unit; pts.push([x, -(x*x + y*y)/(2*R), -y]);
          if (pts.length > 1){ const p = pts[pts.length - 1], q = pts[pts.length - 2]; cum.push(cum[cum.length - 1] + Math.hypot(p[0] - q[0], p[2] - q[2])); } }
        const L = cum[cum.length - 1]; if (L < 150) continue;
        const v = L < 1500 ? 2.5 : BOATV[c.key] || 6, n = Math.max(1, Math.min(4, Math.round(L/3000))), cyc = 2*(L/v + 60);
        S.routes.push({ pts, cum, L, v, n, cyc, ph:hsh(i, 7.7)*cyc, name:c.sea.names[b[ao + 3*nL + i]] || '' }); total += n;
        if (total > 160) break;
      }
      S.state = 2;
    }).catch(() => { if (S.city === c) S.state = 2; });
  }
  const at = (rt, s) => { let j = 1; while (j < rt.cum.length - 1 && rt.cum[j] < s) j++; const u = clamp((s - rt.cum[j-1])/Math.max(rt.cum[j] - rt.cum[j-1], 1e-3), 0, 1), a = rt.pts[j-1], b = rt.pts[j];
    return { p:[a[0] + (b[0] - a[0])*u, a[1] + (b[1] - a[1])*u, a[2] + (b[2] - a[2])*u], d:V.norm([b[0] - a[0], 0, b[2] - a[2]]) }; };
  // the local hour of the city at a moment (s since 1970); a fixed offset worked out once a minute is close enough for the timetable
  // (kept per city: flying from one city to another within the hour reused the first one's offset; from Codex's review of #45)
  let tzAt = -1, tzOff = 0, tzKey = '';
  function localH(c, t){
    if (Math.abs(t - tzAt) > 3600 || tzKey !== c.key){ tzAt = t; tzKey = c.key; try { const f = new Intl.DateTimeFormat('en-GB', { timeZone:c.tz, hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(t*1000)), g = k => +(f.find(x => x.type === k) || {}).value;
      tzOff = ((g('hour')*60 + g('minute')) - Math.floor(((t/60) % 1440 + 1440) % 1440)); } catch (e) { tzOff = 0; } }
    return (((t/60 + tzOff) % 1440 + 1440) % 1440)/60;
  }
  const dayShare = (h, night) => { const k = h < 5 ? 0 : h < 6.5 ? (h - 5)/1.5 : h < 22 ? 1 : h < 23.5 ? 1 - (h - 22)/1.5 : 0; return night + (1 - night)*k*k*(3 - 2*k); };
  // the runway ends in use for a flight at time t: arrivals on the end facing most into the wind, departures on its parallel twin
  function ends(A, t){
    const key = Math.floor(t/3600); let u = A.use.get(key); if (u) return u;
    const w = wxAt('city-' + S.city.key, (key + 0.5)*3600*1000), calm = !w || !w.real || !(w.ws >= 2.5), wd = calm ? CALM[S.city.key] : w.wd;
    // (the end most into the wind lands; its parallel twin, if any, takes the departures; a long crosswind runway is never chosen over it)
    const all = A.rw.flatMap(r => r.ends), dA = e => Math.abs(((e.hdg - wd + 540) % 360) - 180), arr = all.reduce((p, q) => dA(q) < dA(p) - 1 || (Math.abs(dA(q) - dA(p)) <= 1 && q.len > p.len) ? q : p);
    const twin = all.filter(e => e !== arr && Math.abs(((e.hdg - arr.hdg + 540) % 360) - 180) < 8).sort((p, q) => q.len - p.len)[0];
    u = { arr, dep:twin || arr, wd:Math.round(wd), calm }; A.use.set(key, u); if (A.use.size > 6) A.use.delete(A.use.keys().next().value); return u;
  }
  const TAN3 = Math.tan(3*DEG), TF = 265, TIN = 320, TC = 120, TOUT = 330;
  // a quadratic Bezier from a through control b to c, and its direction, at s 0..1
  const qb = (a, b, c, s) => V.add(V.add(V.mul(a, (1 - s)*(1 - s)), V.mul(b, 2*s*(1 - s))), V.mul(c, s*s));
  const qd = (a, b, c, s) => V.norm(V.add(V.mul(V.sub(b, a), 2*(1 - s)), V.mul(V.sub(c, b), 2*s)));
  // where a flight is u seconds into it (arrivals: u 0 at touchdown; departures: 0 at brake release): { p, d (heading), gnd, h (m above the airport) }
  // e: the runway end; g: the flight's own numbers (entry or exit heading)
  function fly(kind, e, A, g, u){
    const ele = A ? A.ele : 0, Y = (p, h) => { p[1] = ele + 4 + h - (p[0]*p[0] + p[2]*p[2])/(2*R); return p; };   // (h above the airport, on the curving Earth, as the ground is drawn)
    if (!kind){
      const TD = 300;
      if (u >= 0){   // (on the runway: braking to taxi speed, then rolling on at 10 m/s, never back; from Codex's review of #45)
        const roll = u < 36 ? 72*u - u*u : 1296 + (u - 36)*10, s = TD + Math.min(roll, e.len - 350);
        return { p:Y(V.add(e.P, V.mul(e.d, s)), 0), d:e.d, gnd:true, h:0 };
      }
      if (u >= -TF){   // (the final approach: 3 degrees down to the touchdown point, at the ground there: no step; from Codex's review)
        return { p:Y(V.add(e.P, V.mul(e.d, TD + 72*u)), -72*u*TAN3), d:e.d, gnd:false, h:-72*u*TAN3 };
      }
      // (the inbound leg: from the entry over the city's side onto the final approach, joining it at its own speed and heading)
      const F = V.add(e.P, V.mul(e.d, TD - 72*TF)), C = V.sub(F, V.mul(e.d, 36*TIN)), s = clamp((u + TF + TIN)/TIN, 0, 1), hF = 72*TF*TAN3;
      const h = hF + (3000 - hF)*(1 - s)*(1 - s);
      return { p:Y(qb(g.E, C, F, s), h), d:qd(g.E, C, F, s), gnd:false, h };
    }
    if (kind === 1){
      if (u < 39) return { p:Y(V.add(e.P, V.mul(e.d, u*u)), 0), d:e.d, gnd:true, h:0 };
      if (u <= TC){ const w = u - 39, h = w*(9.5 + 0.035*w); return { p:Y(V.add(e.P, V.mul(e.d, 1521 + 78*w + 0.27*w*w)), h), d:e.d, gnd:false, h }; }
      // (out of the climb-out: curving toward the flight's own heading, climbing on to 7,000 m)
      const w = TC - 39, D = V.add(e.P, V.mul(e.d, 1521 + 78*w + 0.27*w*w)), hD = w*(9.5 + 0.035*w), v = 78 + 0.54*w;
      const C = V.add(D, V.mul(e.d, v*TOUT/2)), X = V.add(D, g.X), s = clamp((u - TC)/TOUT, 0, 1), h = hD + (7000 - hD)*s;
      return { p:Y(qb(D, C, X, s), h), d:qd(D, C, X, s), gnd:false, h };
    }
    // (an airliner passing over at 10,500 m, straight)
    return { p:Y(V.add(g.E, V.mul(g.d, 230*u)), 10500), d:g.d, gnd:false, h:10500 };
  }
  // the planes flying now at airport A (and, with A null, those passing over): one entry each
  function planes(A, t, out){
    if (!A){
      const I = 3600/OVER, D = 100000/230;
      for (let k=Math.floor((t - D)/I);k<=Math.floor(t/I);k++){
        const T = (k + hsh(k, 91))*I, u = t - T; if (u < 0 || u > D) continue;
        const a = hsh(k, 17)*2*Math.PI, d = [Math.sin(a), 0, -Math.cos(a)], side = (hsh(k, 23) - 0.5)*30000, g = { d, E:V.add(V.mul(d, -50000), [-d[2]*side, 0, d[0]*side]) };
        out.push({ kind:2, g, u, f:fly(2, null, null, g, u), fade:clamp(u/20, 0, 1)*clamp((D - u)/20, 0, 1), id:7e5 + (k % 997), name:'' });
      }
      return;
    }
    const I = 3600/A.peak;
    for (const kind of [0, 1]){
      const T0 = kind ? 0 : TF + TIN, T1 = kind ? TC + TOUT : 50, k0 = Math.floor((t - T1)/I), k1 = Math.floor((t + T0)/I);
      for (let k=k0;k<=k1;k++){
        const T = (k + 0.15 + 0.6*hsh(k, A.peak + kind*31))*I, u = t - T; if (u < -T0 || u > T1) continue;
        if (hsh(k*1.7, A.peak*3.1 + kind) > dayShare(localH(S.city, T), A.night)) continue;
        const e = ends(A, T), E = kind ? e.dep : e.arr;
        // (an arrival's entry: 30 km from the final approach fix, toward the city and to one side; a departure's exit: 45 km away, any way but back)
        const F = V.add(E.P, V.mul(E.d, 300 - 72*TF)), toC = V.norm([-F[0], 0, -F[2]]), a = (hsh(k, A.peak + 5) - 0.5)*1.6, ca = Math.cos(a), sa = Math.sin(a);
        const dirE = [toC[0]*ca - toC[2]*sa, 0, toC[0]*sa + toC[2]*ca], b = Math.atan2(E.d[0], -E.d[2]) + (hsh(k, A.peak + 9) - 0.5)*Math.PI*1.5;
        const g = kind ? { X:[Math.sin(b)*45000, 0, -Math.cos(b)*45000] } : { E:V.add(F, V.mul(dirE, 30000)) };
        const fade = kind ? clamp((T1 - u)/25, 0, 1)*clamp(u/3, 0, 1) : clamp((u + T0)/25, 0, 1)*clamp((T1 - u)/10, 0, 1);
        out.push({ kind, e:E, A, g, u, f:fly(kind, E, A, g, u), fade, id:k*2 + kind + A.peak*1e5, name:SHORT[A.a.iata] || A.a.iata });
      }
    }
  }
  // what hides a point: the heights between the camera and it (the city's layers, buildings and all), sampled in 12 steps
  function hidden(cf, c, p){
    const fx = V.add(c.env.p, M3.apply(c.env.F.M, V.mul(p, 1e-3))), d = V.sub(fx, cf), L = V.len(d)*1000;
    if (L < 30) return false;
    for (let i=1;i<12;i++){ const q = V.add(cf, V.mul(d, i/12)), alt = (V.len(q) - 6371)*1000;   // (the line's own height above the sea at that point)
      const g = EDT.heightAt(q); if (g != null && g > alt + 1.5) return true; }
    return false;
  }
  function tick(){
    if (!FLAGS.realEarth) return;
    const cf = M3.applyT(earth.rot, V.mul(earth.rel, -1/KM)), alt = V.len(cf) - 6371, c = alt < 90 ? ECT.near(cf) : null;
    if (!c){ S.n = 0; if (S.city && GT - S.seen > 120){ S.city = null; S.state = 0; } return; }
    S.seen = GT; if (S.city !== c){ setup(c); S.vis.fill(1); }
  }
  { const prev = earth.update; let last = -1; earth.update = function(dt){ if (prev) prev.call(this, dt); if (GT !== last){ last = GT; tick(); } }; }
  // the points of this frame, from drawEnv after the ground (camera-relative city frame: rel, Rw)
  function draw(best, rel, Rw){
    const c = best && best.city; if (!c || S.city !== c || !FLAGS.realEarth){ S.n = 0; S.nl = 0; hideLabels(); return; }
    const t = (jdNow() - 2440587.5)*86400, cf = M3.applyT(earth.rot, V.mul(earth.rel, -1/KM)), cam = M3.applyT(c.env.F.M, V.mul(V.sub(cf, c.env.p), 1000));
    const sunEl = Math.asin(clamp(V.dot(M3.applyT(earth.rot, sunDirFrom(earth)), c.up), -1, 1))/DEG, night = 1 - smooth(-6, 4, sunEl), day = 1 - night;
    const list = [], wall = performance.now()/1000;
    for (const A of S.ap) planes(A, t, list);
    planes(null, t, list);
    const P = ps.a, C = ps.c, LP = ls.a, LC = ls.c; let n = 0, k = 0, nl = 0;
    const put = (p, b, r, g, bl) => { if (n >= MAXP || b < 0.01) return; P[n*4] = p[0]; P[n*4 + 1] = p[1]; P[n*4 + 2] = p[2]; P[n*4 + 3] = b; C[n*4] = r; C[n*4 + 1] = g; C[n*4 + 2] = bl; C[n*4 + 3] = 0; n++; };
    const seg = (a, b2, br, col) => { if (nl + 2 > MAXL || br < 0.01) return; for (const q of [a, b2]){ LP.set([q[0], q[1], q[2], br], nl*4); LC.set([col[0], col[1], col[2], 0], nl*4); nl++; } };
    const mpp = 2*tanY/sceneH, near = [];   // (metres a scene pixel is wide, a metre away)
    // (each object's visibility is checked again every few frames, round robin, and eased so nothing pops)
    const seen = (id, p) => { const j = (Math.abs(Math.floor(id)) % 1009); if ((k++ + S.vi) % 12 === 0) S.visAt[j] = hidden(cf, c, p) ? 0 : 1; S.vis[j] += (S.visAt[j] - S.vis[j])*0.25; return S.vis[j]; };
    S.fj = 0; if (c.key === 'lasvegas' && V.len(cam) < 25000) fountains(c, t, put, seg, seen, night);   // (first, so the planes' trails never crowd them out)
    for (const pl of list){
      const f = pl.f, vz = seen(pl.id, f.p), b = pl.fade*vz; if (b < 0.01) continue;
      const toC = V.sub(cam, f.p), dist = V.len(toC), face = Math.max(V.dot(f.d, V.mul(toC, 1/Math.max(dist, 1))), 0), low = f.h < 3000;
      // (its shape: at least three times an airliner's 38 m, and at least eight pixels (four characters) long, so it shows from 15 km)
      const Lh = Math.max(57, 4*mpp*dist), side = V.norm(V.cross(f.d, [0, 1, 0])), up = [0, 1, 0];
      const shape = (day*1.5 + night*0.12)*4*b, sc = [0.9, 0.9, 0.86];
      seg(V.add(f.p, V.mul(f.d, Lh)), V.sub(f.p, V.mul(f.d, Lh)), shape, sc);
      const wg = V.add(f.p, V.mul(f.d, Lh*0.1)); seg(V.add(wg, V.mul(side, Lh*0.95)), V.sub(wg, V.mul(side, Lh*0.95)), shape, sc);
      const tl = V.sub(f.p, V.mul(f.d, Lh*0.85)); seg(V.add(tl, V.mul(side, Lh*0.32)), V.sub(tl, V.mul(side, Lh*0.32)), shape, sc); seg(tl, V.add(tl, V.mul(up, Lh*0.3)), shape, sc);
      put(V.add(f.p, V.mul(f.d, Lh)), b*(low ? 1.1 + 2.4*Math.pow(face, 3) : 0.6)*(night*1 + day*0.35*Math.pow(face, 3)), 1, 0.95, 0.85);   // (landing lights, by day only head-on)
      put(V.add(f.p, V.mul(up, Lh*0.15)), b*(0.6 + 0.6*night)*(wall*1.1 % 1 < 0.14 ? 1.2 : 0), 1, 0.15, 0.1);   // (the red beacon, about once a second, day and night: airliners keep it on)
      const st = (wall + hsh(pl.id, 2)) % 1.2, sf = b*(st < 0.05 || (st > 0.12 && st < 0.17) ? 1.6 : 0)*(0.4 + 0.6*night);
      put(V.add(wg, V.mul(side, Lh*0.95)), sf, 1, 1, 1); put(V.sub(wg, V.mul(side, Lh*0.95)), sf, 1, 1, 1);   // (white strobes on the wing tips, a double flash)
      // (a contrail by day above 5,000 m: the path it flew in the last minute, a point a second, fading and spreading)
      if (f.h > 5000 && day > 0.05) for (let j=1;j<=60;j++){
        const q = fly(pl.kind, pl.e, pl.A, pl.g, pl.u - j); if (q.h < 5000) break;
        put(V.add(q.p, [0, -6*j*0.1, 0]), b*day*0.55*(1 - j/61)*clamp((f.h - 5000)/1500, 0, 1), 0.95, 0.96, 1);
      }
      if (vz > 0.5 && pl.fade > 0.5 && dist < 14000) near.push({ pl, dist });
    }
    planeLabels(near, rel, Rw);
    if (S.state === 2){
      const h = localH(c, t), on = h >= 6 ? 1 : 0.25;
      S.routes.forEach((rt, ri) => {
        for (let j=0;j<rt.n;j++){
          if (on < 1 && hsh(ri, j + 0.5) > on) continue;
          const q = ((t + rt.ph + j*rt.cyc/rt.n) % rt.cyc + rt.cyc) % rt.cyc, run = rt.L/rt.v, s = q < 60 ? 0 : q < 60 + run ? (q - 60)*rt.v : q < 120 + run ? rt.L : rt.L - (q - 120 - run)*rt.v;
          const a = at(rt, clamp(s, 0, rt.L)), p = a.p; p[1] += 2.5;
          const id = 5e5 + ri*8 + j, vz = seen(id, p); if (vz < 0.01) continue;
          put(p, vz*(1.1*night + 0.6*day), 1, night > 0.5 ? 0.86 : 0.97, night > 0.5 ? 0.66 : 0.95);
        }
      });
    }
    S.vi++; S.n = n; S.nl = nl;
    S.rel = rel; S.rot = Rw;
    if (nl){ ls.upload('ac'); drawParticles(earth, lspec, 1); }
    if (n){ ps.upload('ac'); drawParticles(earth, spec, 1); }
    // (the readout's line: which runways the planes use now, and that they are simulated)
    const u = S.ap.filter(A => A.peak >= 10).map(A => { const e = ends(A, t); return A.a.iata + ' ' + (e.arr === e.dep ? e.arr.des : e.arr.des + ' and ' + e.dep.des); });
    const w = S.ap.length ? ends(S.ap[0], t) : null;
    S.line = u.length ? `planes (simulated, drawn larger far off): landing ${u.join(', ')}, into the wind${w && !w.calm ? ' from ' + w.wd + '°' : ''}` : '';
  }
  // the Fountains of Bellagio (Las Vegas, 0.22.0): more than 1,200 nozzles in the 8.5-acre lake in front of the Bellagio, shooting water up to
  // 140 m (460 ft) in time with music (Bellagio). A show every 30 minutes from 15:00 (from noon at weekends), every 15 minutes from 20:00 to
  // midnight, each about four minutes. Here 110 jets on the lake's curves (an outer arc, an inner one and a line of shooters through the
  // middle), their heights in waves that run along the lines, the shooters at three moments and the finale; the music and the real
  // choreography are not reproduced (illustrative). Lit white at night
  const BEL = { la:36.11268, lo:-115.17420 };
  let FT = null;
  function fountains(c, t, put, seg, seen, night){
    if (!FT || FT.c !== c || !FT.ok){
      const D = Math.PI/180, uL = [Math.cos(BEL.la*D)*Math.cos(BEL.lo*D), Math.sin(BEL.la*D), -Math.cos(BEL.la*D)*Math.sin(BEL.lo*D)];
      const h = EDT.heightAt(V.mul(uL, 6371)), base = loc(c, BEL.la, BEL.lo, (h != null && h > 100 ? h : (c.ele || 620)) + 0.5), jets = [];
      for (let i=0;i<70;i++){ const a = -1.15 + 2.3*i/69; jets.push({ x:base[0] + 42*Math.cos(a) - 30, z:base[2] + 135*Math.sin(a), hm:58 + 18*Math.cos(a*3), line:0, i }); }
      for (let i=0;i<30;i++){ const a = -1 + 2*i/29; jets.push({ x:base[0] + 20*Math.cos(a) - 34, z:base[2] + 80*Math.sin(a), hm:36, line:1, i }); }
      for (let i=0;i<10;i++) jets.push({ x:base[0] - 10, z:base[2] - 90 + 20*i, hm:140, line:2, i });
      FT = { c, y:base[1], jets, ok:h != null };   // (the lake's level from the city's heights once they are in)
    }
    // (the local day of the week: 1 January 1970 was a Thursday)
    const lh = localH(c, t), um = ((t/60) % 1440 + 1440) % 1440; let off = lh*60 - um; if (off > 720) off -= 1440; if (off < -720) off += 1440;
    const wd = ((Math.floor((t/60 + off)/1440) + 4) % 7 + 7) % 7, weekend = wd === 0 || wd === 6;
    const m = lh*60, first = weekend ? 12*60 : 15*60;
    if (m < first) return;
    const start = m < 20*60 ? first + Math.floor((m - first)/30)*30 : 20*60 + Math.floor((m - 20*60)/15)*15, u = (m - start)*60;
    if (u > 240) return;
    const env = clamp(u/4, 0, 1)*clamp((240 - u)/3, 0, 1), fin = smooth(212, 222, u), sd = start % 97;
    for (const j of FT.jets){
      let h;
      if (j.line === 2){ const shot = [55, 118, 176].some(b => u > b + j.i*0.12 && u < b + 2.5 + j.i*0.12); h = shot ? 140 : fin > 0 ? 140*fin : 0; }
      else { const ph = j.i*(j.line ? 0.5 : 0.22) + sd, w = Math.max(0, Math.sin(u*(0.7 + 0.15*Math.sin(sd)) - ph)); h = j.hm*(0.25 + 0.75*w*w)*(1 - fin) + j.hm*1.15*fin; }
      h *= env; if (h < 2) continue; S.fj++;   // (jets up now, seen or not)
      const vz = seen(7e5 + j.line*100 + j.i, [j.x, FT.y + h*0.5, j.z]); if (vz < 0.01) continue;
      // (each jet a line of water, leaning as it sways, with its spray a point of light at the top)
      const lean = 0.18*Math.sin(u*1.1 + j.i*0.37), b = vz*(0.8 + 0.5*night), top = [j.x + Math.sin(lean)*h*0.5, FT.y + h, j.z], wc = night > 0.5 ? [1, 0.97, 0.9] : [0.97, 0.98, 1];
      seg([j.x, FT.y, j.z], top, b*3.2, wc);
      put(top, b*1.2, wc[0], wc[1], wc[2]);
    }
  }
  // the three nearest planes' labels ('landing at Heathrow'): DOM labels like the objects', beside the plane, hidden with the labels setting
  const LBL = [];
  function planeLabels(near, rel, Rw){
    if (!LBL.length) for (let i=0;i<3;i++){ const el = document.createElement('div'); el.className = 'lab plane-lab'; $('#labels').appendChild(el); LBL.push(el); }
    near.sort((a, b) => a.dist - b.dist);
    LBL.forEach((el, i) => {
      const it = labelsOn && near[i]; let show = false;
      if (it){ const pl = it.pl, w = V.add(rel, M3.apply(Rw, V.mul(pl.f.p, 1e-3*KM))), pr = projectCSS(w);
        if (pr){ const txt = pl.kind === 2 ? 'passing over at 10,500 m' : pl.kind === 1 ? 'leaving ' + pl.name : pl.f.gnd ? 'landed at ' + pl.name : 'landing at ' + pl.name;
          if (el.textContent !== txt) el.textContent = txt;
          el.style.transform = `translate3d(${(pr.x + 10).toFixed(1)}px, ${(pr.y - 8).toFixed(1)}px, 0)`; show = true; } }
      if (el.classList.contains('on') !== show) el.classList.toggle('on', show);
    });
  }
  const hideLabels = () => LBL.forEach(el => el.classList.remove('on'));
  const dbg = () => ({ city:S.city && S.city.key, state:S.state, airports:S.ap.map(A => A.a.iata), routes:S.routes.length, boats:S.routes.reduce((s, r) => s + r.n, 0), points:S.n, lines:S.nl, fountains:S.fj || 0, labels:LBL.filter(el => el.classList.contains('on')).map(el => el.textContent), line:S.line });
  return { tick, draw, dbg, S, ps, get line(){ return S.line; } };
})();
