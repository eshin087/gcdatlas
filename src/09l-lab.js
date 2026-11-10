// ================================================================ the lab (/lab, or ?lab): a small stage for trying the Halo's looks quickly, without waiting for the ship
// to get round to them on the site. The ship is parked by one place (S_.park: its route and every effect run on as usual, only its position is
// held), the lab runs its own frame loop (slow motion, pause, single steps) and its buttons do things at once: a teleport out and back to the
// same place, Pip's outing, a scan, a weapons test (the fold cannon; the aim camera looks over the gun at where it fires), the shield's load by hand, and Pip held up close in front of the camera with any of its
// faces (FACES in 07i-drone.js). It is the same page and engine as the site, so what it shows is
// what the site shows. build.mjs writes it as dist/lab.html (window.__LAB set before the page's script).
const LAB = { on:!!window.__LAB || new URLSearchParams(location.search).has('lab'), speed:1, paused:false, step:0, last:0, cam:'side', place:'saturn', load:null, face:null, panel:null };
if (LAB.on){
  window.__freeze = true;   // (the site's own frame loop stands aside)
  const PLACES = [['saturn', 'Saturn'], ['jupiter', 'Jupiter'], ['earth', 'Earth'], ['mars', 'Mars'], ['sgra', 'Sgr A*'], ['crab', 'Crab Nebula']];
  const SPEEDS = [0.1, 0.25, 0.5, 1, 2];
  const CAMS = [['side', 'side'], ['top', 'top'], ['aim', 'aim'], ['engine', 'engines'], ['pip', 'Pip'], ['chase', 'chase'], ['bridge', 'bridge'], ['orbit', 'drag']];
  // (Pip's bits, to watch one now: 07i-drone.js)
  const BITS = [['peek', 'peekaboo'], ['buddy', 'beside you'], ['bow', 'bow'], ['mote', 'spark'], ['twirl', 'twirl'], ['photo', 'photo'], ['play', 'play'], ['hull', 'hull'], ['engine', 'engine']];
  // a fixed camera round the parked ship, in its own frame (as the showcase's turn): elevation and bearing in degrees, distance in ship radii
  function pose(el, phi, dist){
    const D = Math.PI/180, e = el*D, f = phi*D, dir = [-Math.sin(e), -Math.cos(e)*Math.cos(f), Math.cos(e)*Math.sin(f)];
    return { eye:V.mul(dir, dist*Math.max(1, 0.62/tanX)), look:[0, 0, 0], up:V.norm(V.sub([-1, 0, 0], V.mul(dir, Math.sin(e)))) };
  }
  // 'aim': over the ship's shoulder along its heading (the railgun on the needle fires along it), so the gun and where its slugs land are
  // both in the picture: behind the gun, a little above and to one side, updated every frame
  function aimPose(){
    const a = [0, 1, 0], c = GUN_C, up = [-1, 0, 0], sd = V.cross(a, up), k = Math.max(1, 0.62/tanX);
    return { eye:V.add(c, V.add(V.mul(a, -1.1*k), V.add(V.mul(up, 0.4*k), V.mul(sd, 0.75*k)))), look:V.add(c, V.add(V.mul(a, 1.6), V.mul(sd, -0.2))), up };
  }
  // the parked ship turns its nose onto the place for a weapons test (the gun fires only along its heading: an attack run on the site) and
  // back after, over a couple of seconds
  function labAim(dt){
    const k = S_.park; if (!k || !(dt > 0)) return;
    if (!k.h0) k.h0 = k.h;
    const w = S_.act && S_.act.kind === 'weapons' && !S_.act.gunDone, R = attackR(k.tg), L = V.len(k.p), u = V.mul(k.p, -1/L);
    const aim = w ? V.norm(V.add(V.mul(u, Math.cos(Math.asin(Math.min(0.55*R/L, 0.9)))), V.mul(k.h0, Math.min(0.55*R/L, 0.9)))) : k.h0;
    k.h = slerpDir(k.h, aim, 1 - Math.exp(-dt*1.4));
  }
  // 'engines': close by the right engine, from behind, above and to the side, so its drive's rings show sliding aft
  function enginePose(){
    const k = Math.max(1, 0.62/tanX), look = [-0.04, -0.95, 0.2], eye = V.add(look, V.mul([-0.3, -0.55, 0.55], k)), d = V.norm(V.sub(look, eye));
    return { eye, look, up:V.norm(perpTo([-1, 0, 0], d)) };
  }
  // 'Pip': the ride camera's close-up of Pip (pipShotPose, 07i-drone.js), in the ship's frame, every frame; the chase pose while it is aboard
  function pipTurn(){
    if (!PIP.anc || PIP.st !== 'out') return pose(24, 55, 2.1);
    rideFrame(0); const R = ship.R0, r = ship.rad, p = pipShotPose(110);
    return { eye:V.mul(M3.applyT(R, p.eye), 1/r), look:V.mul(M3.applyT(R, p.look), 1/r), up:M3.applyT(R, p.up) };
  }
  function setCam(c){
    LAB.cam = c;
    if (c === 'orbit'){ window.__cosmos.view('halo', 0); }
    else {
      if (!shipCam.on){ flight = null; tween = null; shipCam.on = true; shipCam.eye = null; shipCam.zoom = 1; motion.last = 'ship'; }
      shipCam.pending = false;
      if (c === 'chase') shipCam.mode = 'chase';
      else if (c === 'bridge') shipCam.mode = 'cockpit';
      else { shipCam.mode = 'turn'; shipCam.turn = c === 'top' ? pose(89.5, 90, 1.9) : c === 'aim' ? aimPose() : c === 'engine' ? enginePose() : c === 'pip' ? pipTurn() : pose(24, 55, 2.1); }
      updateModeUI();
    }
    sync();
  }
  // the stay stays: no jobs of its own, never leaving but by a button, and back to the same place when it teleports
  function keep(){ const st = S_.stay; if (!st || !S_.park) return; st.dur = 1e9; st.jobs.length = 0; S_.next = { tg:S_.park.tg, mode:'fold' }; }
  // park the ship by a place, at the distance of its passes there, over the day side where the Sun lights it, heading along an orbit
  function park(key){
    const tg = BYKEY[key]; if (!tg) return;
    LAB.place = key;
    ship.dbg.reset(7, key); S_.labLoad = LAB.load;
    const R = passR(tg, 'cruise'), sunD = sunDirOf(tg), pole = poleOf(tg);
    const side = V.norm(perpTo(anyPerp(pole), pole)), u = V.norm(sunD ? V.add(V.add(V.mul(sunD, 0.8), V.mul(pole, 0.3)), V.mul(V.norm(perpTo(side, sunD)), 0.5)) : V.add(V.mul(pole, 0.35), side));
    let h = V.cross(pole, u); h = V.len(h) > 1e-6 ? V.norm(h) : anyPerp(u);
    S_.park = { tg, p:V.mul(u, R), h };
    keep(); LAB.visits = S_.visits;
    setCam(LAB.cam); if (LAB.face) face(LAB.face); sync();
  }
  const act = {
    fold:() => ship.demo.leaveNow(S_.park.tg, 'fold'),
    probe:() => ship.demo.jobNow('probe', true),
    scan:() => ship.demo.jobNow('scan', true),
    weapons:() => ship.demo.jobNow('weapons', true),
  };
  // Pip up close with a face: held a little right of centre, 0.45 ship radii in front of the camera, as ship.dbg.drone.pose holds it for the
  // tests ('wink': curious with its right eye shut); 'off' puts it back in the bay
  function face(f){
    LAB.face = f === 'off' ? null : f;
    ship.dbg.drone.pose(LAB.face ? { cam:[0.1, 0, 0.45], face:f === 'wink' ? 'curious' : f, wink:f === 'wink' ? 1 : 0 } : null);
  }
  function press(k){ const ok = act[k] && act[k](); if (!ok) toast('busy · try again when the last one is done'); }
  // ---------------------------------------------------------------- the panel
  function row(name, items, cls){ return `<div class="lab-row"><span>${name}</span><div>${items.map(([v, w]) => `<button type="button" data-${cls}="${v}">${w}</button>`).join('')}</div></div>`; }
  function build(){
    const el = document.createElement('div'); el.className = 'lab-panel';
    el.innerHTML = `<div class="lab-h"><b>Halo lab</b><a href="./" title="the site">site ›</a></div>` +
      row('place', PLACES, 'place') + row('camera', CAMS, 'cam') +
      row('speed', [['pause', 'pause'], ...SPEEDS.map(s => [s, s + 'x']), ['step', 'step']], 'speed') +
      row('do', [['fold', 'teleport'], ['probe', 'Pip'], ['scan', 'scan'], ['weapons', 'weapons']], 'act') +
      row('Pip does', BITS, 'bit') +
      row('Pip face', [...Object.keys(FACES), 'wink', 'off'].map(f => [f, f]), 'face') +
      `<div class="lab-row"><span>shield</span><div class="lab-load"><input type="range" min="0" max="100" value="0" aria-label="shield load"><button type="button" data-load="auto">real</button><em></em></div></div>` +
      `<p class="lab-note">space pause · . step · T teleport · P Pip · S scan · W weapons</p>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.place) park(b.dataset.place);
      else if (b.dataset.cam) setCam(b.dataset.cam);
      else if (b.dataset.speed){ const v = b.dataset.speed; if (v === 'pause') LAB.paused = !LAB.paused; else if (v === 'step'){ LAB.paused = true; LAB.step = 1/30; } else { LAB.speed = +v; LAB.paused = false; } }
      else if (b.dataset.act) press(b.dataset.act);
      else if (b.dataset.face) face(b.dataset.face);
      else if (b.dataset.bit){ if (LAB.face) face('off'); ship.dbg.drone.bit(b.dataset.bit); }
      else if (b.dataset.load){ LAB.load = null; S_.labLoad = null; el.querySelector('input').value = 0; }
      sync();
    });
    el.querySelector('input').addEventListener('input', e => { LAB.load = +e.target.value/100; S_.labLoad = LAB.load; sync(); });
    document.body.appendChild(el); LAB.panel = el;
  }
  function sync(){
    const el = LAB.panel; if (!el) return;
    for (const b of el.querySelectorAll('button')){
      const d = b.dataset, on = d.place ? d.place === LAB.place : d.cam ? d.cam === LAB.cam : d.speed ? (d.speed === 'pause' ? LAB.paused : +d.speed === LAB.speed && !LAB.paused) : d.load ? LAB.load == null : d.face ? d.face === (LAB.face || 'off') : false;
      b.classList.toggle('on', !!on);
    }
    el.querySelector('em').textContent = LAB.load == null ? 'as the place asks' : Math.round(LAB.load*100) + '%';
  }
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest('input'))) return;
    const k = e.key.toLowerCase(), map = { t:'fold', p:'probe', s:'scan', w:'weapons' };
    if (k === ' '){ LAB.paused = !LAB.paused; }
    else if (k === '.'){ LAB.paused = true; LAB.step = 1/30; }
    else if (map[k]) press(map[k]);
    else return;
    e.preventDefault(); e.stopImmediatePropagation(); sync();
  }, true);
  // ---------------------------------------------------------------- its own frame loop
  function loop(now){
    requestAnimationFrame(loop);
    const dtR = LAB.last ? Math.min((now - LAB.last)/1000, 0.1) : 0; LAB.last = now;
    let dt = LAB.paused ? 0 : dtR*LAB.speed;
    if (LAB.step){ dt = LAB.step; LAB.step = 0; }
    // (in steps of at most 1/20 s, as the site's loop takes them)
    do { const d = Math.min(dt, 0.05); labAim(d); tick(d); dt -= d; } while (dt > 1e-9);
    if (S_.visits !== LAB.visits){ LAB.visits = S_.visits; keep(); }
    if (LAB.cam === 'aim' && shipCam.on && shipCam.mode === 'turn') shipCam.turn = aimPose();
    if (LAB.cam === 'pip' && shipCam.on && shipCam.mode === 'turn') shipCam.turn = pipTurn();
    SHOWCAP.txt = (ship.readout ? ship.readout().split('\n')[0] : '') + (LAB.paused ? ' · paused' : LAB.speed !== 1 ? ` · ${LAB.speed}x` : '');
    render(); updateHUD(dtR); updateCaption(dtR);
  }
  document.body.classList.add('halo-lab'); document.title = 'gcdatlas lab';
  stopTour(false); pauseShow(); tween = null; flyMove = null; flight = null; hideHint(true);
  build(); park(LAB.place);
  requestAnimationFrame(loop);
}
