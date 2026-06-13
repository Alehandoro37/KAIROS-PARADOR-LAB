#!/usr/bin/env node
/* KAIROS PARADOR — Public Route Prep V1 / build:external
 *
 * Reproducible, IDEMPOTENT packaging of the existing static pages into the public
 * route tree expected under Firebase Hosting:
 *
 *   /external/landing/logos-parador/            → landing
 *   /external/landing/logos-parador/masterplan/ → Masterplan Blueprint V3.1
 *   /external/landing/logos-parador/map/        → Map Calibration + OSM Context
 *   /external/landing/logos-parador/journey/    → Visitor Journey (cinematic)
 *
 * STRATEGY — packaging only, ZERO logic edits:
 *   The pages use RELATIVE paths (../../data/…, relative ES-module imports,
 *   vendor/leaflet/…). Those resolve correctly only when the served file keeps its
 *   original directory depth. So we MIRROR the source subtree verbatim (no path
 *   rewriting → nothing can break) and expose the clean public routes via tiny
 *   REDIRECT entry pages. A Firebase `rewrite` that served a deep file at a shallow
 *   URL would break the `../../` resolution, so we deliberately use redirects, not
 *   rewrites, for these pages. See docs/deploy/firebase-hosting-route.md.
 *
 * Output goes to build/ (git-ignored). The SOURCE repo is never modified, so GitHub
 * Pages is unaffected. No deploy, no Firebase CLI is run here. */

import { rmSync, mkdirSync, cpSync, writeFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'build');
const OUT = join(BUILD, 'external', 'landing', 'logos-parador');

// 1) clean (idempotent)
rmSync(BUILD, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// 2) mirror source subtrees verbatim — preserves every relative path as-is
const mirror = (rel) => cpSync(join(ROOT, rel), join(OUT, rel), { recursive: true });
['web', 'geometry-engine', 'data'].forEach(mirror);
cpSync(join(ROOT, 'docs', 'concept'), join(OUT, 'docs', 'concept'), { recursive: true }); // landing "Leer concepto" link

// 3) clean public-route entry pages (redirect into the mirrored tree)
const redirect = (to, title) =>
  `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">` +
  `<meta http-equiv="refresh" content="0; url=${to}">` +
  `<meta name="robots" content="noindex"><link rel="canonical" href="${to}">` +
  `<title>${title} — KAIROS PARADOR</title></head>` +
  `<body style="background:#061828;color:#f4fbff;font-family:Arial,sans-serif;padding:2rem">` +
  `<p>Redirigiendo a <a style="color:#8fe5ff" href="${to}">${title}</a>…</p></body></html>\n`;
const routePage = (sub, to, title) => { mkdirSync(join(OUT, sub), { recursive: true }); writeFileSync(join(OUT, sub, 'index.html'), redirect(to, title)); };

// Public landing (commercial entry) — committed source, copied as the root index.
// Its CTAs point at the internal redirect routes below (./masterplan/ ./journey/ ./map/).
cpSync(join(ROOT, 'external', 'landing', 'logos-parador', 'index.html'), join(OUT, 'index.html'));
routePage('masterplan', '../geometry-engine/masterplan/', 'Masterplan Blueprint V3.1');
routePage('map', '../geometry-engine/map-calibration/', 'Map Calibration + OSM Context');
routePage('journey', '../geometry-engine/masterplan/?journey=1&auto=1', 'Visitor Journey (cinematic)');

// 4) report
function tree(dir, prefix = '', depth = 0, max = 2) {
  if (depth > max) return;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name); const isDir = statSync(p).isDirectory();
    console.log(prefix + (isDir ? '▸ ' : '· ') + name + (isDir ? '/' : ''));
    if (isDir) tree(p, prefix + '  ', depth + 1, max);
  }
}
console.log('Built external route tree at:', relative(ROOT, OUT));
console.log('Public routes → /external/landing/logos-parador/{ , masterplan/, map/, journey/}');
console.log('---');
tree(OUT);
