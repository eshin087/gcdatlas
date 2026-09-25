// Turns CelesTrak GP (OMM JSON) records into a compact list the page can animate on the GPU.
// Each satellite becomes 7 numbers at one shared reference time: semi-major axis (km), inclination, right ascension of the
// ascending node, mean anomaly (radians), eccentricity, argument of perigee (radians) and a group code for its colour.
// Elements are moved from their own epoch to the reference time with two-body motion plus the J2 drift of the node and perigee,
// which is accurate to a few km over the few hours a copy is cached. (Full SGP4 is not needed for a picture.)
const MU = 398600.4418, RE = 6378.137, J2 = 1.08263e-3, TAU = Math.PI*2, DEG = Math.PI/180;
export const GROUPS = ['other', 'starlink', 'oneweb', 'navigation', 'geostationary', 'station', 'science', 'kuiper'];
export function groupOf(name, meanMotion, ecc){
  const n = (name || '').toUpperCase();
  if (/^ISS \(|^CSS \(|TIANHE|TIANGONG/.test(n)) return 5;
  if (n.startsWith('STARLINK')) return 1;
  if (n.startsWith('ONEWEB')) return 2;
  if (n.startsWith('KUIPER')) return 7;
  if (/NAVSTAR|GPS |GALILEO|GLONASS|COSMOS 2[45]\d\d|BEIDOU|QZS|IRNSS|NAVIC/.test(n)) return 3;
  if (Math.abs(meanMotion - 1.0027) < 0.02 && ecc < 0.02) return 4;
  if (/HST|HUBBLE|TESS|SWIFT|FERMI|NUSTAR|CHANDRA|XMM|GAIA|LANDSAT|SENTINEL|TERRA|AQUA|AURA|ICESAT|GRACE|JASON|NOAA|GOES|METOP/.test(n)) return 6;
  return 0;
}
export function compact(records, refMs){
  const out = [], named = [];
  for (const r of records){
    const mm = +r.MEAN_MOTION, e = +r.ECCENTRICITY, i = +r.INCLINATION*DEG;
    if (!(mm > 0.05 && mm < 17.5) || !(e >= 0 && e < 0.95) || !isFinite(i)) continue;
    const n = mm*TAU/86400, a = Math.cbrt(MU/(n*n));
    if (a*(1 - e) < RE + 80) continue;   // already re-entering
    const ep = Date.parse(r.EPOCH.endsWith('Z') ? r.EPOCH : r.EPOCH + 'Z'); if (!isFinite(ep)) continue;
    const dt = (refMs - ep)/1000, p = a*(1 - e*e), k = 1.5*J2*(RE/p)**2*n;
    const raan = (+r.RA_OF_ASC_NODE*DEG - k*Math.cos(i)*dt) % TAU;
    const argp = (+r.ARG_OF_PERICENTER*DEG + 0.5*k*(5*Math.cos(i)**2 - 1)*dt) % TAU;
    const M = (+r.MEAN_ANOMALY*DEG + n*dt) % TAU;
    const g = groupOf(r.OBJECT_NAME, mm, e);
    if (g === 5 || /^HST$/.test(r.OBJECT_NAME)) named.push([r.OBJECT_NAME, out.length/7]);
    out.push(+a.toFixed(1), +i.toFixed(4), +((raan + TAU) % TAU).toFixed(4), +((M + TAU) % TAU).toFixed(4), +e.toFixed(5), +((argp + TAU) % TAU).toFixed(4), g);
  }
  return { ref:new Date(refMs).toISOString(), groups:GROUPS, count:out.length/7, named, data:out };
}
