/* KAIROS PARADOR — Masterplan Blueprint V3 / engine
 * PRELIMINAR · CONCEPTUAL experiential overlay on Canvas 2D, now with a guided
 * cinematic VISITOR JOURNEY (9 stops, smooth camera, dynamic highlights), expanded
 * atmosphere, subtle human scale, railway identity and visual-only experience layers.
 * Render is delegated to vanilla utilities (bezier · landscape · atmosphere ·
 * composition · camera). Reuses NOTHING from Engine v2, does NOT modify lot.json,
 * draws OSM context from the seed if present. Not architecture, not cadastre. */
import { LAYERS, GROUPS, MOOD, JOURNEY, EXPERIENCE_LAYERS, HUMAN_CLUSTERS, TONES, buildExperience } from './masterplan-data.js';
import { exportJSON, exportPNG } from './masterplan-export.js';
import { trace, tracePoly, hash, rng } from './bezier-path-utils.js';
import { drawPalm, stippleFoliage, drawPerson, drawTable, drawBench } from './landscape-symbols.js';
import { glowNode, fireNode, viewCorridor, sunsetWash, nightWash, ambientWash, fogDepth, canopyShadow, pathwayGlow, spotlight } from './atmosphere-renderer.js';
import { background, vignette, deckTexture, label, watermark, orderIndex } from './composition-grid.js';
import { makeCamera, focusCamera, sampleCamera, cameraBox, homeView, ZOOM, clampZoom } from './camera-utils.js';

const LOT_URL = '../../data/lot.json';
const SEED_URL = '../../data/osm/osm-context-seed.json';
const PAD = 56, DWELL = 4200;

const $ = (id) => document.getElementById(id);
const colorOf = (k) => (LAYERS.find(l => l.key === k) || {}).color || '#ffffff';

const canvas = $('mpCanvas');
const ctx = canvas.getContext('2d');

let lot = null, seed = null;
let lon0, lat0, mLon, mLat, lotWorld = [], basis = null, frame = null;
let elements = [], byId = {}, areasByLayer = {}, lotAreaM2 = 0;
const visible = new Set(LAYERS.map(l => l.key));

let baseBox = null, viewBox = null, camera = null, rafId = null;
const journey = { active: false, i: 0, autoplay: false, lastAdvance: 0 };
const experience = { night: false, social: false, wellness: false, market: false, humans: true };

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
  byId = {}; areasByLayer = {}; LAYERS.forEach(l => areasByLayer[l.key] = 0);
  elements.forEach(e => {
    byId[e.id] = e;
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

// ---- canvas mapping (camera-aware) -----------------------------------------
let scale = 1;
function computeBox() {
  const xs = lotWorld.map(p => p.x), ys = lotWorld.map(p => p.y);
  const m = Math.max(basis.maxT, 18) * 1.15;
  baseBox = { minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m, minY: Math.min(...ys) - m, maxY: Math.max(...ys) + m };
  if (!camera) camera = makeCamera(homeView(baseBox));
}
function fit(w) {
  const b = viewBox || baseBox;
  const cw = canvas.clientWidth - PAD * 2, ch = canvas.clientHeight - PAD * 2;
  scale = Math.min(cw / (b.maxX - b.minX), ch / (b.maxY - b.minY));
  const offX = PAD + (cw - (b.maxX - b.minX) * scale) / 2, offY = PAD + (ch - (b.maxY - b.minY) * scale) / 2;
  return { x: offX + (w.x - b.minX) * scale, y: canvas.clientHeight - offY - (w.y - b.minY) * scale };
}
const focusWorld = (id) => { const e = byId[id]; return e ? (e.worldC || e.worldCenter) : null; };

// ---- rendering -------------------------------------------------------------
const ALPHA = { solid: 0.30, soft: 0.18, veg: 0.14, faint: 0.07 };
const vis = (e) => visible.has(e.layer);

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
    else { tracePoly(ctx, sp, false); ctx.stroke(); }
    ctx.restore();
  });
}

function drawElement(e) {
  if (!vis(e)) return;
  const col = e.conflictive ? '#ff7a5c' : colorOf(e.layer);
  if (e.kind === 'lot') {
    const sp = lotWorld.map(fit);
    ctx.save(); tracePoly(ctx, sp, true); ctx.fillStyle = 'rgba(143,229,255,.05)'; ctx.fill();
    ctx.strokeStyle = colorOf('lot'); ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); return;
  }
  if (e.kind === 'wedge') { const sp = e.world.map(fit); viewCorridor(ctx, sp[0], sp[1], sp[2], col); return; }
  if (e.kind === 'node') {
    const q = fit(e.worldC);
    if (e.layer === 'palms') drawPalm(ctx, q.x, q.y, Math.max(12, (e.r || 1.4) * scale * 2.4), col);
    else if (e.layer === 'fire') fireNode(ctx, q.x, q.y, Math.max(10, (e.r || 2) * scale));
    else glowNode(ctx, q.x, q.y, Math.max(13, (e.r || 1.8) * scale * 2.2), col, 0.55, 3.6);
    return;
  }
  if (e.kind === 'open') {
    const sp = e.world.map(fit);
    ctx.save(); trace(ctx, sp, { smooth: true, closed: false });
    ctx.strokeStyle = col; ctx.lineWidth = e.layer === 'promenade' ? 3 : 2; ctx.globalAlpha = 0.85;
    ctx.setLineDash(e.layer === 'paths' ? [6, 5] : []); ctx.lineCap = 'round'; ctx.stroke(); ctx.restore(); return;
  }
  const sp = e.world.map(fit);
  ctx.save(); trace(ctx, sp, { smooth: true, closed: true });
  ctx.globalAlpha = ALPHA[e.style] || 0.2; ctx.fillStyle = col; ctx.fill(); ctx.restore();
  if (e.style === 'veg' || e.style === 'faint') {
    stippleFoliage(ctx, sp, col, e.id, { spacing: e.style === 'faint' ? 1600 : 1100 });
  } else {
    ctx.save(); trace(ctx, sp, { smooth: true, closed: true });
    ctx.lineWidth = e.conflictive ? 2.2 : (e.style === 'solid' ? 1.8 : 1); ctx.strokeStyle = col;
    ctx.setLineDash(e.future || e.conflictive ? [7, 5] : []); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    if (e.layer === 'pavilions' || e.layer === 'railway') deckTexture(ctx, sp, col);
  }
}

// active tones (journey stop + experience layers) → cinematic washes
function applyTones(W, H) {
  const tones = [];
  if (experience.night) tones.push('night');
  if (experience.wellness) tones.push('wellness');
  if (experience.market) tones.push('market');
  if (experience.social) tones.push('warm');
  if (journey.active) tones.push(JOURNEY[journey.i].tone);
  tones.forEach(t => {
    if (t === 'sunset') sunsetWash(ctx, W, H, 0.16);
    else if (t === 'night') nightWash(ctx, W, H, 0.26);
    else if (t && TONES[t]) ambientWash(ctx, W, H, TONES[t], 0.09);
  });
}

function drawHumans() {
  if (experience.humans === false) return;
  let mult = 1; if (experience.social || experience.market) mult *= 1.6; if (experience.wellness || experience.night) mult *= 0.6;
  HUMAN_CLUSTERS.forEach((c, ci) => {
    const r = rng(hash(c.kind + ci)); const n = Math.max(1, Math.round(c.n * mult));
    const cs = c.cf * frame.len, ct = c.tf * frame.maxT;
    for (let k = 0; k < n; k++) {
      const ang = r() * 6.283, rad = Math.sqrt(r()) * c.spread;
      const q = fit(fromST(cs + Math.cos(ang) * rad, ct + Math.sin(ang) * rad));
      if (c.kind === 'table') drawTable(ctx, q.x, q.y, Math.max(2, scale * 0.5));
      else if (c.kind === 'bench') drawBench(ctx, q.x, q.y, Math.max(3, scale * 0.9));
      else drawPerson(ctx, q.x, q.y, Math.max(3.5, scale * 1.0));
    }
  });
}

function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function wrapText(text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '', yy = y;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
  ctx.fillText(line, x, yy);
}
function drawJourneyOverlay(W, H) {
  const stop = JOURNEY[journey.i]; const fw = focusWorld(stop.focus);
  if (fw) { const q = fit(fw); spotlight(ctx, W, H, q.x, q.y, Math.min(W, H) * 0.42, 0.55); }
  ctx.save();
  const bx = 40, bw = W - 80, bh = 66, by = H - bh - 28;
  ctx.globalAlpha = 0.85; ctx.fillStyle = '#04101c'; roundRect(bx, by, bw, bh, 12); ctx.fill();
  ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,211,107,.4)'; ctx.lineWidth = 1; roundRect(bx, by, bw, bh, 12); ctx.stroke();
  ctx.fillStyle = '#ffd36b'; ctx.font = '700 14px ui-monospace, monospace'; ctx.textAlign = 'left';
  ctx.fillText(`${journey.i + 1}/9 · ${stop.title}`, bx + 16, by + 24);
  ctx.fillStyle = '#cbeeff'; ctx.font = '12px ui-monospace, monospace';
  wrapText(stop.text, bx + 16, by + 44, bw - 32, 15);
  ctx.restore();
}

function draw() {
  if (!lotWorld.length) return;
  viewBox = cameraBox(camera, baseBox);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  background(ctx, W, H);
  applyTones(W, H);
  drawContext();
  // canopy shadow masses (depth) under the canopy fills
  elements.filter(e => vis(e) && e.layer === 'canopy' && e.world).forEach(e => { const sp = e.world.map(fit); canopyShadow(ctx, () => trace(ctx, sp, { smooth: true, closed: true })); });
  // composed back→front
  [...elements].filter(e => e.kind !== 'context').sort((a, b) => orderIndex(a.layer) - orderIndex(b.layer)).forEach(drawElement);
  // pathway illumination at night or during the journey
  if ((experience.night || journey.active) && visible.has('promenade')) {
    const prom = byId['promenade']; if (prom && prom.world) pathwayGlow(ctx, () => trace(ctx, prom.world.map(fit), { smooth: true, closed: false }), '#ffd36b');
  }
  drawHumans();
  // labels for key program elements
  elements.filter(e => vis(e) && e.world && ['plaza', 'pavilions', 'railway', 'future', 'arrival', 'technical'].includes(e.layer))
    .forEach(e => { const q = fit(e.worldCenter); label(ctx, q.x, q.y + 3, e.conflictive ? `${e.n}!` : `${e.n}`, e.conflictive ? '#ffd0c4' : '#eaf6ff'); });
  fogDepth(ctx, W, H);
  if (journey.active) drawJourneyOverlay(W, H);
  vignette(ctx, W, H);
  watermark(ctx, W, H, 'KAIROS PARADOR · CONCEPTUAL · PRELIMINAR');
  updatePanel();
}
function resize() {
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(640, Math.floor(r.width * devicePixelRatio));
  canvas.height = Math.max(460, Math.floor(r.height * devicePixelRatio));
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  draw();
}

// ---- journey / camera loop -------------------------------------------------
function loop(ts) {
  sampleCamera(camera, ts);
  if (journey.active && journey.autoplay && !camera.animating && ts - journey.lastAdvance > DWELL) goStop(journey.i + 1, ts);
  draw();
  if (journey.active || camera.animating) rafId = requestAnimationFrame(loop);
  else rafId = null;
}
function ensureLoop() { if (rafId == null) rafId = requestAnimationFrame(loop); }
function goStop(i, ts) {
  journey.i = ((i % JOURNEY.length) + JOURNEY.length) % JOURNEY.length;
  const stop = JOURNEY[journey.i]; const fw = focusWorld(stop.focus);
  if (fw) focusCamera(camera, { cx: fw.x, cy: fw.y, zoom: stop.zoom || ZOOM.stop }, 1100, ts != null ? ts : performance.now());
  journey.lastAdvance = ts != null ? ts : performance.now();
  updateJourneyUI(); ensureLoop();
}
function startJourney() { journey.active = true; goStop(0); updateJourneyUI(); }
function stopJourney() {
  journey.active = false; journey.autoplay = false;
  const a = $('mpAutoplay'); if (a) a.checked = false;
  focusCamera(camera, homeView(baseBox), 900, performance.now()); updateJourneyUI(); ensureLoop();
}
function updateJourneyUI() {
  const st = $('mpJourneyState'); if (st) st.textContent = journey.active ? `${journey.i + 1} / 9 · ${JOURNEY[journey.i].title}` : 'Journey detenido';
  const tg = $('mpJourneyToggle'); if (tg) tg.textContent = journey.active ? 'Stop Journey' : 'Start Journey';
}

// ---- zoom controls (manual; compatible with Journey, no free pan) ----------
// Smoothly zoom about the current view centre, clamped to [min, max]. Manual zoom
// only changes the camera framing — Prev/Next/Auto still re-frame each stop, so the
// Journey is never broken by it.
function zoomTo(z, dur) { focusCamera(camera, { cx: camera.cur.cx, cy: camera.cur.cy, zoom: clampZoom(z) }, dur, performance.now()); ensureLoop(); }
function zoomIn() { zoomTo(camera.cur.zoom * 1.25, 280); }
function zoomOut() { zoomTo(camera.cur.zoom / 1.25, 280); }
function resetView() { focusCamera(camera, homeView(baseBox), 600, performance.now()); ensureLoop(); }

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
  const cont = $('mpLayers');
  cont.innerHTML = GROUPS.map(g => {
    const items = LAYERS.filter(l => l.group === g).map(l =>
      `<label class="lyr"><input type="checkbox" data-key="${l.key}" checked> <span class="sw" style="background:${l.color}"></span>${l.label}</label>`).join('');
    const master = g === 'program' ? `<b class="grphdr">${g.toUpperCase()}</b>` : `<label class="grp"><input type="checkbox" data-group="${g}" checked> <b>${g.toUpperCase()}</b></label>`;
    return `<div class="grpbox">${master}${items}</div>`;
  }).join('');
  cont.querySelectorAll('input[data-key]').forEach(chk => chk.addEventListener('change', e => {
    const k = e.target.dataset.key; e.target.checked ? visible.add(k) : visible.delete(k); draw();
  }));
  cont.querySelectorAll('input[data-group]').forEach(chk => chk.addEventListener('change', e => {
    const g = e.target.dataset.group, on = e.target.checked;
    LAYERS.filter(l => l.group === g).forEach(l => { on ? visible.add(l.key) : visible.delete(l.key); const c = cont.querySelector(`input[data-key="${l.key}"]`); if (c) c.checked = on; });
    draw();
  }));
  $('mpMood').innerHTML = MOOD.map(m => `<div class="mood"><span class="sw" style="background:${m.color}"></span><b>${m.label}</b> — ${m.note}</div>`).join('');

  // experience layers (visual only)
  const exp = $('mpExperience');
  if (exp) {
    exp.innerHTML = EXPERIENCE_LAYERS.map(l => `<label class="lyr"><input type="checkbox" data-exp="${l.key}"> ${l.label} <span class="fineprint">· ${l.note}</span></label>`).join('') +
      `<label class="lyr"><input type="checkbox" data-exp="humans" checked> Human scale (siluetas/mesas)</label>`;
    exp.querySelectorAll('input[data-exp]').forEach(chk => chk.addEventListener('change', e => { experience[e.target.dataset.exp] = e.target.checked; draw(); }));
  }

  // journey controls
  $('mpJourneyToggle').addEventListener('click', () => { journey.active ? stopJourney() : startJourney(); });
  $('mpPrev').addEventListener('click', () => { if (journey.active) goStop(journey.i - 1); });
  $('mpNext').addEventListener('click', () => { if (journey.active) goStop(journey.i + 1); });
  $('mpAutoplay').addEventListener('change', e => { journey.autoplay = e.target.checked; if (journey.active) { journey.lastAdvance = performance.now(); ensureLoop(); } });

  $('mpReset').addEventListener('click', resetView);
  $('mpZoomIn').addEventListener('click', zoomIn);
  $('mpZoomOut').addEventListener('click', zoomOut);
  $('mpZoomReset').addEventListener('click', resetView);
  $('mpExportJson').addEventListener('click', () => exportJSON({ frame, centroidLL: { lat: lat0, lon: lon0 }, lotAreaM2, elements, areasByLayer, experience, journey, cameraZoom: camera.cur.zoom }));
  $('mpExportPng').addEventListener('click', () => exportPNG(canvas));
  updateJourneyUI();
}

// ---- init ------------------------------------------------------------------
async function init() {
  lot = await fetch(LOT_URL).then(r => r.json());
  lotWorld = projectLL(lot.polygon);
  buildFrame();
  try { seed = await fetch(SEED_URL).then(r => r.json()); } catch (e) { seed = null; }
  resolve(); computeBox(); buildControls();
  addEventListener('resize', resize); resize();
  // Optional cinematic deep-link: …/masterplan/?journey=1 (auto-starts the tour),
  // optionally with &auto=1 for autoplay. Purely a shareable entry, no new deps.
  const qs = new URLSearchParams(location.search);
  if (qs.get('journey') === '1') { if (qs.get('auto') === '1') { journey.autoplay = true; const a = $('mpAutoplay'); if (a) a.checked = true; } startJourney(); }
}
init().catch(err => { $('mpMetrics').innerHTML = `<h4>Error</h4><p>${err.message}</p>`; });
