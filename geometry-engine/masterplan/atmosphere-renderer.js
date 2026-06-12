/* KAIROS PARADOR — Masterplan V2 / atmosphere-renderer
 * Conceptual lighting & atmosphere for Canvas 2D: warm glow nodes, layered fire,
 * view-corridor gradient wedges, and soft atmospheric area fills. Vanilla, no
 * dependencies. Hints only — nothing photometric. */

// Warm glow point. (x,y) screen, rPx glow radius, color hex (#rrggbb).
export function glowNode(ctx, x, y, rPx, color = '#ffe1a0', intensity = 0.55, coreR = 3.4) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, rPx);
  g.addColorStop(0, color); g.addColorStop(0.28, color + 'aa'); g.addColorStop(1, color + '00');
  ctx.globalAlpha = intensity; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, rPx, 0, 7); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, coreR, 0, 7); ctx.fill();
  ctx.restore();
}

// Conceptual campfire: stacked warm radial layers.
export function fireNode(ctx, x, y, rPx) {
  ctx.save();
  [['#ffd36b', rPx * 1.35, 0.5], ['#ff8a5c', rPx * 0.95, 0.6], ['#ff5a3c', rPx * 0.55, 0.7]].forEach(([c, r, a]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c); g.addColorStop(1, c + '00');
    ctx.globalAlpha = a; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  });
  ctx.restore();
}

// View corridor: gradient wedge fading from apex toward the (open) far edge.
export function viewCorridor(ctx, apex, f1, f2, color = '#bfe8ff') {
  ctx.save();
  const mid = { x: (f1.x + f2.x) / 2, y: (f1.y + f2.y) / 2 };
  const g = ctx.createLinearGradient(apex.x, apex.y, mid.x, mid.y);
  g.addColorStop(0, color + '55'); g.addColorStop(1, color + '00');
  ctx.beginPath(); ctx.moveTo(apex.x, apex.y); ctx.lineTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}

// Soft atmospheric area fill: caller provides a path-tracing thunk.
export function atmosphereArea(ctx, traceFn, color, alpha = 0.14) {
  ctx.save(); traceFn(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fill(); ctx.restore();
}
