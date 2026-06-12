/* KAIROS PARADOR — Geometry Engine v2 / core
 * Preliminary setback / buffer model in the (s,t) frame: road & rail setbacks bite
 * at low t (near the eastern boundary A→B), the water buffer at high t. PRELIMINAR —
 * not topography nor norm. Moved verbatim from the original engine.js IIFE
 * (isRestrictedST). */
import { state } from '../runtime/state.js';

export function isRestrictedST(st, c) {
  const road  = c.roadSetbackM > 0 && c.roadAxisOffsetM > 0 && st.t <= Math.max(0, c.roadSetbackM - c.roadAxisOffsetM);
  const rail  = c.railSetbackM > 0 && c.railAxisOffsetM > 0 && st.t <= Math.max(0, c.railSetbackM - c.railAxisOffsetM);
  const water = c.waterBufferM > 0 && st.t >= state.basis.maxT - c.waterBufferM;
  return {
    blocked: road || rail || water,
    reason: water ? 'pisa buffer hídrico preliminar' : (road || rail ? 'pisa retiro vial/férreo preliminar' : '')
  };
}
