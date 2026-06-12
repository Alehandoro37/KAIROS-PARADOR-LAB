/* KAIROS PARADOR — Geometry Engine v2 / core
 * Local (s,t) frame transforms. The basis itself lives in runtime state and is
 * built in init from the first two polygon vertices (A,B): u = unit(A→B) is the
 * longitudinal axis s, n = normal(u) is the transversal axis t. Moved verbatim
 * from the original engine.js IIFE (toST, fromST). */
import { state } from '../runtime/state.js';
import { sub, add, mul, dot } from '../geo/vector.js';

export function toST(p) {
  const b = state.basis;
  const v = sub(p, b.A);
  return { s: dot(v, b.u), t: dot(v, b.n) };
}
export function fromST(s, t) {
  const b = state.basis;
  return add(b.A, add(mul(b.u, s), mul(b.n, t)));
}
