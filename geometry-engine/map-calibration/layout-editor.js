/* KAIROS PARADOR — Map-Based Layout Calibration V1 / layout-editor.js
 *
 * ADDITIVE module: layers editable design polygons and a conceptual "Layout on Map"
 * overlay ON TOP of the existing Map Calibration page. It does NOT modify
 * calibration.js's calibration/transform logic — it only consumes the additive,
 * read-only handle window.MapCalibration (map + getLotLatLngs) exposed by
 * calibration.js, and listens to its 'kairos:map-ready' event.
 *
 * The layout is BORN FROM THE REAL MAP: polygons derive from the real lot.json
 * polygon (via Map Calibration) and from the seed data/calibration/layout-polygons.seed.json.
 * lot.json is read-only and never written here.
 *
 * Persistence: localStorage (kairos.layoutPolygons.v1) + manual JSON export/import.
 * No backend, no analytics. Everything is PRELIMINAR / CONCEPTUAL — requires survey,
 * studies and permits; NOT cadastre. */
(() => {
  const SEED_URL = '../../data/calibration/layout-polygons.seed.json';
  const CATALOG_URL = '../../data/layout/container-layout.json';
  const LS_KEY = 'kairos.layoutPolygons.v1';
  const $ = (id) => document.getElementById(id);

  const COLORS = {
    lot: '#8fe5ff', usable: '#5fc08a', rail: '#e7b15a', frontage: '#9fd0ff',
    service: '#94b8b2', restricted: '#e0795a', axis: '#e8a25c'
  };
  const MOD = {
    'container-cafe': '#e7b15a', 'cocina': '#e8a25c', 'bar': '#8fe5ff', 'banos': '#9fb0b8',
    'retail-local': '#5fc08a', 'deck-sombra': '#3f8f63', 'service-module': '#94b8b2', 'pabellon': '#b07a4a'
  };

  let L, map, lotRef = null, catalog = null;
  const state = {
    poly: null,          // current polygons doc (seed/localStorage shape)
    active: 'usable',    // key being edited
    editMode: false, addMode: false, hidden: new Set(),
    show: { lot: true, usable: true, rail: true, restricted: true, layout: false, circulation: false, landscape: false },
    groups: {}, modulePlacements: []
  };

  // ---- small geo helpers (lat/lon as [lat,lon]) ----------------------------
  const bbox = (ll) => { const la = ll.map(p => p[0]), lo = ll.map(p => p[1]);
    return { s: Math.min(...la), n: Math.max(...la), w: Math.min(...lo), e: Math.max(...lo) }; };
  const centroid = (ll) => [ll.reduce((s, p) => s + p[0], 0) / ll.length, ll.reduce((s, p) => s + p[1], 0) / ll.length];
  const inPoly = (pt, ll) => { // ray casting; x=lon, y=lat
    let inside = false; const x = pt[1], y = pt[0];
    for (let i = 0, j = ll.length - 1; i < ll.length; j = i++) {
      const xi = ll[i][1], yi = ll[i][0], xj = ll[j][1], yj = ll[j][0];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    } return inside; };

  // ---- polygon registry (read/write the active editable ring) --------------
  function ring(key) {
    if (!state.poly) return null;
    if (key === 'usable') return state.poly.usable_area_polygon;
    if (key === 'rail') return state.poly.rail_side_opportunity_polygon;
    if (key === 'frontage') return state.poly.frontage_zone && state.poly.frontage_zone.polygon;
    if (key === 'service') return state.poly.service_zone && state.poly.service_zone.polygon;
    if (key.startsWith('rz:')) { const z = (state.poly.restricted_zones || []).find(r => r.id === key.slice(3)); return z && z.polygon; }
    if (key.startsWith('dp:')) { const z = (state.poly.drawn_polygons || []).find(r => r.id === key.slice(3)); return z && z.polygon; }
    return null;
  }
  const DRAWN_COLORS = { deck: '#67c994', plaza: '#e7b15a', expansion: '#b07a4a', usable: '#5fc08a', rail: '#e8a25c', frontage: '#9fd0ff', service: '#94b8b2', restricted: '#e0795a', other: '#8fe5ff' };

  // ---- persistence ---------------------------------------------------------
  function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(state.poly)); } catch (e) { /* private mode */ } }
  function loadStored() { try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

  // ---- rendering -----------------------------------------------------------
  function clearGroup(k) { if (state.groups[k]) { state.groups[k].clearLayers(); map.removeLayer(state.groups[k]); } state.groups[k] = L.layerGroup(); }
  function showGroup(k, on) { if (!state.groups[k]) return; if (on) state.groups[k].addTo(map); else map.removeLayer(state.groups[k]); }

  function poly(latlngs, color, opts) {
    return L.polygon(latlngs, Object.assign({ color, weight: 2, fillColor: color, fillOpacity: 0.1 }, opts || {}));
  }

  function render() {
    if (!state.poly) return;
    const hid = (k) => state.hidden.has(k);   // per-polygon hide (delete-fix V1)
    // original lot reference (read-only — can be hidden, never deleted)
    clearGroup('lot');
    if (lotRef && lotRef.length && !hid('lot')) state.groups.lot.addLayer(poly(lotRef, COLORS.lot, { weight: 2, dashArray: '2 5', fillOpacity: 0.04 }).bindTooltip('Original lot from lot.json — read-only'));
    // usable
    clearGroup('usable');
    if (state.poly.usable_area_polygon && !hid('usable')) state.groups.usable.addLayer(poly(state.poly.usable_area_polygon, COLORS.usable, { fillOpacity: 0.14 }).bindTooltip('Área utilizable (editable) — PRELIMINAR'));
    // rail opportunity + axis
    clearGroup('rail');
    if (state.poly.rail_side_opportunity_polygon && !hid('rail')) state.groups.rail.addLayer(poly(state.poly.rail_side_opportunity_polygon, COLORS.rail, { dashArray: '8 6', fillOpacity: 0.08 })
      .bindTooltip(state.poly.rail_opportunity_label || 'Zona de oportunidad — validar propiedad/servidumbres'));
    if (state.poly.rail_axis_hint && state.poly.rail_axis_hint.line && !hid('rail'))
      state.groups.rail.addLayer(L.polyline(state.poly.rail_axis_hint.line, { color: COLORS.axis, weight: 3, dashArray: '10 8', opacity: .8 }).bindTooltip(state.poly.rail_axis_hint.label || 'Eje férreo (conceptual)'));
    // restricted + frontage + service
    clearGroup('restricted');
    (state.poly.restricted_zones || []).forEach(z => { if (!hid('rz:' + z.id)) state.groups.restricted.addLayer(
      poly(z.polygon, COLORS.restricted, { dashArray: '4 4', fillOpacity: 0.16 }).bindTooltip(z.label || 'No-build (preliminar)')); });
    if (state.poly.frontage_zone && !hid('frontage')) state.groups.restricted.addLayer(poly(state.poly.frontage_zone.polygon, COLORS.frontage, { fillOpacity: 0.1 }).bindTooltip(state.poly.frontage_zone.label));
    if (state.poly.service_zone && !hid('service')) state.groups.restricted.addLayer(poly(state.poly.service_zone.polygon, COLORS.service, { fillOpacity: 0.1 }).bindTooltip(state.poly.service_zone.label));
    // user-drawn polygons (Draw Polygon from scratch)
    clearGroup('drawn');
    (state.poly.drawn_polygons || []).forEach(z => { if (!hid('dp:' + z.id)) state.groups.drawn.addLayer(
      poly(z.polygon, DRAWN_COLORS[z.category] || DRAWN_COLORS.other, { fillOpacity: 0.14 }).bindTooltip((z.label || z.category || 'dibujado') + ' (dibujado · editable)')); });

    renderLayout();
    renderVerts();

    showGroup('lot', state.show.lot); showGroup('usable', state.show.usable);
    showGroup('rail', state.show.rail); showGroup('restricted', state.show.restricted); showGroup('drawn', true);
    showGroup('layout', state.show.layout); showGroup('circulation', state.show.circulation);
    showGroup('landscape', state.show.landscape);
  }

  // ---- "Layout on Map": map the container catalog into the usable bbox -----
  function renderLayout() {
    clearGroup('layout'); clearGroup('circulation'); clearGroup('landscape');
    state.modulePlacements = [];
    if (!catalog || !catalog.modules) return;
    const U = state.poly.usable_area_polygon; if (!U) return;   // usable may be deleted
    const ub = bbox(U), vb = catalog.viewBox || { width: 1000, height: 1500 };
    const fz = state.poly.frontage_zone, sz = state.poly.service_zone, op = state.poly.rail_side_opportunity_polygon;
    let outside = 0;

    catalog.modules.forEach(m => {
      const cx = (m.x + m.w / 2) / vb.width, cy = (m.y + m.h / 2) / vb.height;
      let lat = ub.n - cy * (ub.n - ub.s), lon = ub.w + cx * (ub.e - ub.w);
      // semantic overrides per the brief
      if (m.id === 'm-railway' && op) { const c = centroid(op); lat = (lat + c[0]) / 2; lon = (lon + c[1]) / 2; }
      else if (m.type === 'service-module' && sz) { const c = centroid(sz.polygon); lat = c[0]; lon = c[1]; }
      const hw = (m.w / vb.width) * (ub.e - ub.w) / 2, hh = (m.h / vb.height) * (ub.n - ub.s) / 2;
      const rect = [[lat - hh, lon - hw], [lat - hh, lon + hw], [lat + hh, lon + hw], [lat + hh, lon - hw]];
      const inside = inPoly([lat, lon], U); if (!inside) outside++;
      const col = MOD[m.type] || '#cfe';
      const r = L.polygon(rect, { color: inside ? col : COLORS.restricted, weight: inside ? 1.6 : 2, dashArray: inside ? null : '4 3', fillColor: col, fillOpacity: inside ? 0.5 : 0.25 });
      r.bindTooltip(`${m.label} · ${m.dim} · ${m.phase}${inside ? '' : ' · FUERA del área utilizable'}`, { direction: 'top' });
      state.groups.layout.addLayer(r);
      state.modulePlacements.push({ id: m.id, type: m.type, label: m.label, lat, lon, inside });
    });
    // parking aligned with frontage
    if (fz) { state.groups.layout.addLayer(poly(fz.polygon, '#9fd0ff', { weight: 1.6, fillColor: '#9fd0ff', fillOpacity: 0.18 }).bindTooltip('Parqueo / frente vial (conceptual)')); }
    // circulation: frontage → usable centroid → rail opportunity
    const uc = centroid(U), line = [];
    if (fz) line.push(centroid(fz.polygon)); line.push(uc); if (op) line.push(centroid(op));
    if (line.length >= 2) state.groups.circulation.addLayer(L.polyline(line, { color: COLORS.usable, weight: 3, dashArray: '2 7', opacity: .8 }).bindTooltip('Circulación (conceptual)'));
    // landscape palms inside usable
    [[0.3, 0.25], [0.7, 0.35], [0.4, 0.7], [0.65, 0.78], [0.5, 0.5]].forEach(([fx, fy]) => {
      const lat = ub.n - fy * (ub.n - ub.s), lon = ub.w + fx * (ub.e - ub.w);
      if (inPoly([lat, lon], U)) state.groups.landscape.addLayer(L.circleMarker([lat, lon], { radius: 4, color: '#5fc08a', weight: 2, fillColor: '#3f8f63', fillOpacity: .7 }).bindTooltip('Vegetación / palma (conceptual)'));
    });

    if ($('leStatus')) $('leStatus').textContent =
      `${state.modulePlacements.length} módulos · ${outside} FUERA del área utilizable · PRELIMINAR`;
  }

  // ---- editable vertices (only for the active layer) -----------------------
  function renderVerts() {
    clearGroup('verts');
    if (!state.editMode) { showGroup('verts', false); return; }
    const r = ring(state.active); if (!r) return;
    r.forEach((pt, i) => {
      const mk = L.marker(pt, { draggable: true, keyboard: false, icon: L.divIcon({ className: 'le-vtx', html: '', iconSize: [14, 14] }) });
      mk.on('drag', (e) => { const ll = e.target.getLatLng(); r[i] = [ll.lat, ll.lng]; quickRedraw(); });
      mk.on('dragend', () => { persist(); render(); });
      mk.on('dblclick', () => { if (r.length > 3) { r.splice(i, 1); persist(); render(); } });
      state.groups.verts.addLayer(mk);
    });
    showGroup('verts', true);
  }
  // light redraw of just the active polygon while dragging (no full rebuild)
  function quickRedraw() {
    const r = ring(state.active); if (!r) return;
    const gk = state.active === 'usable' ? 'usable' : (state.active === 'rail' ? 'rail' : 'restricted');
    // simplest: full render is cheap at this scale
    render();
  }

  function addVertexAt(latlng) {
    const r = ring(state.active); if (!r) return;
    // insert at the nearest edge
    let best = 0, bestD = Infinity;
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const d = (mx - latlng.lat) ** 2 + (my - latlng.lng) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    r.splice(best + 1, 0, [latlng.lat, latlng.lng]); persist(); render();
  }

  // ---- exports / import ----------------------------------------------------
  function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
  function polygonsDoc() {
    return Object.assign({}, state.poly, { status: 'PRELIMINARY_CONCEPTUAL', exportedAt: new Date().toISOString(),
      disclaimer: 'PRELIMINAR / CONCEPTUAL — no reemplaza topografía, planos, catastro ni licencias.' });
  }
  function exportPolygons() { dl(new Blob([JSON.stringify(polygonsDoc(), null, 2)], { type: 'application/json' }), 'logos-parador-layout-polygons.json'); }
  function exportMapLayout() {
    const out = { schema: 'kairos.map-layout/v1', status: 'PRELIMINARY_CONCEPTUAL', generatedAt: new Date().toISOString(),
      polygons: polygonsDoc(), modules: state.modulePlacements,
      summary: { total: state.modulePlacements.length, outsideUsable: state.modulePlacements.filter(m => !m.inside).length },
      disclaimer: 'PRELIMINAR / CONCEPTUAL — placement ilustrativo sobre el lote real; requiere topografía y diseño profesional.', conceptual_only: true };
    dl(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), 'logos-parador-map-layout.json');
  }
  function exportPng() {
    // Self-contained conceptual raster (NOT the satellite tiles): project the
    // polygons into a canvas via the combined bbox. Avoids tile CORS entirely.
    try {
      const all = [lotRef, state.poly.usable_area_polygon, state.poly.rail_side_opportunity_polygon,
        state.poly.frontage_zone && state.poly.frontage_zone.polygon, state.poly.service_zone && state.poly.service_zone.polygon]
        .concat((state.poly.restricted_zones || []).map(z => z.polygon)).filter(Boolean);
      const flat = [].concat(...all), B = bbox(flat), pad = 40, W = 1000, H = 1000;
      const sx = (W - 2 * pad) / ((B.e - B.w) || 1e-6), sy = (H - 2 * pad) / ((B.n - B.s) || 1e-6), s = Math.min(sx, sy);
      const X = (lon) => pad + (lon - B.w) * s, Y = (lat) => H - pad - (lat - B.s) * s;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
      g.fillStyle = '#06141d'; g.fillRect(0, 0, W, H);
      const drawPoly = (ll, stroke, fill, dash) => { g.beginPath(); ll.forEach((p, i) => { const x = X(p[1]), y = Y(p[0]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
        g.setLineDash(dash || []); g.strokeStyle = stroke; g.lineWidth = 2; if (fill) { g.fillStyle = fill; g.fill(); } g.stroke(); g.setLineDash([]); };
      lotRef && drawPoly(lotRef, COLORS.lot, 'rgba(143,229,255,.05)', [3, 6]);
      drawPoly(state.poly.usable_area_polygon, COLORS.usable, 'rgba(95,192,138,.16)');
      drawPoly(state.poly.rail_side_opportunity_polygon, COLORS.rail, 'rgba(231,177,90,.1)', [8, 6]);
      (state.poly.restricted_zones || []).forEach(z => drawPoly(z.polygon, COLORS.restricted, 'rgba(224,121,90,.18)', [4, 4]));
      state.poly.frontage_zone && drawPoly(state.poly.frontage_zone.polygon, COLORS.frontage, 'rgba(159,208,255,.12)');
      state.poly.service_zone && drawPoly(state.poly.service_zone.polygon, COLORS.service, 'rgba(148,184,178,.12)');
      state.modulePlacements.forEach(m => { const x = X(m.lon), y = Y(m.lat); g.fillStyle = m.inside ? (MOD[m.type] || '#cfe') : COLORS.restricted; g.fillRect(x - 5, y - 5, 10, 10); });
      g.fillStyle = '#cdb98a'; g.font = '14px monospace'; g.fillText('PRELIMINAR / CONCEPTUAL — no es catastro ni topografía', pad, H - 14);
      cv.toBlob(b => b && dl(b, 'logos-parador-map-layout.png'), 'image/png');
    } catch (e) { exportMapLayout(); }
  }
  function importJson(file) {
    const fr = new FileReader();
    fr.onload = () => { try {
      const d = JSON.parse(fr.result);
      if (!d.usable_area_polygon) throw new Error('JSON sin usable_area_polygon');
      state.poly = d; persist(); render();
      if ($('leStatus')) $('leStatus').textContent = 'Polígonos importados · PRELIMINAR';
    } catch (e) { alert('Import inválido: ' + e.message); } };
    fr.readAsText(file);
  }

  // ---- UI wiring -----------------------------------------------------------
  function bind() {
    const sel = $('leLayer'); if (sel) sel.addEventListener('change', () => { state.active = sel.value; renderVerts(); });
    $('leEdit') && $('leEdit').addEventListener('click', () => { state.editMode = !state.editMode; $('leEdit').setAttribute('aria-pressed', state.editMode); $('leEdit').textContent = state.editMode ? 'Editar vértices: ON' : 'Editar vértices'; renderVerts(); });
    $('leAdd') && $('leAdd').addEventListener('click', () => { state.addMode = !state.addMode; $('leAdd').setAttribute('aria-pressed', state.addMode); $('leAdd').textContent = state.addMode ? '+ punto: ON (clic en mapa)' : '+ punto'; });
    $('leResetUsable') && $('leResetUsable').addEventListener('click', () => { if (lotRef && lotRef.length) { state.poly.usable_area_polygon = lotRef.map(p => p.slice()); persist(); render(); } });
    const toggles = { leShowLot: 'lot', leShowUsable: 'usable', leShowRail: 'rail', leShowRestricted: 'restricted', leShowLayout: 'layout', leShowCirc: 'circulation', leShowLand: 'landscape' };
    Object.entries(toggles).forEach(([id, key]) => { const c = $(id); if (c) { c.checked = state.show[key]; c.addEventListener('change', () => { state.show[key] = c.checked; showGroup(key, c.checked); }); } });
    $('leExportPoly') && $('leExportPoly').addEventListener('click', exportPolygons);
    $('leExportLayout') && $('leExportLayout').addEventListener('click', exportMapLayout);
    $('leExportPng') && $('leExportPng').addEventListener('click', exportPng);
    $('leImport') && $('leImport').addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) importJson(e.target.files[0]); });
    map.on('click', (e) => { if (state.addMode && state.editMode) addVertexAt(e.latlng); });
  }

  // ---- boot ----------------------------------------------------------------
  // Rebuild base editable polygons from the REAL lot (conceptual; review manually).
  function rebuildFromLot() {
    if (!lotRef || lotRef.length < 3 || !state.poly) return false;
    const c = centroid(lotRef), b = bbox(lotRef), lonR = b.e - b.w, latR = b.n - b.s;
    const inset = (f) => lotRef.map(p => [c[0] + (p[0] - c[0]) * f, c[1] + (p[1] - c[1]) * f]);
    state.poly.usable_area_polygon = inset(0.82);
    // road/rail sit on the east side (max lon): frontage east, service west
    state.poly.frontage_zone = { id: 'frontage', label: 'Frente / parqueo (auto)', polygon: [
      [b.s + latR * 0.10, b.e - lonR * 0.03], [b.n - latR * 0.10, b.e - lonR * 0.05], [b.n - latR * 0.12, b.e - lonR * 0.24], [b.s + latR * 0.12, b.e - lonR * 0.22]] };
    state.poly.service_zone = { id: 'service', label: 'Servicio / back-of-house (auto)', polygon: [
      [b.s + latR * 0.42, b.w + lonR * 0.05], [b.n - latR * 0.20, b.w + lonR * 0.03], [b.n - latR * 0.22, b.w + lonR * 0.24], [b.s + latR * 0.44, b.w + lonR * 0.26]] };
    state.poly.rail_side_opportunity_polygon = [
      [b.s + latR * 0.12, b.e + lonR * 0.06], [b.n - latR * 0.12, b.e + lonR * 0.10], [b.n - latR * 0.14, b.e + lonR * 0.55], [b.s + latR * 0.14, b.e + lonR * 0.50]];
    state.poly.rail_opportunity_label = 'Zona de oportunidad visual / posible uso — validar propiedad, servidumbres y retiros';
    state.poly.rail_axis_hint = { label: 'Eje férreo (auto · validar)', line: [[b.s - latR * 0.05, b.e + lonR * 0.03], [b.n + latR * 0.05, b.e + lonR * 0.05]] };
    state.poly.restricted_zones = [{ id: 'rz-rail-setback', label: 'Retiro férreo (auto · validar)', polygon: [
      [b.s + latR * 0.05, b.e - lonR * 0.01], [b.n - latR * 0.05, b.e - lonR * 0.03], [b.n - latR * 0.06, b.e - lonR * 0.11], [b.s + latR * 0.06, b.e - lonR * 0.09]] }];
    state.poly._generated_from_lot = true; state.poly._recalibrated = true;
    persist(); render(); return true;
  }

  async function boot() {
    if (!window.MapCalibration || !window.L) return;
    L = window.L; map = window.MapCalibration.map;
    try { lotRef = window.MapCalibration.getLotLatLngs ? window.MapCalibration.getLotLatLngs() : null; } catch (e) { lotRef = null; }

    let seed = null; try { seed = await fetch(SEED_URL).then(r => r.json()); } catch (e) { seed = null; }
    state.seed = seed ? JSON.parse(JSON.stringify(seed)) : null;   // kept for "Reset editable polygons"
    const stored = loadStored();
    if (stored && stored.usable_area_polygon) state.poly = stored;
    else if (seed) state.poly = JSON.parse(JSON.stringify(seed));
    else state.poly = null;
    if (!state.poly) { if ($('leStatus')) $('leStatus').textContent = 'No se pudo cargar el seed de polígonos (requiere build externo).'; return; }
    // if no usable defined but lot known, seed usable from the real lot
    if (!state.poly.usable_area_polygon && lotRef) state.poly.usable_area_polygon = lotRef.map(p => p.slice());

    try { catalog = await fetch(CATALOG_URL).then(r => r.json()); } catch (e) { catalog = null; }

    ['lot', 'usable', 'rail', 'restricted', 'drawn', 'layout', 'circulation', 'landscape', 'verts'].forEach(k => state.groups[k] = L.layerGroup());
    bind(); render();
    // Additive read-only accessor: lets terrain-spatial.js read the live (possibly
    // edited) layout polygons for the constraint engine. Read-only; never writes here.
    // Additive mutators (used by workspace.js for move/scale/delete): they only edit
    // the editable polygon doc + re-render/persist; lot.json is never touched.
    window.KairosLayout = {
      getPolygons: () => state.poly,
      getLotRef: () => lotRef,
      refresh: () => { persist(); render(); },
      centroidOf: (key) => { const r = ring(key); return r ? centroid(r) : null; },
      movePolygon: (key, dLat, dLon) => { const r = ring(key); if (r) { r.forEach(p => { p[0] += dLat; p[1] += dLon; }); persist(); render(); return true; } return false; },
      scalePolygon: (key, f) => { const r = ring(key); if (r) { const c = centroid(r); r.forEach(p => { p[0] = c[0] + (p[0] - c[0]) * f; p[1] = c[1] + (p[1] - c[1]) * f; }); persist(); render(); return true; } return false; },
      deleteRestricted: (id) => { if (state.poly && state.poly.restricted_zones) { state.poly.restricted_zones = state.poly.restricted_zones.filter(z => z.id !== id); persist(); render(); return true; } return false; },
      // delete-fix V1: delete ANY editable polygon (the lot.json original is read-only)
      deletePolygon: (key) => {
        if (!state.poly || key === 'lot') return false;
        if (key === 'usable') state.poly.usable_area_polygon = null;
        else if (key === 'rail') { state.poly.rail_side_opportunity_polygon = null; state.poly.rail_axis_hint = null; }
        else if (key === 'frontage') state.poly.frontage_zone = null;
        else if (key === 'service') state.poly.service_zone = null;
        else if (key.startsWith('rz:')) state.poly.restricted_zones = (state.poly.restricted_zones || []).filter(z => z.id !== key.slice(3));
        else if (key.startsWith('dp:')) state.poly.drawn_polygons = (state.poly.drawn_polygons || []).filter(z => z.id !== key.slice(3));
        else return false;
        persist(); render(); return true;
      },
      // Recalibration V1: rebuild base polygons from the REAL lot; reset to seed; clear
      // all editable overlays; add a user-drawn polygon. None of these touch lot.json.
      rebuildFromLot: () => rebuildFromLot(),
      resetEditablePolygons: () => {
        if (!state.seed) return false;
        state.poly = JSON.parse(JSON.stringify(state.seed)); state.poly.drawn_polygons = []; state.poly._recalibrated = true; state.poly._generated_from_lot = false;
        persist(); render(); return true;
      },
      clearEditablePolygons: () => {
        if (!state.poly) return false;
        state.poly.usable_area_polygon = null; state.poly.rail_side_opportunity_polygon = null; state.poly.rail_axis_hint = null;
        state.poly.frontage_zone = null; state.poly.service_zone = null; state.poly.restricted_zones = []; state.poly.drawn_polygons = [];
        state.poly._recalibrated = true; persist(); render(); return true;
      },
      addDrawnPolygon: (category, latlngs, label) => {
        if (!state.poly || !latlngs || latlngs.length < 3) return null;
        state.poly.drawn_polygons = state.poly.drawn_polygons || [];
        const id = 'd' + (state.poly.drawn_polygons.length + 1) + '-' + Math.abs((latlngs.length * 2654435761) % 99991);
        state.poly.drawn_polygons.push({ id, category: category || 'other', label: label || category || 'Polígono dibujado', polygon: latlngs.map(p => p.slice()), status: 'PRELIMINARY_CONCEPTUAL' });
        state.poly._recalibrated = true; persist(); render(); return 'dp:' + id;
      },
      flags: () => ({ source_lot_unchanged: true, editable_polygons_recalibrated: !!(state.poly && state.poly._recalibrated), generated_from_lot: !!(state.poly && state.poly._generated_from_lot) }),
      setHidden: (key, on) => { if (on) state.hidden.add(key); else state.hidden.delete(key); render(); },
      isHidden: (key) => state.hidden.has(key),
      // compact layer list: { key, label, deletable } (lot original is deletable:false)
      listPolygons: () => {
        const out = [];
        if (lotRef && lotRef.length) out.push({ key: 'lot', label: 'Lote original (lot.json)', deletable: false });
        if (state.poly) {
          if (state.poly.usable_area_polygon) out.push({ key: 'usable', label: 'Área utilizable', deletable: true });
          if (state.poly.rail_side_opportunity_polygon) out.push({ key: 'rail', label: 'Oportunidad ferrocarril', deletable: true });
          if (state.poly.frontage_zone) out.push({ key: 'frontage', label: 'Frente / parqueo', deletable: true });
          if (state.poly.service_zone) out.push({ key: 'service', label: 'Servicio', deletable: true });
          (state.poly.restricted_zones || []).forEach(z => out.push({ key: 'rz:' + z.id, label: z.label || z.id, deletable: true }));
          (state.poly.drawn_polygons || []).forEach(z => out.push({ key: 'dp:' + z.id, label: (z.label || z.category || 'dibujado') + ' ✎', deletable: true }));
        }
        return out;
      }
    };
    // keep the calibrated lot reference in sync if the user nudges calibration
    window.addEventListener('kairos:lot-redraw', () => {
      try { lotRef = window.MapCalibration.getLotLatLngs(); render(); } catch (e) { /* ignore */ }
    });
  }

  if (window.MapCalibration && window.MapCalibration.map) boot();
  else window.addEventListener('kairos:map-ready', boot, { once: true });
})();
