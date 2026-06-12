/* KAIROS PARADOR — Geometry Engine v2 / geo
 * 2D vector helpers. Pure math: no DOM, no shared state. Moved verbatim from the
 * original engine.js IIFE (sub/add/mul/dot/len/norm). */
export const sub  = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const add  = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const mul  = (a, k) => ({ x: a.x * k, y: a.y * k });
export const dot  = (a, b) => a.x * b.x + a.y * b.y;
export const len  = (a) => Math.hypot(a.x, a.y);
export const norm = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; };
