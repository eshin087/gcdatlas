
// ================================================================ 07 emission nebula (Pillars of Creation-like)
const FS_NEBULA = COMMON + `
float pillar(vec3 p, vec2 c, float top, float rb, float lean, float n){
  float y = p.y;
  vec2 cc = c + vec2(lean*pow(y + 1., 2.), 0.03*sin(y*6. + c.x*9.));
  float rad = rb*(0.45 + 0.55*smoothstep(top, -1., y))*(0.85 + 0.3*noise(vec3(c*9., y*5.)));
  float body = max(length(p.xz - cc) - rad, y - top);
  float head = length((p - vec3(cc.x, top, cc.y))*vec3(1., 1.25, 1.)) - rb*0.66;
  float s = min(body, head);
  // evaporating gaseous globules (EGGs) around the head
  for(int k=0;k<4;k++){
    float fk = float(k);
    vec3 e = vec3(cc.x + rb*0.7*cos(fk*1.9 + c.x*7.), top + rb*(0.35 + 0.25*sin(fk*2.3)), cc.y + rb*0.6*sin(fk*1.9 + c.x*7.));
    s = min(s, length(p - e) - rb*(0.09 + 0.05*fract(fk*0.37 + c.x)));
  }
  return s + (n - 0.5)*0.1;
}
// a smaller column without the globules, for the lesser trunks
float mini(vec3 p, vec2 c, float top, float rb){ float rad = rb*(0.45 + 0.55*smoothstep(top, -1., p.y)); return min(max(length(p.xz - c) - rad, p.y - top), length(p - vec3(c.x, top, c.y)) - rb*0.6); }
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.);
  if(h.y < 0.) discard;
  float tm = uTime;
  int N = int(mix(44., 80., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N);
  float jit = hash12(gl_FragCoord.xy)*dt;
  vec3 Ld = normalize(vec3(0.15, 0.85, 0.5));
  vec3 col = vec3(0.); float T = 1.;
  for(int i=0;i<80;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i));
    float r = length(p);
    float n1 = mix(fbm3(p*7. + 5.), ridge(p*11. + 2.), 0.45);
    float sd = min(pillar(p, vec2(-0.32, 0.), 0.42, 0.17, 0.035, n1), min(pillar(p, vec2(0.06, -0.12), 0.1, 0.13, -0.03, n1), pillar(p, vec2(0.4, 0.06), -0.08, 0.1, 0.02, n1)));
    sd = min(sd, min(mini(p, vec2(-0.68, -0.22), -0.42, 0.07), min(mini(p, vec2(0.72, -0.18), -0.36, 0.06), mini(p, vec2(-0.08, -0.4), -0.5, 0.055))) + (n1 - 0.5)*0.1);
    // the dark cloud the columns grow out of, thinning upward into wisps
    float edgeN = fbm3(p*2.4 + 31.);
    float base = smoothstep(-0.5, -0.82, p.y + 0.25*(edgeN - 0.5))*smoothstep(1., 0.6, r);
    sd = min(sd, mix(0.2, -0.05, base));
    float dust = smoothstep(0.012, -0.03, sd);
    // the look of the JWST NIRCam image: translucent rust-and-gold columns with fine inner structure, their sunlit edges
    // glowing orange-red where the ultraviolet boils them, set against a blue haze
    float n2 = noise(p*26. + vec3(7., tm*0.02, 0.));
    float dens = dust*(0.5 + 0.9*n1*n1 + 0.4*n2);
    float face = clamp(0.35 + 0.55*(p.y + 0.9) + 0.4*p.z, 0., 1.5);
    float depthIn = clamp(-sd/0.1, 0., 1.);
    vec3 dustC = mix(vec3(0.42, 0.2, 0.08), vec3(1., 0.66, 0.32), clamp(face*0.7 - depthIn*0.45 + (n1 - 0.5)*0.7 + (n2 - 0.5)*0.3, 0., 1.));
    // the ionisation front: a wavy bright skin that shimmers as the gas streams off it
    float wav = noise(p*17. + vec3(tm*0.05, tm*0.3, 0.));
    float rim = exp(-pow((sd - 0.004 - 0.014*wav)/(0.01 + 0.012*wav), 2.))*face;   // (wav is only needed near the surface, but one noise() is cheap)
    // photo-evaporation: veils of gas peeling off the lit surfaces and drifting away from the cluster
    float flow = 0., evap = 0.;
    if(sd > 0. && sd < 0.2){ flow = fbm3(p*8. - Ld*tm*0.22 + vec3(0., 0., tm*0.05)); evap = exp(-sd/0.05)*smoothstep(0.35, 0.8, flow)*face; }
    float wall = smoothstep(0.05, -0.35, p.z)*smoothstep(-1., -0.55, p.z);
    float g0 = fbm(p*2.3 + (vec3(fbm3(p*1.3), fbm3(p*1.3 + 4.), fbm3(p*1.3 + 8.)) - 0.5)*1.8 + vec3(tm*0.004, 0., tm*0.012));
    float soft = smoothstep(1., 0.3, r + 0.3*(edgeN - 0.5));   // a ragged, gradual edge that hands over to the Eagle Nebula around it
    float gas = soft*(0.15 + g0*g0*g0*2.2)*(0.03 + 6.*wall) + soft*0.25*g0*g0;
    float fore = smoothstep(0.57, 0.74, fbm3(p*3. + 2.))*smoothstep(-0.15, -0.95, p.y)*0.7;
    float gv = fbm3(p*1.6 + 9.);
    vec3 gc = mix(mix(vec3(0.16, 0.34, 0.78), vec3(0.36, 0.6, 0.92), gv), vec3(0.85, 0.55, 0.38), smoothstep(0.55, 0.8, edgeN)*0.5);
    vec3 em = gc*gas*0.4 + dustC*dens*(0.25 + 0.9*face)*(1. - 0.6*depthIn)*14.
      + mix(vec3(1., 0.28, 0.08), vec3(1., 0.62, 0.26), wav)*rim*7. + mix(vec3(1., 0.55, 0.3), vec3(1., 0.45, 0.55), flow)*evap*2.4;
    col += T*em*dt;
    T *= exp(-(dens*16. + fore*6. + gas*0.3)*dt);
    if(T < 0.01) break;
  }
  // young stars still wrapped in the tips, glowing red and slowly flickering
  col += vec3(1., 0.32, 0.18)*(pblob(o, d, vec3(-0.31, 0.44, 0.06), 0.006)*(0.7 + 0.3*sin(tm*1.1)) + pblob(o, d, vec3(0.07, 0.12, -0.05), 0.005)*(0.7 + 0.3*sin(tm*1.4 + 2.)) + pblob(o, d, vec3(0.4, -0.07, 0.1), 0.005)*(0.7 + 0.3*sin(tm*0.9 + 4.)))*30.;
  // Herbig-Haro jets from protostars in the pillar tips (pulsing knots)
  col += jet(o - vec3(-0.3, 0.46, 0.02), d, normalize(vec3(1., 0.35, 0.25)), 0.22, 0.002, 0.012, 1., tm*0.6, vec3(1., 0.55, 0.45), vec3(1., 0.35, 0.4))*25.;
  col += jet(o - vec3(-0.3, 0.46, 0.02), d, -normalize(vec3(1., 0.35, 0.25)), 0.18, 0.002, 0.012, 1., tm*0.6 + 1.3, vec3(1., 0.55, 0.45), vec3(1., 0.35, 0.4))*18.;
  col += jet(o - vec3(0.07, 0.14, -0.1), d, normalize(vec3(-0.8, 0.5, 0.3)), 0.16, 0.002, 0.01, 1., tm*0.7 + 2., vec3(1., 0.6, 0.5), vec3(1., 0.35, 0.4))*22.;
  col += jet(o - vec3(0.41, -0.04, 0.08), d, normalize(vec3(0.7, 0.6, -0.2)), 0.14, 0.002, 0.01, 1., tm*0.8 + 3., vec3(1., 0.6, 0.5), vec3(1., 0.35, 0.4))*20.;
  outCol(col, 1. - T);
}`;
const nebula = (() => {
  const cl = [], bright = [];
  const nStars = Math.round(260*(IS_SMALL ? 0.7 : 1)), ps = makePS(nStars + 40);
  let k = 0;
  for (let i=0;i<nStars;i++){
    const c0 = [0.18 + rndn()*0.12, 0.84 + rndn()*0.06, 0.32 + rndn()*0.12], w = 0.2 + 3*Math.pow(rnd(), 9);
    const c = blackbodyJS(9000 + 25000*rnd());
    ps.a.set([c0[0], c0[1], c0[2], w], k*4); ps.c.set([c[0], c[1], c[2], 0], k*4); k++;
    if (w > 1.2 && bright.length < 14) bright.push({p:c0, w:Math.min(w, 2.5), c});
  }
  for (let i=0;i<40;i++){   // embedded protostars glowing red inside the pillars
    const px = [-0.32, 0.06, 0.4][i % 3], top = [0.42, 0.1, -0.08][i % 3];
    ps.a.set([px + rndn()*0.05, top - rnd()*0.9, (i % 3 === 1 ? -0.12 : 0) + rndn()*0.04, 0.2 + 0.5*rnd()], k*4); ps.c.set([1, 0.35, 0.2, 0], k*4); k++;
  }
  ps.count = k; ps.upload('ac');
  const spikes = makeSpikes(bright);
  const pos = radec(hms(18,18,48), dms(-13,49,0), 6500);
  return addObj({ key:'pillars', name:'Pillars of Creation', label:'Pillars of Creation', type:'star-forming columns in the Eagle Nebula · M16', group:'nebulae', sortKey:6500,
    fact:'Towers of cold gas and dust are eroded by ultraviolet light from the young cluster NGC 6611. Stars forming inside their tips fire jets out of the dust.',
    pos, rad:3, R0:facingEarth(pos, [0, 0.05, 1], 0), prog:program(VS_RECT, FS_NEBULA), minZoom:0.08, pxMin:6, farColor:[0.6, 0.9, 0.7], farLum:0.45, labelRange:3e4, aka:'eagle nebula m16 pillars',
    views:[{d:[0,0.05,1],k:1.4,hold:9,drift:0.025},{d:[0.6,0.3,0.75],k:0.42,off:[-0.3,0.42,0],hold:8,drift:0.05},{d:[-0.35,0.45,0.8],k:1.1,hold:7,drift:-0.03},{d:[0.1,-0.35,1],k:0.55,off:[0.2,0.75,0.3],hold:6,drift:0.04}],
    particles:[
      {ps, prog:'ptBasic', mode:1, sb:2.2, size:2},
      {ps:spikes, prog:'spike', lines:true, mode:1, sb:2.2, size:1, len:0.03, q0:()=>[1, 0, 0, 0]},
    ],
    readout:()=>'the tallest pillar is ~4 light-years high\nultraviolet from O-type stars boils its surface away' });

})();
