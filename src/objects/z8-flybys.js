
// ================================================================ flybys: camera moves that sell the scale of the giants
// Each one starts close (skimming a star's limb, grazing a black hole's disk, inside a galaxy's plane) and sweeps out to a wide shot.
// Distances here are in units of the object's real size (a star's surface, a black hole's horizon, a galaxy's disk), so the
// same recipe works for the Sun and for Stephenson 2-18. They play as a tour angle, or from the "flyby" button on the info panel.
const sizeFrac = o => o.prog === P.blackhole ? 1/20 : o.sizeR ? o.sizeR/o.rad : o.starR ? o.starR : (o.solid || 0.6);
const FLYBY = {
  // skim the limb of a star, then swing round and pull out
  star:{ d:[0.15, 0.25, 1], ks:0.5, offs:[0, 0.93, 0], to:{ d:[-0.95, 0.3, 0.25], ks:5.2 }, hold:13, label:'skimming the surface' },
  planet:{ d:[0.2, 0.18, 1], ks:0.45, offs:[0, 0.95, 0], to:{ d:[-0.8, 0.45, 0.45], ks:4.2 }, hold:12, label:'low pass over the cloud tops' },
  ringed:{ d:[0.35, 0.04, 1], ks:2.1, offs:[0, 0, 0], to:{ d:[-0.5, 0.5, 0.7], ks:7.5 }, hold:13, label:'through the ring plane' },
  // graze a black hole's disk edge-on at a few horizon radii, then rise over the pole and back out
  hole:{ d:[0.12, 0.05, 1], ks:4.2, offs:[0, 0, 0], to:{ d:[0.25, 0.95, 0.2], ks:34 }, hold:14, label:'diving past the horizon' },
  // start in a galaxy's plane, rise until the whole disk is laid out below
  galaxy:{ d:[1, 0.04, 0.25], ks:0.55, offs:[0, 0, 0], to:{ d:[0.15, 1, 0.3], ks:3.4 }, hold:15, label:'rising out of the disk' },
  web:{ d:[0.3, 0.35, 1], ks:0.06, offs:[0, 0, 0], to:{ d:[0.6, 0.6, 0.5], ks:2.2 }, hold:14, label:'pulling back from one filament' },
};
const FLYBY_OBJ = { sun:'star', betelgeuse:'star', uyscuti:'star', stephenson218:'star', r136a1:'star', jupiter:'planet', saturn:'ringed',
  sgra:'hole', m87bh:'hole', ton618:'hole', milkyway:'galaxy', andromeda:'galaxy', sculptor:'galaxy', cosmicweb:'web' };
function makeFlyby(o, kind){
  const f = FLYBY[kind], S = sizeFrac(o);
  return { d:f.d, k:f.ks*S, off:f.offs.map(x => x*S), to:{ d:f.to.d, k:f.to.ks*S }, hold:f.hold, drift:0, flyby:f.label };
}
for (const [key, kind] of Object.entries(FLYBY_OBJ)){
  const o = BYKEY[key]; if (!o || !o.views) continue;
  o.flyby = makeFlyby(o, kind);
  o.views.splice(Math.min(1, o.views.length), 0, o.flyby);   // second angle of the object's tour stop
}
