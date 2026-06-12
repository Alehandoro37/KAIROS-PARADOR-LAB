/* KAIROS PARADOR — Geometry Engine v2 / runtime
 * Mutable runtime state shared across modules — the single source of truth that
 * mirrors the closure variables of the original engine.js IIFE. Populated by
 * runtime/init.js; read by core/, render/ and ui/. Nothing here changes behaviour;
 * it only relocates the former module-level `let` bindings into one object. */
export const state = {
  // DOM references (set in init, after the module-deferred script runs)
  canvas: null,
  ctx: null,
  metricsEl: null,
  versionSelect: null,
  exportBtn: null,
  // Geometry / runtime values
  lot: null,        // raw lot.json
  local: null,      // projected polygon (metres)
  basis: null,      // local (s,t) frame: { A, B, u, n, len, maxT }
  scale: 1,         // last world→pixel scale computed by render fit()
  lastExport: null, // serialisable snapshot for the Export button
};
