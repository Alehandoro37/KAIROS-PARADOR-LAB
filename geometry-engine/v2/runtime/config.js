/* KAIROS PARADOR — Geometry Engine v2 / runtime
 * Static configuration: data URLs (relative — same contract on local server and
 * GitHub Pages), control ids, ISO container dimensions, canvas padding. Values
 * moved verbatim from the original engine.js IIFE. */
export const LOT_URL      = '../../data/lot.json';
export const MANIFEST_URL = '../../data/layouts/manifest.json';
export const LAYOUTS_DIR  = '../../data/layouts/';

export const ids = [
  'roadAxisOffsetM', 'roadSetbackM', 'railAxisOffsetM', 'railSetbackM', 'oldRoadAxisOffsetM', 'waterBufferM',
  'parkBand', 'walkBand', 'boxType', 'boxCount', 'boxGap', 'boxStart'
];

export const ISO = { 20: { l: 6.06, w: 2.44 }, 40: { l: 12.19, w: 2.44 } };

export const PAD = 48;
