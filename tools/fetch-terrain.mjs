#!/usr/bin/env node
/* KAIROS PARADOR — Terrain Intelligence V1 / fetch-terrain.mjs  (BUILD/DEV ONLY)
 *
 * One-time, build-time elevation fetch that VENDORIZES the result as static JSON.
 * The shipped runtime NEVER calls a network elevation service and needs NO API key
 * (offline-first; the external build validator forbids runtime localhost/keys/abs fetch).
 *
 * SOURCE: Open-Elevation public API (https://api.open-elevation.com), no key required,
 * backed by SRTM (~30 m). We sample an 11×11 grid over a ~620 m box around the lot
 * centroid, then DERIVE conceptual slope classes from adjacent-sample gradients.
 *
 * Output (committed, read at runtime via relative fetch):
 *   data/terrain/terrain-profile.json   — elevation grid + stats
 *   data/terrain/slope-zones.json       — conceptual slope classification
 *
 * Run:  node tools/fetch-terrain.mjs        (needs network; re-run to refresh)
 * If the service is unreachable it writes a clearly-labeled SYNTHETIC profile so the
 * page still works — never inventing precision (status flags the synthetic case).
 *
 * ⚠️ Elevación aproximada conceptual — requiere levantamiento topográfico profesional. */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'terrain');
mkdirSync(OUT, { recursive: true });

// lot centroid (from data/lot.json — read-only reference, not modified)
const C = { lat: 3.731563875, lon: -76.32355543 };
const PAD = 0.0028;            // ≈ 310 m each side → ~620 m box
const ROWS = 11, COLS = 11;
const bbox = { s: C.lat - PAD, n: C.lat + PAD, w: C.lon - PAD, e: C.lon + PAD };

const grid = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const lat = bbox.n - (r / (ROWS - 1)) * (bbox.n - bbox.s);
  const lon = bbox.w + (c / (COLS - 1)) * (bbox.e - bbox.w);
  grid.push({ r, c, lat: +lat.toFixed(6), lon: +lon.toFixed(6) });
}

const STAMP = '2026-06-13'; // build date (deterministic; no Date.now in output)
let provider = 'Open-Elevation (api.open-elevation.com)', synthetic = false, elevs = null;

async function fetchElevations() {
  const body = JSON.stringify({ locations: grid.map(p => ({ latitude: p.lat, longitude: p.lon })) });
  const res = await fetch('https://api.open-elevation.com/api/v1/lookup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    signal: AbortSignal.timeout(45000)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (!j.results || j.results.length !== grid.length) throw new Error('unexpected result count');
  return j.results.map(r => r.elevation);
}

try {
  elevs = await fetchElevations();
  console.log('Open-Elevation OK:', elevs.length, 'samples');
} catch (e) {
  synthetic = true;
  provider = 'SYNTHETIC (conceptual) — Open-Elevation unreachable: ' + e.message;
  // gentle valley-floor-ish synthetic surface around ~983 m, NO invented precision
  const base = 983;
  elevs = grid.map(p => +(base + (p.lat - C.lat) * 1500 - Math.abs(p.lon - C.lon) * 400).toFixed(1));
  console.warn('Fell back to SYNTHETIC profile:', e.message);
}

const points = grid.map((p, i) => ({ r: p.r, c: p.c, lat: p.lat, lon: p.lon, elev: +(+elevs[i]).toFixed(1) }));
const vals = points.map(p => p.elev);
const min = Math.min(...vals), max = Math.max(...vals), mean = +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);

writeFileSync(join(OUT, 'terrain-profile.json'), JSON.stringify({
  schema: 'kairos.terrain-profile/v1', version: '1.0.0',
  status: synthetic ? 'PRELIMINARY_CONCEPTUAL_SYNTHETIC' : 'PRELIMINARY_CONCEPTUAL',
  source: {
    provider, dataset: 'SRTM ~30 m (vía Open-Elevation)', endpoint: 'https://api.open-elevation.com/api/v1/lookup',
    fetchedAt: STAMP, method: 'POST de una grilla 11×11 sobre el bbox del lote; vendorizado como JSON estático (sin red ni key en runtime).',
    synthetic
  },
  units: 'metros (aprox., SRTM ~30 m)', crs: 'EPSG:4326 (WGS84) · [lat, lon]',
  reference: { lotCentroid: C }, bbox, grid: { rows: ROWS, cols: COLS },
  stats: { min, max, mean, range: +(max - min).toFixed(1) },
  points,
  disclaimer: 'Elevación aproximada conceptual — requiere levantamiento topográfico profesional.'
}, null, 2) + '\n');

// ---- derive conceptual slope classes from adjacent-sample gradients --------
const at = (r, c) => points.find(p => p.r === r && p.c === c);
const latStepM = ((bbox.n - bbox.s) / (ROWS - 1)) * 111320;
const lonStepM = ((bbox.e - bbox.w) / (COLS - 1)) * 111320 * Math.cos(C.lat * Math.PI / 180);
const classes = [
  { key: 'low', label: 'Baja (apta)', maxPct: 8, color: '#5fc08a' },
  { key: 'moderate', label: 'Moderada (adaptar)', maxPct: 15, color: '#e7b15a' },
  { key: 'steep', label: 'Pronunciada (evitar/decks)', maxPct: Infinity, color: '#e0795a' }
];
const classify = (pct) => pct <= 8 ? 'low' : pct <= 15 ? 'moderate' : 'steep';
const cells = points.map(p => {
  let g = 0;
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    const n = at(p.r + dr, p.c + dc); if (!n) return;
    const run = dr ? latStepM : lonStepM;
    g = Math.max(g, Math.abs(n.elev - p.elev) / (run || 1));
  });
  const pct = +(g * 100).toFixed(1);
  return { lat: p.lat, lon: p.lon, slopePct: pct, class: classify(pct) };
});

writeFileSync(join(OUT, 'slope-zones.json'), JSON.stringify({
  schema: 'kairos.slope-zones/v1', version: '1.0.0',
  status: synthetic ? 'PRELIMINARY_CONCEPTUAL_SYNTHETIC' : 'PRELIMINARY_CONCEPTUAL',
  derivedFrom: 'data/terrain/terrain-profile.json',
  method: 'Pendiente % = máx |Δelev| / distancia horizontal entre muestras SRTM adyacentes (rise/run). CONCEPTUAL.',
  classes: classes.map(c => ({ ...c, maxPct: c.maxPct === Infinity ? null : c.maxPct })),
  grid: { rows: ROWS, cols: COLS }, cells,
  summary: { low: cells.filter(c => c.class === 'low').length, moderate: cells.filter(c => c.class === 'moderate').length, steep: cells.filter(c => c.class === 'steep').length },
  disclaimer: 'Pendiente aproximada conceptual — no sustituye topografía ni estudios de suelos.'
}, null, 2) + '\n');

console.log(`Wrote terrain-profile.json (${points.length} pts, ${min}–${max} m) and slope-zones.json`);
