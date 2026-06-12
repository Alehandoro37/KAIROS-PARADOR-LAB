/* KAIROS PARADOR — Masterplan V2 / landscape-symbols
 * Lightweight PROCEDURAL vegetation for Canvas 2D: palm / tree glyphs and a sparse
 * stipple that reads as foliage inside a closed area. Deterministic (seeded) so it
 * never jitters across redraws. Vanilla, no dependencies. Purely conceptual. */
import { rng, hash, pointInScreenPoly } from './bezier-path-utils.js';

// Palm: slender trunk + radiating fronds. (x,y) = base; s = size in px.
export function drawPalm(ctx, x, y, s, color = '#9ad29a') {
  s = Math.max(9, s);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = Math.max(1.2, s * 0.11);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.06, y - s * 0.5, x, y - s * 0.92); ctx.stroke();
  const tx = x, ty = y - s * 0.92;
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, s * 0.08);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.52;
    const ex = tx + Math.cos(a) * s * 0.72, ey = ty + Math.sin(a) * s * 0.6;
    ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * s * 0.4, ty + Math.sin(a) * s * 0.18, ex, ey); ctx.stroke();
  }
  ctx.restore();
}

// Tree: short trunk + soft canopy disc.
export function drawTree(ctx, x, y, s, color = '#5fae7f') {
  s = Math.max(8, s);
  ctx.save();
  ctx.strokeStyle = '#5a4a30'; ctx.lineWidth = Math.max(1.2, s * 0.16); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.45); ctx.stroke();
  ctx.globalAlpha = 0.85; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y - s * 0.62, s * 0.5, 0, 7); ctx.fill();
  ctx.restore();
}

// ---- human scale (V3) — very subtle, not caricature ------------------------
// Small person silhouette: head + tapered body. (x,y) = feet; s = height px.
export function drawPerson(ctx, x, y, s, color = '#dfe9f2') {
  s = Math.max(3.2, s);
  ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = 0.78;
  ctx.beginPath(); ctx.arc(x, y - s, s * 0.32, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y - s * 0.85); ctx.lineTo(x - s * 0.3, y); ctx.lineTo(x + s * 0.3, y); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// Round café table (top view ring).
export function drawTable(ctx, x, y, s, color = '#cdbfa6') {
  ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, Math.max(2, s), 0, 7); ctx.stroke(); ctx.restore();
}
// Bench (short bar).
export function drawBench(ctx, x, y, s, color = '#b9a98c') {
  ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.stroke(); ctx.restore();
}

// Sparse foliage stipple inside a closed screen-space polygon. Seeded by `id`.
export function stippleFoliage(ctx, screenPts, color, id, opts = {}) {
  const xs = screenPts.map(p => p.x), ys = screenPts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const area = Math.max(1, (maxX - minX) * (maxY - minY));
  const n = Math.min(opts.max || 80, Math.max(6, Math.round(area / (opts.spacing || 1100))));
  const r = rng(hash(id));
  ctx.save(); ctx.fillStyle = color;
  let placed = 0, guard = 0;
  while (placed < n && guard++ < n * 6) {
    const x = minX + r() * (maxX - minX), y = minY + r() * (maxY - minY);
    if (!pointInScreenPoly({ x, y }, screenPts)) continue;
    const rad = (opts.dot || 2) * (0.6 + r() * 0.9);
    ctx.globalAlpha = 0.08 + r() * 0.16;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
    placed++;
  }
  ctx.restore();
}
