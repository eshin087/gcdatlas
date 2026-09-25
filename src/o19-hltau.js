
// ================================================================ HL Tauri: a newborn star with a planet-forming disk carved into rings (as ALMA sees it)
const FS_HLTAU = COMMON + `
float gaps(float r){
  float g = 1.;
  g *= 1. - 0.8*exp(-pow((r - 13.2)/2.2, 2.)); g *= 1. - 0.85*exp(-pow((r - 32.3)/3.2, 2.)); g *= 1. - 0.7*exp(-pow((r - 42.)/2., 2.));
  g *= 1. - 0.75*exp(-pow((r - 50.)/2.8, 2.)); g *= 1. - 0.8*exp(-pow((r - 64.2)/3.8, 2.)); g *= 1. - 0.7*exp(-pow((r - 73.7)/2.2, 2.)); g *= 1. - 0.7*exp(-pow((r - 81.2)/2.5, 2.));
  return g;
}
void main(){
  vec3 o, d; localRay(o, d);
  vec3 col = vec3(0.); float alpha = 0.;
  // dusty envelope still falling onto the system
  col += vec3(1., 0.45, 0.25)*(blob(o, d, vec3(0.), 0.55)*0.05 + blob(o, d, vec3(0.), 0.25)*0.08);
  if(abs(d.y) > 1e-5){
    float t = -o.y/d.y;
    if(t > 0.){
      vec3 q = o + d*t; float r = length(q.xz)*150.;
      float I = pow(max(r, 2.)/10., -0.6)*smoothstep(118., 92., r)*gaps(r);
      float ang = atan(q.z, q.x);
      I *= 0.9 + 0.1*sin(ang*3. + r*0.2 - uTime*0.3*pow(max(r, 5.)/20., -1.5));
      vec3 c = mix(vec3(1., 0.55, 0.2), vec3(1., 0.85, 0.5), smoothstep(0.3, 1.2, I));
      float a = clamp(I*0.55, 0., 0.8);
      col = col*(1. - a) + c*I*2.2;
      alpha = a;
    }
  }
  // bipolar jet (HH 150) and the young star, still wrapped in dust
  col += jet(o, d, vec3(0., 1., 0.), 0.95, 0.004, 0.03, 1., uTime*0.5, vec3(1., 0.5, 0.45), vec3(1., 0.35, 0.4))*6.;
  col += jet(o, d, vec3(0., -1., 0.), 0.8, 0.004, 0.03, 1., uTime*0.5 + 1.7, vec3(1., 0.5, 0.45), vec3(1., 0.35, 0.4))*4.;
  col += vec3(1., 0.75, 0.5)*(pblob(o, d, vec3(0.), 0.002)*200. + blob(o, d, vec3(0.), 0.02)*0.8);
  outCol(col, alpha);
}`;
const hltau = (() => {
  const pos = radec(hms(4,31,38.4), dms(18,13,59), 450);
  return addObj({ key:'hltau', name:'HL Tauri', label:'HL Tau', type:'newborn star and planet-forming disk', group:'nebulae', sortKey:450,
    fact:'A star less than a million years old. Its disk of dust is already carved into rings and gaps, probably by young planets sweeping up material. Colours show the dust glow ALMA sees.',
    pos, rad:150*AU_LY, R0:facingEarth(pos, [Math.sin(46.7*DEG), Math.cos(46.7*DEG), 0], 138), prog:program(VS_RECT, FS_HLTAU), minZoom:0.05, pxMin:5, farColor:[1, 0.6, 0.35], farLum:0.35, labelRange:3000, aka:'protoplanetary disk alma planets forming',
    views:[{dirFn:() => V.norm(V.mul(hltau.pos, -1)), k:2, hold:9, drift:0.02}, {d:[0.3, 0.95, 0.3], k:1.7, hold:9, drift:0.02}, {d:[1, 0.12, 0.3], k:1.4, hold:8, drift:0.03}],
    readout:() => 'disk ~240 AU across · gaps at 13, 32, 42, 50, 64, 74, 81 AU\n450 light-years away in Taurus' });
})();
