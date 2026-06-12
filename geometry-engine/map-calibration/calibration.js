/* KAIROS PARADOR — Map Calibration Layer V1 (Leaflet + OpenStreetMap)
 * Overlays the data/lot.json polygon (WGS84) on an OSM base map for PRELIMINARY
 * visual alignment. lot.json is NOT modified. Leaflet is vendored locally so the
 * page shell works offline; only the OSM tiles require internet (graceful
 * degradation: without tiles the polygon, coordinates and export still work).
 * Nothing here is cadastre or survey — everything is PRELIMINAR. */
(() => {
  const LOT_URL = '../../data/lot.json';
  const CALIB_URL = '../../data/calibration/site-calibration.json';
  const DEG = Math.PI / 180;

  const $ = (id) => document.getElementById(id);
  const coordsBox = $('coordsBox');
  const offlineBanner = $('offlineBanner');

  // Leaflet looks here for its default marker images (we mostly use vector markers).
  if (window.L && L.Icon && L.Icon.Default) L.Icon.Default.imagePath = 'vendor/leaflet/images/';

  let map, osmLayer, lotPolygon, vertexGroup, centroidMarker;
  let lot = null, centroid = null, calibDoc = null, tilesFailed = false;

  const calib = { offsetLat: 0, offsetLon: 0, scale: 1, rotationDeg: 0 };
  const sliders = ['offsetLat', 'offsetLon', 'scale', 'rotationDeg'];

  // ---- geometry --------------------------------------------------------------
  function computeCentroid(poly) {
    const lon = poly.reduce((s, p) => s + p.lon, 0) / poly.length;
    const lat = poly.reduce((s, p) => s + p.lat, 0) / poly.length;
    return { lon, lat };
  }
  // p' = offset + R(rot)·scale·(p − centroid), equirectangular-aware (cos lat0).
  function transform(p) {
    const lat0 = centroid.lat, lon0 = centroid.lon, k = Math.cos(lat0 * DEG) || 1;
    let dx = (p.lon - lon0) * k, dy = (p.lat - lat0);
    dx *= calib.scale; dy *= calib.scale;
    const t = calib.rotationDeg * DEG, c = Math.cos(t), s = Math.sin(t);
    const rx = dx * c - dy * s, ry = dx * s + dy * c;
    return { id: p.id, lon: lon0 + rx / k + calib.offsetLon, lat: lat0 + ry + calib.offsetLat };
  }
  function transformedPolygon() { return lot.polygon.map(transform); }
  function latlngs(tp) { return tp.map(p => [p.lat, p.lon]); }
  function polyBounds(tp) {
    const lats = tp.map(p => p.lat), lons = tp.map(p => p.lon);
    return { south: Math.min(...lats), north: Math.max(...lats), west: Math.min(...lons), east: Math.max(...lons) };
  }

  // ---- rendering -------------------------------------------------------------
  function drawLot() {
    const tp = transformedPolygon();
    const ll = latlngs(tp);
    if (lotPolygon) lotPolygon.setLatLngs(ll);
    else lotPolygon = L.polygon(ll, { color: '#8fe5ff', weight: 2.5, fillColor: '#8fe5ff', fillOpacity: 0.08 }).addTo(map);

    if (vertexGroup) vertexGroup.clearLayers();
    else vertexGroup = L.layerGroup().addTo(map);
    tp.forEach(p => {
      L.circleMarker([p.lat, p.lon], { radius: 6, color: '#efa827', weight: 2, fillColor: '#efa827', fillOpacity: 0.9 })
        .bindTooltip(`${p.id} · ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`, { direction: 'top' })
        .addTo(vertexGroup);
    });
    const ct = transform(centroid);
    L.circleMarker([ct.lat, ct.lon], { radius: 5, color: '#7dffa8', weight: 2, fillColor: 'transparent' })
      .bindTooltip('centroide (PRELIMINAR)', { direction: 'top' }).addTo(vertexGroup);

    applyToggles();
    updateCoords();
  }
  function applyToggles() {
    const showLot = $('toggleLot').checked, showV = $('toggleVertices').checked;
    if (lotPolygon) { showLot ? lotPolygon.addTo(map) : map.removeLayer(lotPolygon); }
    if (vertexGroup) { showV ? vertexGroup.addTo(map) : map.removeLayer(vertexGroup); }
  }
  function updateCoords() {
    const tp = transformedPolygon(), b = polyBounds(tp), ct = transform(centroid);
    const c = map.getCenter(), z = map.getZoom();
    const rows = tp.map(p => `<code>${p.id}</code> ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`).join('<br>');
    coordsBox.innerHTML =
      `<h4>Coordenadas — PRELIMINAR</h4>` +
      `<b>Centro mapa:</b> ${c.lat.toFixed(6)}, ${c.lng.toFixed(6)} · z${z}<br>` +
      `<b>Centroide lote:</b> ${ct.lat.toFixed(6)}, ${ct.lon.toFixed(6)}<br>` +
      `<b>Bounds:</b> S ${b.south.toFixed(6)} · N ${b.north.toFixed(6)}<br>` +
      `<span style="margin-left:46px">W ${b.west.toFixed(6)} · E ${b.east.toFixed(6)}</span><br>` +
      `<b>Vértices:</b><br>${rows}`;
  }
  function fitToLot() {
    if (lotPolygon) map.fitBounds(lotPolygon.getBounds(), { padding: [40, 40], maxZoom: 19 });
  }

  // ---- base layers -----------------------------------------------------------
  function setBase(kind) {
    if (kind === 'osm') { if (!map.hasLayer(osmLayer)) osmLayer.addTo(map); }
    else { if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer); } // placeholder = styled dark context bg
  }

  // ---- export ----------------------------------------------------------------
  function exportCalibration() {
    const tp = transformedPolygon(), b = polyBounds(tp), ct = transform(centroid);
    const c = map.getCenter();
    const out = {
      schema: 'kairos.site-calibration/v1',
      status: 'PRELIMINAR — no catastro / no topografía / no georreferenciación oficial',
      generatedAt: new Date().toISOString(),
      source: { lot: LOT_URL, crs: 'EPSG:4326 (WGS84, lon/lat)', note: 'lot.json no se modifica; la calibración es un ajuste manual preliminar.' },
      map: { center: { lat: c.lat, lon: c.lng }, zoom: map.getZoom(), base: $('baseLayer').value, tilesLoaded: !tilesFailed },
      lotCentroid: { lat: ct.lat, lon: ct.lon },
      polygonBounds: { south: b.south, west: b.west, north: b.north, east: b.east },
      calibration: { offsetLat: calib.offsetLat, offsetLon: calib.offsetLon, scale: calib.scale, rotationDeg: calib.rotationDeg, pivot: 'centroide del polígono lot.json', model: "p' = offset + R(rot)·scale·(p − centroide); equirectangular aprox. (cos lat0)" },
      polygon: tp.map(p => ({ id: p.id, lon: p.lon, lat: p.lat })),
      warnings: [
        'PRELIMINAR — el georreferenciado del KML no está verificado.',
        'La transformación de calibración es un nudge manual del usuario, no catastro ni topografía.',
        'Los tiles de OpenStreetMap son contexto visual; su alineación no constituye norma.'
      ]
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'calibration-export.json'; a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- controls --------------------------------------------------------------
  function syncOutputs() {
    $('offsetLatOut').textContent = `${calib.offsetLat.toFixed(6)}°`;
    $('offsetLonOut').textContent = `${calib.offsetLon.toFixed(6)}°`;
    $('scaleOut').textContent = calib.scale.toFixed(3);
    $('rotationDegOut').textContent = `${calib.rotationDeg.toFixed(1)}°`;
  }
  function bindControls() {
    sliders.forEach(id => $(id).addEventListener('input', e => {
      calib[id] = Number(e.target.value); syncOutputs(); drawLot();
    }));
    $('toggleLot').addEventListener('change', applyToggles);
    $('toggleVertices').addEventListener('change', applyToggles);
    $('baseLayer').addEventListener('change', e => setBase(e.target.value));
    $('resetBtn').addEventListener('click', fitToLot);
    $('resetCalibBtn').addEventListener('click', () => {
      calib.offsetLat = 0; calib.offsetLon = 0; calib.scale = 1; calib.rotationDeg = 0;
      sliders.forEach(id => $(id).value = calib[id]); syncOutputs(); drawLot();
    });
    $('exportBtn').addEventListener('click', exportCalibration);
  }

  // ---- init ------------------------------------------------------------------
  async function init() {
    const view = { center: [3.731563875059279, -76.32355543313126], zoom: 18 };
    try {
      calibDoc = await fetch(CALIB_URL).then(r => r.json());
      if (calibDoc.view && calibDoc.view.center) view.center = [calibDoc.view.center.lat, calibDoc.view.center.lon];
      if (calibDoc.view && calibDoc.view.zoom) view.zoom = calibDoc.view.zoom;
      if (calibDoc.calibration) {
        ['offsetLat', 'offsetLon', 'scale', 'rotationDeg'].forEach(k => {
          if (typeof calibDoc.calibration[k] === 'number') { calib[k] = calibDoc.calibration[k]; const el = $(k); if (el) el.value = calib[k]; }
        });
      }
    } catch (e) { /* calibration file optional — fall back to defaults */ }

    map = L.map('map', { zoomControl: true, attributionControl: true }).setView(view.center, view.zoom);
    osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap contributors · contexto PRELIMINAR'
    });
    osmLayer.on('tileerror', () => { tilesFailed = true; offlineBanner.classList.add('show'); });
    osmLayer.on('load', () => { if (!tilesFailed) offlineBanner.classList.remove('show'); });
    setBase($('baseLayer').value);

    map.on('move zoom', updateCoords);
    syncOutputs(); bindControls();

    lot = await fetch(LOT_URL).then(r => r.json());
    centroid = computeCentroid(lot.polygon);
    drawLot();

    // Additive, read-only handle so the optional OSM Context layer can share this
    // map. Does not alter calibration behaviour; context draws in its own pane.
    window.MapCalibration = {
      map,
      getCentroid: () => ({ lon: centroid.lon, lat: centroid.lat }),
      getCalib: () => ({ ...calib }),
      bringLotToFront: () => { if (lotPolygon) lotPolygon.bringToFront(); if (vertexGroup) vertexGroup.bringToFront(); }
    };
    window.dispatchEvent(new CustomEvent('kairos:map-ready'));
  }

  init().catch(err => { coordsBox.innerHTML = `<h4>Error</h4>${err.message}`; });
})();
