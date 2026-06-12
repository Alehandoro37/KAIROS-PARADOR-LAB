/* KAIROS PARADOR — Geometry Engine v2 / render
 * Canvas 2D render pipeline: DPR-aware resize, world→pixel fit, bands, preliminary
 * axes, lot polygon, ISO modules, watermark, and the metrics panel. Also builds the
 * serialisable `lastExport` snapshot consumed by the Export button. Moved verbatim
 * from the original engine.js IIFE (resize, fit, pathPoly, drawBand, drawLineST,
 * drawModule, draw). No visual behaviour changed. */
import { state } from '../runtime/state.js';
import { PAD } from '../runtime/config.js';
import { fromST } from '../core/basis.js';
import { computeModules, sampleAreas } from '../core/modules.js';
import { params, constraints } from '../ui/params.js';

export function resize() {
  const { canvas, ctx } = state;
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(600, Math.floor(r.width * devicePixelRatio));
  canvas.height = Math.max(420, Math.floor(r.height * devicePixelRatio));
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  draw();
}

function fit(pt) {
  const { canvas, local } = state;
  const xs = local.map(p => p.x), ys = local.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = canvas.clientWidth - PAD * 2, h = canvas.clientHeight - PAD * 2;
  const scale = Math.min(w / (maxX - minX + 20), h / (maxY - minY + 20));
  state.scale = scale;
  return { x: PAD + (pt.x - minX + 10) * scale, y: canvas.clientHeight - PAD - (pt.y - minY + 10) * scale };
}

function pathPoly(poly, close = true) {
  const { ctx } = state;
  ctx.beginPath();
  poly.forEach((p, i) => { const q = fit(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
  if (close) ctx.closePath();
}

function drawBand(t1, t2, color) {
  const { ctx, basis } = state;
  const pts = [];
  for (let s = 0; s <= basis.len; s += 1) pts.push(fromST(s, t1));
  for (let s = basis.len; s >= 0; s -= 1) pts.push(fromST(s, t2));
  pathPoly(pts); ctx.fillStyle = color; ctx.fill();
}

function drawLineST(t, style, label) {
  const { ctx, basis } = state;
  const a = fit(fromST(0, t)), b = fit(fromST(basis.len, t));
  ctx.save(); ctx.setLineDash(style.dash || []); ctx.strokeStyle = style.color; ctx.lineWidth = style.width || 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = style.color; ctx.font = '12px ui-monospace, monospace'; ctx.fillText(label, a.x + 8, a.y - 8); ctx.restore();
}

function drawModule(m, ok) {
  const { ctx } = state;
  pathPoly(m.corners); ctx.fillStyle = ok ? 'rgba(255,179,107,.28)' : 'rgba(176,85,60,.12)'; ctx.strokeStyle = ok ? '#ffb36b' : '#b0553c'; ctx.lineWidth = 2; ctx.setLineDash(ok ? [] : [7, 5]); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  const q = fit(m.corners[0]); ctx.fillStyle = ok ? '#ffd36b' : '#ffb0a0'; ctx.font = '11px ui-monospace, monospace'; ctx.fillText(ok ? m.id : `${m.id} X`, q.x + 4, q.y - 4);
}

export function draw() {
  const { ctx, canvas, basis, local, metricsEl } = state;
  if (!local) return;
  const p = params(), c = constraints();
  const areas = sampleAreas(c); const mods = computeModules(p, c);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = '#061526'; ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  const effectiveEast = Math.max(c.roadSetbackM - c.roadAxisOffsetM, c.railSetbackM - c.railAxisOffsetM, 0);
  if (effectiveEast > 0) drawBand(0, effectiveEast, 'rgba(176,85,60,.22)');
  if (c.waterBufferM > 0) drawBand(basis.maxT - c.waterBufferM, basis.maxT, 'rgba(80,140,170,.18)');
  if (p.parkBand > 0) drawBand(effectiveEast, effectiveEast + p.parkBand, 'rgba(180,190,255,.10)');
  if (p.walkBand > 0) drawBand(effectiveEast + p.parkBand, effectiveEast + p.parkBand + p.walkBand, 'rgba(255,255,255,.08)');

  drawLineST(c.roadAxisOffsetM, { color: '#8fe5ff', width: 2.2 }, 'EJE VIAL (PRELIMINAR)');
  drawLineST(c.railAxisOffsetM, { color: '#ffd36b', width: 2, dash: [8, 6] }, 'EJE FÉRREO (PRELIMINAR)');
  drawLineST(c.oldRoadAxisOffsetM, { color: '#b9e5ff', width: 1.6, dash: [2, 7] }, 'VÍA ANTIGUA (PRELIMINAR)');

  pathPoly(local); ctx.strokeStyle = '#8fe5ff'; ctx.lineWidth = 2.5; ctx.fillStyle = 'rgba(143,229,255,.06)'; ctx.fill(); ctx.stroke();
  mods.valid.forEach(m => drawModule(m, true)); mods.rejected.forEach(m => drawModule(m, false));

  ctx.save(); ctx.translate(canvas.clientWidth / 2, canvas.clientHeight / 2); ctx.rotate(-Math.PI / 9); ctx.font = '700 24px ui-monospace, monospace'; ctx.fillStyle = 'rgba(255,211,107,.16)'; ctx.textAlign = 'center'; ctx.fillText('PRELIMINAR — PENDIENTE TOPOGRAFÍA', 0, 0); ctx.restore();

  state.lastExport = { project: 'KAIROS PARADOR — LINEAR STATION', generatedAt: new Date().toISOString(), params: p, constraints: c, metrics: { areaTotalM2: +areas.total.toFixed(1), areaRestrictedM2: +areas.restricted.toFixed(1), areaUsefulM2: +areas.useful.toFixed(1), method: areas.method }, validModules: mods.valid.map(m => ({ id: m.id, type: m.type, s: m.s, t: m.t })), rejectedModules: mods.rejected.map(m => ({ id: m.id, type: m.type, reason: m.reason, s: m.s, t: m.t })), warnings: ['PRELIMINAR — pendiente topografía georreferenciada', 'Ejes modelados paralelos al lindero A→B; no son ejes oficiales', 'Buffer hídrico medido desde lindero occidental por convención del lab'] };
  metricsEl.innerHTML = `<h4>Métricas</h4><p><b>Área KML:</b> ${areas.total.toFixed(1)} m²</p><p><b>Restringida preliminar:</b> ${areas.restricted.toFixed(1)} m²</p><p><b>Útil preliminar:</b> ${areas.useful.toFixed(1)} m²</p><p><b>Módulos válidos:</b> ${mods.valid.length} · <b>rechazados:</b> ${mods.rejected.length}</p><p class="pend">PRELIMINAR — pendiente topografía</p>`;
}
