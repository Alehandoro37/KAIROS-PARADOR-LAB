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
    mode: 'select', addType: 'container-20', noteCat: 'general', snap: false,
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
  const save = () => { try { localStorage.setItem(LS_EL, JSON.stringify(state.elements)); localStorage.setItem(LS_NOTE, JSON.stringify(state.notes)); } catch (e) {} };
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
  function workspaceDoc() {
    return { schema: 'kairos.spatial-workspace/v1', status: 'PRELIMINARY_CONCEPTUAL',
      role: 'Map Calibration = Spatial Source of Truth (núcleo editable). layout-map = presentación planimétrica secundaria. 3D = visualización derivada.',
      center: (window.MapCalibration && window.MapCalibration.getCentroid && window.MapCalibration.getCentroid()) || null,
      polygons: polys(), elements: elementsDoc().elements, notes: state.notes, constraints: constraintDoc(),
      three_d_prep: {
        note: 'Preparado para que el 3D lo lea en fase siguiente (NO se rehace el 3D aquí).',
        element_volumes: state.elements.map(e => { const t = TYPES[e.type] || {}; return { id: e.id, type: e.type, volume: { w: e.w || t.w, d: e.d || t.d, h: t.h }, rotation: e.rotation || 0, lat: e.lat, lon: e.lon }; }),
        terrain_reference: 'data/terrain/terrain-profile.json',
        camera_anchors: state.anchors,
        conflict_flags: state.elements.filter(e => e._status !== 'ok').map(e => ({ id: e.id, status: e._status })),
        polygon_references: Object.keys(polys())
      },
      disclaimer: DISC };
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
    $('wsExportWorkspace') && $('wsExportWorkspace').addEventListener('click', () => dl(workspaceDoc(), 'logos-parador-spatial-workspace.json'));
    $('wsExportPolygons') && $('wsExportPolygons').addEventListener('click', () => dl(Object.assign({ schema: 'kairos.layout-polygons/v1', status: 'PRELIMINARY_CONCEPTUAL' }, polys(), { disclaimer: DISC }), 'logos-parador-polygons.json'));
    $('wsExportElements') && $('wsExportElements').addEventListener('click', () => dl(elementsDoc(), 'logos-parador-elements.json'));
    $('wsExportConstraints') && $('wsExportConstraints').addEventListener('click', () => dl(constraintDoc(), 'logos-parador-constraint-report.json'));
    $('wsExportNotes') && $('wsExportNotes').addEventListener('click', () => dl(notesDoc(), 'logos-parador-notes.json'));
    $('wsImport') && $('wsImport').addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) importJson(e.target.files[0]); });
    map.on('click', (e) => { if (state.mode === 'add') addElementAt(e.latlng); else if (state.mode === 'notes') addNoteAt(e.latlng); });
  }

  function boot() {
    if (!window.MapCalibration || !window.L) return;
    L = window.L; map = window.MapCalibration.map;
    load(); buildPalette(); bind(); setupSatellite();
    fetch(DATA + 'spatial/vegetation-strategy.json').then(r => r.ok ? r.json() : null).then(v => { state.veg = v; renderElements(); }).catch(() => {});
    fetch(DATA + 'spatial/spatial-zones.json').then(r => r.ok ? r.json() : null).then(z => { state.anchors = (z && z.camera_anchors) || []; }).catch(() => {});
    renderElements(); renderNotes(); showProps(); setMode('select');
  }

  if (window.MapCalibration && window.MapCalibration.map) boot();
  else window.addEventListener('kairos:map-ready', () => setTimeout(boot, 90), { once: true });
})();
