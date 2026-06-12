/* KAIROS PARADOR — Geometry Engine v2 / ui
 * DOM access helpers for reading control values and writing output labels.
 * Moved verbatim from the original engine.js IIFE ($, val, setVal, out). */
export const $ = (id) => document.getElementById(id);
export const val = (id) => { const el = $(id); return el ? Number(el.value) : 0; };
export const setVal = (id, v) => { const el = $(id); if (el) el.value = v; };
export function out(id, v) {
  const el = $(id + 'Out');
  if (el) el.textContent = id.includes('Count') ? String(v) : `${Number(v).toFixed(id.includes('boxStart') ? 0 : 1)} m`;
}
