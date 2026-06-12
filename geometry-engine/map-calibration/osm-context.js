/* KAIROS PARADOR — Context Infrastructure Layer V1 (OSM / Overpass)
 * OPTIONAL contextual enrichment for the Map Calibration page. Draws REAL nearby
 * infrastructure (highways, railways, waterways, buildings, landuse, amenities)
 * fetched client-side from the public Overpass API around the lot centroid.
 *
 * Rules honoured: no backend, no Google APIs, no billing, no scraping loops, no
 * simulations. ONE MANUAL fetch per click (no auto-fetch on load, no polling),
 * defensive timeout.
 *
 * CACHE MODEL (GitHub Pages has a READ-ONLY filesystem — nothing is written to the
 * repo at runtime):
 *   • runtime cache  = browser localStorage, key `kairos.osmContext.v1`
 *     { timestamp, bbox, centroid, radius, featureCounts, geojson }
 *   • static seed    = data/osm/osm-context-seed.json (versioned fallback, never
 *     overwritten by the app)
 *   • export         = manual download of the generated JSON (no repo write)
 *   • fallback chain on Overpass failure: localStorage → seed → banner (map intact)
 *
 * Everything is PRELIMINAR — OSM context, not cadastre or survey.
 * Data © OpenStreetMap contributors. */
(() => {
  const ENDPOINT = 'https://overpass-api.de/api/interpreter';
  const SEED_URL = '../../data/osm/osm-context-seed.json';
  const LS_KEY = 'kairos.osmContext.v1';
  const TIMEOUT_MS = 25000;

  const $ = (id) => document.getElementById(id);

  const CATS = {
    roads:     { color: '#9fd0ff', weight: 2,   dash: null },
    rail:      { color: '#ffd36b', weight: 2,   dash: '8 6' },
    water:     { color: '#5aa0d6', weight: 2.5, dash: null },
    buildings: { color: '#b9c6d6', weight: 1,   dash: null, fill: true },
    labels:    { color: '#7dffa8', weight: 1,   dash: '2 6', fill: true }
  };

  let map = null; const pane = 'ctxPane';
  const groups = {};
  let lastGeojson = null;            // currently rendered FeatureCollection
  let lastMeta = null;               // { timestamp, bbox, centroid, radius, featureCounts }
  let opacity = 0.8;
  let inFlight = false;

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

  // ---- Overpass elements → GeoJSON FeatureCollection -------------------------
  function elementsToGeojson(elements) {
    const features = [];
    elements.forEach(el => {
      const cat = categorize(el); if (!cat) return;
      const t = el.tags || {};
      const name = t.name || t.highway || t.railway || t.waterway || t.landuse || t.building || t.amenity || cat;
      let geometry = null;
      if (el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length) {
        const coords = el.geometry.map(p => [p.lon, p.lat]); // GeoJSON = [lon,lat]
        const closed = !!(t.building || t.landuse || t.natural === 'water');
        geometry = closed ? { type: 'Polygon', coordinates: [coords] } : { type: 'LineString', coordinates: coords };
      } else if (el.type === 'node' && el.lon != null) {
        geometry = { type: 'Point', coordinates: [el.lon, el.lat] };
      }
      if (!geometry) return;
      features.push({ type: 'Feature', properties: { category: cat, osmType: el.type, id: el.id, name, tags: t }, geometry });
    });
    return { type: 'FeatureCollection', features };
  }
  function countFeatures(geojson) {
    const c = { roads: 0, rail: 0, water: 0, buildings: 0, labels: 0 };
    (geojson.features || []).forEach(f => { const k = f.properties && f.properties.category; if (k && k in c) c[k]++; });
    return c;
  }

  // ---- rendering -------------------------------------------------------------
  function ensureGroups() { Object.keys(CATS).forEach(c => { if (!groups[c]) groups[c] = L.layerGroup(); }); }
  function styleFor(cat) {
    const s = CATS[cat];
    return { pane, color: s.color, weight: s.weight, opacity, dashArray: s.dash || undefined,
             fill: !!s.fill, fillColor: s.color, fillOpacity: s.fill ? opacity * 0.25 : 0 };
  }
  function render(geojson) {
    ensureGroups();
    Object.values(groups).forEach(g => g.clearLayers());
    (geojson.features || []).forEach(f => {
      const cat = f.properties && f.properties.category; if (!cat || !groups[cat]) return;
      const g = f.geometry, name = (f.properties && f.properties.name) || cat;
      if (g.type === 'Point') {
        const [lon, lat] = g.coordinates;
        L.circleMarker([lat, lon], { pane, radius: 4, color: CATS.labels.color, weight: 1, fillColor: CATS.labels.color, fillOpacity: opacity })
          .bindTooltip(`${name} · PRELIMINAR`, { direction: 'top' }).addTo(groups.labels);
      } else if (g.type === 'LineString') {
        L.polyline(g.coordinates.map(c => [c[1], c[0]]), styleFor(cat)).bindTooltip(`${name} · PRELIMINAR`, { sticky: true }).addTo(groups[cat]);
      } else if (g.type === 'Polygon') {
        L.polygon(g.coordinates[0].map(c => [c[1], c[0]]), styleFor(cat)).bindTooltip(`${name} · PRELIMINAR`, { sticky: true }).addTo(groups[cat]);
      }
    });
    applyToggles();
    if (window.MapCalibration && window.MapCalibration.bringLotToFront) window.MapCalibration.bringLotToFront();
  }
  function applyToggles() {
    const onoff = { roads: 'ctxRoads', rail: 'ctxRail', water: 'ctxWater', buildings: 'ctxBuildings', labels: 'ctxLabels' };
    Object.entries(onoff).forEach(([cat, id]) => {
      const grp = groups[cat]; if (!grp) return;
      const show = $(id) ? $(id).checked : true;
      if (show) grp.addTo(map); else map.removeLayer(grp);
    });
  }
  function applyOpacity() {
    Object.keys(groups).forEach(cat => groups[cat].eachLayer(l => { if (l.setStyle) l.setStyle(styleFor(cat)); }));
  }

  // ---- cache: browser localStorage ONLY (Pages FS is read-only) --------------
  function buildCacheObj(geojson, centroid, r) {
    return { timestamp: new Date().toISOString(), bbox: bbox(centroid, r), centroid, radius: r,
             featureCounts: countFeatures(geojson), geojson };
  }
  function saveCache(obj) { try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch (e) {} }
  function loadLocalCache() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { const o = JSON.parse(raw); if (o && o.geojson && Array.isArray(o.geojson.features) && o.geojson.features.length) return o; }
    } catch (e) {}
    return null;
  }
  async function loadSeed() {
    try {
      const o = await fetch(SEED_URL).then(r => r.json());
      if (o && o.geojson && Array.isArray(o.geojson.features) && o.geojson.features.length) return o;
    } catch (e) {}
    return null;
  }
  function clearCache() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}  // clears ONLY localStorage
    lastGeojson = null; lastMeta = null;
    ensureGroups(); Object.values(groups).forEach(g => g.clearLayers());
    banner(false); setStatus('Cache local (localStorage) limpiada. Contexto vacío.', 'ok');
  }

  function adopt(cacheObj, sourceLabel) {
    lastGeojson = cacheObj.geojson;
    lastMeta = { timestamp: cacheObj.timestamp, bbox: cacheObj.bbox, centroid: cacheObj.centroid, radius: cacheObj.radius, featureCounts: cacheObj.featureCounts };
    render(lastGeojson);
    const c = cacheObj.featureCounts || countFeatures(lastGeojson);
    setStatus(`${sourceLabel} · ${lastGeojson.features.length} features · vías ${c.roads} · rail ${c.rail} · agua ${c.water} · edif ${c.buildings} · labels ${c.labels}`, 'ok');
  }

  // ---- fetch (manual, single, timeout) ---------------------------------------
  async function reloadContext() {
    if (inFlight) return;
    if (!window.MapCalibration || !window.MapCalibration.map) { setStatus('Mapa no listo todavía.', 'err'); return; }
    const centroid = window.MapCalibration.getCentroid();
    const r = radius();
    const q = buildQuery(centroid, r);
    inFlight = true; banner(false); setStatus('Consultando Overpass… (1 fetch manual, espera)', null);
    $('ctxReloadBtn').disabled = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const geojson = elementsToGeojson(Array.isArray(json.elements) ? json.elements : []);
      const obj = buildCacheObj(geojson, centroid, r);
      obj.overpassQuery = q; obj.overpassEndpoint = ENDPOINT;
      saveCache(obj);
      adopt(obj, 'OK (Overpass)');
    } catch (err) {
      clearTimeout(timer);
      const msg = err.name === 'AbortError' ? 'timeout' : err.message;
      // Fallback chain: localStorage → seed → banner
      const cached = loadLocalCache();
      if (cached) { adopt(cached, 'Cache local (Overpass falló)'); banner(true, `Overpass no disponible (${msg}) — mostrando cache de localStorage (PRELIMINAR).`); }
      else {
        const seed = await loadSeed();
        if (seed) { adopt(seed, 'Seed estático (Overpass falló)'); banner(true, `Overpass no disponible (${msg}) — mostrando seed estático (PRELIMINAR).`); }
        else { banner(true, 'Contexto OSM no disponible (sin red o Overpass falló). Mapa, polígono y calibración siguen intactos.'); setStatus(`Sin contexto: ${msg}. Sin cache ni seed.`, 'err'); }
      }
    } finally { inFlight = false; $('ctxReloadBtn').disabled = false; }
  }

  // ---- export (manual download; never writes to the repo) --------------------
  function exportContext() {
    const centroid = (window.MapCalibration && window.MapCalibration.getCentroid()) || (lastMeta && lastMeta.centroid) || null;
    const r = radius();
    const geojson = lastGeojson || { type: 'FeatureCollection', features: [] };
    const counts = lastMeta ? lastMeta.featureCounts : countFeatures(geojson);
    const out = {
      schema: 'kairos.calibration-context/v1',
      status: 'PRELIMINAR — contexto OSM, no catastro / no topografía',
      generatedAt: new Date().toISOString(),
      source: { lot: '../../data/lot.json', osm: 'Overpass API · © OpenStreetMap contributors' },
      bbox: lastMeta ? lastMeta.bbox : (centroid ? bbox(centroid, r) : null),
      centroid,
      radius: r,
      overpassEndpoint: ENDPOINT,
      overpassQuery: centroid ? buildQuery(centroid, r) : null,
      timestamp: lastMeta ? lastMeta.timestamp : null,
      featureCounts: counts,
      featuresTotal: geojson.features.length,
      geojson,
      warnings: [
        'PRELIMINAR — datos OSM de contexto, no constituyen catastro ni topografía.',
        'Overpass es un servicio público con rate limits; se consulta 1 vez por clic manual.',
        'GitHub Pages es read-only: el cache vive en localStorage del navegador; este archivo es una descarga manual, no se escribe al repo.'
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
    // Passive restore (NO network to Overpass): localStorage → static seed.
    const cached = loadLocalCache();
    if (cached) { adopt(cached, 'Cache local restaurado (sin red)'); }
    else {
      const seed = await loadSeed();
      if (seed) { adopt(seed, 'Seed estático cargado (sin red)'); }
      else { setStatus('Contexto no cargado. Pulsa “Cargar contexto” (1 consulta manual a Overpass).', null); }
    }
  }

  if (window.MapCalibration && window.MapCalibration.map) start();
  else window.addEventListener('kairos:map-ready', start, { once: true });
})();
