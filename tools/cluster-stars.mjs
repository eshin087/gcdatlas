// Fetches the member stars of the atlas's open clusters from Hunt & Reffert 2023 (Gaia DR3; VizieR J/A+A/673/A114, through VizieR's TAP)
// and writes src/objects/p0-cluster-stars-data.js: per cluster its centre, distance, size and extinction from the catalogue, and its
// brightest members (probability 0.5 or more) as offsets on the sky, G magnitude and BP-RP colour. (Its ages are left out: the catalogue's
// fits to the colour-magnitude diagram are rough, M67 1.7 billion years against the published 4; the readouts give published ages.)
//   node tools/cluster-stars.mjs              every cluster in LIST
//   node tools/cluster-stars.mjs m18 m21      only these; the others keep their data as it is in the file
// It asks CDS's TAP service first and, if that cannot be reached, the VizieR mirror at Harvard (the same catalogue through VizieR's
// ASU interface; CDS was down on 2026-11-09).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src/objects/p0-cluster-stars-data.js');
// atlas key -> the catalogue's name (M39, NGC 7092, is listed under Theia 517); MAX: the brightest members kept per cluster (the faint rest add nothing at ASCII sizes)
const LIST = { beehive:'NGC_2632', wildduck:'NGC_6705', ptolemy:'NGC_6475', m6:'NGC_6405', m23:'NGC_6494', m25:'IC_4725', m29:'NGC_6913', m34:'NGC_1039',
  m35:'NGC_2168', m36:'NGC_1960', m37:'NGC_2099', m38:'NGC_1912', m39:'Theia_517', m41:'NGC_2287', m46:'NGC_2437', m47:'NGC_2422', m52:'NGC_7654',
  m67:'NGC_2682', m103:'NGC_581', ngc6603:'NGC_6603',
  // (0.25.0, the last of Messier's open clusters)
  m18:'NGC_6613', m21:'NGC_6531', m26:'NGC_6694', m48:'NGC_2548', m50:'NGC_2323', m93:'NGC_2447',
  // (0.28.0, Caldwell's southern showpieces)
  jewelbox:'NGC_4755', southernpleiades:'IC_2602', wishingwell:'NGC_3532' };
const MAX = 600, PMIN = 0.5;
const only = process.argv.slice(2);
for (const k of only) if (!LIST[k]) throw new Error('not in LIST: ' + k);
const TAP = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync', ASU = 'https://vizier.cfa.harvard.edu/viz-bin/asu-tsv';
async function tap(q){
  const r = await fetch(TAP, { method:'POST', body:new URLSearchParams({ request:'doQuery', lang:'adql', format:'tsv', query:q }), signal:AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('TAP ' + r.status);
  const [head, ...rows] = (await r.text()).trim().split('\n').map(l => l.split('\t').map(s => s.replace(/^"|"$/g, '')));
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
// the mirror's tab-separated output: comment lines (#), then the column names, their units and a line of dashes, then the rows
async function asu(params){
  const r = await fetch(ASU + '?' + new URLSearchParams(params), { signal:AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error('VizieR mirror ' + r.status);
  const lines = (await r.text()).split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const head = lines[0].split('\t').map(s => s.trim());
  return lines.slice(3).map(l => { const v = l.split('\t').map(s => s.trim()); return Object.fromEntries(head.map((h, i) => [h, v[i] ?? ''])); });
}
let viaTap = true;
try { await tap('SELECT TOP 1 Name FROM "J/A+A/673/A114/clusters"'); } catch (e){ viaTap = false; console.log(`CDS's TAP service did not answer (${e.message}): using the VizieR mirror at Harvard`); }
const clusterRow = async name => viaTap
  ? (await tap(`SELECT Name, RA_ICRS, DE_ICRS, dist50, r50pc, rcpc, rtpc, logAge50, AV50, N FROM "J/A+A/673/A114/clusters" WHERE Name = '${name}'`))[0]
  : (await asu({ '-source':'J/A+A/673/A114/clusters', Name:name, '-out':'Name,RA_ICRS,DE_ICRS,dist50,r50pc,rcpc,rtpc,logAge50,AV50,N', '-out.max':'5' })).find(c => c.Name === name);
const members = async name => viaTap
  ? tap(`SELECT TOP ${MAX} RA_ICRS, DE_ICRS, Gmag, "BP-RP", Prob FROM "J/A+A/673/A114/members" WHERE Name = '${name}' AND Prob >= ${PMIN} AND Gmag IS NOT NULL ORDER BY Gmag`)
  : asu({ '-source':'J/A+A/673/A114/members', Name:name, Prob:'>=' + PMIN, Gmag:'0..30', '-sort':'Gmag', '-out.max':String(MAX), '-out':'RA_ICRS,DE_ICRS,Gmag,BP-RP,Prob' });
// (with keys given, the clusters not asked for keep what the file has)
const keep = {};
if (only.length){
  const src = fs.readFileSync(FILE, 'utf8'), at = src.indexOf('const CLUSTER_STARS = ');
  Object.assign(keep, Function('return ' + src.slice(at + 'const CLUSTER_STARS = '.length).trim().replace(/;\s*$/, ''))());
  const lost = Object.keys(LIST).filter(k => !only.includes(k) && !keep[k]);
  if (lost.length) throw new Error('not in the file yet, so name them too: ' + lost.join(' '));
}
const out = {};
for (const [key, name] of Object.entries(LIST)){
  if (only.length && !only.includes(key)){ out[key] = keep[key]; continue; }
  const c = await clusterRow(name);
  if (!c) throw new Error('not in the catalogue: ' + name);
  const ra0 = +c.RA_ICRS, de0 = +c.DE_ICRS, cd = Math.cos(de0*Math.PI/180);
  const m = await members(name);
  if (!m.length) throw new Error(name + ': no members');
  // 6 bytes a star: int16 east and north offsets (0.01 arcmin), uint8 G x 10, int8 BP-RP x 40 (missing colour: -128)
  const buf = Buffer.alloc(m.length*6);
  m.forEach((s, i) => {
    let dra = +s.RA_ICRS - ra0; if (dra > 180) dra -= 360; if (dra < -180) dra += 360;
    const xi = Math.round(dra*cd*6000), eta = Math.round((+s.DE_ICRS - de0)*6000);
    if (Math.abs(xi) > 32767 || Math.abs(eta) > 32767) throw new Error(`${name}: a member is more than 5.4 degrees out`);
    buf.writeInt16LE(xi, i*6); buf.writeInt16LE(eta, i*6 + 2);
    buf.writeUInt8(Math.max(0, Math.min(255, Math.round(+s.Gmag*10))), i*6 + 4);
    buf.writeInt8(s['BP-RP'] === '' ? -128 : Math.max(-127, Math.min(127, Math.round(+s['BP-RP']*40))), i*6 + 5);
  });
  out[key] = { name:name === 'Theia_517' ? 'NGC 7092' : name.replace('_', ' '), ra:+ra0.toFixed(5), dec:+de0.toFixed(5), pc:+(+c.dist50).toFixed(1), r50:+(+c.r50pc).toFixed(2), rc:+(+c.rcpc).toFixed(2),
    rt:+(+c.rtpc).toFixed(2), av:+(+c.AV50).toFixed(3), n:+c.N, k:m.length, s:buf.toString('base64') };
  console.log(`${key.padEnd(9)} ${name.padEnd(9)} ${Math.round(+c.dist50*3.2616)} ly · ${Math.round(10**(+c.logAge50)/1e6)} Myr · ${c.N} members, ${m.length} kept, G ${(+m[0].Gmag).toFixed(1)} to ${(+m[m.length - 1].Gmag).toFixed(1)}`);
}
const day = new Date().toISOString().slice(0, 10);
const js = `// generated by tools/cluster-stars.mjs from Hunt & Reffert 2023 (Gaia DR3 members, VizieR J/A+A/673/A114) on ${day}: do not edit by hand.
// Per cluster: centre (deg), distance pc (dist50), radii pc (r50, core rc, tidal rt), extinction AV, members n, kept k, and s: the k
// brightest members (probability ${PMIN} or more), 6 bytes each, base64: int16 east and north offsets from the centre (0.01 arcmin), uint8 G x 10,
// int8 BP-RP x 40 (-128: none).
const CLUSTER_STARS = ${JSON.stringify(out).replace(/"(\w+)":/g, '$1:')};
`;
fs.writeFileSync(FILE, js);
console.log(`src/objects/p0-cluster-stars-data.js: ${(js.length/1024).toFixed(1)} KB`);
