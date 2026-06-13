/* KAIROS PARADOR — Conceptual Spatial 3D Layer V1 / app.js
 *
 * LIGHT conceptual 3D that REUSES the existing spatial data (vendorized terrain,
 * editable polygons, zones, container layout, vegetation, camera anchors). It does
 * NOT invent a new terrain or an incongruent maquette.
 *
 * Three.js is VENDORIZED locally (./vendor/three/three.module.min.js, r160) — no CDN,
 * no runtime external dependency, no API key. Orbit controls are a small custom
 * implementation (avoids the examples/jsm bare-specifier import).
 *
 * Reads (relative, offline-safe once built): data/terrain/*, data/spatial/*,
 * data/layout/container-layout.json, data/calibration/layout-polygons.seed.json.
 *
 * ⚠️ Modelo 3D conceptual basado en elevación aproximada. No sustituye topografía,
 * estudios de suelos, ingeniería, arquitectura, licencias ni validación legal/catastral. */
import * as THREE from './vendor/three/three.module.min.js';

const $ = (id) => document.getElementById(id);
const DATA = '../data/';
const TYPE_COLOR = {
  cafe: 0xe7b15a, cocina: 0xe8a25c, bar: 0x8fe5ff, banos: 0x9fb0b8, retail: 0x5fc08a,
  lounge: 0xb07a4a, service: 0x94b8b2, storage: 0xbfb9a6, rooftop: 0xb07a4a, deck: 0x67c994, pabellon: 0xb07a4a
};
const ACT_COLOR = { preserve: 0x3f8f63, evaluate: 0xe7b15a, remove: 0xe0795a };

// ---- WebGL guard ----------------------------------------------------------
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
  catch (e) { return false; }
}

const state = {
  renderer: null, scene: null, camera: null, controls: null, container: null,
  groups: {}, data: {}, exaggeration: 6, buildingScale: 3,
  center: { lat: 3.731563875, lon: -76.32355543 }, mPerLat: 111320, mPerLon: 111320,
  bbox: null, terrainPts: [], anchors: [], constraints: []
};

function world(lat, lon, y) {
  return new THREE.Vector3((lon - state.center.lon) * state.mPerLon, y || 0, -(lat - state.center.lat) * state.mPerLat);
}

// bilinear-ish terrain height sample (nearest-grid fallback)
function terrainHeight(lat, lon) {
  if (!state.terrainPts.length) return 0;
  let best = state.terrainPts[0], bd = Infinity;
  for (const p of state.terrainPts) { const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2; if (d < bd) { bd = d; best = p; } }
  return best._y;
}

// ---- custom orbit controls (compact) --------------------------------------
function makeControls(camera, dom, target) {
  const c = { target: target.clone(), radius: 180, theta: Math.PI * 0.78, phi: Math.PI * 0.36, min: 30, max: 900, dragging: null };
  function apply() {
    c.phi = Math.max(0.12, Math.min(Math.PI / 2 - 0.02, c.phi));
    c.radius = Math.max(c.min, Math.min(c.max, c.radius));
    camera.position.set(
      c.target.x + c.radius * Math.sin(c.phi) * Math.cos(c.theta),
      c.target.y + c.radius * Math.cos(c.phi),
      c.target.z + c.radius * Math.sin(c.phi) * Math.sin(c.theta));
    camera.lookAt(c.target);
  }
  const pt = (e) => ({ x: e.clientX, y: e.clientY });
  dom.addEventListener('pointerdown', (e) => { c.dragging = { ...pt(e), pan: e.button === 2 || e.shiftKey, t: c.target.clone(), th: c.theta, ph: c.phi }; dom.setPointerCapture(e.pointerId); });
  dom.addEventListener('pointermove', (e) => {
    if (!c.dragging) return; const p = pt(e), dx = p.x - c.dragging.x, dy = p.y - c.dragging.y;
    if (c.dragging.pan) {
      const s = c.radius * 0.0016;
      const right = new THREE.Vector3(Math.sin(c.theta - Math.PI / 2), 0, -Math.cos(c.theta - Math.PI / 2));
      const fwd = new THREE.Vector3(Math.cos(c.theta), 0, Math.sin(c.theta));
      c.target.copy(c.dragging.t).addScaledVector(right, -dx * s).addScaledVector(fwd, -dy * s);
    } else { c.theta = c.dragging.th + dx * 0.005; c.phi = c.dragging.ph - dy * 0.005; }
    apply(); render();
  });
  const end = () => { c.dragging = null; };
  dom.addEventListener('pointerup', end); dom.addEventListener('pointercancel', end);
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('wheel', (e) => { e.preventDefault(); c.radius *= (e.deltaY > 0 ? 1.1 : 0.9); apply(); render(); }, { passive: false });
  c.set = (pos, tgt) => { c.target.copy(tgt); const d = pos.clone().sub(tgt); c.radius = d.length(); c.theta = Math.atan2(d.z, d.x); c.phi = Math.acos(Math.max(-1, Math.min(1, d.y / c.radius))); apply(); render(); };
  c.apply = apply; apply(); return c;
}

// Render synchronously on demand (small scene; avoids rAF throttling in
// background/headless tabs leaving a blank framebuffer).
function render() { if (state.renderer && state.scene && state.camera) state.renderer.render(state.scene, state.camera); }

// ---- build scene ----------------------------------------------------------
function buildTerrain() {
  const t = state.data.terrain; if (!t) return;
  state.bbox = t.bbox; state.center = t.reference.lotCentroid;
  state.mPerLon = 111320 * Math.cos(state.center.lat * Math.PI / 180);
  const { rows, cols } = t.grid, min = t.stats.min;
  const slope = state.data.slope ? state.data.slope.cells : null;
  const SLOPE_C = { low: new THREE.Color(0x2f6f4f), moderate: new THREE.Color(0x6b5a2f), steep: new THREE.Color(0x6b3a2f) };
  const verts = [], colors = [], idx = [];
  const at = (r, c) => t.points.find(p => p.r === r && p.c === c);
  const map = {};
  t.points.forEach((p, i) => {
    const y = (p.elev - min) * state.exaggeration;
    const w = world(p.lat, p.lon, y); p._y = y;
    map[`${p.r}_${p.c}`] = verts.length / 3;
    verts.push(w.x, w.y, w.z);
    const base = new THREE.Color(0x0e3b30);
    if (slope && slope[i]) base.lerp(SLOPE_C[slope[i].class] || base, 0.5);
    colors.push(base.r, base.g, base.b);
  });
  state.terrainPts = t.points;
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = map[`${r}_${c}`], b = map[`${r}_${c + 1}`], d = map[`${r + 1}_${c}`], e = map[`${r + 1}_${c + 1}`];
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, flatShading: false });
  const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true;
  state.groups.terrain = new THREE.Group(); state.groups.terrain.add(mesh); state.scene.add(state.groups.terrain);
  // subtle wireframe contour feeling
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(g), new THREE.LineBasicMaterial({ color: 0x8fe5ff, transparent: true, opacity: 0.06 }));
  state.groups.terrain.add(wire);
}

function rebuildTerrainHeights() {
  // re-apply exaggeration without rebuilding topology
  const t = state.data.terrain; if (!t || !state.groups.terrain) return;
  const mesh = state.groups.terrain.children[0]; const pos = mesh.geometry.attributes.position; const min = t.stats.min;
  const order = [];
  // reuse same vertex order as build
  const map = {}; let vi = 0; t.points.forEach(p => { map[`${p.r}_${p.c}`] = vi++; });
  t.points.forEach(p => { const i = map[`${p.r}_${p.c}`]; const y = (p.elev - min) * state.exaggeration; p._y = y; pos.setY(i, y); });
  pos.needsUpdate = true; mesh.geometry.computeVertexNormals();
  // reposition containers/decks/trees on new heights
  ['containers', 'trees', 'zones'].forEach(k => { if (state.groups[k]) { state.scene.remove(state.groups[k]); } });
  buildContainers(); buildTrees(); buildZones(); applyToggles(); render();
}

function buildContainers() {
  const z = state.data.zones; if (!z) return;
  const g = new THREE.Group(); state.groups.containers = g; state.scene.add(g);
  state.constraints = [];
  const usable = state.data.polys && state.data.polys.usable_area_polygon;
  const inPoly = (pt, ll) => { if (!ll) return true; let ins = false; const x = pt[1], y = pt[0];
    for (let i = 0, j = ll.length - 1; i < ll.length; j = i++) { const xi = ll[i][1], yi = ll[i][0], xj = ll[j][1], yj = ll[j][0];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; } return ins; };
  z.containers.forEach(m => {
    const inside = inPoly(m.anchor, usable);
    const baseY = terrainHeight(m.anchor[0], m.anchor[1]);
    const w = m.volume.w, d = m.volume.d, h = m.volume.h * state.buildingScale;
    const geo = new THREE.BoxGeometry(w, h, d);
    const col = TYPE_COLOR[m.type] || 0xcfe;
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0.05, emissive: inside ? 0x000000 : 0x3a0f08, transparent: true, opacity: 0.92 });
    const box = new THREE.Mesh(geo, mat); box.castShadow = true;
    const p = world(m.anchor[0], m.anchor[1], baseY + h / 2); box.position.copy(p);
    if (/NE|SW/.test(m.orientation)) box.rotation.y = -Math.PI / 8;
    box.userData = { id: m.id, phase: m.phase, type: m.type, inside };
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: inside ? 0xeaf6ff : 0xe0795a, transparent: true, opacity: 0.5 }));
    box.add(edges);
    g.add(box);
    // deck / pilotes under elevated landmarks & decks
    if (m.levels === 2 || m.ground_strategy === 'decks' || m.ground_strategy === 'pilotes') {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.4, d + 2), new THREE.MeshStandardMaterial({ color: 0x67c994, roughness: 0.8, transparent: true, opacity: 0.6 }));
      deck.position.copy(world(m.anchor[0], m.anchor[1], baseY + 0.2)); g.add(deck);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, baseY > 0 ? 2 : 2, 6), new THREE.MeshStandardMaterial({ color: 0x6b4a2f }));
        leg.position.copy(world(m.anchor[0], m.anchor[1], 1)).add(new THREE.Vector3(sx * w / 2, 0, sz * d / 2)); g.add(leg);
      }
    }
    state.constraints.push({ id: m.id, use: m.use, type: m.type, phase: m.phase, levels: m.levels, inside, status: inside ? 'ok' : 'violation' });
  });
  const viol = state.constraints.filter(c => !c.inside).length;
  if ($('vStatus')) $('vStatus').textContent = `${z.containers.length} volúmenes · ${viol} en conflicto (fuera del área utilizable) · conceptual`;
}

function buildTrees() {
  const v = state.data.veg; if (!v) return;
  const g = new THREE.Group(); state.groups.trees = g; state.scene.add(g);
  v.clusters.forEach(cl => {
    const color = ACT_COLOR[cl.action] || 0x3f8f63, n = Math.max(3, Math.round((cl.radius_m || 8) / 4));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2, rr = (cl.radius_m || 8) * (0.3 + 0.6 * ((i * 7) % 5) / 5);
      const dLat = (Math.cos(ang) * rr) / state.mPerLat, dLon = (Math.sin(ang) * rr) / state.mPerLon;
      const lat = cl.center[0] + dLat, lon = cl.center[1] + dLon, by = terrainHeight(lat, lon);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 5), new THREE.MeshStandardMaterial({ color: 0x6b4a2f }));
      trunk.position.copy(world(lat, lon, by + 1.5));
      const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: true, opacity: 0.9 }));
      crown.position.copy(world(lat, lon, by + 5)); crown.castShadow = true;
      g.add(trunk); g.add(crown);
    }
  });
}

function buildZones() {
  const z = state.data.zones; if (!z) return;
  const g = new THREE.Group(); state.groups.zones = g; state.scene.add(g);
  z.zones.forEach(zo => {
    const pts = zo.polygon.map(p => world(p[0], p[1], terrainHeight(p[0], p[1]) + 0.5));
    pts.push(pts[0].clone());
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(zo.color), transparent: true, opacity: 0.7 }));
    g.add(line);
  });
  // restricted zones (from layout polygons)
  const rz = state.data.polys && state.data.polys.restricted_zones;
  (rz || []).forEach(r => {
    const pts = r.polygon.map(p => world(p[0], p[1], terrainHeight(p[0], p[1]) + 0.6)); pts.push(pts[0].clone());
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xe0795a, dashSize: 3, gapSize: 2, transparent: true, opacity: 0.8 })).computeLineDistances());
  });
}

// ---- camera anchors / named views -----------------------------------------
function setupAnchors() {
  const z = state.data.zones; state.anchors = (z && z.camera_anchors) || [];
  const host = $('vCams'); if (!host) return;
  const views = [['top', 'Top'], ...state.anchors.map(a => [a.id, a.label])];
  host.innerHTML = views.map(([id, label]) => `<button class="vbtn" data-cam="${id}" type="button">${label}</button>`).join('');
  host.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => gotoView(b.dataset.cam)));
}
function gotoView(id) {
  const target = world(state.center.lat, state.center.lon, terrainHeight(state.center.lat, state.center.lon));
  if (id === 'top') { state.controls.set(target.clone().add(new THREE.Vector3(0.1, 320, 0.1)), target); return; }
  const a = state.anchors.find(x => x.id === id); if (!a) return;
  const eye = world(a.lat, a.lon, terrainHeight(a.lat, a.lon) + (a.height_m || 3) + 6);
  // look toward lot centroid for context
  state.controls.set(eye.clone().add(new THREE.Vector3(18, 14, 18)), target);
}

// ---- toggles / phases / exaggeration --------------------------------------
function applyToggles() {
  const show = (k, id) => { const g = state.groups[k]; const c = $(id); if (g) g.visible = c ? c.checked : true; };
  show('terrain', 'vTerrain'); show('containers', 'vContainers'); show('trees', 'vTrees'); show('zones', 'vZones');
  // phase filter on containers
  const ph = { F1: $('vF1'), F2: $('vF2'), F3: $('vF3') };
  if (state.groups.containers) state.groups.containers.children.forEach(o => {
    if (o.userData && o.userData.phase) { const c = ph[o.userData.phase]; o.visible = c ? c.checked : true; }
  });
  // restrictions = dashed lines inside zones group; toggle whole zones handles it; separate restrict toggle dims violations
  render();
}

// ---- exports ---------------------------------------------------------------
function exportScene() {
  const out = { schema: 'kairos.spatial-3d/v1', status: 'PRELIMINARY_CONCEPTUAL', exaggeration: state.exaggeration,
    buildingScale: state.buildingScale, center: state.center,
    containers: state.constraints, camera_anchors: state.anchors,
    disclaimer: 'Modelo 3D conceptual basado en elevación aproximada. No sustituye topografía, ingeniería, arquitectura ni validación legal/catastral.', conceptual_only: true };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = 'logos-parador-3d-scene.json'; a.click(); URL.revokeObjectURL(a.href);
}
function exportPng() {
  try { state.renderer.render(state.scene, state.camera);
    state.renderer.domElement.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'logos-parador-3d-snapshot.png'; a.click(); URL.revokeObjectURL(a.href); }, 'image/png');
  } catch (e) { exportScene(); }
}

// ---- boot ------------------------------------------------------------------
async function boot() {
  const host = $('vCanvas'); state.container = host;
  if (!webglOK()) { $('vFallback').style.display = 'grid'; host.style.display = 'none'; return; }

  const get = (u) => fetch(DATA + u).then(r => r.ok ? r.json() : null).catch(() => null);
  const [terrain, slope, zones, veg, mat, catalog, polys] = await Promise.all([
    get('terrain/terrain-profile.json'), get('terrain/slope-zones.json'), get('spatial/spatial-zones.json'),
    get('spatial/vegetation-strategy.json'), get('spatial/material-strategy.json'),
    get('layout/container-layout.json'), get('calibration/layout-polygons.seed.json')
  ]);
  state.data = { terrain, slope, zones, veg, mat, catalog, polys };
  if (!terrain || !zones) { $('vFallback').style.display = 'grid'; $('vFallback').querySelector('p').textContent = 'No se pudo cargar la data espacial (requiere el build externo).'; host.style.display = 'none'; return; }

  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x06141d);
  state.scene.fog = new THREE.Fog(0x06141d, 350, 900);
  const sz = () => ({ w: host.clientWidth || host.parentElement.clientWidth || 1180, h: host.clientHeight || 560 });
  const s0 = sz();
  state.camera = new THREE.PerspectiveCamera(50, s0.w / s0.h, 0.5, 4000);
  // Render INTO the existing #vCanvas (it is a <canvas>; do not append another).
  state.renderer = new THREE.WebGLRenderer({ canvas: host, antialias: true, preserveDrawingBuffer: true });
  state.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  state.renderer.setSize(s0.w, s0.h, false);
  state.renderer.shadowMap.enabled = true; state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // sunset lighting — warm low directional + soft hemisphere
  const hemi = new THREE.HemisphereLight(0xbfe0d8, 0x0a2b34, 0.7); state.scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffcf76, 1.1); sun.position.set(-220, 120, 140); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.near = 10; sun.shadow.camera.far = 800;
  sun.shadow.camera.left = -250; sun.shadow.camera.right = 250; sun.shadow.camera.top = 250; sun.shadow.camera.bottom = -250;
  state.scene.add(sun);
  state.scene.add(new THREE.AmbientLight(0x16545a, 0.4));

  buildTerrain(); buildContainers(); buildTrees(); buildZones(); setupAnchors();

  const target = world(state.center.lat, state.center.lon, terrainHeight(state.center.lat, state.center.lon));
  state.controls = makeControls(state.camera, state.renderer.domElement, target);
  state.controls.radius = 160; state.controls.theta = Math.PI * 0.8; state.controls.phi = Math.PI * 0.34; state.controls.apply();

  // UI
  ['vTerrain', 'vContainers', 'vTrees', 'vZones', 'vF1', 'vF2', 'vF3'].forEach(id => { const c = $(id); if (c) c.addEventListener('change', applyToggles); });
  const ex = $('vExag'); if (ex) ex.addEventListener('input', () => { state.exaggeration = +ex.value; $('vExagOut') && ($('vExagOut').textContent = ex.value + '×'); rebuildTerrainHeights(); });
  $('vReset') && $('vReset').addEventListener('click', () => gotoView('top'));
  $('vExportScene') && $('vExportScene').addEventListener('click', exportScene);
  $('vExportPng') && $('vExportPng').addEventListener('click', exportPng);
  const resize = () => {
    if (!state.renderer) return; const { w, h } = sz();
    state.camera.aspect = w / h; state.camera.updateProjectionMatrix(); state.renderer.setSize(w, h, false); render();
  };
  window.addEventListener('resize', resize);
  // correct the size once the element actually gets laid out (robust to vh quirks)
  if (window.ResizeObserver) { const ro = new ResizeObserver(resize); ro.observe(host); }
  applyToggles(); render();
  if ($('vStatus2')) $('vStatus2').textContent = `Three.js r${THREE.REVISION} (local) · terreno ${terrain.points.length} pts · ${zones.containers.length} volúmenes`;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
