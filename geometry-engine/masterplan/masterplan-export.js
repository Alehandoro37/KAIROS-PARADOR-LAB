/* KAIROS PARADOR — Masterplan Blueprint V1 / export
 * JSON (structured, honest precision) and PNG (from the conceptual canvas) exports.
 * Coordinates/areas are APPROXIMATE — the masterplan is conceptual, derived from a
 * hand-traced polygon. No cadastral precision is implied. */

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}

// Honest rounding: areas → whole m²; lengths → 1 dp; lat/lon → 5 dp (~1 m).
const m2 = (v) => Math.round(v);
const m1 = (v) => Math.round(v * 10) / 10;
const deg5 = (v) => Math.round(v * 1e5) / 1e5;

export function buildExportObject(state) {
  const { frame, centroidLL, lotAreaM2, elements, areasByLayer } = state;
  const objects = elements
    .filter(e => e.kind !== 'lot' && e.kind !== 'context')
    .map(e => ({
      n: e.n, id: e.id, label: e.label, layer: e.layer,
      kind: e.kind, future: !!e.future, conflictive: !!e.conflictive,
      areaApproxM2: e.area != null ? m2(e.area) : null,
      // relative (s,t) geometry in metres — honest, lot-relative, not lat/lon
      geometryStM: (e.pts || []).map(p => [m1(p[0]), m1(p[1])]),
      approxCenterLatLon: e.centerLL ? { lat: deg5(e.centerLL.lat), lon: deg5(e.centerLL.lon) } : null
    }));
  return {
    schema: 'kairos.masterplan/v1',
    version: 'Masterplan Blueprint V1',
    status: 'PRELIMINAR CONCEPTUAL',
    generatedAt: new Date().toISOString(),
    source: { lot: '../../data/lot.json', osmContext: '../../data/osm/osm-context-seed.json' },
    frame: { lengthM: m1(frame.len), depthM: m1(frame.maxT), centroidApprox: { lat: deg5(centroidLL.lat), lon: deg5(centroidLL.lon) } },
    lotAreaApproxM2: m2(lotAreaM2),
    canonicalElements: 17,
    objectsCount: objects.length,
    conflictiveCount: objects.filter(o => o.conflictive).length,
    objects,
    areasByLayerApproxM2: Object.fromEntries(Object.entries(areasByLayer).map(([k, v]) => [k, m2(v)])),
    precisionNote: 'Coordenadas y áreas APROXIMADAS, derivadas de un polígono trazado a mano sobre Google Earth. Precisión real ~metros, no centímetros. No es catastro ni levantamiento.',
    warnings: [
      'NO APTO PARA USO LEGAL / CATASTRAL / CONSTRUCCIÓN',
      'PRELIMINAR CONCEPTUAL — distribución espacial de exploración, no diseño arquitectónico final',
      'Geometría relativa al lote; contexto OSM © OpenStreetMap contributors',
      'lot.json no se modifica; es la única fuente geométrica'
    ]
  };
}

export function exportJSON(state) {
  const blob = new Blob([JSON.stringify(buildExportObject(state), null, 2)], { type: 'application/json' });
  download(blob, 'masterplan-export.json');
}

export function exportPNG(canvas) {
  // The whole conceptual scene is drawn by us (no external tiles) → canvas is not
  // tainted → toBlob/toDataURL works.
  if (canvas.toBlob) canvas.toBlob((b) => { if (b) download(b, 'masterplan-render.png'); }, 'image/png');
  else download(dataURLtoBlob(canvas.toDataURL('image/png')), 'masterplan-render.png');
}
function dataURLtoBlob(u) {
  const [head, b64] = u.split(','); const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: (head.match(/:(.*?);/) || [, 'image/png'])[1] });
}
