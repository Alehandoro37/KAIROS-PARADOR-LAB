/* KAIROS PARADOR — Masterplan Blueprint V2 / export
 * JSON (grouped by experience: experience_zones · circulation · landscape ·
 * atmosphere_nodes, conceptual_only:true) and PNG (from the conceptual canvas).
 * Honest precision — APPROXIMATE coordinates/areas, no cadastral exactness. */

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}
const m2 = (v) => Math.round(v);
const m1 = (v) => Math.round(v * 10) / 10;
const deg5 = (v) => Math.round(v * 1e5) / 1e5;

function serialize(e) {
  const o = {
    n: e.n, id: e.id, label: e.label || e.id, layer: e.layer, kind: e.kind,
    future: !!e.future, conflictive: !!e.conflictive,
    areaApproxM2: e.area != null ? m2(e.area) : null,
    approxCenterLatLon: e.centerLL ? { lat: deg5(e.centerLL.lat), lon: deg5(e.centerLL.lon) } : null
  };
  if (e.kind === 'node') o.st = [m1(e.s), m1(e.t)];
  else o.geometryStM = (e.pts || []).map(p => [m1(p[0]), m1(p[1])]);
  return o;
}

export function buildExportObject(state) {
  const { frame, centroidLL, lotAreaM2, elements, areasByLayer } = state;
  const prog = elements.filter(e => e.group === 'program' && e.kind !== 'lot' && e.kind !== 'context');
  const byGroup = (g) => elements.filter(e => e.group === g).map(serialize);
  const layerAreas = Object.fromEntries(Object.entries(areasByLayer).filter(([, v]) => v > 0).map(([k, v]) => [k, m2(v)]));
  const shapes = elements.filter(e => e.kind !== 'lot' && e.kind !== 'context');
  return {
    schema: 'kairos.masterplan/v2',
    version: 'Masterplan Blueprint V2 — experiential landscape redesign',
    status: 'PRELIMINAR CONCEPTUAL',
    conceptual_only: true,
    generatedAt: new Date().toISOString(),
    source: { lot: '../../data/lot.json', osmContext: '../../data/osm/osm-context-seed.json' },
    frame: { lengthM: m1(frame.len), depthM: m1(frame.maxT), centroidApprox: { lat: deg5(centroidLL.lat), lon: deg5(centroidLL.lon) } },
    lotAreaApproxM2: m2(lotAreaM2),
    counts: { shapes: shapes.length, conflictive: shapes.filter(e => e.conflictive).length },
    experience_zones: prog.map(serialize),
    circulation: byGroup('circulation'),
    landscape: byGroup('landscape'),
    atmosphere_nodes: byGroup('atmosphere'),
    areasByLayerApproxM2: layerAreas,
    precisionNote: 'Coordenadas y áreas APROXIMADAS (~metros), derivadas de un polígono trazado a mano sobre Google Earth. Diseño CONCEPTUAL de experiencia; no es arquitectura, catastro ni cálculo estructural.',
    warnings: [
      'NO APTO PARA USO LEGAL / CATASTRAL / CONSTRUCCIÓN',
      'PRELIMINAR CONCEPTUAL — placemaking experiencial, no diseño constructivo',
      'Geometría relativa al lote; contexto OSM © OpenStreetMap contributors',
      'lot.json no se modifica; es la única fuente geométrica'
    ]
  };
}

export function exportJSON(state) {
  const blob = new Blob([JSON.stringify(buildExportObject(state), null, 2)], { type: 'application/json' });
  download(blob, 'masterplan-v2-export.json');
}

export function exportPNG(canvas) {
  // Fully self-drawn scene (no external tiles) → canvas is not tainted.
  if (canvas.toBlob) canvas.toBlob((b) => { if (b) download(b, 'masterplan-v2-render.png'); }, 'image/png');
  else download(dataURLtoBlob(canvas.toDataURL('image/png')), 'masterplan-v2-render.png');
}
function dataURLtoBlob(u) {
  const [head, b64] = u.split(','); const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: (head.match(/:(.*?);/) || [, 'image/png'])[1] });
}
