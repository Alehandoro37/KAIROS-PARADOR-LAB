/* KAIROS PARADOR — Conceptual Spatial 3D Layer V1 / app.js  (Design Correction V1)
 *
 * LIGHT conceptual 3D that REUSES the existing spatial data (vendorized terrain,
 * editable polygons, zones, container layout, vegetation, camera anchors). It does
 * NOT invent a new terrain or an incongruent maquette.
 *
 * Three.js is VENDORIZED locally (./vendor/three/three.module.min.js, r160) — no CDN,
 * no runtime external dependency, no API key. Orbit controls are a small custom
 * implementation (avoids the examples/jsm bare-specifier import).
 *
 * Design Correction V1: realistic conceptual scale (real-metre heights, no "toy"
 * stretch), architectural container detail (base slab · dark-metal body · light roof ·
 * deck · access · discrete label), legible vegetation (preserve/evaluate/remove),
 * railway conflict shown as a TENSION TO VALIDATE (not a bug), camera anchors that each
 * communicate a design decision, simple conceptual materials, sober terrain
 * exaggeration (1×/3×/6×) with an elevation legend.
 *
 * ⚠️ Modelo 3D conceptual basado en elevación aproximada. No sustituye topografía,
 * estudios de suelos, ingeniería, arquitectura, licencias ni validación legal/catastral. */
import * as THREE from './vendor/three/three.module.min.js';

const $ = (id) => document.getElementById(id);
const DATA = '../data/';
// accent (roof / identity) colour by use
const USE_COLOR = {
  cafe: 0xe7b15a, cocina: 0xe8a25c, bar: 0x8fe5ff, banos: 0x9fb0b8, retail: 0x5fc08a,
  lounge: 0xb07a4a, service: 0x94b8b2, storage: 0xbfb9a6, rooftop: 0xb07a4a, deck: 0x67c994, pabellon: 0xb07a4a
};
// simple conceptual surface materials (no textures)
const MAT_COLOR = {
  'wood-deck': 0x8a5a36, 'permeable-pavers': 0x59707c, 'gravel-stabilized': 0x9c9279,
  'tropical-concrete': 0x8b9296, 'compacted-paths': 0xa98f63
};
const METAL = 0x2b333b;             // dark metal container body
const ACT_COLOR = { preserve: 0x3f8f63, evaluate: 0xe7b15a, remove: 0xe0795a };
const VIEW_NOTE = {
  top: 'Lectura en planta — relación lote · zonas · frente vial.',
  'cam-arrival': 'Llegada desde la Troncal: umbral, parqueo velado y primer plano de la plaza.',
  'cam-railway-sunset': 'Identidad férrea: deck al atardecer — tensión a validar (retiros/servidumbre).',
  'cam-plaza': 'Corazón social: plaza permeable, food y sombra.',
  'cam-lounge': 'Remate vertical: Railway Lounge Tower mirando el corredor.',
  'cam-wellness': 'Retiro tranquilo al norte — vegetación como buffer.'
};

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
  catch (e) { return false; }
}

const state = {
  renderer: null, scene: null, camera: null, controls: null, container: null,
  groups: {}, data: {}, exaggeration: 3, buildingScale: 1,   // sober defaults — real-metre heights
  center: { lat: 3.731563875, lon: -76.32355543 }, mPerLat: 111320, mPerLon: 111320,
  terrainPts: [], anchors: [], constraints: []
};

function world(lat, lon, y) {
  return new THREE.Vector3((lon - state.center.lon) * state.mPerLon, y || 0, -(lat - state.center.lat) * state.mPerLat);
}
function terrainHeight(lat, lon) {
  if (!state.terrainPts.length) return 0;
  let best = state.terrainPts[0], bd = Infinity;
  for (const p of state.terrainPts) { const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2; if (d < bd) { bd = d; best = p; } }
  return best._y;
}
const containerSize = (w) => (w <= 7 ? '≈20ft' : w >= 11 ? '≈40ft' : 'modular');

// discrete label sprite (canvas texture; no external asset)
function labelSprite(text, hex) {
  const pad = 14, fs = 30; const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = `600 ${fs}px ui-monospace, monospace`; const w = Math.ceil(g.measureText(text).width) + pad * 2;
  c.width = w; c.height = fs + pad * 2;
  g.font = `600 ${fs}px ui-monospace, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(4,16,28,0.72)'; const r = 10, W = c.width, H = c.height;
  g.beginPath(); g.moveTo(r, 0); g.arcTo(W, 0, W, H, r); g.arcTo(W, H, 0, H, r); g.arcTo(0, H, 0, 0, r); g.arcTo(0, 0, W, 0, r); g.fill();
  g.fillStyle = '#' + (hex || 0xeaf6ff).toString(16).padStart(6, '0'); g.fillText(text, W / 2, H / 2 + 1);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.set((W / H) * 4.2, 4.2, 1); return sp;
}

function makeControls(camera, dom, target) {
  const c = { target: target.clone(), radius: 110, theta: Math.PI * 0.78, phi: Math.PI * 0.40, min: 24, max: 700, dragging: null };
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

function render() { if (state.renderer && state.scene && state.camera) state.renderer.render(state.scene, state.camera); }

// ---- terrain --------------------------------------------------------------
function buildTerrain() {
  const t = state.data.terrain; if (!t) return;
  state.center = t.reference.lotCentroid;
  state.mPerLon = 111320 * Math.cos(state.center.lat * Math.PI / 180);
  const { rows, cols } = t.grid, min = t.stats.min;
  const slope = state.data.slope ? state.data.slope.cells : null;
  const SLOPE_C = { low: new THREE.Color(0x2f6f4f), moderate: new THREE.Color(0x6b5a2f), steep: new THREE.Color(0x6b3a2f) };
  const verts = [], colors = [], idx = [], map = {};
  t.points.forEach((p) => {
    const y = (p.elev - min) * state.exaggeration; const w = world(p.lat, p.lon, y); p._y = y;
    map[`${p.r}_${p.c}`] = verts.length / 3; verts.push(w.x, w.y, w.z);
    const base = new THREE.Color(0x103a30);
    if (slope) { const cell = slope.find(s => s.lat === p.lat && s.lon === p.lon); if (cell) base.lerp(SLOPE_C[cell.class] || base, 0.4); }
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
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 }));
  mesh.receiveShadow = true;
  state.groups.terrain = new THREE.Group(); state.groups.terrain.add(mesh); state.scene.add(state.groups.terrain);
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(g), new THREE.LineBasicMaterial({ color: 0x8fe5ff, transparent: true, opacity: 0.045 }));
  state.groups.terrain.add(wire);
  updateElevLegend();
}
function updateElevLegend() {
  const t = state.data.terrain; if (!t || !$('vElevLegend')) return;
  $('vElevLegend').textContent = `Elevación conceptual ~${t.stats.min}–${t.stats.max} m · exagerada ${state.exaggeration}× (aprox.)`;
}
function setExag(v) {
  state.exaggeration = v;
  document.querySelectorAll('[data-exag]').forEach(b => b.setAttribute('aria-pressed', (+b.getAttribute('data-exag') === v) ? 'true' : 'false'));
  const t = state.data.terrain; if (!t || !state.groups.terrain) return;
  const mesh = state.groups.terrain.children[0], pos = mesh.geometry.attributes.position, min = t.stats.min, map = {}; let vi = 0;
  t.points.forEach(p => { map[`${p.r}_${p.c}`] = vi++; });
  t.points.forEach(p => { const y = (p.elev - min) * v; p._y = y; pos.setY(map[`${p.r}_${p.c}`], y); });
  pos.needsUpdate = true; mesh.geometry.computeVertexNormals();
  ['containers', 'trees', 'zones', 'labels', 'conflicts'].forEach(k => { if (state.groups[k]) state.scene.remove(state.groups[k]); });
  buildContainers(); buildTrees(); buildZones(); updateElevLegend(); applyToggles(); render();
}

// ---- architectural containers ---------------------------------------------
function inPoly(pt, ll) { if (!ll) return true; let ins = false; const x = pt[1], y = pt[0];
  for (let i = 0, j = ll.length - 1; i < ll.length; j = i++) { const xi = ll[i][1], yi = ll[i][0], xj = ll[j][1], yj = ll[j][0];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; } return ins; }

function buildContainers() {
  const z = state.data.zones; if (!z) return;
  const g = new THREE.Group(); state.groups.containers = g; state.scene.add(g);
  const labels = new THREE.Group(); state.groups.labels = labels; state.scene.add(labels);
  const conflicts = new THREE.Group(); state.groups.conflicts = conflicts; state.scene.add(conflicts);
  state.constraints = [];
  const usable = state.data.polys && state.data.polys.usable_area_polygon;

  z.containers.forEach(m => {
    const inside = inPoly(m.anchor, usable);
    const baseY = terrainHeight(m.anchor[0], m.anchor[1]);
    const w = m.volume.w, d = m.volume.d, h = Math.max(2.6, m.volume.h * state.buildingScale); // real-metre conceptual height
    const accent = USE_COLOR[m.type] || 0xcfe;
    const matCol = MAT_COLOR[m.material] || 0x8b9296;
    const rot = /NE|SW/.test(m.orientation) ? -Math.PI / 8 : 0;
    const node = new THREE.Group(); node.position.copy(world(m.anchor[0], m.anchor[1], baseY)); node.rotation.y = rot;

    // base slab (material by ground strategy / surface)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 0.4, d + 1.6),
      new THREE.MeshStandardMaterial({ color: matCol, roughness: 0.9, metalness: 0.02 }));
    slab.position.y = 0.2; slab.receiveShadow = true; node.add(slab);

    // main volume — dark metal container body
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: METAL, roughness: 0.5, metalness: 0.55 }));
    body.position.y = 0.4 + h / 2; body.castShadow = true; node.add(body);
    body.add(new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({ color: 0x0a1822, transparent: true, opacity: 0.6 })));

    // light roof — thin overhang in the use colour (identity)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.3, d + 1),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6, metalness: 0.1, emissive: accent, emissiveIntensity: 0.06 }));
    roof.position.y = 0.4 + h + 0.15; node.add(roof);

    // front / access marker (toward south/-Z) — small accent post + threshold
    const door = new THREE.Mesh(new THREE.BoxGeometry(Math.min(2, w * 0.3), Math.min(2.1, h * 0.8), 0.25),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, metalness: 0.2 }));
    door.position.set(0, 0.4 + Math.min(2.1, h * 0.8) / 2, d / 2 + 0.15); node.add(door);

    // terrace deck for lounges / decks / 2-level landmarks
    if (m.levels === 2 || m.type === 'deck' || m.type === 'lounge' || m.ground_strategy === 'decks') {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(w + 3, 0.35, d + 3),
        new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.85 }));
      deck.position.set(0, 0.55, -(d / 2 + 1.6)); deck.receiveShadow = true; node.add(deck);
      // pilotes under the deck
      for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x5a3f28 }));
        leg.position.set(sx * (w / 2 + 1), -0.3, -(d / 2 + 1.6)); node.add(leg); }
    }

    node.userData = { id: m.id, phase: m.phase, type: m.type, inside };
    g.add(node);

    // discrete label
    const lab = labelSprite(`${m.use} · ${m.phase}${m.levels === 2 ? ' · L2' : ''}`, accent);
    lab.position.copy(world(m.anchor[0], m.anchor[1], baseY + 0.4 + h + 3)); lab.userData = { phase: m.phase };
    labels.add(lab);

    // conflict = TENSION TO VALIDATE (not a bug): ground ring + explicit label
    if (!inside) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(w, d) * 0.7, Math.max(w, d) * 0.9, 28),
        new THREE.MeshBasicMaterial({ color: 0xe0795a, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.copy(world(m.anchor[0], m.anchor[1], baseY + 0.5)); conflicts.add(ring);
      const cl = labelSprite('Validar retiro, servidumbre y permiso férreo', 0xf3c9bb);
      cl.position.copy(world(m.anchor[0], m.anchor[1], baseY + 0.4 + h + 7)); conflicts.add(cl);
    }
    state.constraints.push({ id: m.id, use: m.use, type: m.type, container: containerSize(w), phase: m.phase, levels: m.levels, inside, status: inside ? 'ok' : 'tension' });
  });

  const tension = state.constraints.filter(c => !c.inside).length;
  if ($('vStatus')) $('vStatus').textContent = `${z.containers.length} volúmenes · ${tension} tensión férrea a validar · conceptual`;
}

// ---- legible vegetation (preserve / evaluate / remove) --------------------
function buildTrees() {
  const v = state.data.veg; if (!v) return;
  const g = new THREE.Group(); state.groups.trees = g; state.scene.add(g);
  v.clusters.forEach(cl => {
    const color = ACT_COLOR[cl.action] || 0x3f8f63;
    const n = Math.max(2, Math.min(5, Math.round((cl.radius_m || 8) / 6)));   // fewer → less saturation
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + (cl.center[0] * 1000 % 1), rr = (cl.radius_m || 8) * (0.35 + 0.5 * ((i * 7) % 4) / 4);
      const lat = cl.center[0] + (Math.cos(ang) * rr) / state.mPerLat, lon = cl.center[1] + (Math.sin(ang) * rr) / state.mPerLon;
      const by = terrainHeight(lat, lon);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 3, 5), new THREE.MeshStandardMaterial({ color: 0x5a3f28 }));
      trunk.position.copy(world(lat, lon, by + 1.5)); g.add(trunk);
      if (cl.action === 'preserve') {                      // leafy shade canopy (structure)
        const c1 = new THREE.Mesh(new THREE.SphereGeometry(3.4, 8, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.95, transparent: true, opacity: 0.92 }));
        c1.position.copy(world(lat, lon, by + 5)); c1.castShadow = true; g.add(c1);
      } else if (cl.action === 'evaluate') {               // smaller, lighter — to verify
        const c2 = new THREE.Mesh(new THREE.ConeGeometry(2, 4.5, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: true, opacity: 0.8 }));
        c2.position.copy(world(lat, lon, by + 5)); g.add(c2);
      } else {                                             // remove-if-necessary — sparse + marker
        const c3 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.4, 5), new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: true, opacity: 0.55 }));
        c3.position.copy(world(lat, lon, by + 4.2)); g.add(c3);
      }
    }
  });
  // green corridors as shade structure on the ground
  (v.green_corridors || []).forEach(gc => {
    const pts = gc.line.map(p => world(p[0], p[1], terrainHeight(p[0], p[1]) + 0.4));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3f8f63, transparent: true, opacity: 0.5 })));
  });
}

function buildZones() {
  const z = state.data.zones; if (!z) return;
  const g = new THREE.Group(); state.groups.zones = g; state.scene.add(g);
  z.zones.forEach(zo => {
    const pts = zo.polygon.map(p => world(p[0], p[1], terrainHeight(p[0], p[1]) + 0.3)); pts.push(pts[0].clone());
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(zo.color), transparent: true, opacity: 0.65 })));
  });
  const rz = state.data.polys && state.data.polys.restricted_zones;
  (rz || []).forEach(r => {
    const pts = r.polygon.map(p => world(p[0], p[1], terrainHeight(p[0], p[1]) + 0.4)); pts.push(pts[0].clone());
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xe0795a, dashSize: 3, gapSize: 2, transparent: true, opacity: 0.8 })).computeLineDistances());
  });
}

// ---- camera anchors / decision views --------------------------------------
function setupAnchors() {
  state.anchors = (state.data.zones && state.data.zones.camera_anchors) || [];
  const host = $('vCams'); if (!host) return;
  const views = [['top', 'Top'], ...state.anchors.map(a => [a.id, a.label])];
  host.innerHTML = views.map(([id, label]) => `<button class="vbtn" data-cam="${id}" type="button">${label}</button>`).join('');
  host.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => gotoView(b.dataset.cam)));
}
const VIEW_OFFSET = {
  'cam-arrival': [10, 16, 46], 'cam-railway-sunset': [40, 26, 28], 'cam-plaza': [30, 40, 34],
  'cam-lounge': [-34, 30, 18], 'cam-wellness': [8, 22, -40]
};
function gotoView(id) {
  const note = $('vViewNote'); if (note) note.textContent = VIEW_NOTE[id] || '';
  const lotC = world(state.center.lat, state.center.lon, terrainHeight(state.center.lat, state.center.lon));
  if (id === 'top') { state.controls.set(lotC.clone().add(new THREE.Vector3(2, 240, 2)), lotC); return; }
  const a = state.anchors.find(x => x.id === id); if (!a) return;
  const subj = world(a.lat, a.lon, terrainHeight(a.lat, a.lon) + 2);     // frame the subject of the decision
  const off = VIEW_OFFSET[id] || [24, 22, 24];
  state.controls.set(subj.clone().add(new THREE.Vector3(off[0], off[1], off[2])), subj);
}

// ---- toggles --------------------------------------------------------------
function applyToggles() {
  const show = (k, id) => { const g = state.groups[k]; const c = $(id); if (g) g.visible = c ? c.checked : true; };
  show('terrain', 'vTerrain'); show('containers', 'vContainers'); show('trees', 'vTrees');
  show('zones', 'vZones'); show('labels', 'vLabels'); show('conflicts', 'vConflicts');
  const ph = { F1: $('vF1'), F2: $('vF2'), F3: $('vF3') };
  const phaseOn = (p) => { const c = ph[p]; return c ? c.checked : true; };
  if (state.groups.containers) state.groups.containers.children.forEach(o => { if (o.userData && o.userData.phase) o.visible = phaseOn(o.userData.phase); });
  if (state.groups.labels) state.groups.labels.children.forEach(o => { if (o.userData && o.userData.phase) o.visible = (!$('vLabels') || $('vLabels').checked) && phaseOn(o.userData.phase); });
  render();
}

// ---- exports --------------------------------------------------------------
function exportScene() {
  const out = { schema: 'kairos.spatial-3d/v1', status: 'PRELIMINARY_CONCEPTUAL', exaggeration: state.exaggeration,
    buildingScale: state.buildingScale, center: state.center, containers: state.constraints, camera_anchors: state.anchors,
    disclaimer: 'Modelo 3D conceptual basado en elevación aproximada. No sustituye topografía, ingeniería, arquitectura ni validación legal/catastral.', conceptual_only: true };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = 'logos-parador-3d-scene.json'; a.click(); URL.revokeObjectURL(a.href);
}
function exportPng() {
  try { render(); state.renderer.domElement.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'logos-parador-3d-snapshot.png'; a.click(); URL.revokeObjectURL(a.href); }, 'image/png'); }
  catch (e) { exportScene(); }
}

// ---- boot -----------------------------------------------------------------
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
  state.scene.fog = new THREE.Fog(0x06141d, 260, 720);
  const sz = () => ({ w: host.clientWidth || host.parentElement.clientWidth || 1180, h: host.clientHeight || 560 });
  const s0 = sz();
  state.camera = new THREE.PerspectiveCamera(48, s0.w / s0.h, 0.5, 4000);
  state.renderer = new THREE.WebGLRenderer({ canvas: host, antialias: true, preserveDrawingBuffer: true });
  state.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  state.renderer.setSize(s0.w, s0.h, false);
  state.renderer.shadowMap.enabled = true; state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // sunset lighting
  state.scene.add(new THREE.HemisphereLight(0xbfe0d8, 0x0a2b34, 0.75));
  const sun = new THREE.DirectionalLight(0xffcf76, 1.15); sun.position.set(-180, 110, 120); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.near = 8; sun.shadow.camera.far = 600;
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160; sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  state.scene.add(sun); state.scene.add(new THREE.AmbientLight(0x16545a, 0.42));

  buildTerrain(); buildContainers(); buildTrees(); buildZones(); setupAnchors();

  const target = world(state.center.lat, state.center.lon, terrainHeight(state.center.lat, state.center.lon));
  state.controls = makeControls(state.camera, state.renderer.domElement, target);
  state.controls.radius = 100; state.controls.theta = Math.PI * 0.82; state.controls.phi = Math.PI * 0.40; state.controls.apply();

  ['vTerrain', 'vContainers', 'vTrees', 'vZones', 'vLabels', 'vConflicts', 'vF1', 'vF2', 'vF3'].forEach(id => { const c = $(id); if (c) c.addEventListener('change', applyToggles); });
  document.querySelectorAll('[data-exag]').forEach(b => b.addEventListener('click', () => setExag(+b.getAttribute('data-exag'))));
  $('vReset') && $('vReset').addEventListener('click', () => gotoView('top'));
  $('vExportScene') && $('vExportScene').addEventListener('click', exportScene);
  $('vExportPng') && $('vExportPng').addEventListener('click', exportPng);
  const resize = () => { if (!state.renderer) return; const { w, h } = sz(); state.camera.aspect = w / h; state.camera.updateProjectionMatrix(); state.renderer.setSize(w, h, false); render(); };
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(host);

  setExag(state.exaggeration); applyToggles(); render();
  if ($('vStatus2')) $('vStatus2').textContent = `Three.js r${THREE.REVISION} (local) · terreno ${terrain.points.length} pts · ${zones.containers.length} volúmenes · escala conceptual`;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
