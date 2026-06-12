/* KAIROS PARADOR — Geometry Engine v2 / ui
 * Reads control values into the params/constraints objects the engine computes
 * from, and refreshes the slider output labels. Moved verbatim from the original
 * engine.js IIFE (params, constraints, updateOutputs). */
import { val, out } from './dom.js';
import { ids } from '../runtime/config.js';

export function params() {
  return {
    parkBand: val('parkBand'), walkBand: val('walkBand'), boxType: val('boxType'),
    boxCount: val('boxCount'), boxGap: val('boxGap'), boxStart: val('boxStart')
  };
}

export function constraints() {
  return {
    roadAxisOffsetM: val('roadAxisOffsetM'), roadSetbackM: val('roadSetbackM'),
    railAxisOffsetM: val('railAxisOffsetM'), railSetbackM: val('railSetbackM'),
    oldRoadAxisOffsetM: val('oldRoadAxisOffsetM'), waterBufferM: val('waterBufferM'),
    status: 'PRELIMINAR — pendiente topografía',
    model: 'ejes paralelos al lindero oriental A→B; valores editables, no topografía ni norma'
  };
}

export function updateOutputs() { ids.forEach(id => out(id, val(id))); }
