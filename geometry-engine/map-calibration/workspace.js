/* KAIROS PARADOR — Spatial Design Workspace V1 / workspace.js
 *
 * ADDITIVE workspace layer that turns Map Calibration into the editable CORE
 * (Spatial Source of Truth). It does NOT modify calibration.js — it consumes the
 * read-only handles window.MapCalibration (map) and window.KairosLayout (editable
 * polygons), and adds: a single-screen toolbar, a draggable/rotatable ELEMENT editor,
 * a NOTES layer, an ESRI World Imagery satellite basemap (no key), live CONSTRAINT
 * validation, and exports that the derived views (layout-map = planimetric secondary,
 * 3D = derived visualization) consume.
 *
 * Persistence: localStorage (kairos.elements.v1, kairos.notes.v1) + JSON export/import.
 * No backend, no API key, no Google Maps. Satellite/streets tiles need internet and
 * fail gracefully (offline → placeholder). Everything is PRELIMINAR / CONCEPTUAL.
 *
 * ⚠️ No reemplaza topografía, estudios, ingeniería, arquitectura, licencias ni
 * validación legal/catastral. */
(() => {
  const $ = (id) => document.getElementById(id);
  const LS_EL = 'kairos.elements.v1', LS_NOTE = 'kairos.notes.v1';
  const DATA = '../../data/';
  let L, map;

  // element catalogue (conceptual dimensions in metres + height for 3D volume)
  const TYPES = {
    'container-20': { label: 'Container 20ft', w: 6, d: 2.4, h: 2.6, color: '#e7b15a' },
    'container-40': { label: 'Container 40ft', w: 12, d: 2.4, h: 2.6, color: '#e7b15a' },
    'kitchen': { label: 'Kitchen', w: 6, d: 3, h: 2.8, color: '#e8a25c' },
    'bath': { label: 'Bath module', w: 4, d: 3, h: 2.8, color: '#9fb0b8' },
    'bar': { label: 'Bar', w: 6, d: 2.4, h: 2.6, color: '#8fe5ff' },
    'deck': { label: 'Deck', w: 6, d: 6, h: 0.4, color: '#67c994' },
    'pergola': { label: 'Pergola', w: 5, d: 5, h: 2.8, color: '#b07a4a' },
    'sign': { label: 'Sign / landmark', w: 1.5, d: 1.5, h: 4, color: '#efa827' },
    'tree-preserve': { label: 'Tree · preserve', w: 5, d: 5, h: 5, color: '#3f8f63' },
    'tree-evaluate': { label: 'Tree · evaluate', w: 4, d: 4, h: 5, color: '#e7b15a' },
    'tree-remove': { label: 'Tree · remove?', w: 4, d: 4, h: 4, color: '#e0795a' },
    'service-point': { label: 'Service point', w: 2, d: 2, h: 2.4, color: '#94b8b2' },
    'parking-bay': { label: 'Parking bay', w: 5, d: 2.5, h: 0.1, color: '#9fd0ff' }
  };
  const STATUS_COLOR = { ok: '#5fc08a', warning: '#e7b15a', conflict: '#e0795a' };
  const NOTE_CATS = ['general', 'árbol', 'borde de terreno', 'zona despejada', 'acceso posible', 'sombra/vegetación'];

  const state = {
    mode: 'select', addType: 'container-20', noteCat: 'general', snap: false, selPoly: null,
    elements: [], notes: [], sel: null, layers: {}, esri: null, veg: null, anchors: []
  };

  // ---- geo helpers ([lat,lon]) ---------------------------------------------
  const mPerLat = 111320;
  const mPerLon = (lat) => 111320 * Math.cos(lat * Math.PI / 180);
  const inPoly = (pt, ll) => { if (!ll || ll.length < 3) return false; let ins = false; const x = pt[1], y = pt[0];
    for (let i = 0, j = ll.length - 1; i < ll.length; j = i++) { const xi = ll[i][1], yi = ll[i][0], xj = ll[j][1], yj = ll[j][0];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; } return ins; };
  const metersBetween = (a, b) => { const k = mPerLon(a[0]); return Math.hypot((b[1] - a[1]) * k, (b[0] - a[0]) * mPerLat); };
  const centroid = (ll) => [ll.reduce((s, p) => s + p[0], 0) / ll.length, ll.reduce((s, p) => s + p[1], 0) / ll.length];

  function footprint(el) { // 4 corners [lat,lon] from center + w/d + rotation
    const t = TYPES[el.type] || { w: 4, d: 4 }, hw = (el.w || t.w) / 2, hd = (el.d || t.d) / 2;
    const th = (el.rotation || 0) * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
    const kLon = mPerLon(el.lat);
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => {
      const rx = x * c - y * s, ry = x * s + y * c;
      return [el.lat + ry / mPerLat, el.lon + rx / kLon];
    });
  }

  // ---- persistence ----------------------------------------------------------
  const save = () => { try { localStorage.setItem(LS_EL, JSON.stringify(state.elements)); localStorage.setItem(LS_NOTE, JSON.stringify(state.notes)); } catch (e) {} setSaved('✓ Saved locally'); };
  const load = () => { try { state.elements = JSON.parse(localStorage.getItem(LS_EL) || '[]'); state.notes = JSON.parse(localStorage.getItem(LS_NOTE) || '[]'); } catch (e) { state.elements = []; state.notes = []; } };

  // ---- constraint validation ------------------------------------------------
  function polys() { try { return (window.KairosLayout && window.KairosLayout.getPolygons()) || {}; } catch (e) { return {}; } }
  function validate(el) {
    const P = polys(), flags = []; const at = [el.lat, el.lon];
    const usable = P.usable_area_polygon, restricted = (P.restricted_zones || []).map(r => r.polygon);
    const railOpp = P.rail_side_opportunity_polygon, front = P.frontage_zone && P.frontage_zone.polygon;
    const isTree = /^tree-/.test(el.type);
    if (usable && !inPoly(at, usable)) flags.push({ level: 'conflict', msg: 'fuera del área utilizable' });
    restricted.forEach(rz => { if (inPoly(at, rz)) flags.push({ level: 'conflict', msg: 'dentro de zona restringida' }); });
    if (railOpp && inPoly(at, railOpp)) flags.push({ level: 'warning', msg: 'lado férreo — validar retiro/servidumbre/permiso' });
    // tree-to-preserve conflict (non-tree element over a preserve cluster)
    if (!isTree && state.veg) (state.veg.clusters || []).filter(c => c.action === 'preserve').forEach(c => {
      if (metersBetween(at, c.center) < (c.radius_m || 8)) flags.push({ level: 'warning', msg: 'conflicto con árbol a preservar' });
    });
    // minimum conceptual distance to other elements
    let near = Infinity; state.elements.forEach(o => { if (o.id !== el.id) near = Math.min(near, metersBetween(at, [o.lat, o.lon])); });
    if (near < 3) flags.push({ level: 'warning', msg: 'distancia conceptual insuficiente entre módulos' });
    // pedestrian access (far from frontage/access)
    if (!isTree && front && metersBetween(at, centroid(front)) > 90) flags.push({ level: 'warning', msg: 'módulo sin acceso peatonal claro' });
    const status = flags.some(f => f.level === 'conflict') ? 'conflict' : flags.some(f => f.level === 'warning') ? 'warning' : 'ok';
    return { status, flags };
  }

  // ---- rendering ------------------------------------------------------------
  function clearGroup(k) { if (state.layers[k]) { state.layers[k].clearLayers(); map.removeLayer(state.layers[k]); } state.layers[k] = L.layerGroup().addTo(map); }
  function renderElements() {
    clearGroup('elements');
    state.elements.forEach(el => {
      const t = TYPES[el.type] || {}, v = validate(el); el._status = v.status; el._flags = v.flags;
      const poly = L.polygon(footprint(el), { color: STATUS_COLOR[v.status], weight: el.id === state.sel ? 3 : 1.8, fillColor: t.color || '#cfe', fillOpacity: el.id === state.sel ? 0.55 : 0.4 });
      poly.on('click', () => selectEl(el.id));
      state.layers.elements.addLayer(poly);
      const mk = L.marker([el.lat, el.lon], { draggable: true, keyboard: false,
        icon: L.divIcon({ className: 'ws-el' + (el.id === state.sel ? ' sel' : ''), html: `<span>${(t.label || el.type)}${el.rotation ? ' ' + el.rotation + '°' : ''}</span>`, iconSize: [10, 10] }) });
      mk.on('click', () => selectEl(el.id));
      mk.on('drag', (e) => { const ll = e.target.getLatLng(); el.lat = ll.lat; el.lon = ll.lng; poly.setLatLngs(footprint(el)); });
      mk.on('dragend', () => { save(); renderElements(); if (el.id === state.sel) showProps(); refreshStatus(); });
      state.layers.elements.addLayer(mk);
    });
    refreshStatus();
  }
  function renderNotes() {
    clearGroup('notes');
    state.notes.forEach(n => {
      const mk = L.marker([n.lat, n.lon], { icon: L.divIcon({ className: 'ws-note', html: '📝', iconSize: [18, 18] }) });
      mk.bindTooltip(`[${n.category}] ${n.text}`, { direction: 'top' });
      mk.on('click', () => { state.sel = 'note:' + n.id; showProps(); });
      state.layers.notes.addLayer(mk);
    });
  }
  function refreshStatus() {
    const s = { ok: 0, warning: 0, conflict: 0 }; state.elements.forEach(e => s[e._status || 'ok']++);
    if ($('wsStatus')) $('wsStatus').textContent = `${state.elements.length} elementos · ${s.ok} OK · ${s.warning} warning · ${s.conflict} conflicto · ${state.notes.length} notas · PRELIMINAR`;
  }

  // ---- selection / properties ----------------------------------------------
  function selectEl(id) { state.sel = id; renderElements(); showProps(); }
  function showProps() {
    const host = $('wsProps'); if (!host) return;
    if (typeof state.sel === 'string' && state.sel.startsWith('note:')) {
      const n = state.notes.find(x => 'note:' + x.id === state.sel); if (!n) { host.innerHTML = ''; return; }
      host.innerHTML = `<div class="ws-prow"><b>Nota</b><button class="ws-x" data-del-note="${n.id}">✕</button></div>` +
        `<label>Categoría <select id="wsNoteCat2">${NOTE_CATS.map(c => `<option ${c === n.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>` +
        `<textarea id="wsNoteText2">${(n.text || '').replace(/</g, '&lt;')}</textarea>`;
      $('wsNoteText2').addEventListener('input', () => { n.text = $('wsNoteText2').value; save(); renderNotes(); });
      $('wsNoteCat2').addEventListener('change', () => { n.category = $('wsNoteCat2').value; save(); renderNotes(); });
      host.querySelector('[data-del-note]').addEventListener('click', () => { state.notes = state.notes.filter(x => x.id !== n.id); state.sel = null; save(); renderNotes(); host.innerHTML = ''; refreshStatus(); });
      return;
    }
    const el = state.elements.find(x => x.id === state.sel); if (!el) { host.innerHTML = '<p class="ws-hint">Selecciona un elemento para ver/editar sus propiedades.</p>'; return; }
    const t = TYPES[el.type] || {}, v = validate(el);
    host.innerHTML =
      `<div class="ws-prow"><b>${t.label || el.type}</b><span class="ws-badge ${v.status}">${v.status.toUpperCase()}</span></div>` +
      `<div class="ws-pgrid">` +
      `<span>Dim</span><span>${el.w || t.w}×${el.d || t.d} m · h${t.h}</span>` +
      `<span>Rotación</span><span>${el.rotation || 0}°</span>` +
      `<span>Fase</span><span><select id="wsPhase">${['F1', 'F2', 'F3'].map(p => `<option ${p === el.phase ? 'selected' : ''}>${p}</option>`).join('')}</select></span>` +
      `</div>` +
      `<label>Nota <input id="wsNote" type="text" value="${(el.note || '').replace(/"/g, '&quot;')}"></label>` +
      (v.flags.length ? `<ul class="ws-flags">${v.flags.map(f => `<li class="${f.level}">${f.msg}</li>`).join('')}</ul>` : '<p class="ws-ok">Sin conflictos conceptuales.</p>') +
      `<div class="ws-actrow"><button class="ws-b" id="wsRotate">Rotar 15°</button><button class="ws-b" id="wsDup">Duplicar</button><button class="ws-b" id="wsDel">Eliminar</button></div>`;
    $('wsPhase').addEventListener('change', () => { el.phase = $('wsPhase').value; save(); });
    $('wsNote').addEventListener('input', () => { el.note = $('wsNote').value; save(); });
    $('wsRotate').addEventListener('click', () => { el.rotation = ((el.rotation || 0) + 15) % 360; save(); renderElements(); showProps(); });
    $('wsDup').addEventListener('click', () => { const c = Object.assign({}, el, { id: uid(), lat: el.lat + 0.00006, lon: el.lon + 0.00006 }); state.elements.push(c); save(); selectEl(c.id); });
    $('wsDel').addEventListener('click', () => { state.elements = state.elements.filter(x => x.id !== el.id); state.sel = null; save(); renderElements(); host.innerHTML = ''; });
  }
  const uid = () => 'e' + Math.abs((state.elements.length + 1) * 2654435761 % 99991) + '-' + state.elements.length;

  // ---- toolbar / modes ------------------------------------------------------
  function setMode(m) {
    state.mode = m;
    document.querySelectorAll('[data-ws-mode]').forEach(b => b.setAttribute('aria-pressed', b.getAttribute('data-ws-mode') === m ? 'true' : 'false'));
    const pal = $('wsPalette'); if (pal) pal.style.display = m === 'add' ? '' : 'none';
    const nb = $('wsNoteBar'); if (nb) nb.style.display = m === 'notes' ? '' : 'none';
    if (m === 'draw') { const e = $('leEdit'); if (e && e.getAttribute('aria-pressed') !== 'true') e.click(); } // reuse polygon editor
    map.getContainer().style.cursor = (m === 'add' || m === 'notes') ? 'crosshair' : '';
  }
  function addElementAt(latlng) {
    const t = TYPES[state.addType]; const el = { id: uid(), type: state.addType, w: t.w, d: t.d, rotation: 0, phase: 'F1', note: '', lat: latlng.lat, lon: latlng.lng, status: 'conceptual' };
    state.elements.push(el); save(); selectEl(el.id);
  }
  function addNoteAt(latlng) {
    const text = (prompt('Nota (' + state.noteCat + '):', '') || '').trim(); if (!text) return;
    state.notes.push({ id: uid(), kind: 'point', category: state.noteCat, text, lat: latlng.lat, lon: latlng.lng }); save(); renderNotes(); refreshStatus();
  }

  // ---- basemap: ESRI World Imagery (no key) ---------------------------------
  function setupSatellite() {
    const sel = $('baseLayer'); if (!sel) return;
    if (![...sel.options].some(o => o.value === 'satellite')) {
      const o = document.createElement('option'); o.value = 'satellite'; o.textContent = 'ESRI World Imagery (satélite, sin key)';
      sel.insertBefore(o, sel.options[1] || null);
    }
    state.esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics · contexto PRELIMINAR'
    });
    state.esri.on('tileerror', () => { const b = $('offlineBanner'); if (b) { b.textContent = 'Satélite no disponible (sin conexión). Usa OSM o el polígono offline.'; b.classList.add('show'); } });
    const apply = () => { if (sel.value === 'satellite') state.esri.addTo(map); else if (map.hasLayer(state.esri)) map.removeLayer(state.esri); };
    sel.addEventListener('change', apply); apply();
  }

  // ---- exports / import -----------------------------------------------------
  function dl(obj, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
  const DISC = 'PRELIMINAR / CONCEPTUAL — no reemplaza topografía, estudios, ingeniería, arquitectura, licencias ni validación legal/catastral.';
  function elementsDoc() { return { schema: 'kairos.elements/v1', status: 'PRELIMINARY_CONCEPTUAL', elements: state.elements.map(e => { const t = TYPES[e.type] || {}; const v = validate(e); return { id: e.id, type: e.type, label: t.label, dimensions: { w: e.w || t.w, d: e.d || t.d, h: t.h }, rotation: e.rotation || 0, phase: e.phase, note: e.note, status: 'conceptual', validation: v.status, flags: v.flags.map(f => f.msg), lat: e.lat, lon: e.lon }; }), disclaimer: DISC }; }
  function notesDoc() { return { schema: 'kairos.notes/v1', status: 'PRELIMINARY_CONCEPTUAL', notes: state.notes, disclaimer: DISC }; }
  function constraintDoc() { const items = state.elements.map(e => { const v = validate(e); return { id: e.id, type: e.type, validation: v.status, flags: v.flags }; });
    const s = { ok: 0, warning: 0, conflict: 0 }; items.forEach(i => s[i.validation]++); return { schema: 'kairos.constraint-report/v1', status: 'PRELIMINARY_CONCEPTUAL', summary: s, items, disclaimer: DISC }; }
  function nowISO() { try { return new Date().toISOString(); } catch (e) { return 'unknown'; } }
  function workspaceDoc() {
    const cr = constraintDoc();
    return {
      schema: 'kairos.spatial-workspace/v1',
      generated_at: nowISO(),
      coordinate_system: 'WGS84 EPSG:4326',
      source: 'map-calibration',
      status: 'PRELIMINARY_CONCEPTUAL',
      role: 'Map Calibration = Spatial Source of Truth (núcleo editable). layout-map = presentación planimétrica secundaria. 3D = visualización derivada.',
      center: (window.MapCalibration && window.MapCalibration.getCentroid && window.MapCalibration.getCentroid()) || null,
      polygons: polys(),
      elements: elementsDoc().elements,
      notes: state.notes,
      constraints: cr,
      terrain_reference: 'data/terrain/terrain-profile.json',
      camera_anchors: state.anchors,
      validation_summary: cr.summary,
      three_d_prep: {
        note: 'El 3D reconstruye la volumetría conceptual desde elements[] (type/dimensions/rotation/phase/notes/validation).',
        element_volumes: state.elements.map(e => { const t = TYPES[e.type] || {}; return { id: e.id, type: e.type, volume: { w: e.w || t.w, d: e.d || t.d, h: t.h }, rotation: e.rotation || 0, lat: e.lat, lon: e.lon }; }),
        polygon_references: Object.keys(polys())
      },
      disclaimer: DISC
    };
  }
  function importJson(file) {
    const fr = new FileReader();
    fr.onload = () => { try { const d = JSON.parse(fr.result);
      if (Array.isArray(d.elements)) state.elements = d.elements.map(e => ({ id: e.id || uid(), type: e.type, w: (e.dimensions || {}).w || e.w, d: (e.dimensions || {}).d || e.d, rotation: e.rotation || 0, phase: e.phase || 'F1', note: e.note || '', lat: e.lat, lon: e.lon }));
      if (Array.isArray(d.notes)) state.notes = d.notes;
      save(); renderElements(); renderNotes(); refreshStatus();
    } catch (e) { alert('Import inválido: ' + e.message); } };
    fr.readAsText(file);
  }

  // ---- save state indicator -------------------------------------------------
  function setSaved(txt) { const e = $('wsSaved'); if (e) e.textContent = txt; }
  function saveToBrowser() { save(); setSaved('✓ Saved locally'); }
  function resetToSeed() {
    if (!confirm('¿Reset al seed? Se borran elementos y notas locales (los polígonos vuelven al seed). El lote original no se modifica.')) return;
    try { localStorage.removeItem(LS_EL); localStorage.removeItem(LS_NOTE); localStorage.removeItem('kairos.layoutPolygons.v1'); } catch (e) {}
    state.elements = []; state.notes = []; state.sel = null;
    renderElements(); renderNotes(); showProps(); setSaved('Reset · recarga para re-seed polígonos');
  }
  // hook save() to update the indicator
  const _save = save; // eslint-disable-line
  function saveAll() { _save(); setSaved('✓ Saved locally'); }

  // ---- delete key -----------------------------------------------------------
  function deleteSelected() {
    if (typeof state.sel === 'string' && state.sel.startsWith('note:')) {
      const id = state.sel.slice(5); state.notes = state.notes.filter(n => n.id !== id); state.sel = null; saveAll(); renderNotes(); showProps(); refreshStatus(); return;
    }
    const el = state.elements.find(x => x.id === state.sel); if (!el) return;
    state.elements = state.elements.filter(x => x.id !== el.id); state.sel = null; saveAll(); renderElements(); showProps();
  }

  // ---- polygon select / move (drag interior) / scale / delete ---------------
  function scalePoly(f) { if (state.selPoly && window.KairosLayout) { window.KairosLayout.scalePolygon(state.selPoly, f); renderElements(); setSaved('✓ Saved locally'); } }
  function nudgePoly(dLat, dLon) { if (state.selPoly && window.KairosLayout) { window.KairosLayout.movePolygon(state.selPoly, dLat, dLon); renderElements(); setSaved('✓ Saved locally'); } }
  function deletePoly() {
    if (!state.selPoly) return;
    if (!state.selPoly.startsWith('rz:')) { alert('Solo las zonas restringidas se pueden borrar; las categorías base se editan/escalan (el lote original nunca se borra).'); return; }
    if (!confirm('¿Borrar esta zona restringida?')) return;
    window.KairosLayout.deleteRestricted(state.selPoly.slice(3)); state.selPoly = null; renderElements();
  }
  // drag the whole selected polygon by dragging the map interior (Move mode)
  function bindPolygonDrag() {
    let drag = null;
    map.on('mousedown', (e) => { if (state.mode !== 'move' || !state.selPoly) return; drag = e.latlng; map.dragging.disable(); });
    map.on('mousemove', (e) => { if (!drag) return; const dLat = e.latlng.lat - drag.lat, dLon = e.latlng.lng - drag.lng; if (window.KairosLayout) window.KairosLayout.movePolygon(state.selPoly, dLat, dLon); drag = e.latlng; renderElements(); });
    map.on('mouseup', () => { if (drag) { drag = null; map.dragging.enable(); setSaved('✓ Saved locally'); } });
  }

  // ---- advanced zoom --------------------------------------------------------
  function fitTo(latlngs) { if (latlngs && latlngs.length) map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 20 }); }
  function fitUsable() { const P = polys(); fitTo(P.usable_area_polygon); }
  function fitLot() { const r = (window.KairosLayout && window.KairosLayout.getLotRef && window.KairosLayout.getLotRef()) || (polys().source_lot_polygon); fitTo(r); }
  function fitSelected() {
    if (state.selPoly) { const r = window.KairosLayout && window.KairosLayout.getPolygons && ringFromPolys(state.selPoly); if (r) return fitTo(r); }
    const el = state.elements.find(x => x.id === state.sel); if (el) return fitTo(footprint(el));
    fitUsable();
  }
  function ringFromPolys(key) { const P = polys(); if (key === 'usable') return P.usable_area_polygon; if (key === 'rail') return P.rail_side_opportunity_polygon; if (key === 'frontage') return P.frontage_zone && P.frontage_zone.polygon; if (key === 'service') return P.service_zone && P.service_zone.polygon; if (key.startsWith('rz:')) { const z = (P.restricted_zones || []).find(r => r.id === key.slice(3)); return z && z.polygon; } return null; }
  function updateZoom() { if ($('wsZoomLevel')) $('wsZoomLevel').textContent = 'z' + map.getZoom(); }

  // ---- layer visibility presets ---------------------------------------------
  const PRESETS = {
    'clean': { on: ['leShowLot', 'leShowUsable', 'leShowRail', 'tsZones', 'tsContainers'], off: ['tsTerrain', 'tsSlope', 'tsDrainage', 'tsTrees', 'leShowRestricted', 'leShowLayout', 'leShowCirc', 'leShowLand'] },
    'full': { on: ['leShowLot', 'leShowUsable', 'leShowRail', 'leShowRestricted', 'tsTerrain', 'tsSlope', 'tsDrainage', 'tsZones', 'tsContainers', 'tsTrees', 'tsRailway'], off: [] },
    'satellite': { on: ['leShowLot', 'leShowUsable', 'leShowRail'], off: ['tsTerrain', 'tsSlope', 'tsDrainage', 'tsContainers', 'tsTrees', 'leShowLayout'], base: 'satellite' },
    'construction': { on: ['leShowLot', 'leShowUsable', 'leShowRestricted', 'tsZones', 'tsRailway'], off: ['tsTerrain', 'tsSlope', 'tsDrainage', 'tsTrees', 'tsContainers'] }
  };
  function applyPreset(name) {
    const p = PRESETS[name]; if (!p) return;
    const setChk = (id, v) => { const c = $(id); if (c && c.type === 'checkbox') { c.checked = v; c.dispatchEvent(new Event('change')); } };
    (p.on || []).forEach(id => setChk(id, true)); (p.off || []).forEach(id => setChk(id, false));
    if (p.base) { const sel = $('baseLayer'); if (sel) { sel.value = p.base; sel.dispatchEvent(new Event('change')); } }
    document.querySelectorAll('[data-ws-preset]').forEach(b => b.setAttribute('aria-pressed', b.getAttribute('data-ws-preset') === name ? 'true' : 'false'));
    if (name === 'satellite') setMode('notes'); // satellite markup
    setSaved('Preset: ' + name);
  }

  // ---- primitive layout generator -------------------------------------------
  function generatePrimitiveLayout() {
    const P = polys(), U = P.usable_area_polygon; if (!U) { alert('No hay área utilizable definida (polígono usable).'); return; }
    const generated = state.elements.filter(e => e.status === 'GENERATED_CONCEPTUAL');
    if (state.elements.length) {
      const ans = prompt('Ya hay elementos. Escribe "replace" para reemplazar el layout generado, o "append" para añadir:', 'replace');
      if (ans === null) return;
      if (/^replace/i.test(ans)) state.elements = state.elements.filter(e => e.status !== 'GENERATED_CONCEPTUAL');
      // append → keep all
    }
    const c = centroid(U), b = (() => { const la = U.map(p => p[0]), lo = U.map(p => p[1]); return { s: Math.min(...la), n: Math.max(...la), w: Math.min(...lo), e: Math.max(...lo) }; })();
    const fz = P.frontage_zone && centroid(P.frontage_zone.polygon);
    const sz = P.service_zone && centroid(P.service_zone.polygon);
    const op = P.rail_side_opportunity_polygon && centroid(P.rail_side_opportunity_polygon);
    const lerp = (a, t) => [c[0] + (a[0] - c[0]) * t, c[1] + (a[1] - c[1]) * t];
    const add = (type, at, rot, note) => { const t = TYPES[type]; if (!at) return; state.elements.push({ id: uid(), type, w: t.w, d: t.d, rotation: rot || 0, phase: 'F1', note: note || '', lat: at[0], lon: at[1], status: 'GENERATED_CONCEPTUAL' }); };
    // parking + gravel toward road frontage
    add('parking-bay', fz ? lerp(fz, 0.85) : [b.s + (b.n - b.s) * 0.12, c[1]], 0, 'parqueo hacia frente vial');
    add('parking-bay', fz ? lerp(fz, 0.7) : [b.s + (b.n - b.s) * 0.18, c[1]], 0, 'parqueo');
    // deck toward rail opportunity / edge
    add('deck', op ? lerp(op, 0.55) : [c[0], b.e - (b.e - b.w) * 0.18], -15, 'deck hacia borde férreo (validar retiro)');
    // kitchen + service near service spine
    add('kitchen', sz ? lerp(sz, 0.65) : [c[0] + (b.n - b.s) * 0.1, b.w + (b.e - b.w) * 0.2], 0, 'cocina junto a service spine');
    add('service-point', sz ? lerp(sz, 0.85) : [c[0] + (b.n - b.s) * 0.15, b.w + (b.e - b.w) * 0.18], 0, 'servicios / técnica');
    // bath accessible but discreet
    add('bath', [c[0] - (b.n - b.s) * 0.06, b.w + (b.e - b.w) * 0.28], 0, 'baños accesibles y discretos');
    // 2–4 containers / pavilions around the plaza centre
    add('container-40', [c[0], c[1]], 0, 'pabellón gastronómico');
    add('container-20', [c[0] + (b.n - b.s) * 0.08, c[1] + (b.e - b.w) * 0.06], 20, 'café');
    add('bar', [c[0] - (b.n - b.s) * 0.05, c[1] + (b.e - b.w) * 0.05], 0, 'bar / lounge');
    // entrance signage near frontage
    add('sign', fz ? lerp(fz, 0.95) : [b.s + (b.n - b.s) * 0.08, c[1]], 0, 'signage de entrada');
    // preserve trees if vegetation data exists
    if (state.veg) (state.veg.clusters || []).filter(t => t.action === 'preserve').slice(0, 3).forEach(t => add('tree-preserve', t.center, 0, 'árbol a conservar'));
    saveAll(); renderElements(); refreshStatus();
    setSaved('Layout primitivo generado (GENERATED_CONCEPTUAL)');
  }

  // ---- clean plan view (same data, no map) ----------------------------------
  function togglePlan() {
    const host = $('wsPlan'); if (!host) return;
    const on = host.style.display === 'none' || !host.style.display;
    host.style.display = on ? 'block' : 'none';
    const btn = $('wsPlanToggle'); if (btn) btn.textContent = on ? 'Map View' : 'Clean Plan View';
    if (on) renderPlan();
  }
  function renderPlan() {
    const host = $('wsPlan'); if (!host) return; const P = polys(), U = P.usable_area_polygon;
    const all = [].concat(U || [], ...state.elements.map(footprint));
    if (!all.length) { host.innerHTML = '<div class="ws-planmsg">Sin área utilizable / elementos para el plano.</div>'; return; }
    const la = all.map(p => p[0]), lo = all.map(p => p[1]); const s = Math.min(...la), n = Math.max(...la), w = Math.min(...lo), e = Math.max(...lo);
    const W = 1000, H = 1000, pad = 60, sc = Math.min((W - 2 * pad) / ((e - w) || 1e-6), (H - 2 * pad) / ((n - s) || 1e-6));
    const X = (lon) => pad + (lon - w) * sc, Y = (lat) => H - pad - (lat - s) * sc;
    const path = (ring2) => ring2.map((p, i) => (i ? 'L' : 'M') + X(p[1]).toFixed(1) + ' ' + Y(p[0]).toFixed(1)).join(' ') + ' Z';
    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">`;
    for (let g = pad; g <= W - pad; g += 40) svg += `<line x1="${g}" y1="${pad}" x2="${g}" y2="${H - pad}" stroke="rgba(143,229,255,.06)"/><line x1="${pad}" y1="${g}" x2="${W - pad}" y2="${g}" stroke="rgba(143,229,255,.06)"/>`;
    if (U) svg += `<path d="${path(U)}" fill="rgba(95,192,138,.1)" stroke="#5fc08a" stroke-width="2"/>`;
    (P.restricted_zones || []).forEach(z => svg += `<path d="${path(z.polygon)}" fill="rgba(224,121,90,.12)" stroke="#e0795a" stroke-width="1.5" stroke-dasharray="5 4"/>`);
    state.elements.forEach(el => { const t = TYPES[el.type] || {}; svg += `<path d="${path(footprint(el))}" fill="${t.color || '#cfe'}" fill-opacity="0.55" stroke="${STATUS_COLOR[el._status || 'ok']}" stroke-width="1.6"/>`; });
    svg += `<text x="${pad}" y="${H - 18}" fill="#cdb98a" font-family="ui-monospace,monospace" font-size="16">CLEAN PLAN VIEW · conceptual · mismos datos del workspace · PRELIMINAR</text></svg>`;
    host.innerHTML = svg;
  }

  // ---- UI wiring ------------------------------------------------------------
  function buildPalette() {
    const pal = $('wsPaletteList'); if (!pal) return;
    pal.innerHTML = Object.entries(TYPES).map(([k, t]) => `<button class="ws-pal" data-type="${k}" style="border-color:${t.color}">${t.label}</button>`).join('');
    pal.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => { state.addType = b.dataset.type; pal.querySelectorAll('.ws-pal').forEach(x => x.classList.toggle('on', x === b)); }));
    const first = pal.querySelector('.ws-pal'); if (first) first.classList.add('on');
    const nc = $('wsNoteCat'); if (nc) { nc.innerHTML = NOTE_CATS.map(c => `<option>${c}</option>`).join(''); nc.addEventListener('change', () => state.noteCat = nc.value); }
  }
  function bind() {
    document.querySelectorAll('[data-ws-mode]').forEach(b => b.addEventListener('click', () => setMode(b.getAttribute('data-ws-mode'))));
    const exportWS = () => dl(workspaceDoc(), 'logos-parador-spatial-workspace.json');
    $('wsExportWorkspace') && $('wsExportWorkspace').addEventListener('click', exportWS);
    $('wsExport3D') && $('wsExport3D').addEventListener('click', exportWS);
    $('wsExportPolygons') && $('wsExportPolygons').addEventListener('click', () => dl(Object.assign({ schema: 'kairos.layout-polygons/v1', status: 'PRELIMINARY_CONCEPTUAL' }, polys(), { disclaimer: DISC }), 'logos-parador-polygons.json'));
    $('wsExportElements') && $('wsExportElements').addEventListener('click', () => dl(elementsDoc(), 'logos-parador-elements.json'));
    $('wsExportConstraints') && $('wsExportConstraints').addEventListener('click', () => dl(constraintDoc(), 'logos-parador-constraint-report.json'));
    $('wsExportNotes') && $('wsExportNotes').addEventListener('click', () => dl(notesDoc(), 'logos-parador-notes.json'));
    $('wsImport') && $('wsImport').addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) importJson(e.target.files[0]); });
    map.on('click', (e) => { if (state.mode === 'add') addElementAt(e.latlng); else if (state.mode === 'notes') addNoteAt(e.latlng); });
    // delete key
    document.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel != null) { const tag = (e.target && e.target.tagName) || ''; if (/INPUT|TEXTAREA|SELECT/.test(tag)) return; e.preventDefault(); deleteSelected(); } });
    // save / reset
    $('wsSave') && $('wsSave').addEventListener('click', saveToBrowser);
    $('wsReset') && $('wsReset').addEventListener('click', resetToSeed);
    // primitive layout generator
    $('wsGenerate') && $('wsGenerate').addEventListener('click', generatePrimitiveLayout);
    // clean plan view
    $('wsPlanToggle') && $('wsPlanToggle').addEventListener('click', togglePlan);
    // layer presets
    document.querySelectorAll('[data-ws-preset]').forEach(b => b.addEventListener('click', () => applyPreset(b.getAttribute('data-ws-preset'))));
    // advanced zoom
    $('wsZoomIn') && $('wsZoomIn').addEventListener('click', () => map.zoomIn(2));
    $('wsZoomOut') && $('wsZoomOut').addEventListener('click', () => map.zoomOut(2));
    $('wsFitSel') && $('wsFitSel').addEventListener('click', fitSelected);
    $('wsFitUsable') && $('wsFitUsable').addEventListener('click', fitUsable);
    $('wsFitLot') && $('wsFitLot').addEventListener('click', fitLot);
    map.on('zoomend', updateZoom); updateZoom();
    // polygon selector + ops
    const ps = $('wsPolySel'); if (ps) ps.addEventListener('change', () => { state.selPoly = ps.value || null; });
    $('wsPolyScaleUp') && $('wsPolyScaleUp').addEventListener('click', () => scalePoly(1.05));
    $('wsPolyScaleDn') && $('wsPolyScaleDn').addEventListener('click', () => scalePoly(0.95));
    $('wsPolyDel') && $('wsPolyDel').addEventListener('click', deletePoly);
    document.querySelectorAll('[data-ws-nudge]').forEach(b => b.addEventListener('click', () => { const d = 0.00004, m = b.getAttribute('data-ws-nudge'); nudgePoly(m === 'n' ? d : m === 's' ? -d : 0, m === 'e' ? d : m === 'w' ? -d : 0); }));
    bindPolygonDrag();
  }

  function boot() {
    if (!window.MapCalibration || !window.L) return;
    L = window.L; map = window.MapCalibration.map;
    load(); buildPalette(); bind(); setupSatellite();
    fetch(DATA + 'spatial/vegetation-strategy.json').then(r => r.ok ? r.json() : null).then(v => { state.veg = v; renderElements(); }).catch(() => {});
    fetch(DATA + 'spatial/spatial-zones.json').then(r => r.ok ? r.json() : null).then(z => { state.anchors = (z && z.camera_anchors) || []; }).catch(() => {});
    renderElements(); renderNotes(); showProps(); setMode('select'); setSaved('✓ Saved locally');
  }

  if (window.MapCalibration && window.MapCalibration.map) boot();
  else window.addEventListener('kairos:map-ready', () => setTimeout(boot, 90), { once: true });
})();
