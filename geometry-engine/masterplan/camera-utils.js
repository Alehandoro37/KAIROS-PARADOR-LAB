/* KAIROS PARADOR — Masterplan V3 / camera-utils
 * Lightweight cinematic camera for Canvas 2D: a {cx, cy, zoom} world-space view with
 * eased transitions (smooth pan + soft zoom presets) for the guided Visitor Journey.
 * No free pan/zoom, no dependencies, no WebGL — just easing + interpolation math. */

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const lerp = (a, b, t) => a + (b - a) * t;

// Soft zoom presets (multipliers over the home/whole-lot framing).
export const ZOOM = { home: 1, wide: 1.5, stop: 2.1, close: 2.6 };

export function makeCamera(home) {
  return { home: { ...home }, cur: { ...home }, from: { ...home }, to: { ...home }, t0: 0, dur: 0, animating: false };
}

// Begin an eased transition to a target {cx, cy, zoom}. `now` = rAF timestamp (ms).
export function focusCamera(cam, target, dur, now) {
  cam.from = { ...cam.cur };
  cam.to = { cx: target.cx, cy: target.cy, zoom: target.zoom != null ? target.zoom : cam.cur.zoom };
  cam.t0 = now; cam.dur = Math.max(1, dur); cam.animating = true;
}

// Advance the camera to time `now`; returns the current {cx, cy, zoom}.
export function sampleCamera(cam, now) {
  if (!cam.animating) return cam.cur;
  let t = (now - cam.t0) / cam.dur;
  if (t >= 1) { t = 1; cam.animating = false; }
  const e = easeInOutCubic(t);
  cam.cur = {
    cx: lerp(cam.from.cx, cam.to.cx, e),
    cy: lerp(cam.from.cy, cam.to.cy, e),
    zoom: lerp(cam.from.zoom, cam.to.zoom, e)
  };
  return cam.cur;
}

// Effective world view-box for the current camera over a base box (whole-lot framing).
export function cameraBox(cam, base) {
  const hx = (base.maxX - base.minX) / 2 / cam.cur.zoom, hy = (base.maxY - base.minY) / 2 / cam.cur.zoom;
  return { minX: cam.cur.cx - hx, maxX: cam.cur.cx + hx, minY: cam.cur.cy - hy, maxY: cam.cur.cy + hy };
}

export function homeView(base) {
  return { cx: (base.minX + base.maxX) / 2, cy: (base.minY + base.maxY) / 2, zoom: ZOOM.home };
}
