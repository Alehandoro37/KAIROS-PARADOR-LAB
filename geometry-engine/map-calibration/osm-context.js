/* KAIROS PARADOR — Context Infrastructure Layer V1 (OSM / Overpass)
 * OPTIONAL contextual enrichment for the Map Calibration page. Draws REAL nearby
 * infrastructure (highways, railways, waterways, buildings, landuse, amenities)
 * fetched client-side from the public Overpass API around the lot centroid.
 *
 * Rules honoured: no backend, no Google APIs, no billing, no scraping loops, no
 * simulations. ONE MANUAL fetch per click (no auto-fetch on load, no polling),
 * defensive timeout. Graceful degradation: if Overpass fails/times out it falls
 * back to the local cache (localStorage seed/file); if none, a banner shows and the
 * map / polygon / calibration keep working untouched. Everything is PRELIMINAR —
 * OSM context, not cadastre or survey. Data © OpenStreetMap contributors. */
(() => {
  const ENDPOINT = 'https://overpass-api.de/api/interpreter';
  const CACHE_SEED_URL = '../../data/runtime/osm-context-cache.json';
  const LS_KEY = 'kairos:osm-context-cache/v1';
  const TIMEOUT_MS = 25000;

  const $ = (id) => document.getElementById(id);

  // Category styles. Each category renders into its own Leaflet LayerGroup.
  const CATS = {
    roads:     { color: '#9fd0ff', weight: 2,   dash: null },
    rail:      { color: '#ffd36b', weight: 2,   dash: '8 6' },
    water:     { color: '#5aa0d6', weight: 2.5, dash: null },
    buildings: { color: '#b9c6d6', weight: 1,   dash: null, fill: true },
    labels:    { color: '#7dffa8', weight: 1,   dash: '2 6', fill: true }
  };

  let map = null, pane = 'ctxPane';
  const groups = {};                 // category → L.layerGroup
  let lastElements = [];             // raw Overpass elements currently rendered
  let lastMeta = null;               // { query, endpoint, centroid, radiusM, savedAt, counts }
  let opacity = 0.8;
  let inFlight = false;              // rate-limit guard: never two fetches at once

  // ---- helpers ---------------------------------------------------------------
  function setStatus(html, kind) {
    const el = $('ctxStatus'); if (!el) return;
    el.innerHTML = html; el.style.color = kind === 'err' ? '#ffb0a0' : (kind === 'ok' ? '#9cf5c0' : '#9cc6dd');
  }
  function banner(show, msg) {
    const b = $('ctxBanner'); if (!b) return;
    b.textContent = msg || ''; b.classList.toggle('show', !!show);
  }
  function radius() { const v = $('ctxRadius'); return v ? Number(v.value) : 500; }

  function bbox(centroid, r) {
    const dLat = r / 111320, dLon = r / (111320 * Math.cos(centroid.lat * Math.PI / 180) || 1);
    return { south: centroid.lat - dLat, west: centroid.lon - dLon, north: centroid.lat + dLat, east: centroid.lon + dLon };
  }
  function buildQuery(centroid, r) {
    const a = `(around:${r},${centroid.lat},${centroid.lon})`;
    return `[out:json][timeout:25];(` +
      `way["highway"]${a};way["railway"]${a};way["waterway"]${a};` +
      `way["natural"="water"]${a};way["building"]${a};way["landuse"]${a};` +
      `node["amenity"]${a};` +
      `);out geom;`;
  }
  function categorize(el) {
    const t = el.tags || {};
    if (el.type === 'node' && t.amenity) return 'labels';
    if (el.type !== 'way') return null;
    if (t.highway) return 'roads';
    if (t.railway) return 'rail';
    if (t.waterway || t.natural === 'water') return 'water';
    if (t.building) return 'buildings';
    if (t.landuse) return 'labels';
    return null;
  }

  // ---- rendering -------------------------------------------------------------
  function ensureGroups() {
    Object.keys(CATS).forEach(c => { if (!groups[c]) groups[c] = L.layerGroup(); });
  }
  function styleFor(cat) {
    const s = CATS[cat];
    return { pane, color: s.color, weight: s.weight, opacity, dashArray: s.dash || undefined,
             fill: !!s.fill, fillColor: s.color, fillOpacity: s.fill ? opacity * 0.25 : 0 };
  }
  function render(elements) {
    ensureGroups();
    Object.values(groups).forEach(g => g.clearLayers());
    const counts = { roads: 0, rail: 0, water: 0, buildings: 0, labels: 0 };
    elements.forEach(el => {
      const cat = categorize(el); if (!cat) return;
      counts[cat]++;
      if (el.type === 'way' && el.geometry) {
        const ll = el.geometry.map(p => [p.lat, p.lon]);
        const closed = el.tags && (el.tags.building || el.tags.landuse || el.tags.natural === 'water');
        const layer = closed ? L.polygon(ll, styleFor(cat)) : L.polyline(ll, styleFor(cat));
        const name = (el.tags && (el.tags.name || el.tags.highway || el.tags.railway || el.tags.waterway || el.tags.landuse || el.tags.building)) || cat;
        layer.bindTooltip(`${name} · PRELIMINAR`, { sticky: true });
        layer.addTo(groups[cat]);
      } else if (el.type === 'node' && el.lat != null) {
        const name = (el.tags && (el.tags.name || el.tags.amenity)) || 'amenity';
        L.circleMarker([el.lat, el.lon], { pane, radius: 4, color: CATS.labels.color, weight: 1, fillColor: CATS.labels.color, fillOpacity: opacity })
          .bindTooltip(`${name} · PRELIMINAR`, { direction: 'top' }).addTo(groups.labels);
      }
    });
    applyToggles();
    if (window.MapCalibration && window.MapCalibration.bringLotToFront) window.MapCalibration.bringLotToFront();
    return counts;
  }
  function applyToggles() {
    const onoff = { roads: 'ctxRoads', rail: 'ctxRail', water: 'ctxWater', buildings: 'ctxBuildings', labels: 'ctxLabels' };
    Object.entries(onoff).forEach(([cat, id]) => {
      const g = groups[cat]; if (!g) return;
      const show = $(id) ? $(id).checked : true;
      if (show) g.addTo(map); else map.removeLayer(g);
    });
  }
  function applyOpacity() {
    Object.keys(groups).forEach(cat => groups[cat].eachLayer(l => {
      if (l.setStyle) l.setStyle(styleFor(cat));
    }));
  }

  // ---- cache (client-side; server FS is read-only, esp. on Pages) ------------
  function saveCache() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ meta: lastMeta, elements: lastElements })); } catch (e) {}
  }
  function loadLocalCache() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { const o = JSON.parse(raw); if (o && Array.isArray(o.elements) && o.elements.length) return o; }
    } catch (e) {}
    return null;
  }
  function clearCache() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    lastElements = []; lastMeta = null;
    Object.values(groups).forEach(g => g.clearLayers());
    setStatus('Cache local limpiada. Contexto vacío.', 'ok'); banner(false);
  }

  // ---- fetch (manual, single, timeout) ---------------------------------------
  async function reloadContext() {
    if (inFlight) return;
    if (!window.MapCalibration || !window.MapCalibration.map) { setStatus('Mapa no listo todavía.', 'err'); return; }
    const centroid = window.MapCalibration.getCentroid();
    const r = radius();
    const q = buildQuery(centroid, r);
    inFlight = true; banner(false); setStatus('Consultando Overpass… (1 fetch, espera)', null);
    $('ctxReloadBtn').disabled = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const elements = Array.isArray(json.elements) ? json.elements : [];
      lastElements = elements;
      const counts = render(elements);
      lastMeta = { query: q, endpoint: ENDPOINT, centroid, radiusM: r, bbox: bbox(centroid, r), savedAt: new Date().toISOString(), counts, total: elements.length };
      saveCache();
      setStatus(`OK · ${elements.length} elementos · vías ${counts.roads} · rail ${counts.rail} · agua ${counts.water} · edif ${counts.buildings} · labels ${counts.labels}`, 'ok');
    } catch (err) {
      clearTimeout(timer);
      const cached = loadLocalCache();
      if (cached) {
        lastElements = cached.elements; lastMeta = cached.meta || lastMeta; render(lastElements);
        banner(true, 'Overpass no disponible — mostrando cache local (PRELIMINAR).');
        setStatus(`Overpass falló (${err.name === 'AbortError' ? 'timeout' : err.message}). Cache local en uso.`, 'err');
      } else {
        banner(true, 'Contexto OSM no disponible (sin red o Overpass falló). El mapa, el polígono y la calibración siguen intactos.');
        setStatus(`Sin contexto: ${err.name === 'AbortError' ? 'timeout' : err.message}. Sin cache disponible.`, 'err');
      }
    } finally {
      inFlight = false; $('ctxReloadBtn').disabled = false;
    }
  }

  // ---- export ----------------------------------------------------------------
  function exportContext() {
    const centroid = (window.MapCalibration && window.MapCalibration.getCentroid()) || (lastMeta && lastMeta.centroid) || null;
    const r = radius();
    const meta = lastMeta || (centroid ? { query: buildQuery(centroid, r), endpoint: ENDPOINT, centroid, radiusM: r, bbox: bbox(centroid, r), counts: { roads: 0, rail: 0, water: 0, buildings: 0, labels: 0 }, total: 0 } : null);
    const out = {
      schema: 'kairos.calibration-context/v1',
      status: 'PRELIMINAR — contexto OSM, no catastro / no topografía',
      generatedAt: new Date().toISOString(),
      source: { lot: '../../data/lot.json', osm: 'Overpass API · © OpenStreetMap contributors' },
      bbox: meta ? meta.bbox : null,
      centroid: centroid,
      radiusM: r,
      overpassEndpoint: ENDPOINT,
      overpassQuery: meta ? meta.query : null,
      featuresCount: meta ? meta.counts : null,
      featuresTotal: meta ? meta.total : 0,
      fetchedAt: meta ? meta.savedAt || null : null,
      warnings: [
        'PRELIMINAR — datos OSM de contexto, no constituyen catastro ni topografía.',
        'Overpass es un servicio público con rate limits; se consulta 1 vez por clic manual.',
        'En GitHub Pages el filesystem es read-only: el cache vive en localStorage del navegador y en este JSON descargable, no se escribe a disco.'
      ]
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'calibration-context-export.json'; a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- wiring ----------------------------------------------------------------
  function bind() {
    $('ctxReloadBtn').addEventListener('click', reloadContext);
    $('ctxClearBtn').addEventListener('click', clearCache);
    $('ctxExportBtn').addEventListener('click', exportContext);
    ['ctxRoads', 'ctxRail', 'ctxWater', 'ctxBuildings', 'ctxLabels'].forEach(id => $(id).addEventListener('change', applyToggles));
    $('ctxOpacity').addEventListener('input', e => { opacity = Number(e.target.value); $('ctxOpacityOut').textContent = opacity.toFixed(2); applyOpacity(); });
    $('ctxRadius').addEventListener('input', e => { $('ctxRadiusOut').textContent = `${e.target.value} m`; });
  }

  async function start() {
    map = window.MapCalibration.map;
    map.createPane(pane);
    map.getPane(pane).style.zIndex = 350; // above tiles (200), below lot polygon (overlayPane 400)
    ensureGroups();
    bind();

    // Passive cache restore (NO network): localStorage first, then committed seed file.
    let restored = loadLocalCache();
    if (!restored) {
      try {
        const seed = await fetch(CACHE_SEED_URL).then(r => r.json());
        if (seed && Array.isArray(seed.elements) && seed.elements.length) restored = { meta: seed.meta || null, elements: seed.elements };
      } catch (e) { /* seed optional */ }
    }
    if (restored) {
      lastElements = restored.elements; lastMeta = restored.meta;
      const counts = render(lastElements);
      setStatus(`Cache local restaurado · ${lastElements.length} elementos (sin red).`, 'ok');
    } else {
      setStatus('Contexto no cargado. Pulsa “Cargar contexto” (1 consulta manual a Overpass).', null);
    }
  }

  if (window.MapCalibration && window.MapCalibration.map) start();
  else window.addEventListener('kairos:map-ready', start, { once: true });
})();
