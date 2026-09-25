
// ================================================================ Eta Carinae: the Homunculus, twin dusty lobes thrown off in the Great Eruption of the 1840s
const FS_ETACAR = COMMON + `
float lobe(vec3 p, float sg){
  vec3 q = p - vec3(0., 0.36*sg, 0.);
  float r = length(q/vec3(0.31, 0.38, 0.31));
  // the lobes pinch in toward the star
  r += 0.25*smoothstep(0.2, 0., abs(p.y))*(1. - abs(p.y)/0.2);
  return r;
}
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.);
  if(h.y < 0.) discard;
  vec3 col = vec3(0.); float T = 1.;
  int N = int(mix(46., 84., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt;
  float tc = -dot(o, d);
  float Tstar = 1.; bool passed = false;
  for(int i=0;i<84;i++){
    if(i >= N) break;
    float t = t0 + jit + dt*float(i);
    if(!passed && t > tc){ Tstar = T; passed = true; }
    vec3 p = o + d*t; float rc = length(p);
    float sg = p.y > 0. ? 1. : -1.;
    float l = lobe(p, sg);
    float shellN = fbm3(p*14. + 3.);
    float cells = 1. - pow(ridge(p*9. + 1.), 2.)*0.8;
    float shell = exp(-pow((l - 1.)/0.07, 2.))*(0.35 + 1.1*shellN)*cells;
    // equatorial skirt: radial streamers of ejecta in the waist
    float ang = atan(p.z, p.x);
    float skirt = exp(-p.y*p.y/0.0015)*smoothstep(0.08, 0.2, rc)*smoothstep(0.62, 0.3, rc)*pow(noise(vec3(ang*6., rc*4., 2.)), 2.)*2.;
    // outer ejecta: faint red nitrogen-rich filaments beyond the lobes
    float outer = smoothstep(0.62, 0.8, fbm3(p*6. + 11.))*smoothstep(0.55, 0.75, rc)*smoothstep(1., 0.8, rc);
    // the little homunculus inside
    float inner = exp(-pow((length(p/vec3(0.1, 0.16, 0.1)) - 1.)/0.12, 2.))*0.6;
    float lit = 1./(0.12 + rc*rc*3.);
    vec3 dustC = mix(vec3(1., 0.7, 0.42), vec3(0.95, 0.55, 0.35), shellN);
    vec3 em = dustC*shell*lit*(sg > 0. ? 1. : 0.7)*4. + vec3(1., 0.75, 0.5)*skirt*lit*0.35 + vec3(1., 0.3, 0.28)*outer*0.25 + vec3(1., 0.5, 0.4)*inner*lit*0.5;
    col += T*em*dt*5.;
    T *= exp(-(shell*14. + skirt*3. + inner*4.)*dt);
  }
  if(!passed) Tstar = T;
  // the central binary: one of the most massive and luminous stars known
  col += Tstar*vec3(0.75, 0.85, 1.)*(pblob(o, d, vec3(0.), 0.0015)*1600. + blob(o, d, vec3(0.), 0.02)*3.);
  outCol(col, (1. - T)*0.92);
}`;
const etacar = (() => {
  const pos = radec(hms(10,45,3.6), dms(-59,41,4), 7500);
  // hero orientation: the near (south-east) lobe tipped ~41 degrees toward us
  const n = 5, spikes = makeSpikes([{ p:[0, 0, 0], w:2.5, c:[0.8, 0.9, 1] }]);
  return addObj({ key:'etacar', name:'Eta Carinae', label:'Eta Carinae', type:'hypergiant binary inside the Homunculus Nebula', group:'stars', sortKey:7500,
    fact:'In the 1840s this star blew off ten Suns\' worth of gas and briefly became the second-brightest star in the sky. That debris is the Homunculus. It may explode as a supernova or hypernova.',
    pos, rad:0.4, R0:facingEarth(pos, V.norm([0, 0.66, 0.75]), -40), prog:program(VS_RECT, FS_ETACAR), minZoom:0.1, pxMin:6, farColor:[1, 0.75, 0.55], farLum:0.9, labelRange:3e4, aka:'homunculus carina hypergiant',
    views:[{d:[0, 0.66, 0.75], k:2.2, hold:9, drift:0.03}, {d:[1, 0.05, 0.15], k:1.8, hold:8, drift:0.03}, {d:[0.3, 0.2, 1], k:0.6, hold:8, drift:0.04}],
    particles:[{ ps:spikes, prog:'spike', lines:true, mode:1, sb:0.15, size:1, len:0.06, q0:() => [1, 0, 0, 0] }],
    readout:() => 'two stars of ~90 and ~30 solar masses on a 5.5-year orbit\ntheir colliding winds glow in X-rays at 3,000 km/s' });
})();
