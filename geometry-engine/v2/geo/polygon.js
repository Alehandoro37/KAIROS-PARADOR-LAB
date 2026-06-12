/* KAIROS PARADOR — Geometry Engine v2 / geo
 * Polygon primitives: shoelace area + ray-casting point-in-polygon. Moved verbatim
 * from the original engine.js IIFE (area, pointInPoly).
 * NOTE: `area` is retained as-is for fidelity though the engine computes areas by
 * grid sampling (see core/modules.js → sampleAreas), not via this function. */
export function area(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a / 2);
}
export function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    const hit = ((a.y > pt.y) != (b.y > pt.y)) && (pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y + 1e-9) + a.x);
    if (hit) inside = !inside;
  }
  return inside;
}
