/* KAIROS PARADOR — Masterplan V2 / composition-grid
 * Visual hierarchy & composition for Canvas 2D: background, vignette, draw-order,
 * deck/mirador plank texture, labels and the watermark. Vanilla, no dependencies.
 * Defines the back→front layer order so the scene reads as a composed plan. */

// Back→front draw order by layer key (lower index = further back).
export const ORDER = [
  'context', 'canopy', 'buffers', 'gardens', 'parkingGreen',
  'lot', 'view', 'promenade', 'paths',
  'plaza', 'railway', 'pavilions', 'future', 'technical', 'arrival',
  'palms', 'gathering', 'lounge', 'fire', 'lighting'
];
export const orderIndex = (key) => { const i = ORDER.indexOf(key); return i < 0 ? ORDER.length : i; };

export function background(ctx, W, H) {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
  g.addColorStop(0, '#0a2233'); g.addColorStop(1, '#05101d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

export function vignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.34, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.40)');
  ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}

// Deck / mirador plank texture, clipped to a closed screen-space shape.
export function deckTexture(ctx, screenPts, color = '#e8b06b') {
  ctx.save();
  ctx.beginPath(); screenPts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.clip();
  const ys = screenPts.map(p => p.y), xs = screenPts.map(p => p.x);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  ctx.strokeStyle = color; ctx.globalAlpha = 0.30; ctx.lineWidth = 1;
  for (let y = minY; y <= maxY; y += 4) { ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke(); }
  ctx.restore();
}

export function label(ctx, x, y, text, color = '#eaf6ff') {
  ctx.save(); ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = color;
  ctx.fillText(text, x, y); ctx.restore();
}

// Subtle, premium watermark — present but non-aggressive (small, low alpha, muted).
export function watermark(ctx, W, H, text) {
  ctx.save(); ctx.translate(W / 2, H * 0.92);
  ctx.font = '600 12px ui-monospace, monospace'; ctx.fillStyle = 'rgba(180,210,230,.10)';
  ctx.textAlign = 'center'; ctx.letterSpacing = '2px';
  ctx.fillText(text, 0, 0); ctx.restore();
}
