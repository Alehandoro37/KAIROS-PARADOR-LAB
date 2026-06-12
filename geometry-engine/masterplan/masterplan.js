/* KAIROS PARADOR — Masterplan Blueprint V1 / engine
 * PRELIMINAR · CONCEPTUAL spatial-design overlay rendered on a Canvas 2D, parametric
 * and relative to the Logos lot frame. Reuses NOTHING from Engine v2 (independent),
 * does NOT modify lot.json, and draws the OSM context from the validated seed if
 * available. PNG export is native to the canvas. Not architecture, not cadastre. */
import { LAYERS, WARNING, buildBlueprint } from './masterplan-data.js';
import { exportJSON, exportPNG } from './masterplan-export.js';

const LOT_URL = '../../data/lot.json';
const SEED_URL = '../../data/osm/osm-context-seed.json';
const PAD = 54;

const $ = (id) => document.getElementById(id);
const colorOf = (key) => (LAYERS.find(l => l.key === key) || {}).color || '#ffffff';

const canvas = $('mpCanvas');
const ctx = canvas.getContext('2d');

let lot = null, seed = null;
let lon0, lat0, mLon, mLat;          // projection (equirectangular, centroid-based)
let lotWorld = [], basis = null, frame = null;
let elements = [], areasByLayer = {}, lotAreaM2 = 0;
const visible = new Set(LAYERS.map(l => l.key));

// ---- projection / frame ----------------------------------------------------
function projectLL(points) {
  lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  lon0 = points.reduce((s, p) => s + p.lon, 0) / points.length;
  mLat = 111320; mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  return points.map(p => ({ id: p.id, x: (p.lon - lon0) * mLon, y: (p.lat - lat0) * mLat }));
}
const llToWorld = (lon, lat) => ({ x: (lon - lon0) * mLon, y: (lat - lat0) * mLat });
const worldToLL = (w) => ({ lon: lon0 + w.x / mLon, lat: lat0 + w.y / mLat });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const hyp = (a) => Math.hypot(a.x, a.y);
function buildFrame() {
  const A = lotWorld[0], B = lotWorld[1];
  let u = sub(B, A); const len = hyp(u); u = { x: u.x / len, y: u.y / len };
  let n = { x: -u.y, y: u.x };
  const t = (p) => dot(sub(p, A), n);
  let maxT = Math.max(...lotWorld.map(t)), minT = Math.min(...lotWorld.map(t));
  if (Math.abs(minT) > Math.abs(maxT)) { n = { x: u.y, y: -u.x }; maxT = Math.max(...lotWorld.map(p => dot(sub(p, A), n))); }
  basis = { A, u, n, len, maxT };
  frame = { len, maxT };
}
const fromST = (s, t) => ({ x: basis.A.x + basis.u.x * s + basis.n.x * t, y: basis.A.y + basis.u.y * s + basis.n.y * t });
function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    const hit = ((a.y > pt.y) != (b.y > pt.y)) && (pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y + 1e-9) + a.x);
    if (hit) inside = !inside;
  }
  return inside;
}
function shoelaceWorld(poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; s += p.x * q.y - q.x * p.y; } return Math.abs(s / 2); }

// ---- resolve program into world coords + conflict test ---------------------
function resolve() {
  elements = buildBlueprint(frame.len, frame.maxT);
  areasByLayer = {}; LAYERS.forEach(l => areasByLayer[l.key] = 0);
  elements.forEach(e => {
    if (e.kind === 'lot' || e.kind === 'context') { e.world = null; e.conflictive = false; return; }
    e.world = (e.pts || []).map(p => fromST(p[0], p[1]));
    const closed = (e.kind === 'poly');
    // conflict: every defining vertex must lie inside the lot polygon
    e.conflictive = !e.world.every(w => pointInPoly(w, lotWorld));
    // centre (for export) + label anchor
    const cx = e.world.reduce((s, w) => s + w.x, 0) / e.world.length;
    const cy = e.world.reduce((s, w) => s + w.y, 0) / e.world.length;
    e.center = { x: cx, y: cy }; e.centerLL = worldToLL(e.center);
    if (e.area != null) areasByLayer[e.layer] += e.area;
  });
  lotAreaM2 = shoelaceWorld(lotWorld);
}

// ---- canvas mapping --------------------------------------------------------
let scale = 1, bbox = null;
function computeBox() {
  const xs = lotWorld.map(p => p.x), ys = lotWorld.map(p => p.y);
  const m = Math.max(basis.maxT, 18) * 1.1; // margin to reveal adjacent road/rail
  bbox = { minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m, minY: Math.min(...ys) - m, maxY: Math.max(...ys) + m };
}
function fit(w) {
  const cw = canvas.clientWidth - PAD * 2, ch = canvas.clientHeight - PAD * 2;
  scale = Math.min(cw / (bbox.maxX - bbox.minX), ch / (bbox.maxY - bbox.minY));
  const offX = PAD + (cw - (bbox.maxX - bbox.minX) * scale) / 2;
  return { x: offX + (w.x - bbox.minX) * scale, y: canvas.clientHeight - PAD - (w.y - bbox.minY) * scale };
}
function path(world, close = true) {
  ctx.beginPath();
  world.forEach((w, i) => { const q = fit(w); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
  if (close) ctx.closePath();
}

// ---- rendering -------------------------------------------------------------
const ZONE = new Set(['parking', 'green', 'events', 'expansion']);
function drawContext() {
  if (!seed || !visible.has('context') || !seed.geojson) return;
  const col = colorOf('context');
  seed.geojson.features.forEach(f => {
    const g = f.geometry; if (!g) return;
    const coords = g.type === 'Point' ? [g.coordinates] : (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates);
    const w = coords.map(c => llToWorld(c[0], c[1]));
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = f.properties.category === 'rail' ? 1.6 : 1.2;
    if (f.properties.category === 'rail') ctx.setLineDash([6, 5]);
    if (g.type === 'Point') { const q = fit(w[0]); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, 7); ctx.fill(); }
    else { path(w, g.type === 'Polygon'); ctx.stroke(); }
    ctx.restore();
  });
}
function drawElement(e) {
  if (!visible.has(e.layer) || !e.world) return;
  const col = e.conflictive ? '#ff7a5c' : colorOf(e.layer);
  ctx.save();
  if (e.kind === 'access') {
    const a = fit(e.world[0]), b = fit(e.world[1]);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(a.x, a.y, 4.5, 0, 7); ctx.fill();
  } else if (e.kind === 'polyline') {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); path(e.world, false); ctx.stroke();
  } else { // poly
    path(e.world, true);
    ctx.globalAlpha = ZONE.has(e.layer) ? 0.14 : 0.26; ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = e.conflictive ? 2.4 : 1.6;
    ctx.setLineDash(e.future || e.conflictive ? [7, 5] : []); ctx.stroke(); ctx.setLineDash([]);
  }
  // numbered label
  const c = fit(e.center || e.world[0]);
  ctx.fillStyle = e.conflictive ? '#ffd0c4' : '#eaf6ff'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center';
  ctx.fillText(e.conflictive ? `${e.n}!` : `${e.n}`, c.x, c.y + 3);
  ctx.restore();
}
function draw() {
  if (!lotWorld.length) return;
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = '#061526'; ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawContext();
  // lot polygon
  if (visible.has('lot')) { path(lotWorld); ctx.fillStyle = 'rgba(143,229,255,.06)'; ctx.fill(); ctx.strokeStyle = colorOf('lot'); ctx.lineWidth = 2.5; ctx.stroke(); }
  // zones first, then buildings/lines/access on top
  elements.filter(e => e.world && ZONE.has(e.layer)).forEach(drawElement);
  elements.filter(e => e.world && !ZONE.has(e.layer) && e.kind === 'poly').forEach(drawElement);
  elements.filter(e => e.world && e.kind === 'polyline').forEach(drawElement);
  elements.filter(e => e.world && e.kind === 'access').forEach(drawElement);
  // watermark
  ctx.save(); ctx.translate(canvas.clientWidth / 2, canvas.clientHeight / 2); ctx.rotate(-Math.PI / 9);
  ctx.font = '700 22px ui-monospace, monospace'; ctx.fillStyle = 'rgba(255,160,92,.16)'; ctx.textAlign = 'center';
  ctx.fillText('PRELIMINAR · CONCEPTUAL — NO CATASTRO', 0, 0); ctx.restore();
  updatePanel();
}
function resize() {
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(640, Math.floor(r.width * devicePixelRatio));
  canvas.height = Math.max(460, Math.floor(r.height * devicePixelRatio));
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  draw();
}

// ---- panel / legend / UI ---------------------------------------------------
function updatePanel() {
  const prog = elements.filter(e => e.area != null).reduce((s, e) => s + e.area, 0);
  const conf = elements.filter(e => e.conflictive).length;
  const shapes = elements.filter(e => e.kind !== 'lot' && e.kind !== 'context').length;
  const rows = LAYERS.filter(l => areasByLayer[l.key] > 0).map(l => `<tr><td><span class="sw" style="background:${l.color}"></span>${l.label}</td><td class="num">≈ ${Math.round(areasByLayer[l.key])} m²</td></tr>`).join('');
  $('mpMetrics').innerHTML =
    `<h4>Áreas aproximadas</h4>` +
    `<p><b>Lote:</b> ≈ ${Math.round(lotAreaM2)} m² · <b>frente:</b> ≈ ${frame.len.toFixed(1)} m · <b>fondo:</b> ≈ ${frame.maxT.toFixed(1)} m</p>` +
    `<p><b>Huella programa:</b> ≈ ${Math.round(prog)} m² · <b>centroide:</b> ${lat0.toFixed(5)}, ${lon0.toFixed(5)}</p>` +
    `<p><b>Elementos:</b> 17 (${shapes} formas)</p>` +
    `<p class="${conf ? 'pend' : ''}"><b>Conflictivos:</b> ${conf} forma(s) fuera del polígono</p>` +
    `<table class="mini">${rows}</table>` +
    `<p class="fineprint">Cifras APROXIMADAS (~metros), no catastrales.</p>`;
}
function buildControls() {
  const legend = $('mpLayers');
  legend.innerHTML = LAYERS.map(l =>
    `<label class="lyr"><input type="checkbox" data-key="${l.key}" checked> <span class="sw" style="background:${l.color}"></span>${l.label}</label>`).join('');
  legend.querySelectorAll('input[data-key]').forEach(chk => chk.addEventListener('change', e => {
    const k = e.target.dataset.key; e.target.checked ? visible.add(k) : visible.delete(k); draw();
  }));
  $('mpReset').addEventListener('click', () => { computeBox(); draw(); });
  $('mpExportJson').addEventListener('click', () => exportJSON({ frame, centroidLL: { lat: lat0, lon: lon0 }, lotAreaM2, elements, areasByLayer }));
  $('mpExportPng').addEventListener('click', () => exportPNG(canvas));
}

// ---- init ------------------------------------------------------------------
async function init() {
  lot = await fetch(LOT_URL).then(r => r.json());
  lotWorld = projectLL(lot.polygon);
  buildFrame();
  try { seed = await fetch(SEED_URL).then(r => r.json()); } catch (e) { seed = null; }
  resolve();
  computeBox();
  buildControls();
  addEventListener('resize', resize);
  resize();
}
init().catch(err => { $('mpMetrics').innerHTML = `<h4>Error</h4><p>${err.message}</p>`; });
