/* KAIROS PARADOR — Geometry Engine v2 / runtime
 * Orchestration: grab DOM refs, load lot.json, build the (s,t) basis, wire the
 * control listeners, version selector and Export button, then do the first render.
 * Moved verbatim from the original engine.js IIFE (applyLayout, loadManifest, init);
 * only the closure variables now live in runtime/state.js. */
import { state } from './state.js';
import { LOT_URL, MANIFEST_URL, LAYOUTS_DIR, ids } from './config.js';
import { projectLL } from '../geo/projection.js';
import { sub, norm, len } from '../geo/vector.js';
import { toST } from '../core/basis.js';
import { setVal } from '../ui/dom.js';
import { updateOutputs } from '../ui/params.js';
import { resize, draw } from '../render/canvas.js';

export function applyLayout(l) {
  if (l.params) { Object.entries(l.params).forEach(([k, v]) => setVal(k, v)); }
  if (l.constraints) { Object.entries(l.constraints).forEach(([k, v]) => { if (typeof v === 'number') setVal(k, v); }); }
  updateOutputs(); draw();
}

export async function loadManifest() {
  try {
    const m = await fetch(MANIFEST_URL).then(r => r.json());
    (m.layouts || []).forEach(l => { const o = document.createElement('option'); o.value = l.file; o.textContent = l.label; state.versionSelect.appendChild(o); });
  } catch (e) {}
}

export async function init() {
  state.canvas = document.getElementById('lotCanvas');
  state.ctx = state.canvas.getContext('2d');
  state.metricsEl = document.getElementById('metrics');
  state.versionSelect = document.getElementById('versionSelect');
  state.exportBtn = document.getElementById('exportBtn');

  state.lot = await fetch(LOT_URL).then(r => r.json());
  state.local = projectLL(state.lot.polygon);
  const basis = { A: state.local[0], B: state.local[1] };
  basis.u = norm(sub(basis.B, basis.A)); basis.n = { x: -basis.u.y, y: basis.u.x }; basis.len = len(sub(basis.B, basis.A));
  state.basis = basis;
  basis.maxT = Math.max(...state.local.map(p => toST(p).t));

  ids.forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => { updateOutputs(); draw(); }); });
  state.versionSelect.addEventListener('change', async e => { if (!e.target.value) return; const l = await fetch(`${LAYOUTS_DIR}${e.target.value}`).then(r => r.json()); applyLayout(l); });
  state.exportBtn.addEventListener('click', () => { const blob = new Blob([JSON.stringify(state.lastExport, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'layout-export-setbacks.json'; a.click(); URL.revokeObjectURL(a.href); });

  await loadManifest(); updateOutputs(); resize();
}
