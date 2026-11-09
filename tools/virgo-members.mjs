// The Virgo Cluster's galaxies (0.25.0): writes src/objects/p0v-virgo-data.js from two VizieR catalogues.
// - The Extended Virgo Cluster Catalog (Kim et al. 2014, ApJS 215, 22; VizieR J/ApJS/215/22): 1,589 galaxies with SDSS positions,
//   velocities, magnitudes and types, of which 1,028 are members by the Virgo infall model (MmI = M) and the rest possible members.
// - Surface-brightness-fluctuation distances from the ACS Virgo Cluster Survey (Mei et al. 2007, ApJ 655, 144; J/ApJ/655/144):
//   measured distances for most of its 100 elliptical and lenticular galaxies. (Blakeslee et al. 2009 recalibrated them by a few
//   hundredths of a magnitude and corrected two typos, M86 and M89: both are drawn as objects of their own, with Blakeslee's distances,
//   so neither is among the points here)
// Kept: the members (MmI = M) that the atlas does not draw as objects of their own (the Messier galaxies and NGC 4647, matched within
// 1 arcminute). Per galaxy: its offset from M87 in right ascension and declination, its SDSS r magnitude, a type code and, where Mei et al.
// measured one, its distance. Nothing about depth is made up here: the page does that for the galaxies without a distance (p9c-messier4.js).
//   node tools/virgo-members.mjs
// It asks CDS's TAP service first and, if that cannot be reached, the VizieR mirror at Harvard (as tools/cluster-stars.mjs does).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src/objects/p0v-virgo-data.js');
const TAP = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync', ASU = 'https://vizier.cfa.harvard.edu/viz-bin/asu-tsv';
// M87's place (SIMBAD), the middle of the cluster's main part; and the galaxies drawn as objects of their own (SIMBAD, degrees)
const RA0 = 187.70593, DEC0 = 12.39112;
const OWN = { M49:[187.4449, 8.0004], M58:[189.4317, 11.8181], M59:[190.5094, 11.6469], M60:[190.9166, 11.5527], M61:[185.4789, 4.4738],
  M84:[186.2656, 12.8870], M85:[186.3502, 18.1911], M86:[186.5492, 12.9460], M87:[RA0, DEC0], M88:[187.9965, 14.4203], M89:[188.9159, 12.5563],
  M90:[189.2075, 13.1629], M91:[188.8602, 14.4963], M98:[183.4512, 14.9005], M99:[184.7068, 14.4165], M100:[185.7289, 15.8223], 'NGC 4647':[190.8856, 11.5825] };
async function tap(q){
  const r = await fetch(TAP, { method:'POST', body:new URLSearchParams({ request:'doQuery', lang:'adql', format:'tsv', query:q }), signal:AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error('TAP ' + r.status);
  const [head, ...rows] = (await r.text()).trim().split('\n').map(l => l.split('\t').map(s => s.replace(/^"|"$/g, '').trim()));
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
// the mirror's tab-separated output: per table, comment lines (#), the column names, their units and a line of dashes, then the rows;
// only the first table is read (the EVCC's second table holds its photometry, under other columns)
async function asu(params){
  const r = await fetch(ASU + '?' + new URLSearchParams(params), { signal:AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('VizieR mirror ' + r.status);
  const lines = (await r.text()).split('\n'), out = [];
  let head = null, skip = 0;
  for (const l of lines){
    if (!l.trim()){ if (head && out.length) break; continue; }
    if (l.startsWith('#')){ if (head && out.length) break; continue; }
    if (!head){ head = l.split('\t').map(s => s.trim()); skip = 2; continue; }
    if (skip){ skip--; continue; }
    const v = l.split('\t').map(s => s.trim()); out.push(Object.fromEntries(head.map((h, i) => [h, v[i] ?? ''])));
  }
  return out;
}
let viaTap = true;
try { await tap('SELECT TOP 1 EVCC FROM "J/ApJS/215/22/table4"'); } catch (e){ viaTap = false; console.log(`CDS's TAP service did not answer (${e.message}): using the VizieR mirror at Harvard`); }
const COLS = 'EVCC,VCC,NGC,RAJ2000,DEJ2000,cz,MmI,MTyp1,rmag,R50';
const evcc = viaTap ? await tap(`SELECT ${COLS} FROM "J/ApJS/215/22/table4"`) : await asu({ '-source':'J/ApJS/215/22', '-out':COLS, '-out.max':'5000' });
const mei = viaTap ? await tap('SELECT VCC, "m-M", "e_m-M" FROM "J/ApJ/655/144/table1"') : await asu({ '-source':'J/ApJ/655/144/table1', '-out':'VCC,m-M,e_m-M', '-out.max':'500' });
if (evcc.length < 1500 || evcc.length > 1700) throw new Error(`the EVCC came back with ${evcc.length} rows, not about 1,589`);
const sbf = new Map(mei.filter(r => r['m-M'] !== '').map(r => [+r.VCC, 10**(+r['m-M']/5 + 1)/1e6]));   // VCC number -> distance, Mpc
// type codes: 0 giant elliptical, 1 lenticular, 2 dwarf elliptical or lenticular, 3 spiral, 4 irregular or Magellanic, 5 other (edge-on, unclassified)
const code = t => /^d(E|S0)/.test(t) ? 2 : /^E/.test(t) ? 0 : /^S0|^SB0/.test(t) ? 1 : /^Irr|^Sm|^SBm|^BCD|^dIrr/.test(t) ? 4 : /^S/.test(t) ? 3 : 5;
const sep = (a, b, c, d) => Math.hypot((a - c)*Math.cos(b*Math.PI/180), b - d)*60;   // arcminutes, small angles
const kept = [], dropped = [];
for (const g of evcc){
  if (g.MmI !== 'M') continue;
  const ra = +g.RAJ2000, dec = +g.DEJ2000;
  const own = Object.entries(OWN).find(([, [r, d]]) => sep(ra, dec, r, d) < 1);
  if (own){ dropped.push(own[0]); continue; }
  kept.push({ ra, dec, r:+g.rmag, t:code(g.MTyp1), d:g.VCC ? sbf.get(+g.VCC) || 0 : 0 });
}
const missed = Object.keys(OWN).filter(k => !dropped.includes(k));
console.log(`EVCC: ${evcc.length} galaxies, ${evcc.filter(g => g.MmI === 'M').length} members; drawn as objects: ${dropped.length} (${dropped.join(' ')})` + (missed.length ? `; not matched: ${missed.join(' ')}` : ''));
// 8 bytes a galaxy: int16 offsets from M87 in right ascension and declination (0.001 degrees), uint8 r x 10 - 50 (255: none),
// uint8 type code, uint16 distance (0.01 Mpc; 0: none)
const buf = Buffer.alloc(kept.length*8);
kept.forEach((g, i) => {
  buf.writeInt16LE(Math.round((g.ra - RA0)*1000), i*8); buf.writeInt16LE(Math.round((g.dec - DEC0)*1000), i*8 + 2);
  buf.writeUInt8(isFinite(g.r) && g.r > 0 ? Math.max(0, Math.min(254, Math.round(g.r*10 - 50))) : 255, i*8 + 4);
  buf.writeUInt8(g.t, i*8 + 5); buf.writeUInt16LE(Math.round(g.d*100), i*8 + 6);
});
const nd = kept.filter(g => g.d).length, ds = kept.filter(g => g.d).map(g => g.d), mean = ds.reduce((a, b) => a + b, 0)/nd;
const sd = Math.sqrt(ds.reduce((a, b) => a + (b - mean)**2, 0)/nd);
const day = new Date().toISOString().slice(0, 10);
const js = `// generated by tools/virgo-members.mjs on ${day} from the Extended Virgo Cluster Catalog (Kim et al. 2014, VizieR J/ApJS/215/22) and
// the ACS Virgo Cluster Survey's distances (Mei et al. 2007, J/ApJ/655/144): do not edit by hand.
// The cluster's ${kept.length} members by the Virgo infall model (MmI = M) that are not drawn as objects of their own; ${nd} have a measured distance
// (surface-brightness fluctuations: mean ${mean.toFixed(2)} Mpc, spread ${sd.toFixed(2)} Mpc). s: 8 bytes a galaxy, base64: int16 offsets from M87
// (ra0, dec0) in right ascension and declination (0.001 deg), uint8 SDSS r x 10 - 50 (255: none), uint8 type (0 E, 1 S0, 2 dE or dS0,
// 3 spiral, 4 irregular or Magellanic, 5 other), uint16 distance (0.01 Mpc, 0: none).
const VIRGO_MEMBERS = { ra0:${RA0}, dec0:${DEC0}, n:${kept.length}, nd:${nd}, dMean:${mean.toFixed(3)}, dSd:${sd.toFixed(3)}, s:'${buf.toString('base64')}' };
`;
fs.writeFileSync(FILE, js);
console.log(`${path.relative(ROOT, FILE)}: ${kept.length} galaxies, ${nd} with distances (mean ${mean.toFixed(2)} Mpc, spread ${sd.toFixed(2)}), ${(js.length/1024).toFixed(1)} KB`);
const tc = [0, 0, 0, 0, 0, 0]; kept.forEach(g => tc[g.t]++); console.log('types (E, S0, dE/dS0, spiral, irregular, other):', tc.join(' '));
