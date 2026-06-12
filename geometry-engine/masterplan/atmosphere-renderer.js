/* KAIROS PARADOR — Masterplan V2/V3 / atmosphere-renderer
 * Conceptual lighting & cinematic atmosphere for Canvas 2D: warm glow nodes, layered
 * fire, view-corridor wedges, ambient/sunset/night washes, fog depth, soft halos,
 * canopy shadows, pathway illumination and a journey spotlight. Vanilla, lightweight,
 * hints only — nothing photometric or physical. */

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

// ---- V3 cinematic washes & depth ------------------------------------------
export function ambientWash(ctx, W, H, color, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore();
}
export function sunsetWash(ctx, W, H, alpha = 0.20) {
  ctx.save(); ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ff9e5e'); g.addColorStop(0.5, '#ff6a88'); g.addColorStop(1, '#3a2a66');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
export function nightWash(ctx, W, H, alpha = 0.34) {
  ctx.save(); ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a1a3a'); g.addColorStop(1, '#06122a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
export function fogDepth(ctx, W, H) {
  ctx.save();
  const g = ctx.createLinearGradient(0, H, 0, H * 0.45);
  g.addColorStop(0, 'rgba(180,210,230,0.10)'); g.addColorStop(1, 'rgba(180,210,230,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
// Soft lighting halo around a point.
export function halo(ctx, x, y, r, color = '#ffe1a0', alpha = 0.4) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color + '88'); g.addColorStop(1, color + '00');
  ctx.globalAlpha = alpha; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
}
// Soft dark shadow mass under canopy (caller traces the shape).
export function canopyShadow(ctx, traceFn) {
  ctx.save(); traceFn(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#04140c'; ctx.fill(); ctx.restore();
}
// Glowing pathway illumination (caller traces the open path).
export function pathwayGlow(ctx, traceFn, color = '#ffd36b') {
  ctx.save(); traceFn();
  ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.stroke(); ctx.restore();
}
// Journey spotlight: keep (x,y) bright, darken the rest (cinematic focus).
export function spotlight(ctx, W, H, x, y, r, dark = 0.58) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, r * 0.28, x, y, r);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(2,8,16,${dark})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
