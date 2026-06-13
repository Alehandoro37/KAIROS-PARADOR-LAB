/* KAIROS PARADOR — Terrain Intelligence + Spatial Constraint Engine V1 / terrain-spatial.js
 *
 * ADDITIVE module on the Map Calibration page (the "Spatial Source of Truth").
 * It does NOT modify calibration.js logic — it consumes the read-only handles
 * window.MapCalibration (map) and window.KairosLayout (live layout polygons), and
 * static vendorized JSON. No backend, no API key, no runtime elevation network call.
 *
 * Reads (all relative, offline-safe once built):
 *   data/terrain/terrain-profile.json     · elevation grid (vendorized SRTM, no key)
 *   data/terrain/slope-zones.json          · conceptual slope classes
 *   data/spatial/spatial-zones.json        · zones + containers + 3D-readiness
 *   data/spatial/vegetation-strategy.json  · trees: preserve/evaluate/remove + corridors
 *   data/spatial/material-strategy.json    · surface materials
 *
 * Phases: A Terrain (elevation gradient / slope / drainage / platforms),
 * B Spatial constraints + trees + railway identity, C container architecture,
 * D 3D-readiness export (NO 3D rendered). Exports: spatial-layout / terrain-layout /
 * constraint-report / PNG.
 *
 * ⚠️ Visualización conceptual preliminar. No reemplaza: topografía profesional, estudios
 * de suelos, ingeniería, arquitectura, licencias, validación legal o catastral. */
(() => {
  const D = '../../data/';
  const $ = (id) => document.getElementById(id);
  let L, map;
  const state = {
    terrain: null, slope: null, zones: null, veg: null, mat: null, polys: null,
    groups: {}, show: { terrain: false, slope: false, drainage: false, zones: false, containers: false, trees: false, railway: false },
    constraints: []
  };

  // ---- geo helpers ([lat,lon]) --------------------------------------------
  const metersBetween = (a, b) => { const k = Math.cos(a[0] * Math.PI / 180);
    const dx = (b[1] - a[1]) * 111320 * k, dy = (b[0] - a[0]) * 111320; return Math.hypot(dx, dy); };
  const centroid = (ll) => [ll.reduce((s, p) => s + p[0], 0) / ll.length, ll.reduce((s, p) => s + p[1], 0) / ll.length];
  const inPoly = (pt, ll) => { let inside = false; const x = pt[1], y = pt[0];
    for (let i = 0, j = ll.length - 1; i < ll.length; j = i++) { const xi = ll[i][1], yi = ll[i][0], xj = ll[j][1], yj = ll[j][0];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside; } return inside; };
  // elevation gradient color: low→high  (cool green → gold → warm)
  function elevColor(t) {
    const stops = [[47, 111, 143], [95, 192, 138], [231, 177, 90], [224, 121, 90]];
    const x = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.floor(x), f = x - i;
    const a = stops[i], b = stops[Math.min(stops.length - 1, i + 1)];
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
  }
  const SLOPE_COLOR = { low: '#5fc08a', moderate: '#e7b15a', steep: '#e0795a' };

  function grp(k) { if (state.groups[k]) { state.groups[k].clearLayers(); map.removeLayer(state.groups[k]); } state.groups[k] = L.layerGroup(); return state.groups[k]; }
  function show(k, on) { const g = state.groups[k]; if (!g) return; if (on) g.addTo(map); else map.removeLayer(g); }

  // ---- Phase A: terrain / slope / drainage / platforms --------------------
  function renderTerrain() {
    const g = grp('terrain'); if (!state.terrain) return;
    const { min, max } = state.terrain.stats, span = (max - min) || 1;
    state.terrain.points.forEach(p => {
      const t = (p.elev - min) / span;
      g.addLayer(L.circleMarker([p.lat, p.lon], { radius: 7, stroke: false, fillColor: elevColor(t), fillOpacity: 0.5 })
        .bindTooltip(`~${p.elev} m (aprox.)`, { direction: 'top' }));
    });
    // potential platforms = flattest low-slope cells near median elevation
    if (state.slope) {
      const med = state.terrain.stats.mean;
      state.slope.cells.forEach((c, i) => {
        const p = state.terrain.points[i];
        if (c.class === 'low' && p && Math.abs(p.elev - med) <= state.terrain.stats.range * 0.35)
          g.addLayer(L.circleMarker([c.lat, c.lon], { radius: 3, color: '#eaf6ff', weight: 1, fillColor: '#eaf6ff', fillOpacity: 0.5 })
            .bindTooltip('Plataforma potencial (conceptual)', { direction: 'top' }));
      });
    }
  }
  function renderSlope() {
    const g = grp('slope'); if (!state.slope) return;
    state.slope.cells.forEach(c => {
      g.addLayer(L.circleMarker([c.lat, c.lon], { radius: 9, stroke: false, fillColor: SLOPE_COLOR[c.class] || '#888', fillOpacity: 0.32 })
        .bindTooltip(`Pendiente ~${c.slopePct}% · ${c.class} (conceptual)`, { direction: 'top' }));
    });
  }
  function renderDrainage() {
    const g = grp('drainage'); if (!state.terrain) return;
    const pts = state.terrain.points, { rows, cols } = state.terrain.grid;
    const at = (r, c) => pts.find(p => p.r === r && p.c === c);
    pts.forEach(p => {
      let lo = null; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => { const n = at(p.r + dr, p.c + dc); if (n && (!lo || n.elev < lo.elev) && n.elev < p.elev) lo = n; });
      if (lo && (p.r + p.c) % 2 === 0) // subset of arrows to avoid clutter
        g.addLayer(L.polyline([[p.lat, p.lon], [lo.lat, lo.lon]], { color: '#5aa0d6', weight: 1.5, opacity: 0.5 }));
      const isLow = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dr, dc]) => { const n = at(p.r + dr, p.c + dc); return !n || n.elev >= p.elev; });
      if (isLow) g.addLayer(L.circleMarker([p.lat, p.lon], { radius: 4, color: '#5aa0d6', weight: 2, fillColor: '#1d3a52', fillOpacity: .7 }).bindTooltip('Punto bajo / acumulación (conceptual)'));
    });
  }

  // ---- Phase B: spatial zones + constraint engine + trees + railway -------
  function nearestSlope(pt) { if (!state.slope) return null; let best = null, bd = Infinity;
    state.slope.cells.forEach(c => { const d = metersBetween(pt, [c.lat, c.lon]); if (d < bd) { bd = d; best = c; } }); return best; }

  function renderZones() {
    const g = grp('zones'); if (!state.zones) return;
    state.zones.zones.forEach(z => {
      g.addLayer(L.polygon(z.polygon, { color: z.color, weight: 2, fillColor: z.color, fillOpacity: 0.12 }).bindTooltip(`${z.label} — ${(z.constraints || []).join(' · ')}`));
      const c = centroid(z.polygon);
      g.addLayer(L.marker(c, { icon: L.divIcon({ className: 'ts-zlbl', html: z.label, iconSize: [120, 16] }) }));
    });
  }

  function evaluate() {
    state.constraints = [];
    if (!state.zones) return state.constraints;
    const polys = state.polys || {};
    const usable = polys.usable_area_polygon;
    const restricted = (polys.restricted_zones || []).map(r => r.polygon);
    const railC = (state.zones.zones.find(z => z.id === 'z-railway') || {}).polygon;
    (state.zones.containers || []).forEach(m => {
      const pt = m.anchor, reasons = []; let status = 'ok';
      if (usable && !inPoly(pt, usable)) { status = 'violation'; reasons.push('fuera del área utilizable'); }
      restricted.forEach((rz, i) => { if (inPoly(pt, rz)) { status = 'violation'; reasons.push('dentro de zona restringida'); } });
      const sc = nearestSlope(pt);
      if (sc && sc.class === 'steep') { if (status !== 'violation') status = 'warn'; reasons.push('pendiente pronunciada → usar decks/pilotes'); }
      else if (sc && sc.class === 'moderate') { if (status === 'ok') status = 'warn'; reasons.push('pendiente moderada → adaptar nivel'); }
      if (m.levels === 2 && railC && inPoly(pt, railC)) reasons.push('landmark vertical alineado al corredor férreo');
      if (!reasons.length) reasons.push('sin conflictos conceptuales');
      state.constraints.push({ id: m.id, use: m.use, type: m.type, zone: m.zone, levels: m.levels, anchor: pt,
        slopeClass: sc ? sc.class : null, slopePct: sc ? sc.slopePct : null, status, reasons });
    });
    return state.constraints;
  }

  function renderContainers() {
    const g = grp('containers'); if (!state.zones) return;
    evaluate();
    const STC = { ok: '#5fc08a', warn: '#e7b15a', violation: '#e0795a' };
    let viol = 0, warn = 0;
    state.zones.containers.forEach(m => {
      const c = state.constraints.find(x => x.id === m.id) || { status: 'ok', reasons: [] };
      if (c.status === 'violation') viol++; else if (c.status === 'warn') warn++;
      const dLat = (m.volume.d || 4) / 111320 / 2, dLon = (m.volume.w || 8) / (111320 * Math.cos(m.anchor[0] * Math.PI / 180)) / 2;
      const rect = [[m.anchor[0] - dLat, m.anchor[1] - dLon], [m.anchor[0] - dLat, m.anchor[1] + dLon], [m.anchor[0] + dLat, m.anchor[1] + dLon], [m.anchor[0] + dLat, m.anchor[1] - dLon]];
      g.addLayer(L.polygon(rect, { color: STC[c.status], weight: c.status === 'ok' ? 1.6 : 2, dashArray: m.landmark ? '5 4' : null, fillColor: STC[c.status], fillOpacity: 0.45 })
        .bindTooltip(`${m.use} · ${m.levels === 2 ? '2 niveles (landmark)' : '1 nivel'} · ${m.orientation}<br>${c.status.toUpperCase()}: ${c.reasons.join('; ')}`, { direction: 'top' }));
    });
    if ($('tsStatus')) $('tsStatus').textContent = `${state.zones.containers.length} contenedores · ${warn} warn · ${viol} en conflicto · PRELIMINAR`;
  }

  function renderTrees() {
    const g = grp('trees'); if (!state.veg) return;
    const AC = {}; (state.veg.actions || []).forEach(a => AC[a.key] = a.color);
    (state.veg.clusters || []).forEach(c => {
      g.addLayer(L.circle(c.center, { radius: c.radius_m || 8, color: AC[c.action] || '#3f8f63', weight: 2, fillColor: AC[c.action] || '#3f8f63', fillOpacity: 0.16 })
        .bindTooltip(`${c.label} — ${c.action.toUpperCase()}: ${c.note}`));
    });
    (state.veg.green_corridors || []).forEach(gc => g.addLayer(L.polyline(gc.line, { color: '#3f8f63', weight: 4, opacity: 0.5, dashArray: '2 8' }).bindTooltip(gc.label)));
  }

  function renderRailway() {
    const g = grp('railway'); if (!state.zones) return;
    const rail = state.zones.zones.find(z => z.id === 'z-railway'); if (!rail) return;
    g.addLayer(L.polygon(rail.polygon, { color: '#e8a25c', weight: 2, dashArray: '8 6', fillColor: '#e8a25c', fillOpacity: 0.08 })
      .bindTooltip('Railway identity corridor — Validar propiedad, servidumbres, retiros y permisos'));
    (state.zones.containers || []).filter(m => m.zone === 'z-railway').forEach(m =>
      g.addLayer(L.marker(m.anchor, { icon: L.divIcon({ className: 'ts-rail', html: '◆', iconSize: [16, 16] }) })
        .bindTooltip(`${m.use} (identity corridor) — validar propiedad/servidumbres`)));
  }

  function renderAll() {
    renderTerrain(); renderSlope(); renderDrainage(); renderZones(); renderContainers(); renderTrees(); renderRailway();
    Object.keys(state.show).forEach(k => show(k, state.show[k]));
  }

  // ---- exports -------------------------------------------------------------
  function dl(obj, name, type) { const blob = obj instanceof Blob ? obj : new Blob([JSON.stringify(obj, null, 2)], { type: type || 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
  const STAMP = () => { try { return new Date().toISOString(); } catch (e) { return 'build'; } };
  function exportSpatial() {
    evaluate();
    dl({ schema: 'kairos.spatial-layout/v1', status: 'PRELIMINARY_CONCEPTUAL', generatedAt: STAMP(),
      zones: state.zones && state.zones.zones, containers: state.zones && state.zones.containers,
      vertical_landmark_nodes: state.zones && state.zones.vertical_landmark_nodes,
      ground_strategy: state.zones && state.zones.ground_strategy,
      camera_anchors: state.zones && state.zones.camera_anchors,
      three_d_readiness: state.zones && state.zones.three_d_readiness,
      constraints: state.constraints,
      disclaimer: 'Visualización conceptual preliminar. No reemplaza topografía, suelos, ingeniería, arquitectura, licencias ni validación legal/catastral.', conceptual_only: true },
      'logos-parador-spatial-layout.json');
  }
  function exportTerrain() {
    dl({ schema: 'kairos.terrain-layout/v1', status: state.terrain ? state.terrain.status : 'PRELIMINARY_CONCEPTUAL', generatedAt: STAMP(),
      terrain: state.terrain && { source: state.terrain.source, stats: state.terrain.stats, grid: state.terrain.grid, bbox: state.terrain.bbox },
      slope: state.slope && { classes: state.slope.classes, summary: state.slope.summary, method: state.slope.method },
      lowPoints: state.terrain ? state.terrain.points.filter(p => { const at = (r, c) => state.terrain.points.find(q => q.r === r && q.c === c);
        return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dr, dc]) => { const n = at(p.r + dr, p.c + dc); return !n || n.elev >= p.elev; }); }).map(p => ({ lat: p.lat, lon: p.lon, elev: p.elev })) : [],
      disclaimer: 'Elevación/pendiente aproximada conceptual — requiere levantamiento topográfico profesional.', conceptual_only: true },
      'logos-parador-terrain-layout.json');
  }
  function exportConstraints() {
    evaluate();
    const s = { ok: 0, warn: 0, violation: 0 }; state.constraints.forEach(c => s[c.status]++);
    dl({ schema: 'kairos.constraint-report/v1', status: 'PRELIMINARY_CONCEPTUAL', generatedAt: STAMP(),
      summary: s, items: state.constraints,
      method: 'Cada contenedor evaluado vs área utilizable, zonas restringidas y clase de pendiente conceptual.',
      disclaimer: 'Reporte de restricciones CONCEPTUAL — no es ingeniería ni norma. Requiere estudios profesionales.', conceptual_only: true },
      'logos-parador-constraint-report.json');
  }
  function exportPng() {
    try {
      const pts = []; (state.zones ? state.zones.zones : []).forEach(z => z.polygon.forEach(p => pts.push(p)));
      (state.terrain ? state.terrain.points : []).forEach(p => pts.push([p.lat, p.lon]));
      if (!pts.length) return exportSpatial();
      const la = pts.map(p => p[0]), lo = pts.map(p => p[1]);
      const B = { s: Math.min(...la), n: Math.max(...la), w: Math.min(...lo), e: Math.max(...lo) };
      const pad = 50, W = 1000, H = 1000, s = Math.min((W - 2 * pad) / ((B.e - B.w) || 1e-6), (H - 2 * pad) / ((B.n - B.s) || 1e-6));
      const X = (lon) => pad + (lon - B.w) * s, Y = (lat) => H - pad - (lat - B.s) * s;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
      g.fillStyle = '#06141d'; g.fillRect(0, 0, W, H);
      if (state.terrain) { const { min, max } = state.terrain.stats, span = (max - min) || 1; state.terrain.points.forEach(p => { g.fillStyle = elevColor((p.elev - min) / span); g.globalAlpha = .5; g.beginPath(); g.arc(X(p.lon), Y(p.lat), 8, 0, 7); g.fill(); }); g.globalAlpha = 1; }
      (state.zones ? state.zones.zones : []).forEach(z => { g.beginPath(); z.polygon.forEach((p, i) => { const x = X(p[1]), y = Y(p[0]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.strokeStyle = z.color; g.lineWidth = 2; g.stroke(); });
      (state.constraints || []).forEach(c => { g.fillStyle = c.status === 'violation' ? '#e0795a' : c.status === 'warn' ? '#e7b15a' : '#5fc08a'; g.fillRect(X(c.anchor[1]) - 5, Y(c.anchor[0]) - 5, 10, 10); });
      g.fillStyle = '#cdb98a'; g.font = '14px monospace'; g.fillText('PRELIMINAR / CONCEPTUAL — no es topografía ni catastro', pad, H - 16);
      cv.toBlob(b => b && dl(b, 'logos-parador-spatial-snapshot.png'), 'image/png');
    } catch (e) { exportSpatial(); }
  }

  // ---- UI ------------------------------------------------------------------
  function bind() {
    const t = { tsTerrain: 'terrain', tsSlope: 'slope', tsDrainage: 'drainage', tsZones: 'zones', tsContainers: 'containers', tsTrees: 'trees', tsRailway: 'railway' };
    Object.entries(t).forEach(([id, key]) => { const c = $(id); if (c) { c.checked = state.show[key]; c.addEventListener('change', () => { state.show[key] = c.checked; show(key, c.checked); }); } });
    $('tsExportSpatial') && $('tsExportSpatial').addEventListener('click', exportSpatial);
    $('tsExportTerrain') && $('tsExportTerrain').addEventListener('click', exportTerrain);
    $('tsExportConstraints') && $('tsExportConstraints').addEventListener('click', exportConstraints);
    $('tsExportPng') && $('tsExportPng').addEventListener('click', exportPng);
  }

  async function boot() {
    if (!window.MapCalibration || !window.L) return;
    L = window.L; map = window.MapCalibration.map;
    const get = (u) => fetch(D + u).then(r => r.ok ? r.json() : null).catch(() => null);
    const [terrain, slope, zones, veg, mat] = await Promise.all([
      get('terrain/terrain-profile.json'), get('terrain/slope-zones.json'),
      get('spatial/spatial-zones.json'), get('spatial/vegetation-strategy.json'), get('spatial/material-strategy.json')
    ]);
    state.terrain = terrain; state.slope = slope; state.zones = zones; state.veg = veg; state.mat = mat;
    try { state.polys = (window.KairosLayout && window.KairosLayout.getPolygons()) || null; } catch (e) { state.polys = null; }
    if (!state.polys) { state.polys = await get('calibration/layout-polygons.seed.json'); }
    ['terrain', 'slope', 'drainage', 'zones', 'containers', 'trees', 'railway'].forEach(k => state.groups[k] = L.layerGroup());
    bind(); renderAll();
    if ($('tsStatus') && !state.zones) $('tsStatus').textContent = 'No se pudo cargar la capa espacial (requiere build externo).';
  }

  if (window.MapCalibration && window.MapCalibration.map) boot();
  else window.addEventListener('kairos:map-ready', () => setTimeout(boot, 60), { once: true });
})();
