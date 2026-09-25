
// ================================================================ content pack: extreme stars (the biggest, the heaviest, the sooty ones)
const uyScuti = namedStar('uyscuti', 'UY Scuti', hms(18,27,36.53), dms(-12,27,58.9), 5900, 909, 3550, { type:'red supergiant · one of the largest stars known',
  fact:'Placed where the Sun is, its surface would reach most of the way to Jupiter. If it were a hollow ball, hundreds of millions of Suns would fit inside. Even so it is only 7 to 10 times the Sun\'s mass: it is enormous but thin.',
  star:{ cells:4, act:0, corona:0, speed:0.06, limb:0.78 }, bound:4, farLum:1, labelRange:6e4, aka:'uy sct biggest star hypergiant scutum',
  views:[{ d:[0.3, 0.45, 1], k:1.6, hold:9, drift:0.02 }, { d:[0.3, 0.3, 1], k:0.6, hold:8, drift:0.03 }, { d:[0.6, 1, 0.3], k:3.2, hold:8, drift:0.02 }],
  readout:() => '909 times the Sun\'s radius (8.5 AU across) · 5,900 light-years\nlight takes about 70 minutes to cross it' });
addScaleRings(uyScuti, [SS_RINGS.earth, SS_RINGS.mars, SS_RINGS.jupiter]);

const stephenson = namedStar('stephenson218', 'Stephenson 2-18', hms(18,39,2.37), dms(-6,5,10.5), 19000, 2150, 3200, { type:'red supergiant · possibly the largest star known',
  fact:'If its measured size is right, its surface would reach beyond the orbit of Saturn. Its distance is uncertain by more than half, so it may be smaller, but it is certainly one of the giants of the galaxy.',
  star:{ cells:3, act:0, corona:0, speed:0.05, limb:0.8 }, bound:4, farLum:1.1, labelRange:1.5e5, aka:'st2-18 stephenson 2 dfk 1 biggest star',
  views:[{ d:[0.3, 0.45, 1], k:1.6, hold:9, drift:0.02 }, { d:[0.3, 0.3, 1], k:0.58, hold:8, drift:0.03 }, { d:[0.6, 1, 0.3], k:3.4, hold:8, drift:0.02 }],
  readout:() => '~2,150 times the Sun\'s radius (20 AU across) · ~19,000 light-years\nlight would take almost 3 hours to cross it' });
addScaleRings(stephenson, [SS_RINGS.earth, SS_RINGS.jupiter, SS_RINGS.saturn]);

// ---------------------------------------------------------------- the Tarantula Nebula and R136a1, the heaviest star known
const FS_HII = COMMON + `
// a giant H II region: bubbles blown by clusters of massive stars, long glowing filaments radiating from the core like spider legs
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(40., 72., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  for(int i=0;i<72;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i)); float r = length(p);
    vec3 u = p/max(r, 1e-3);
    float legs = pow(ridge(u*4.5 + vec3(0., 0., r*1.2)), 4.)*smoothstep(1., 0.3, r)*smoothstep(0.05, 0.25, r);
    float cav = smoothstep(0.08, 0.3, r);
    float bub = 0.;
    for(int k=0;k<4;k++){ float fk = float(k); vec3 c = 0.5*vec3(sin(fk*2.1 + 1.), cos(fk*1.7), sin(fk*3.3 + 2.))*0.8; float rb = 0.18 + 0.06*fk; bub += exp(-pow((length(p - c) - rb)/0.035, 2.)); }
    float g = fbmW(p*3. + vec3(tm*0.003));
    float em = (legs*1.6 + bub*0.8 + pow(g, 3.)*1.6*smoothstep(0.95, 0.35, r))*cav;
    vec3 c = mix(vec3(1., 0.3, 0.35), vec3(0.4, 0.95, 0.85), smoothstep(0.35, 0., r)*0.7 + smoothstep(0.55, 0.8, fbm3(p*4.))*0.4);
    col += T*c*em*dt*3.;
    T *= exp(-smoothstep(0.6, 0.85, fbm3(p*3.5 + 17.))*smoothstep(0.2, 0.9, r)*5.*dt);
  }
  outCol(col, (1. - T)*0.8);
}`;
const tarantula = (() => {
  const pos = radec(hms(5,38,38), dms(-69,5,42), 163000);
  const cl = clusterPS(Math.round(600*QUALITY), [0, 0, 0], 0.07, 36000);
  return addObj({ key:'tarantula', name:'Tarantula Nebula', label:'Tarantula', type:'the most active star-forming region in the Local Group · 30 Doradus', group:'nebulae', sortKey:163000,
    fact:'A star factory in the Large Magellanic Cloud so bright that, if it were as close as the Orion Nebula, it would cast shadows on Earth. Its central cluster R136 holds the heaviest stars known.',
    pos, rad:330, R0:facingEarth(pos, [0, 0, 1], 0), prog:program(VS_RECT, FS_HII), minZoom:0.02, pxMin:6, farColor:[1, 0.55, 0.6], farLum:0.5, labelRange:4e5, labelMin:30, aka:'30 doradus ngc 2070 r136 lmc tarantula',
    visFn(rpx){ return smooth(6, 16, rpx)*(0.15 + 0.85*smooth(8, 120, orbit.dist)); },
    views:[{ dirFn:() => V.norm(V.mul(pos, -1)), k:1.6, hold:9, drift:0.02 }, { d:[0.6, 0.4, 0.7], k:0.55, hold:8, drift:0.03 }],
    particles:[{ ps:cl.ps, prog:'ptBasic', mode:1, sb:0.6, size:1.8 }, { ps:cl.spikes, prog:'spike', lines:true, mode:1, sb:0.6, size:1, len:0.03, q0:() => [1, 0, 0, 0] }],
    readout:() => '163,000 light-years, in the Large Magellanic Cloud · ~650 light-years across\nsupernova 1987A went off at its edge' });
})();
const r136a1 = namedStar('r136a1', 'R136a1', hms(5,38,42.39), dms(-69,6,2.9), 163000, 42.7, 46000, { type:'Wolf-Rayet star · the heaviest star known',
  fact:'Between 200 and 300 times the mass of the Sun and about 7 million times as bright. Stars this heavy blow themselves apart with winds of thousands of km/s and live only a few million years.',
  star:{ cells:60, act:0, corona:0.9, speed:0.3 }, bound:6, farLum:1.3, labelRange:40, labelMin:1e-4, aka:'r136 a1 heaviest most massive star tarantula',
  views:[{ d:[0.3, 0.3, 1], k:1.4, hold:9, drift:0.03 }, { d:[0.8, 0.5, 0.3], k:0.5, hold:8, drift:0.03 }, { d:[0.2, 0.2, 1], k:2.5e6, hold:8, drift:0.02 }],
  readout:() => '~46,000 K surface · 43 times the Sun\'s radius\nits wind carries off an Earth\'s mass every few months' });

// ---------------------------------------------------------------- WR 140: two massive stars whose colliding winds make soot, one shell every 8 years
const wr140 = (() => {
  const pos = radec(hms(20,20,27.98), dms(43,51,16.3), 5600);
  const NS = 17, PER = 9, perShell = Math.round(700*QUALITY), ps = makePS(NS*perShell);
  const dirs = [];
  for (let s=0;s<NS;s++) for (let i=0;i<perShell;i++){
    // dust forms in a broad band around the orbital plane near periastron, sweeping round as the stars pass each other
    const a = (rnd() - 0.5)*Math.PI*1.35 + 0.4, lat = rndn()*0.32, ca = Math.cos(lat);
    const sq = 1 + 0.18*Math.pow(Math.abs(Math.cos(2*a)), 3);   // the squarish shells in the JWST image
    dirs.push([Math.cos(a)*ca*sq, Math.sin(lat), Math.sin(a)*ca*sq, 0.4 + rnd()]);
  }
  const st = { age:0 };
  const o = addObj({ key:'wr140', name:'WR 140', label:'WR 140', type:'colliding-wind binary · a dust-making machine', group:'stars', sortKey:5600,
    fact:'A Wolf-Rayet star and an O-type giant on an 8-year orbit. Each time they swing close, their colliding winds squeeze out a puff of carbon soot. The James Webb telescope saw 17 of these shells nested like ripples.',
    pos, rad:1.4, R0:facingEarth(pos, [0, 1, 0.15], 0), minZoom:0.02, pxMin:4, farColor:[1, 0.7, 0.5], farLum:0.5, labelRange:2e4, aka:'wr 140 wolf rayet dust shells jwst',
    particleVis:rpx => smooth(2, 8, rpx),
    update(dt){
      st.age += dt;
      const phase = st.age/PER;
      for (let s=0;s<NS;s++){
        const age = phase - Math.floor(phase) + s, r = 0.02 + age*0.052, fade = Math.exp(-age*0.16)*smooth(0, 0.3, age);
        for (let i=0;i<perShell;i++){ const k = s*perShell + i, dd = dirs[k]; ps.a[k*4] = dd[0]*r; ps.a[k*4+1] = dd[1]*r; ps.a[k*4+2] = dd[2]*r; ps.a[k*4+3] = dd[3]*fade; }
      }
      ps.upload('a');
    },
    views:[{ d:[0, 1, 0.15], k:1.15, hold:10, drift:0.02 }, { d:[0.7, 0.5, 0.5], k:0.8, hold:8, drift:0.03 }],
    particles:[{ ps, prog:'ptBasic', mode:3, sb:0.9, size:1.6, rad:1.4 }], sim:st,
    readout:() => '5,600 light-years · shells spaced about 0.07 light-years apart\nthe dust streams out at ~2,600 km/s' });
  for (let i=0;i<NS*perShell;i++){ const c = V.lerp([1, 0.55, 0.3], [1, 0.8, 0.55], rnd()); ps.c.set([c[0], c[1], c[2], 0], i*4); }
  ps.upload('c'); o.update(0);
  // the two stars at the centre
  const stars = makePS(2); stars.a.set([0.004, 0, 0, 3, -0.004, 0, 0, 2.5]); stars.c.set([0.75, 0.85, 1, 0, 0.85, 0.9, 1, 0]); stars.upload('ac');
  o.particles.push({ ps:stars, prog:'ptBasic', mode:3, sb:1.3, size:3 });
  return o;
})();
