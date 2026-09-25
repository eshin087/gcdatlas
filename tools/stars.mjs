import { loadLiteStarCatalog } from 'star-catalog-lite';
import fs from 'fs';
const cat = await loadLiteStarCatalog();
const d3 = JSON.parse(fs.readFileSync('node_modules/d3-celestial/data/stars.6.json'));
const bvByHip = new Map(d3.features.map(f => [+f.id, +f.properties.bv]));
let n = 0, noPar = 0, noBv = 0; const out = [];
for (const s of cat){
  if (s.flags & 64) continue;
  const hasPar = (s.flags & 32) && s.parallaxMas > 0;
  if (!hasPar){ noPar++; continue; }
  const bv = bvByHip.get(s.hipId); if (bv === undefined || isNaN(bv)) noBv++;
  out.push({ name:s.displayName, id:s.canonicalId, hip:s.hipId, ra:s.rightAscensionDeg, dec:s.declinationDeg, plx:s.parallaxMas, mag:s.magnitude, bv });
  n++;
}
console.log(n, noPar, noBv);
out.sort((a,b)=>a.mag-b.mag);
console.log(out.slice(0,40).map(s=>`${s.name}|${s.id}|${s.mag.toFixed(2)}|${(3261.56/s.plx).toFixed(1)}ly|bv ${s.bv}`).join('\n'));
const dists = out.map(s => 3261.56/s.plx).sort((a,b)=>a-b);
console.log('median', dists[dists.length>>1], 'p90', dists[Math.floor(dists.length*0.9)], 'max', dists[dists.length-1]);
fs.writeFileSync('stars.json', JSON.stringify(out));
