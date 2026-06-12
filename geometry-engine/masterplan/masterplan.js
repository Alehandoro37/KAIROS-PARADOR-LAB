/* KAIROS PARADOR — Masterplan Blueprint V2 / engine
 * PRELIMINAR · CONCEPTUAL experiential overlay on Canvas 2D: organic curves
 * (quadratic smoothing), layered vegetation, warm glow nodes, view corridors.
 * Parametric and relative to the Logos lot; keeps the conflict detection. Reuses
 * NOTHING from Engine v2, does NOT modify lot.json, draws OSM context from the seed
 * if present. Not architecture, not cadastre. */
import { LAYERS, GROUPS, MOOD, WARNING, buildExperience } from './masterplan-data.js';
import { exportJSON, exportPNG } from './masterplan-export.js';

const LOT_URL = '../../data/lot.json';
const SEED_URL = '../../data/osm/osm-context-seed.json';
const PAD = 56;

const $ = (id) => document.getElementById(id);
const colorOf = (k) => (LAYERS.find(l => l.key === k) || {}).color || '#ffffff';
const groupOf = (k) => (LAYERS.find(l => l.key === k) || {}).group || 'program';

const canvas = $('mpCanvas');
const ctx = canvas.getContext('2d');

let lot = null, seed = null;
let lon0, lat0, mLon, mLat, lotWorld = [], basis = null, frame = null;
let elements = [], areasByLayer = {}, lotAreaM2 = 0;
const visible = new Set(LAYERS.map(l => l.key));

// ---- projection / frame ----------------------------------------------------
function projectLL(points) {
  lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  lon0 = points.reduce((s, p) => s + p.lon, 0) / points.length;
  mLat = 111320; mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  return points.map(p => ({ x: (p.lon - lon0) * mLon, y: (p.lat - lat0) * mLat }));
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
  let maxT = Math.max(...lotWorld.map(p => dot(sub(p, A), n))), minT = Math.min(...lotWorld.map(p => dot(sub(p, A), n)));
  if (Math.abs(minT) > Math.abs(maxT)) { n = { x: u.y, y: -u.x }; maxT = Math.max(...lotWorld.map(p => dot(sub(p, A), n))); }
  basis = { A, u, n, len, maxT }; frame = { len, maxT };
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

// ---- resolve program → world + conflict ------------------------------------
function resolve() {
  elements = buildExperience(frame.len, frame.maxT);
  areasByLayer = {}; LAYERS.forEach(l => areasByLayer[l.key] = 0);
  elements.forEach(e => {
    if (e.kind === 'lot' || e.kind === 'context') { e.conflictive = false; return; }
    if (e.kind === 'node') { e.worldC = fromST(e.s, e.t); e.centerLL = worldToLL(e.worldC); }
    else { e.world = (e.pts || []).map(p => fromST(p[0], p[1])); }
    const verts = e.world || [e.worldC];
    const cx = verts.reduce((s, w) => s + w.x, 0) / verts.length, cy = verts.reduce((s, w) => s + w.y, 0) / verts.length;
    e.worldCenter = { x: cx, y: cy }; e.centerLL = e.centerLL || worldToLL(e.worldCenter);
    const mode = e.conflict || 'vertices';
    e.conflictive =
      mode === 'none' ? false :
      mode === 'center' ? !pointInPoly(e.worldCenter, lotWorld) :
      mode === 'origin' ? !pointInPoly(verts[0], lotWorld) :
      !verts.every(w => pointInPoly(w, lotWorld));
    if (e.area != null) areasByLayer[e.layer] += e.area;
  });
  lotAreaM2 = shoelaceWorld(lotWorld);
}

// ---- canvas mapping --------------------------------------------------------
let scale = 1, bbox = null;
function computeBox() {
  const xs = lotWorld.map(p => p.x), ys = lotWorld.map(p => p.y);
  const m = Math.max(basis.maxT, 18) * 1.15;
  bbox = { minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m, minY: Math.min(...ys) - m, maxY: Math.max(...ys) + m };
}
function fit(w) {
  const cw = canvas.clientWidth - PAD * 2, ch = canvas.clientHeight - PAD * 2;
  scale = Math.min(cw / (bbox.maxX - bbox.minX), ch / (bbox.maxY - bbox.minY));
  const offX = PAD + (cw - (bbox.maxX - bbox.minX) * scale) / 2;
  return { x: offX + (w.x - bbox.minX) * scale, y: canvas.clientHeight - PAD - (w.y - bbox.minY) * scale };
}
// smoothing -----------------------------------------------------------------
function smoothClosed(sp) {
  ctx.beginPath();
  const n = sp.length, mid = (i) => ({ x: (sp[i].x + sp[(i + 1) % n].x) / 2, y: (sp[i].y + sp[(i + 1) % n].y) / 2 });
  let m0 = mid(n - 1); ctx.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) { const mi = mid(i); ctx.quadraticCurveTo(sp[i].x, sp[i].y, mi.x, mi.y); }
  ctx.closePath();
}
function smoothOpen(sp) {
  ctx.beginPath(); ctx.moveTo(sp[0].x, sp[0].y);
  for (let i = 1; i < sp.length - 1; i++) { const mx = (sp[i].x + sp[i + 1].x) / 2, my = (sp[i].y + sp[i + 1].y) / 2; ctx.quadraticCurveTo(sp[i].x, sp[i].y, mx, my); }
  ctx.lineTo(sp[sp.length - 1].x, sp[sp.length - 1].y);
}

// ---- rendering -------------------------------------------------------------
const ALPHA = { solid: 0.30, soft: 0.18, veg: 0.14, faint: 0.07 };
function drawContext() {
  if (!seed || !visible.has('context') || !seed.geojson) return;
  const col = colorOf('context');
  seed.geojson.features.forEach(f => {
    const g = f.geometry; if (!g) return;
    const cs = g.type === 'Point' ? [g.coordinates] : (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates);
    const sp = cs.map(c => fit(llToWorld(c[0], c[1])));
    ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = col; ctx.lineWidth = f.properties.category === 'rail' ? 1.6 : 1.1;
    if (f.properties.category === 'rail') ctx.setLineDash([6, 5]);
    if (g.type === 'Point') { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sp[0].x, sp[0].y, 1.8, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); sp.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); }
    ctx.restore();
  });
}
function drawClosed(e) {
  const sp = e.world.map(fit);
  const col = e.conflictive ? '#ff7a5c' : colorOf(e.layer);
  ctx.save(); smoothClosed(sp);
  ctx.globalAlpha = ALPHA[e.style] || 0.2; ctx.fillStyle = col; ctx.fill();
  ctx.globalAlpha = 1; ctx.lineWidth = e.conflictive ? 2.2 : (e.style === 'solid' ? 1.8 : 1);
  ctx.strokeStyle = col; ctx.setLineDash(e.future || e.conflictive ? [7, 5] : []);
  if (e.style !== 'veg' && e.style !== 'faint') ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
}
function drawOpen(e) {
  const sp = e.world.map(fit); const col = e.conflictive ? '#ff7a5c' : colorOf(e.layer);
  ctx.save(); smoothOpen(sp); ctx.strokeStyle = col; ctx.lineWidth = e.layer === 'promenade' ? 3 : 2;
  ctx.globalAlpha = 0.85; ctx.setLineDash(e.layer === 'paths' ? [6, 5] : []); ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
}
function drawNode(e) {
  const q = fit(e.worldC); const col = e.conflictive ? '#ff7a5c' : colorOf(e.layer);
  const rpx = Math.max(6, (e.r || 1.5) * scale);
  ctx.save();
  if (e.glow) {
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rpx * 2.2);
    g.addColorStop(0, col); g.addColorStop(0.25, col + 'aa'); g.addColorStop(1, col + '00');
    ctx.globalAlpha = 0.55; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, rpx * 2.2, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q.x, q.y, e.layer === 'palms' ? 3 : 3.6, 0, 7); ctx.fill();
  ctx.restore();
}
function drawWedge(e) {
  const sp = e.world.map(fit); const col = colorOf(e.layer);
  ctx.save(); const g = ctx.createLinearGradient(sp[0].x, sp[0].y, (sp[1].x + sp[2].x) / 2, (sp[1].y + sp[2].y) / 2);
  g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00');
  ctx.beginPath(); ctx.moveTo(sp[0].x, sp[0].y); ctx.lineTo(sp[1].x, sp[1].y); ctx.lineTo(sp[2].x, sp[2].y); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
}
function vis(e) { return visible.has(e.layer); }
function draw() {
  if (!lotWorld.length) return;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
  bg.addColorStop(0, '#0a2233'); bg.addColorStop(1, '#05101d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  drawContext();
  // landscape (back)
  elements.filter(e => vis(e) && e.world && (e.style === 'veg' || e.style === 'faint')).forEach(drawClosed);
  // view corridors
  elements.filter(e => vis(e) && e.kind === 'wedge').forEach(drawWedge);
  // lot outline
  if (visible.has('lot')) { const sp = lotWorld.map(fit); ctx.save(); ctx.beginPath(); sp.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = 'rgba(143,229,255,.05)'; ctx.fill(); ctx.strokeStyle = colorOf('lot'); ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); }
  // circulation
  elements.filter(e => vis(e) && e.kind === 'open').forEach(drawOpen);
  // program solid/soft closed (plaza, pavilions, railway, future, technical)
  elements.filter(e => vis(e) && e.world && (e.style === 'solid' || e.style === 'soft')).forEach(drawClosed);
  // nodes (palms then atmosphere glows on top)
  elements.filter(e => vis(e) && e.kind === 'node' && e.layer === 'palms').forEach(drawNode);
  elements.filter(e => vis(e) && e.kind === 'node' && e.layer !== 'palms').forEach(drawNode);
  // labels for key program elements + conflict markers
  ctx.save(); ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center';
  elements.filter(e => vis(e) && e.world && ['plaza', 'pavilions', 'railway', 'future', 'arrival', 'technical'].includes(e.layer)).forEach(e => {
    const q = fit(e.worldCenter); ctx.fillStyle = e.conflictive ? '#ffd0c4' : '#eaf6ff';
    ctx.fillText(e.conflictive ? `${e.n}!` : `${e.n}`, q.x, q.y + 3);
  });
  ctx.restore();
  // watermark
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 9); ctx.font = '700 22px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(255,158,107,.15)'; ctx.textAlign = 'center'; ctx.fillText('PRELIMINAR · CONCEPTUAL — NO CATASTRO', 0, 0); ctx.restore();
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
  const byGroup = {}; GROUPS.forEach(g => byGroup[g] = 0);
  LAYERS.forEach(l => byGroup[l.group] += areasByLayer[l.key] || 0);
  const rows = GROUPS.filter(g => byGroup[g] > 0).map(g => `<tr><td>${g}</td><td class="num">≈ ${Math.round(byGroup[g])} m²</td></tr>`).join('');
  $('mpMetrics').innerHTML =
    `<h4>Áreas aproximadas</h4>` +
    `<p><b>Lote:</b> ≈ ${Math.round(lotAreaM2)} m² · <b>frente:</b> ≈ ${frame.len.toFixed(1)} m · <b>fondo:</b> ≈ ${frame.maxT.toFixed(1)} m</p>` +
    `<p><b>Huella zonas:</b> ≈ ${Math.round(prog)} m² · <b>centroide:</b> ${lat0.toFixed(5)}, ${lon0.toFixed(5)}</p>` +
    `<p class="${conf ? 'pend' : ''}"><b>Conflictivos:</b> ${conf} forma(s) fuera del polígono</p>` +
    `<table class="mini">${rows}</table>` +
    `<p class="fineprint">Cifras APROXIMADAS (~metros), conceptuales, no catastrales.</p>`;
}
function buildControls() {
  // grouped layer toggles + group master toggles
  const cont = $('mpLayers');
  cont.innerHTML = GROUPS.map(g => {
    const items = LAYERS.filter(l => l.group === g).map(l =>
      `<label class="lyr"><input type="checkbox" data-key="${l.key}" checked> <span class="sw" style="background:${l.color}"></span>${l.label}</label>`).join('');
    const master = g === 'program' ? '' : `<label class="grp"><input type="checkbox" data-group="${g}" checked> <b>${g.toUpperCase()}</b></label>`;
    return `<div class="grpbox">${master || `<b class="grphdr">${g.toUpperCase()}</b>`}${items}</div>`;
  }).join('');
  cont.querySelectorAll('input[data-key]').forEach(chk => chk.addEventListener('change', e => {
    const k = e.target.dataset.key; e.target.checked ? visible.add(k) : visible.delete(k); draw();
  }));
  cont.querySelectorAll('input[data-group]').forEach(chk => chk.addEventListener('change', e => {
    const g = e.target.dataset.group, on = e.target.checked;
    LAYERS.filter(l => l.group === g).forEach(l => {
      on ? visible.add(l.key) : visible.delete(l.key);
      const c = cont.querySelector(`input[data-key="${l.key}"]`); if (c) c.checked = on;
    });
    draw();
  }));
  // mood legend
  $('mpMood').innerHTML = MOOD.map(m => `<div class="mood"><span class="sw" style="background:${m.color}"></span><b>${m.label}</b> — ${m.note}</div>`).join('');
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
  resolve(); computeBox(); buildControls();
  addEventListener('resize', resize); resize();
}
init().catch(err => { $('mpMetrics').innerHTML = `<h4>Error</h4><p>${err.message}</p>`; });
