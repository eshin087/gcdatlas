// ================================================================ now and then on a tour trip, a comet or a meteor passes the camera (illustrative)
// About one trip in three (never two in a row), partway through the flight, a streak with a glowing head and a fading tail
// crosses part of the screen, well away from the middle where the destination is. It is drawn in the camera's own frame,
// so it never changes the flight: the camera does not stop, turn or slow down for it. Inside the Solar System it is a comet
// whose tails point away from the Sun; elsewhere a meteor-like streak. See docs/ACCURACY.md.
const passer = (() => {
  // its own random sequence, so the shared rnd() (and with it every flight) stays exactly as it was
  let seed = 7771;
  const pr = () => { seed = (seed*1664525 + 1013904223) >>> 0; return seed/4294967296; };
  const NT = 90, ps = makePS(NT + 1);
  const S = { flight:null, since:1, cur:null, count:0, force:false };
  // decide once per trip, as it starts
  function decide(f){
    const ok = tour.on && SET.travel !== 'warp' && !reduceMotion && !SKYV.on && !cmp && f.dur > 2.4;
    const p = S.force ? 1 : S.since < 1 ? 0 : Math.min(1, 0.3 + 0.2*(S.since - 1));
    if (ok && pr() < p){ S.since = 0; S.force = false; make(f); } else S.since++;
  }
  function make(f){
    // inside the Solar System a comet (slow, tails away from the Sun), otherwise a quick meteor-like streak
    const nearSun = V.len(sun.rel) < 3000*AU_LY || V.len(V.sub(frel(f.obj), frel(sun))) < 3000*AU_LY;
    const comet = nearSun && pr() < 0.7, dur = comet ? 2.6 + 1.2*pr() : 0.8 + 0.5*pr();
    const x0 = 0.18 + 0.35*pr(), start = Math.min(x0*f.dur, 0.85*f.dur - dur);
    if (start < 0.1*f.dur) return;
    // the path: a straight line whose closest point to the middle of the screen is at 55 to 80% of the half-height,
    // in the upper half or toward the right (the interface sits bottom and left), crossing it sideways
    const th = (-35 + 180*pr())*DEG, rho = 0.55 + 0.25*pr(), mid = [rho*Math.cos(th), rho*Math.sin(th)];
    const tilt = (5 + 15*pr())*DEG, sgn = pr() < 0.5 ? -1 : 1, tg = [-Math.sin(th)*sgn, Math.cos(th)*sgn];
    const dir = [tg[0]*Math.cos(tilt) + Math.cos(th)*Math.sin(tilt), tg[1]*Math.cos(tilt) + Math.sin(th)*Math.sin(tilt)];
    const L = comet ? 0.35 + 0.2*pr() : 0.55 + 0.3*pr();
    S.cur = { comet, dur, start, mid, dir, L, tail:comet ? 0.32 + 0.14*pr() : 0.26 + 0.14*pr(), sz:0.85 + 0.3*pr() };
    S.count++;
  }
  function draw(c, u){
    // camera frame (x right, y up, z forward), at a small depth in front of the camera; screen units are the half-height
    const tn = tanY, z = 1, e = u;
    const fin = smooth(0, c.comet ? 0.22 : 0.12, u)*(1 - smooth(c.comet ? 0.72 : 0.7, 1, u));
    const hx = c.mid[0] + c.dir[0]*c.L*(e - 0.5), hy = c.mid[1] + c.dir[1]*c.L*(e - 0.5);
    const head = [hx*tn*z, hy*tn*z, z];
    // tail direction on screen: behind the motion, or (a comet) away from the Sun
    let tdx = -c.dir[0], tdy = -c.dir[1];
    if (c.comet){
      const sc = [V.dot(sun.rel, cam.right), V.dot(sun.rel, cam.up), V.dot(sun.rel, cam.fwd)], l = Math.hypot(sc[0], sc[1]);
      // projected away from the Sun; when the Sun is almost straight ahead or behind, the tail is foreshortened
      if (l > 1e-30){ const ax = -sc[0]/l, ay = -sc[1]/l, fore = clamp(l/V.len(sc), 0.6, 1); tdx = ax*fore; tdy = ay*fore; }
    }
    const grow = c.comet ? 1 : smooth(0, 0.35, u);   // a meteor's trail builds up behind it
    let n = 0;
    ps.a.set([head[0], head[1], head[2], 1.4*fin*c.sz], 0); ps.c.set(c.comet ? [0.85, 0.94, 1, 0] : [0.92, 1, 0.9, 0], 0); n++;
    for (let j=1;j<=NT;j++){
      const v = j/NT, len = c.tail*grow*v;
      let px, py;
      if (c.comet){
        // two tails: a straight blue one away from the Sun, and a broader yellowish one bending back along the path
        const dust = j % 2 === 0, bend = dust ? v*v*0.35 : 0;
        px = hx + (tdx + (-c.dir[0] - tdx)*bend)*len; py = hy + (tdy + (-c.dir[1] - tdy)*bend)*len;
        const b = (dust ? 0.75 : 0.95)*Math.pow(1 - v, 1.3)*fin*c.sz;
        ps.a.set([px*tn*z, py*tn*z, z, b], n*4); ps.c.set(dust ? [1, 0.9, 0.72, 0] : [0.5, 0.72, 1, 0], n*4);
      } else {
        px = hx + tdx*len; py = hy + tdy*len;
        const b = 1.1*Math.pow(1 - v, 1.6)*fin*c.sz;
        ps.a.set([px*tn*z, py*tn*z, z, b], n*4); ps.c.set(V.lerp([1, 0.9, 0.6], [1, 0.5, 0.25], v), n*4);
      }
      n++;
    }
    ps.count = n; ps.upload('ac');
    const spec = { ps, prog:'ptBasic', mode:3, rad:1e-15, rel:() => [0, 0, 0], rot:() => camRot };
    drawParticles(null, Object.assign({ sb:1.3, size:2.6 }, spec));
    drawParticles(null, Object.assign({ sb:0.3, size:c.comet ? 14 : 9, count:() => 1 }, spec));   // a soft glow round the head
  }
  EXTRAS.push(() => {
    if (window.__cosmos && !window.__cosmos.passer) window.__cosmos.passer = S;
    const f = flight;
    if (f !== S.flight){ S.flight = f; S.cur = null; if (f) decide(f); }
    const c = S.cur; if (!c || !f) return;
    const u = (f.t - c.start)/c.dur;
    if (u < 0) return;
    if (u > 1){ S.cur = null; return; }
    draw(c, u);
  });
  return S;
})();
