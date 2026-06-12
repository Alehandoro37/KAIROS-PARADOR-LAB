/* KAIROS PARADOR — Masterplan V2 / bezier-path-utils
 * Vanilla Canvas-2D helpers for organic, smooth paths (quadratic midpoint
 * smoothing) plus a tiny deterministic RNG used by the procedural symbols. No
 * dependencies, no DOM beyond the passed 2D context. */

// Trace an open polyline (no smoothing).
export function tracePoly(ctx, p, closed = false) {
  ctx.beginPath();
  p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  if (closed) ctx.closePath();
}

// Smooth CLOSED path through control points via midpoint quadratics (organic blob).
export function traceSmoothClosed(ctx, p) {
  const n = p.length;
  if (n < 3) return tracePoly(ctx, p, true);
  const mid = (i) => ({ x: (p[i].x + p[(i + 1) % n].x) / 2, y: (p[i].y + p[(i + 1) % n].y) / 2 });
  ctx.beginPath();
  const m0 = mid(n - 1); ctx.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) { const mi = mid(i); ctx.quadraticCurveTo(p[i].x, p[i].y, mi.x, mi.y); }
  ctx.closePath();
}

// Smooth OPEN path (promenade / sendero).
export function traceSmoothOpen(ctx, p) {
  if (p.length < 3) return tracePoly(ctx, p, false);
  ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2;
    ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
  }
  ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
}

// Unified entry: smooth + closed by default.
export function trace(ctx, p, { smooth = true, closed = true } = {}) {
  if (smooth && closed) traceSmoothClosed(ctx, p);
  else if (smooth) traceSmoothOpen(ctx, p);
  else tracePoly(ctx, p, closed);
}

// Screen-space point-in-polygon (used by procedural fills).
export function pointInScreenPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    const hit = ((a.y > pt.y) != (b.y > pt.y)) && (pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y + 1e-9) + a.x);
    if (hit) inside = !inside;
  }
  return inside;
}

// Deterministic hash + mulberry32 RNG → stable procedural detail across redraws.
export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
