/* KAIROS PARADOR — Geometry Engine v2 / geo
 * Equirectangular local projection lon/lat (WGS84) → metres, centred on the
 * polygon centroid. mLon = 111320·cos(lat0); mLat = 111320. Moved verbatim from
 * the original engine.js IIFE (projectLL). */
export function projectLL(points) {
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lon0 = points.reduce((s, p) => s + p.lon, 0) / points.length;
  const mLat = 111320, mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  return points.map(p => ({ id: p.id, lon: p.lon, lat: p.lat, x: (p.lon - lon0) * mLon, y: (p.lat - lat0) * mLat }));
}
