/* KAIROS PARADOR — Geometry Engine v2 / Setback Layer V1
 * ENTRY POINT (ES module). This file is intentionally thin: it only wires the window
 * resize handler and boots the engine. All logic was split — without behaviour change
 * — into sibling modules and lives under:
 *     geo/      projection.js · polygon.js · vector.js   (pure geometry math)
 *     core/     basis.js · constraints.js · modules.js    ((s,t) frame + domain)
 *     render/   canvas.js                                  (Canvas 2D pipeline)
 *     ui/       dom.js · params.js                         (controls ↔ values)
 *     runtime/  config.js · state.js · init.js             (config, state, bootstrap)
 *     debug/    inspect.js                                  (placeholder, not imported)
 * Imports are RELATIVE and resolve identically under a local static server and under
 * GitHub Pages (project subpath). See ../../docs/local-runtime/ and ./README.md. */
import { resize } from './render/canvas.js';
import { init } from './runtime/init.js';

addEventListener('resize', resize);
init().catch(err => { const el = document.getElementById('metrics'); if (el) el.innerHTML = `<h4>Error</h4><p>${err.message}</p>`; });
