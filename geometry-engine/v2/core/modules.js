/* KAIROS PARADOR — Geometry Engine v2 / core
 * Domain logic in the (s,t) frame: ISO container placement (computeModules) and
 * grid-sampled area accounting (sampleAreas). A module is valid iff its 4 corners
 * fall inside the polygon and outside every restriction. Moved verbatim from the
 * original engine.js IIFE. */
import { state } from '../runtime/state.js';
import { ISO } from '../runtime/config.js';
import { fromST } from './basis.js';
import { isRestrictedST } from './constraints.js';
import { pointInPoly } from '../geo/polygon.js';

export function computeModules(p, c) {
  const type = ISO[p.boxType] || ISO[20];
  const valid = [], rejected = [];
  for (let i = 0; i < p.boxCount; i++) {
    const s0 = p.boxStart + i * (type.l + p.boxGap);
    const t0 = Math.max(c.roadSetbackM - c.roadAxisOffsetM, c.railSetbackM - c.railAxisOffsetM, 0) + p.parkBand + p.walkBand + type.w / 2;
    const cornersST = [
      { s: s0, t: t0 - type.w / 2 }, { s: s0 + type.l, t: t0 - type.w / 2 },
      { s: s0 + type.l, t: t0 + type.w / 2 }, { s: s0, t: t0 + type.w / 2 }
    ];
    const corners = cornersST.map(q => fromST(q.s, q.t));
    let reason = '';
    if (!corners.every(pt => pointInPoly(pt, state.local))) reason = 'fuera del polígono';
    const restrictedCorner = cornersST.find(st => isRestrictedST(st, c).blocked);
    if (!reason && restrictedCorner) reason = isRestrictedST(restrictedCorner, c).reason;
    const mod = { id: `M${i + 1}`, type: `${p.boxType}'`, s: s0, t: t0, cornersST, corners };
    (reason ? rejected : valid).push(reason ? { ...mod, reason } : mod);
  }
  return { valid, rejected };
}

export function sampleAreas(c) {
  const step = 0.4;
  let total = 0, restricted = 0;
  for (let s = 0; s <= state.basis.len; s += step) {
    for (let t = 0; t <= state.basis.maxT; t += step) {
      const pt = fromST(s, t);
      if (pointInPoly(pt, state.local)) {
        total += step * step;
        if (isRestrictedST({ s, t }, c).blocked) restricted += step * step;
      }
    }
  }
  return { total, restricted, useful: Math.max(0, total - restricted), method: 'malla 0.4 m' };
}
