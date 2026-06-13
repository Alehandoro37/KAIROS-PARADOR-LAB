#!/usr/bin/env node
/* KAIROS PARADOR — Firebase Hosting Dry Run V1 / validate:external
 *
 * SAFETY validator for the external landing build (build/external/landing/logos-parador).
 * It does NOT deploy and does NOT touch Firebase — it only inspects the generated
 * tree and exits non-zero if anything is wrong, so a human can publish with confidence.
 *
 * Checks: build exists · route dirs exist · critical files exist · redirect pages
 * exist with the expected targets · data/lot.json · vendored Leaflet · all masterplan
 * modules · no dangerous absolute paths · no localhost · no file:// · no Google API
 * keys · no embedded `firebase deploy`. Run AFTER `npm run build:external`. */

import { existsSync, statSync, readdirSync, readFileSync } from 'fs';
import { join, dirname, extname, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(ROOT, 'build', 'external', 'landing', 'logos-parador');
const oks = [], errors = [];
const ok = (m) => oks.push(m);
const fail = (m) => errors.push(m);

function done() {
  console.log('— validate:external —');
  oks.forEach(m => console.log('  ✓ ' + m));
  if (errors.length) { console.log(''); errors.forEach(m => console.error('  ✗ ' + m)); console.error(`\nFAIL: ${errors.length} problem(s)`); process.exit(1); }
  console.log(`\nPASS: ${oks.length} checks ok`); process.exit(0);
}

if (!existsSync(BASE)) { console.error(`✗ build missing — run \`npm run build:external\` first (${relative(ROOT, BASE)})`); process.exit(1); }
ok('build root exists: ' + relative(ROOT, BASE));

// route directories
['.', 'masterplan', 'map', 'journey', 'technical-roadmap', 'layout-map', 'web', 'geometry-engine', 'data'].forEach(d => {
  const p = join(BASE, d);
  (existsSync(p) && statSync(p).isDirectory()) ? ok('route dir: ' + (d === '.' ? '(root)' : d)) : fail('missing route dir: ' + d);
});

// critical files
const required = [
  'index.html', 'masterplan/index.html', 'map/index.html', 'journey/index.html',
  'web/index.html', 'web/css/lab.css', 'web/js/main.js',
  'geometry-engine/masterplan/index.html', 'geometry-engine/masterplan/masterplan.js',
  'geometry-engine/masterplan/masterplan-data.js', 'geometry-engine/masterplan/masterplan-export.js',
  'geometry-engine/masterplan/bezier-path-utils.js', 'geometry-engine/masterplan/landscape-symbols.js',
  'geometry-engine/masterplan/atmosphere-renderer.js', 'geometry-engine/masterplan/composition-grid.js',
  'geometry-engine/masterplan/camera-utils.js',
  'geometry-engine/map-calibration/index.html', 'geometry-engine/map-calibration/calibration.js',
  'geometry-engine/map-calibration/osm-context.js',
  'geometry-engine/map-calibration/vendor/leaflet/leaflet.js', 'geometry-engine/map-calibration/vendor/leaflet/leaflet.css',
  'data/lot.json', 'data/osm/osm-context-seed.json', 'data/calibration/site-calibration.json', 'data/costs.json',
  // favicons (avoid favicon 404 on the public pages)
  'favicon.svg', 'geometry-engine/masterplan/favicon.svg', 'geometry-engine/map-calibration/favicon.svg',
  // vendored brand logo (no hotlink to the tokenized Firebase URL)
  'assets/logo.jpg', 'geometry-engine/masterplan/assets/logo.jpg', 'geometry-engine/map-calibration/assets/logo.jpg',
  // Operational Intelligence Layer (investment route + conceptual business layer)
  'investment/index.html', 'web/js/investment-dashboard.js',
  'data/business/operational-model.json', 'data/business/phases.json', 'data/business/experience-economy.json',
  // Advanced Technical Roadmap (phased development guide + experience system CSS + versioned JSON)
  'technical-roadmap/index.html', 'web/css/experience-system.css', 'data/technical-development-roadmap.json',
  // Detailed Container Layout Map (architectural site-layout model + SVG renderer + versioned JSON)
  'layout-map/index.html', 'web/js/layout-map.js', 'data/layout/container-layout.json',
  // Map-Based Layout Calibration (editable polygons module + geo seed, on Map Calibration)
  'geometry-engine/map-calibration/layout-editor.js', 'data/calibration/layout-polygons.seed.json',
  // Terrain Intelligence + Spatial Constraint Engine (module + vendorized terrain + spatial data)
  'geometry-engine/map-calibration/terrain-spatial.js',
  'data/terrain/terrain-profile.json', 'data/terrain/slope-zones.json',
  'data/spatial/spatial-zones.json', 'data/spatial/vegetation-strategy.json', 'data/spatial/material-strategy.json'
];
required.forEach(f => existsSync(join(BASE, f)) ? ok('file: ' + f) : fail('missing file: ' + f));

// CORE present in the build (packaging-only — these are NOT modified by the build/refinement)
['geometry-engine/v2', 'data/lot.json', 'geometry-engine/map-calibration/calibration.js'].forEach(c => {
  existsSync(join(BASE, c)) ? ok('core present (untouched): ' + c) : fail('core missing from build: ' + c);
});

// head polish (favicon link + meta description) on the public pages
[
  ['index.html', 'landing'],
  ['geometry-engine/masterplan/index.html', 'masterplan'],
  ['geometry-engine/map-calibration/index.html', 'map']
].forEach(([f, label]) => {
  const p = join(BASE, f);
  if (!existsSync(p)) { fail(`missing page for head checks: ${label}`); return; }
  const s = readFileSync(p, 'utf8');
  /<link[^>]+rel=["']icon["'][^>]+href=["']favicon\.svg["']/i.test(s) ? ok(`${label}: favicon link`) : fail(`${label}: missing favicon link`);
  /<meta[^>]+name=["']description["']/i.test(s) ? ok(`${label}: meta description`) : fail(`${label}: missing meta description`);
  /href=["']assets\/logo\.jpg["']/i.test(s) ? ok(`${label}: brand logo referenced`) : fail(`${label}: missing brand logo`);
  /rel=["']apple-touch-icon["']/i.test(s) ? ok(`${label}: apple-touch-icon`) : fail(`${label}: missing apple-touch-icon`);
  /property=["']og:image["'][^>]*content=["']https:\/\//i.test(s) ? ok(`${label}: og:image (absolute)`) : fail(`${label}: missing absolute og:image`);
});

// Operational Intelligence Layer — investment route + cross-nav + disclaimer
const invPath = join(BASE, 'investment', 'index.html');
if (!existsSync(invPath)) { fail('missing investment route'); }
else {
  const I = readFileSync(invPath, 'utf8');
  /not financial advice|no es asesoría financiera/i.test(I) ? ok('investment: prominent disclaimer') : fail('investment: missing disclaimer');
  /src=["']\.\.\/web\/js\/investment-dashboard\.js["']/i.test(I) ? ok('investment: dashboard module referenced') : fail('investment: missing dashboard module ref');
  /id=["']oiVerticals["']/.test(I) && /id=["']oiPhases["']/.test(I) ? ok('investment: dashboard containers') : fail('investment: missing dashboard containers');
}
// cross-navigation: every public page links to /investment/
[['index.html', './investment/'], ['geometry-engine/masterplan/index.html', '../../investment/'],
 ['geometry-engine/map-calibration/index.html', '../../investment/'], ['investment/index.html', './']
].forEach(([f, href]) => {
  const p = join(BASE, f); if (!existsSync(p)) { fail(`cross-nav: missing ${f}`); return; }
  readFileSync(p, 'utf8').includes(`href="${href}"`) ? ok(`cross-nav (${f.split('/')[0] || 'root'}) → investment`) : fail(`cross-nav: ${f} missing investment link (${href})`);
});

// Advanced Technical Roadmap — phased development guide route + content + cross-nav
const trPath = join(BASE, 'technical-roadmap', 'index.html');
if (!existsSync(trPath)) { fail('missing technical-roadmap route'); }
else {
  const T = readFileSync(trPath, 'utf8');
  const Tn = T.replace(/\s+/g, ' '); // collapse whitespace so wrapped text still matches
  /http-equiv=["']refresh/i.test(T) ? fail('technical-roadmap is a redirect, expected the guide page') : ok('technical-roadmap present (not a redirect)');
  /No reemplaza levantamiento topogr[aá]fico, estudios t[eé]cnicos, dise[ñn]os arquitect[oó]nicos, licencias ni asesor[ií]a profesional/i.test(Tn)
    ? ok('technical-roadmap: prominent disclaimer') : fail('technical-roadmap: missing required disclaimer');
  /href=["']\.\.\/web\/css\/experience-system\.css["']/i.test(T) ? ok('technical-roadmap: experience-system.css referenced') : fail('technical-roadmap: missing experience-system.css');
  /fetch\(\s*[^)]*technical-development-roadmap\.json/i.test(T) ? ok('technical-roadmap: technical JSON referenced (relative)') : fail('technical-roadmap: missing technical JSON reference');
  /id=["']trPhases["']/.test(T) ? ok('technical-roadmap: phases container') : fail('technical-roadmap: missing phases container');
}
// versioned technical JSON — schema + required per-phase fields, conceptual disclaimer
const trJsonPath = join(BASE, 'data', 'technical-development-roadmap.json');
if (!existsSync(trJsonPath)) { fail('missing data/technical-development-roadmap.json'); }
else {
  let J = null;
  try { J = JSON.parse(readFileSync(trJsonPath, 'utf8')); } catch (e) { fail('technical JSON not valid JSON: ' + e.message); }
  if (J) {
    /^kairos\.technical-development-roadmap\//.test(J.schema || '') ? ok('technical JSON: schema id') : fail('technical JSON: bad/missing schema id');
    typeof J.version === 'string' ? ok('technical JSON: versioned (' + J.version + ')') : fail('technical JSON: missing version');
    /No reemplaza levantamiento topogr[aá]fico/i.test(J.disclaimer || '') ? ok('technical JSON: conceptual disclaimer') : fail('technical JSON: missing disclaimer');
    const ph = Array.isArray(J.phases) ? J.phases : [];
    ph.length >= 10 ? ok(`technical JSON: ${ph.length} phases`) : fail(`technical JSON: too few phases (${ph.length})`);
    const fields = ['phase_id', 'title', 'technical_actions', 'required_studies', 'dependencies', 'risk_level', 'design_output', 'next_decision'];
    const bad = ph.filter(p => !fields.every(k => k in p));
    bad.length === 0 ? ok('technical JSON: every phase has required fields') : fail(`technical JSON: ${bad.length} phase(s) missing fields`);
    const RISKS = new Set(['bajo', 'medio', 'alto']);
    ph.every(p => RISKS.has(p.risk_level)) ? ok('technical JSON: risk_level values valid') : fail('technical JSON: invalid risk_level value');
  }
}
// cross-navigation: every public page links to /technical-roadmap/ (and the new page links back)
[['index.html', './technical-roadmap/'], ['geometry-engine/masterplan/index.html', '../../technical-roadmap/'],
 ['geometry-engine/map-calibration/index.html', '../../technical-roadmap/'], ['investment/index.html', '../technical-roadmap/'],
 ['technical-roadmap/index.html', '../investment/']
].forEach(([f, href]) => {
  const p = join(BASE, f); if (!existsSync(p)) { fail(`cross-nav: missing ${f}`); return; }
  readFileSync(p, 'utf8').includes(`href="${href}"`) ? ok(`cross-nav (${f.split('/')[0] || 'root'}) → ${href}`) : fail(`cross-nav: ${f} missing link (${href})`);
});

// Detailed Container Layout Map — planimetric site-layout route + content + exports + cross-nav
const lmPath = join(BASE, 'layout-map', 'index.html');
if (!existsSync(lmPath)) { fail('missing layout-map route'); }
else {
  const M = readFileSync(lmPath, 'utf8');
  const Mn = M.replace(/\s+/g, ' '); // collapse whitespace so wrapped text still matches
  /http-equiv=["']refresh/i.test(M) ? fail('layout-map is a redirect, expected the layout page') : ok('layout-map present (not a redirect)');
  /Maqueta conceptual preliminar\. No reemplaza planos arquitect[oó]nicos, topograf[ií]a, licencias ni dise[ñn]o constructivo/i.test(Mn)
    ? ok('layout-map: prominent disclaimer') : fail('layout-map: missing required disclaimer');
  /href=["']\.\.\/web\/css\/experience-system\.css["']/i.test(M) ? ok('layout-map: experience-system.css reused') : fail('layout-map: missing experience-system.css');
  /src=["']\.\.\/web\/js\/layout-map\.js["']/i.test(M) ? ok('layout-map: SVG renderer referenced') : fail('layout-map: missing layout-map.js');
  /id=["']lmStage["']/.test(M) ? ok('layout-map: SVG stage container') : fail('layout-map: missing SVG stage');
  (/id=["']lmZoomIn["']/.test(M) && /id=["']lmZoomOut["']/.test(M) && /id=["']lmZoomReset["']/.test(M)) ? ok('layout-map: zoom controls') : fail('layout-map: missing zoom controls');
  (/data-setlevel=["']1["']/.test(M) && /data-setlevel=["']2["']/.test(M) && /data-setlevel=["']3["']/.test(M)) ? ok('layout-map: 3 detail levels') : fail('layout-map: missing detail levels');
  (/id=["']lmExportJson["']/.test(M) && /id=["']lmExportSvg["']/.test(M) && /id=["']lmExportPng["']/.test(M)) ? ok('layout-map: export controls (JSON/SVG/PNG)') : fail('layout-map: missing export controls');
}
// versioned container-layout JSON — schema + container modules + required per-module fields + sections
const lmJsonPath = join(BASE, 'data', 'layout', 'container-layout.json');
if (!existsSync(lmJsonPath)) { fail('missing data/layout/container-layout.json'); }
else {
  let K = null;
  try { K = JSON.parse(readFileSync(lmJsonPath, 'utf8')); } catch (e) { fail('container-layout JSON not valid JSON: ' + e.message); }
  if (K) {
    /^kairos\.container-layout\//.test(K.schema || '') ? ok('layout JSON: schema id') : fail('layout JSON: bad/missing schema id');
    typeof K.version === 'string' ? ok('layout JSON: versioned (' + K.version + ')') : fail('layout JSON: missing version');
    /No reemplaza planos arquitect[oó]nicos/i.test(K.disclaimer || '') ? ok('layout JSON: conceptual disclaimer') : fail('layout JSON: missing disclaimer');
    ['modules', 'paths', 'parking', 'plazas', 'landscape', 'service_zones', 'labels', 'zoom_levels'].forEach(k =>
      (k in K) ? ok('layout JSON: has ' + k) : fail('layout JSON: missing ' + k));
    const mods = Array.isArray(K.modules) ? K.modules : [];
    mods.length >= 6 ? ok(`layout JSON: ${mods.length} modules`) : fail(`layout JSON: too few modules (${mods.length})`);
    const mfields = ['id', 'type', 'dim', 'orientation', 'phase', 'state'];
    const badm = mods.filter(m => !mfields.every(k => k in m));
    badm.length === 0 ? ok('layout JSON: every module has required fields') : fail(`layout JSON: ${badm.length} module(s) missing fields`);
    mods.every(m => m.state === 'conceptual') ? ok('layout JSON: all modules state="conceptual"') : fail('layout JSON: a module is not conceptual');
    // container module types present
    const types = new Set(mods.map(m => m.type));
    const wantTypes = ['container-cafe', 'cocina', 'bar', 'banos', 'retail-local', 'deck-sombra', 'service-module'];
    const missingT = wantTypes.filter(t => !types.has(t));
    missingT.length === 0 ? ok('layout JSON: container module types present') : fail('layout JSON: missing container types: ' + missingT.join(', '));
    Array.isArray(K.zoom_levels) && K.zoom_levels.length === 3 ? ok('layout JSON: 3 zoom/detail levels') : fail('layout JSON: expected 3 zoom_levels');
  }
}
// cross-navigation: every public page links to /layout-map/ (and the new page links back)
[['index.html', './layout-map/'], ['geometry-engine/masterplan/index.html', '../../layout-map/'],
 ['geometry-engine/map-calibration/index.html', '../../layout-map/'], ['investment/index.html', '../layout-map/'],
 ['technical-roadmap/index.html', '../layout-map/'], ['layout-map/index.html', '../technical-roadmap/']
].forEach(([f, href]) => {
  const p = join(BASE, f); if (!existsSync(p)) { fail(`cross-nav: missing ${f}`); return; }
  readFileSync(p, 'utf8').includes(`href="${href}"`) ? ok(`cross-nav (${f.split('/')[0] || 'root'}) → ${href}`) : fail(`cross-nav: ${f} missing link (${href})`);
});

// Map-Based Layout Calibration — editable polygons + "Layout on Map" overlay on Map Calibration
const mcPath = join(BASE, 'geometry-engine', 'map-calibration', 'index.html');
if (!existsSync(mcPath)) { fail('missing map-calibration page for layout checks'); }
else {
  const MC = readFileSync(mcPath, 'utf8');
  /Layout on Map/i.test(MC) ? ok('map-calibration: "Layout on Map" tools') : fail('map-calibration: missing "Layout on Map"');
  /src=["']layout-editor\.js["']/i.test(MC) ? ok('map-calibration: layout-editor.js wired (additive)') : fail('map-calibration: layout-editor.js not referenced');
  // editable polygon controls + export/import
  (/id=["']leEdit["']/.test(MC) && /id=["']leAdd["']/.test(MC) && /id=["']leLayer["']/.test(MC)) ? ok('map-calibration: polygon edit controls') : fail('map-calibration: missing polygon edit controls');
  (/id=["']leExportPoly["']/.test(MC) && /id=["']leExportLayout["']/.test(MC)) ? ok('map-calibration: layout export (polygons + map layout)') : fail('map-calibration: missing layout export');
  /id=["']leImport["']/.test(MC) ? ok('map-calibration: polygon JSON import') : fail('map-calibration: missing polygon import');
  // layout-on-map toggles (usable / rail / restrictions / container layout / circulation / landscape)
  ['leShowLot', 'leShowUsable', 'leShowRail', 'leShowRestricted', 'leShowLayout', 'leShowCirc', 'leShowLand'].every(id => new RegExp(`id=["']${id}["']`).test(MC))
    ? ok('map-calibration: layout toggles (lot/usable/rail/restrict/layout/circ/land)') : fail('map-calibration: missing layout toggles');
  // no-false-precision labels present
  (/requiere topograf[ií]a/i.test(MC) && /PRELIMINAR/i.test(MC) && /sin precisi[oó]n catastral/i.test(MC)) ? ok('map-calibration: no-false-precision labels') : fail('map-calibration: missing no-precision labels');
  // rail-side opportunity exact, non-ownership label
  /Zona de oportunidad visual \/ posible uso — validar propiedad, servidumbres y retiros/i.test(MC.replace(/\s+/g, ' ')) ? ok('map-calibration: rail-opportunity label (no ownership claim)') : fail('map-calibration: missing rail-opportunity label');
}
// layout-editor.js must NOT write lot.json and must be additive (uses the read-only handle)
const lePath = join(BASE, 'geometry-engine', 'map-calibration', 'layout-editor.js');
if (existsSync(lePath)) {
  const LE = readFileSync(lePath, 'utf8');
  /window\.MapCalibration/.test(LE) ? ok('layout-editor: uses read-only MapCalibration handle') : fail('layout-editor: does not use MapCalibration handle');
  !/lot\.json['"]\s*,/.test(LE) && !/PUT|POST|writeFile/i.test(LE) ? ok('layout-editor: does not write lot.json / no network writes') : fail('layout-editor: suspicious write to lot.json');
}
// geo seed — schema, status, required keys
const lpPath = join(BASE, 'data', 'calibration', 'layout-polygons.seed.json');
if (!existsSync(lpPath)) { fail('missing data/calibration/layout-polygons.seed.json'); }
else {
  let P = null;
  try { P = JSON.parse(readFileSync(lpPath, 'utf8')); } catch (e) { fail('layout-polygons seed not valid JSON: ' + e.message); }
  if (P) {
    /^kairos\.layout-polygons\//.test(P.schema || '') ? ok('layout-polygons seed: schema id') : fail('layout-polygons seed: bad/missing schema id');
    P.status === 'PRELIMINARY_CONCEPTUAL' ? ok('layout-polygons seed: status PRELIMINARY_CONCEPTUAL') : fail('layout-polygons seed: wrong status');
    ['source_lot_polygon', 'usable_area_polygon', 'rail_side_opportunity_polygon', 'restricted_zones', 'frontage_zone', 'service_zone', 'notes'].forEach(k =>
      (k in P) ? ok('layout-polygons seed: has ' + k) : fail('layout-polygons seed: missing ' + k));
    (Array.isArray(P.source_lot_polygon) && P.source_lot_polygon.length >= 3) ? ok('layout-polygons seed: source_lot_polygon from real lot') : fail('layout-polygons seed: bad source_lot_polygon');
  }
}
// layout-map (legacy) must NOT present itself as the primary source
const lmLegacyPath = join(BASE, 'layout-map', 'index.html');
if (existsSync(lmLegacyPath)) {
  const LM = readFileSync(lmLegacyPath, 'utf8').replace(/\s+/g, ' ');
  (/fuente principal/i.test(LM) && /Map Calibration/i.test(LM) && /(legacy|secundaria)/i.test(LM)) ? ok('layout-map: marked secondary (source of truth = Map Calibration)') : fail('layout-map: not marked secondary / no source-of-truth pointer');
  /Architectural Presentation Layer/i.test(LM) ? ok('layout-map: labeled Architectural Presentation Layer') : fail('layout-map: not labeled Architectural Presentation Layer');
  /href="\.\.\/map\/"/.test(readFileSync(lmLegacyPath, 'utf8')) ? ok('layout-map: links to Map Calibration (primary)') : fail('layout-map: missing link to Map Calibration');
}

// Terrain Intelligence + Spatial Constraint Engine — module, vendorized terrain, spatial data
if (existsSync(mcPath)) {
  const MC = readFileSync(mcPath, 'utf8');
  /Spatial Source of Truth/i.test(MC) ? ok('map-calibration: labeled Spatial Source of Truth (primary)') : fail('map-calibration: missing Spatial Source of Truth label');
  /src=["']terrain-spatial\.js["']/i.test(MC) ? ok('map-calibration: terrain-spatial.js wired (additive)') : fail('map-calibration: terrain-spatial.js not referenced');
  (/id=["']tsTerrain["']/.test(MC) && /id=["']tsSlope["']/.test(MC) && /id=["']tsDrainage["']/.test(MC)) ? ok('map-calibration: terrain toggles (relief/slope/drainage)') : fail('map-calibration: missing terrain toggles');
  (/id=["']tsZones["']/.test(MC) && /id=["']tsContainers["']/.test(MC) && /id=["']tsTrees["']/.test(MC) && /id=["']tsRailway["']/.test(MC)) ? ok('map-calibration: spatial-constraint toggles (zones/containers/trees/railway)') : fail('map-calibration: missing spatial toggles');
  (/id=["']tsExportSpatial["']/.test(MC) && /id=["']tsExportTerrain["']/.test(MC) && /id=["']tsExportConstraints["']/.test(MC)) ? ok('map-calibration: spatial exports (spatial/terrain/constraint)') : fail('map-calibration: missing spatial exports');
  /id=["']leEdit["']/.test(MC) && /class=["']le-vtx/.test(MC.replace(/\n/g, ' ')) || /le-vtx/.test(MC) ? ok('map-calibration: draggable layout vertices (editor + handles)') : fail('map-calibration: missing draggable vertex styling');
  // prominent full disclaimer + no-false-precision terrain label
  /No reemplaza:?\s*topograf[ií]a profesional, estudios de suelos, ingenier[ií]a, arquitectura, licencias, validaci[oó]n legal o catastral/i.test(MC.replace(/\s+/g, ' ')) ? ok('map-calibration: prominent full disclaimer') : fail('map-calibration: missing prominent full disclaimer');
  /Elevaci[oó]n aproximada conceptual — requiere levantamiento topogr[aá]fico profesional/i.test(MC.replace(/\s+/g, ' ')) ? ok('map-calibration: no-false-precision elevation label') : fail('map-calibration: missing no-false-precision elevation label');
}
// terrain-spatial.js must be additive + offline (no runtime elevation network / no lot.json write)
const tsPath = join(BASE, 'geometry-engine', 'map-calibration', 'terrain-spatial.js');
if (existsSync(tsPath)) {
  const TS = readFileSync(tsPath, 'utf8');
  /window\.MapCalibration/.test(TS) ? ok('terrain-spatial: uses read-only MapCalibration handle') : fail('terrain-spatial: does not use MapCalibration handle');
  !/open-elevation|api\.open|https?:\/\/[^"']*elevation/i.test(TS) ? ok('terrain-spatial: no runtime elevation network (vendorized)') : fail('terrain-spatial: runtime elevation network call detected');
  !/lot\.json/.test(TS) ? ok('terrain-spatial: does not touch lot.json') : fail('terrain-spatial: references lot.json');
}
// vendorized terrain profile — schema, status, disclaimer, real grid
const tpPath = join(BASE, 'data', 'terrain', 'terrain-profile.json');
if (existsSync(tpPath)) {
  let T = null; try { T = JSON.parse(readFileSync(tpPath, 'utf8')); } catch (e) { fail('terrain-profile not valid JSON: ' + e.message); }
  if (T) {
    /^kairos\.terrain-profile\//.test(T.schema || '') ? ok('terrain-profile: schema id') : fail('terrain-profile: bad schema');
    /PRELIMINARY_CONCEPTUAL/.test(T.status || '') ? ok('terrain-profile: conceptual status') : fail('terrain-profile: status not conceptual');
    /levantamiento topogr[aá]fico profesional/i.test(T.disclaimer || '') ? ok('terrain-profile: disclaimer (needs survey)') : fail('terrain-profile: missing disclaimer');
    (Array.isArray(T.points) && T.points.length >= 25 && T.stats) ? ok(`terrain-profile: grid (${T.points.length} pts, ${T.stats.min}-${T.stats.max} m)`) : fail('terrain-profile: insufficient grid/stats');
  }
}
// slope-zones — schema + Low/Moderate/Steep classes
const szPath = join(BASE, 'data', 'terrain', 'slope-zones.json');
if (existsSync(szPath)) {
  let S = null; try { S = JSON.parse(readFileSync(szPath, 'utf8')); } catch (e) { fail('slope-zones not valid JSON: ' + e.message); }
  if (S) {
    /^kairos\.slope-zones\//.test(S.schema || '') ? ok('slope-zones: schema id') : fail('slope-zones: bad schema');
    const keys = (S.classes || []).map(c => c.key);
    (keys.includes('low') && keys.includes('moderate') && keys.includes('steep')) ? ok('slope-zones: low/moderate/steep classes') : fail('slope-zones: missing slope classes');
    (Array.isArray(S.cells) && S.cells.length >= 25) ? ok(`slope-zones: ${S.cells.length} cells classified`) : fail('slope-zones: insufficient cells');
  }
}
// spatial zones — 7 zones + containers (architecture descriptors) + 3D readiness
const spPath = join(BASE, 'data', 'spatial', 'spatial-zones.json');
if (existsSync(spPath)) {
  let Z = null; try { Z = JSON.parse(readFileSync(spPath, 'utf8')); } catch (e) { fail('spatial-zones not valid JSON: ' + e.message); }
  if (Z) {
    /^kairos\.spatial-zones\//.test(Z.schema || '') ? ok('spatial-zones: schema id') : fail('spatial-zones: bad schema');
    const zids = (Z.zones || []).map(z => z.id);
    ['z-arrival', 'z-food', 'z-railway', 'z-wellness', 'z-service', 'z-parking', 'z-future'].every(id => zids.includes(id)) ? ok('spatial-zones: 7 zones (arrival/food/railway/wellness/service/parking/future)') : fail('spatial-zones: missing one of the 7 zones');
    const cs = Z.containers || [];
    const cfields = ['id', 'use', 'type', 'orientation', 'levels', 'ventilation', 'service_access', 'circulation', 'technical'];
    (cs.length >= 8 && cs.every(c => cfields.every(k => k in c))) ? ok(`spatial-zones: ${cs.length} containers with architecture descriptors`) : fail('spatial-zones: containers missing architecture fields');
    (Z.vertical_landmark_nodes && Z.vertical_landmark_nodes.length >= 2) ? ok('spatial-zones: vertical landmark nodes') : fail('spatial-zones: missing landmark nodes');
    (Z.three_d_readiness && Z.three_d_readiness.implemented === false && Z.camera_anchors && Z.camera_anchors.length >= 3) ? ok('spatial-zones: 3D-readiness (descriptors + camera anchors, not rendered)') : fail('spatial-zones: missing 3D-readiness/camera anchors');
    Z.ground_strategy ? ok('spatial-zones: ground strategy (decks/pilotes/stepped/fill/avoid-leveling)') : fail('spatial-zones: missing ground strategy');
  }
}
// vegetation strategy — preserve/evaluate/remove (no assumed clearing)
const vgPath = join(BASE, 'data', 'spatial', 'vegetation-strategy.json');
if (existsSync(vgPath)) {
  let V = null; try { V = JSON.parse(readFileSync(vgPath, 'utf8')); } catch (e) { fail('vegetation-strategy not valid JSON: ' + e.message); }
  if (V) {
    /^kairos\.vegetation-strategy\//.test(V.schema || '') ? ok('vegetation-strategy: schema id') : fail('vegetation-strategy: bad schema');
    const acts = (V.actions || []).map(a => a.key);
    (acts.includes('preserve') && acts.includes('evaluate') && acts.includes('remove')) ? ok('vegetation-strategy: preserve/evaluate/remove (no assumed clearing)') : fail('vegetation-strategy: missing actions');
    (Array.isArray(V.clusters) && V.clusters.length >= 3 && Array.isArray(V.green_corridors)) ? ok('vegetation-strategy: tree clusters + green corridors') : fail('vegetation-strategy: missing clusters/corridors');
  }
}
// material strategy — surface materials
const mtPath = join(BASE, 'data', 'spatial', 'material-strategy.json');
if (existsSync(mtPath)) {
  let MM = null; try { MM = JSON.parse(readFileSync(mtPath, 'utf8')); } catch (e) { fail('material-strategy not valid JSON: ' + e.message); }
  if (MM) {
    /^kairos\.material-strategy\//.test(MM.schema || '') ? ok('material-strategy: schema id') : fail('material-strategy: bad schema');
    const mids = (MM.materials || []).map(m => m.id);
    ['gravel-stabilized', 'permeable-pavers', 'wood-deck', 'tropical-concrete', 'compacted-paths'].every(id => mids.includes(id)) ? ok('material-strategy: surface materials catalog') : fail('material-strategy: missing materials');
  }
}

// public landing (commercial entry) — root index.html
const landingPath = join(BASE, 'index.html');
if (!existsSync(landingPath)) { fail('missing public landing: index.html'); }
else {
  const L = readFileSync(landingPath, 'utf8');
  /http-equiv=["']refresh/i.test(L) ? fail('public landing index.html is a redirect, expected the commercial landing') : ok('public landing present (not a redirect)');
  /logos\s*parador/i.test(L) ? ok('landing hero: "Logos Parador"') : fail('landing missing hero "Logos Parador"');
  // 3 CTAs (relative)
  const ctas = [['Ver Masterplan', './masterplan/'], ['Iniciar Journey', './journey/'], ['Ver Mapa', './map/']];
  ctas.forEach(([label, href]) => {
    (L.includes(`href="${href}"`) && L.includes(label)) ? ok(`landing CTA: ${label} → ${href}`) : fail(`landing CTA missing: ${label} (${href})`);
  });
  // discrete disclaimer
  /no sustituye levantamiento|conceptual preliminar/i.test(L) ? ok('landing disclaimer present') : fail('landing disclaimer missing');
  // SEO + public nav
  /property=["']og:title["']/i.test(L) ? ok('landing Open Graph (og:title)') : fail('landing missing Open Graph');
  /name=["']twitter:card["']/i.test(L) ? ok('landing Twitter card') : fail('landing missing Twitter card');
  /class="topbar"|class="pubnav"/.test(L) ? ok('landing public nav') : fail('landing missing public nav');
  // each CTA route resolves to an existing entry page
  [['./masterplan/', 'masterplan/index.html'], ['./journey/', 'journey/index.html'], ['./map/', 'map/index.html']].forEach(([href, file]) => {
    existsSync(join(BASE, file)) ? ok(`landing route resolves: ${href}`) : fail(`landing route broken: ${href} (missing ${file})`);
  });
}

// internal redirect entry pages → expected targets
const redirects = {
  'masterplan/index.html': '../geometry-engine/masterplan/',
  'map/index.html': '../geometry-engine/map-calibration/',
  'journey/index.html': '../geometry-engine/masterplan/?journey=1&auto=1'
};
for (const [f, target] of Object.entries(redirects)) {
  const p = join(BASE, f);
  if (!existsSync(p)) { fail('missing redirect page: ' + f); continue; }
  const s = readFileSync(p, 'utf8');
  (/http-equiv=["']refresh/i.test(s) && s.includes('url=' + target)) ? ok(`redirect: ${f} → ${target}`) : fail(`redirect target wrong/missing in ${f} (expected ${target})`);
}

// content scans (skip vendored Leaflet + docs prose)
const TEXT = new Set(['.html', '.js', '.mjs', '.css', '.json']);
function walk(d) { let out = []; for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? out = out.concat(walk(p)) : out.push(p); } return out; }
const scan = walk(BASE).filter(f => TEXT.has(extname(f)) && !f.includes(`${'/vendor/leaflet/'}`));
const patterns = [
  { name: 'no absolute src/href ("/…")', re: /(?:src|href)\s*=\s*["']\/(?!\/)/ },
  { name: 'no absolute fetch("/…")', re: /\bfetch\(\s*["']\/(?!\/)/ },
  { name: 'no absolute ES import ("/…")', re: /\bimport[^"'\n]*["']\/(?!\/)/ },
  { name: 'no absolute css url(/…)', re: /url\(\s*["']?\/(?!\/)/ },
  { name: 'no localhost references', re: /localhost/i },
  { name: 'no file:// references', re: /file:\/\// },
  { name: 'no Google API keys (AIza…)', re: /AIza[0-9A-Za-z_\-]{35}/ },
  { name: 'no embedded "firebase deploy"', re: /firebase\s+deploy/i },
  { name: 'no real analytics/tracking', re: /gtag\(|googletagmanager|google-analytics|mixpanel|segment\.com|hotjar|fbq\(|connect\.facebook\.net/i }
];
for (const c of patterns) {
  const hits = scan.filter(f => c.re.test(readFileSync(f, 'utf8'))).map(f => relative(BASE, f));
  hits.length ? fail(`${c.name} — found in: ${hits.join(', ')}`) : ok(c.name);
}

done();
