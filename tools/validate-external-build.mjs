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
['.', 'masterplan', 'map', 'journey', 'technical-roadmap', 'web', 'geometry-engine', 'data'].forEach(d => {
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
  'technical-roadmap/index.html', 'web/css/experience-system.css', 'data/technical-development-roadmap.json'
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
