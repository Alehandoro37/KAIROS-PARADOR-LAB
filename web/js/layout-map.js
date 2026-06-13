/* KAIROS PARADOR — Detailed Container Layout Map V1 / layout-map.js
 * Premium planimetric "architectural model" of the Logos Parador site layout.
 *
 * DECISION: interactive SVG (not Canvas). A label-dense, zoom-heavy maquette
 * stays crisp at any zoom in SVG (real DOM text, native hit-testing, viewBox
 * zoom/pan in one line, trivial SVG export). The masterplan already IS the
 * Canvas view; this is deliberately a different, document-like vector view.
 *
 * Vanilla JS, no deps, no analytics, no backend. Reads the conceptual layout
 * (data/layout/container-layout.json) and renders modules/paths/plaza/parking/
 * landscape/services/labels with 3 progressive detail levels.
 *
 * ⚠️ CONCEPTUAL — NOT architectural drawings, topography, permits or construction
 * design. Geometry here is a stylized maquette, NOT the georeferenced lot. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const DATA = '../data/layout/container-layout.json';
  const $ = (id) => document.getElementById(id);

  // --- premium architectural palette (dark · deep green · gold · technical cyan) ---
  const TYPE = {
    'container-cafe': { fill: 'rgba(231,177,90,.18)', stroke: '#e7b15a' },
    'cocina':         { fill: 'rgba(232,162,92,.16)', stroke: '#e8a25c' },
    'bar':            { fill: 'rgba(143,229,255,.14)', stroke: '#8fe5ff' },
    'banos':          { fill: 'rgba(159,176,184,.16)', stroke: '#9fb0b8' },
    'retail-local':   { fill: 'rgba(95,192,138,.16)',  stroke: '#5fc08a' },
    'deck-sombra':    { fill: 'rgba(63,143,99,.20)',   stroke: '#3f8f63' },
    'service-module': { fill: 'rgba(148,184,178,.14)', stroke: '#94b8b2' },
    'pabellon':       { fill: 'rgba(176,122,74,.18)',  stroke: '#b07a4a' }
  };

  const el = (tag, attrs, kids) => {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(c => c && n.appendChild(c));
    return n;
  };
  const txt = (x, y, s, cls) => { const t = el('text', { x, y, class: cls || 'lm-lbl' }); t.textContent = s; return t; };

  const state = { doc: null, level: 1, base: null, vb: null, drag: null };
  const svg = $('lmStage');

  function setVB(v) { state.vb = v; svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); }

  // ---------------------------------------------------------------- render ----
  function render(doc) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // defs: soft shadow + subtle texture grid (no heavy glow) — built via DOM
    // (createElementNS, not innerHTML, which is inconsistent on SVG elements).
    const filter = el('filter', { id: 'lm-soft', x: '-20%', y: '-20%', width: '140%', height: '140%' },
      el('feDropShadow', { dx: 0, dy: 6, stdDeviation: 7, 'flood-color': '#000', 'flood-opacity': '0.40' }));
    const pattern = el('pattern', { id: 'lm-grid', width: 34, height: 34, patternUnits: 'userSpaceOnUse' },
      el('path', { d: 'M34 0H0V34', fill: 'none', stroke: 'rgba(143,229,255,.06)', 'stroke-width': 1 }));
    const canopy = el('radialGradient', { id: 'lm-canopy', cx: '50%', cy: '50%', r: '50%' }, [
      el('stop', { offset: '0%', 'stop-color': 'rgba(63,143,99,.22)' }),
      el('stop', { offset: '100%', 'stop-color': 'rgba(63,143,99,0)' })]);
    svg.appendChild(el('defs', null, [filter, pattern, canopy]));

    const layer = (id) => { const g = el('g', { id, 'data-layer': id }); svg.appendChild(g); return g; };
    const lots = layer('lm-lot'), ctx = layer('lm-context'), green = layer('lm-green'),
      exp = layer('lm-expansion'), plaza = layer('lm-plaza'), park = layer('lm-parking'),
      paths = layer('lm-paths'), svc = layer('lm-service'), mods = layer('lm-modules'),
      flora = layer('lm-flora'), labels = layer('lm-labels');

    const lvl = (n) => n || 1;

    // lot polygon + texture
    if (doc.lot) {
      const pts = doc.lot.points.map(p => p.join(',')).join(' ');
      lots.appendChild(el('polygon', { points: pts, fill: 'rgba(10,43,52,.55)', stroke: 'rgba(143,229,255,.45)', 'stroke-width': 2.5, 'data-level': 1 }));
      lots.appendChild(el('polygon', { points: pts, fill: 'url(#lm-grid)', stroke: 'none', 'data-level': 1 }));
    }
    // context — road (Troncal) + rail (Ferrocarril)
    if (doc.context) {
      const r = doc.context.road, ra = doc.context.rail;
      if (r) { ctx.appendChild(el('path', { d: r.d, stroke: 'rgba(159,208,255,.5)', 'stroke-width': r.width || 36, fill: 'none', 'stroke-linecap': 'round', 'data-level': 1 }));
        ctx.appendChild(el('path', { d: r.d, stroke: 'rgba(207,234,255,.7)', 'stroke-width': 2, 'stroke-dasharray': '12 14', fill: 'none', 'data-level': 1 })); }
      if (ra) ctx.appendChild(el('path', { d: ra.d, stroke: '#e8a25c', 'stroke-width': 4, 'stroke-dasharray': ra.dash || '14 10', fill: 'none', opacity: .85, 'data-level': 1 }));
    }
    // landscape / green
    (doc.landscape || []).forEach(L => {
      if (L.type === 'green' && L.d) green.appendChild(el('path', { d: L.d, fill: 'rgba(63,143,99,.12)', stroke: 'none', 'data-level': lvl(L.level) }));
      if (L.type === 'canopy' && L.r) green.appendChild(el('circle', { cx: L.x, cy: L.y, r: L.r, fill: 'url(#lm-canopy)', 'data-level': lvl(L.level) }));
    });
    // expansion (reserve, dashed)
    if (doc.expansion) {
      exp.appendChild(el('path', { d: doc.expansion.d, fill: 'rgba(231,177,90,.05)', stroke: 'rgba(231,177,90,.5)', 'stroke-width': 2, 'stroke-dasharray': doc.expansion.dash || '12 9', 'data-level': lvl(doc.expansion.level) }));
    }
    // plazas / patios
    (doc.plazas || []).forEach(p => {
      if (p.d) plaza.appendChild(el('path', { d: p.d, fill: 'rgba(231,177,90,.12)', stroke: 'rgba(231,177,90,.55)', 'stroke-width': 2, filter: 'url(#lm-soft)', 'data-level': lvl(p.level) }));
      else if (p.shape === 'rect') plaza.appendChild(rectAt(p, 'rgba(143,229,255,.08)', 'rgba(143,229,255,.4)'));
    });
    // parking zone + stalls
    if (doc.parking) {
      const z = doc.parking.zone;
      park.appendChild(rectAt({ x: z.x, y: z.y, w: z.w, h: z.h, rot: z.rot, level: lvl(doc.parking.level) }, 'rgba(148,184,178,.08)', 'rgba(143,229,255,.32)', 8));
      const st = doc.parking.stalls;
      if (st) {
        const cw = z.w / st.perRow, ch = z.h / st.rows, g2 = el('g', { 'data-level': lvl(st.level), transform: `rotate(${z.rot || 0} ${z.x + z.w / 2} ${z.y + z.h / 2})` });
        for (let r = 0; r < st.rows; r++) for (let c = 0; c < st.perRow; c++)
          g2.appendChild(el('rect', { x: z.x + c * cw + 3, y: z.y + r * ch + 3, width: cw - 6, height: ch - 6, rx: 3, fill: 'none', stroke: 'rgba(143,229,255,.28)', 'stroke-width': 1 }));
        park.appendChild(g2);
      }
    }
    // paths
    (doc.paths || []).forEach(p => paths.appendChild(el('path', {
      d: p.d, fill: 'none', stroke: p.type === 'promenade' ? 'rgba(231,177,90,.55)' : 'rgba(143,229,255,.4)',
      'stroke-width': p.type === 'promenade' ? 5 : 3, 'stroke-linecap': 'round',
      'stroke-dasharray': p.type === 'trail' ? '4 8' : null, 'data-level': lvl(p.level) })));
    // service zones
    (doc.service_zones || []).forEach(s => {
      svc.appendChild(rectAt({ x: s.x, y: s.y, w: s.w, h: s.h, level: lvl(s.level) }, 'rgba(148,184,178,.07)', 'rgba(148,184,178,.4)', 6));
      const sl = txt(s.x + s.w / 2, s.y + s.h / 2, s.label, 'lm-zone'); sl.setAttribute('data-level', lvl(s.level)); svc.appendChild(sl);
    });
    // modules (interactive)
    (doc.modules || []).forEach(m => {
      const c = TYPE[m.type] || { fill: 'rgba(255,255,255,.06)', stroke: '#cfe' };
      const cx = m.x + m.w / 2, cy = m.y + m.h / 2, rot = m.orientation && /SW|NE/.test(m.orientation) ? -18 : 0;
      const g = el('g', { class: 'lm-mod', tabindex: 0, role: 'button', 'data-id': m.id, 'data-level': m.phase === 'F3' ? 1 : 2, transform: `rotate(${rot} ${cx} ${cy})` });
      g.appendChild(el('rect', { x: m.x, y: m.y, width: m.w, height: m.h, rx: 6, fill: c.fill, stroke: c.stroke, 'stroke-width': 2, filter: 'url(#lm-soft)' }));
      g.appendChild(el('rect', { x: m.x, y: m.y, width: m.w, height: m.h, rx: 6, fill: 'none', stroke: c.stroke, 'stroke-width': 1, 'stroke-dasharray': m.phase === 'F3' ? '5 5' : null, opacity: .5 }));
      g.appendChild(txt(cx, cy + 4, m.label, 'lm-mlbl')).setAttribute('data-level', 3);
      g.addEventListener('click', () => select(m));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(m); } });
      mods.appendChild(g);
    });
    // flora — palms (level 3)
    (doc.landscape || []).forEach(L => {
      if (L.type !== 'palm') return;
      (L.points || []).forEach(([px, py]) => {
        const g = el('g', { 'data-level': lvl(L.level), class: 'lm-palm' });
        g.appendChild(el('path', { d: `M${px} ${py} q3 -22 0 -40`, stroke: '#5fc08a', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }));
        g.appendChild(el('path', { d: `M${px} ${py - 38} q-14 -6 -24 -14`, stroke: '#5fc08a', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }));
        g.appendChild(el('path', { d: `M${px} ${py - 38} q14 -6 24 -14`, stroke: '#5fc08a', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }));
        g.appendChild(el('path', { d: `M${px} ${py - 38} q-6 -16 -10 -26`, stroke: '#67c994', 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' }));
        g.appendChild(el('path', { d: `M${px} ${py - 38} q6 -16 10 -26`, stroke: '#67c994', 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' }));
        flora.appendChild(g);
      });
    });
    // zone labels
    (doc.labels || []).forEach(L => { const t = txt(L.x, L.y, L.text, 'lm-zone'); t.setAttribute('data-level', lvl(L.level)); labels.appendChild(t); });

    applyLevel(state.level);
  }

  function rectAt(o, fill, stroke, rx) {
    const r = el('rect', { x: o.x, y: o.y, width: o.w, height: o.h, rx: rx || 8, fill, stroke, 'stroke-width': 1.5, 'data-level': o.level || 1 });
    if (o.rot) r.setAttribute('transform', `rotate(${o.rot} ${o.x + o.w / 2} ${o.y + o.h / 2})`);
    return r;
  }

  // ------------------------------------------------------ detail levels ----
  function applyLevel(n) {
    state.level = n;
    svg.querySelectorAll('[data-level]').forEach(node => {
      const lv = +node.getAttribute('data-level') || 1;
      node.style.display = lv <= n ? '' : 'none';
    });
    document.querySelectorAll('[data-setlevel]').forEach(b =>
      b.setAttribute('aria-pressed', (+b.getAttribute('data-setlevel') === n) ? 'true' : 'false'));
    const zl = (state.doc.zoom_levels || []).find(z => z.level === n);
    if ($('lmLevelNote') && zl) $('lmLevelNote').textContent = `Nivel ${n} · ${zl.label} — ${zl.detail}`;
  }

  // --------------------------------------------------------- selection ----
  function select(m) {
    svg.querySelectorAll('.lm-mod').forEach(g => g.classList.toggle('sel', g.getAttribute('data-id') === m.id));
    const host = $('lmInfo'); if (!host) return;
    host.innerHTML =
      `<div class="lm-info-h"><b>${esc(m.label)}</b><span class="chip">${esc(m.phase)}</span></div>` +
      `<dl class="lm-info-dl">` +
      `<div><dt>Tipo</dt><dd>${esc(m.type)}</dd></div>` +
      `<div><dt>Dimensión</dt><dd>${esc(m.dim)}</dd></div>` +
      `<div><dt>Orientación</dt><dd>${esc(m.orientation)}</dd></div>` +
      `<div><dt>Estado</dt><dd>${esc(m.state)}</dd></div>` +
      `</dl>`;
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ----------------------------------------------------------- zoom/pan ----
  function zoom(factor) {
    const v = state.vb, cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    let nw = v.w * factor, nh = v.h * factor;
    const min = state.base.w * 0.25, max = state.base.w * 2.2;
    nw = Math.max(min, Math.min(max, nw)); nh = nw * (state.base.h / state.base.w);
    setVB({ x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh });
  }
  function reset() { setVB({ ...state.base }); }

  function bindPan() {
    const pt = (e) => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
    svg.addEventListener('pointerdown', (e) => { state.drag = { ...pt(e), vb: { ...state.vb } }; svg.setPointerCapture(e.pointerId); svg.classList.add('grab'); });
    svg.addEventListener('pointermove', (e) => {
      if (!state.drag) return; const p = pt(e), d = state.drag;
      setVB({ x: d.vb.x - (p.x - d.x) * d.vb.w, y: d.vb.y - (p.y - d.y) * d.vb.h, w: d.vb.w, h: d.vb.h });
    });
    const end = () => { state.drag = null; svg.classList.remove('grab'); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end); svg.addEventListener('pointerleave', end);
    svg.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
  }

  // ------------------------------------------------------------- export ----
  function downloadBlob(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  function exportJson() {
    const snap = { ...state.doc, exported_view: { detail_level: state.level }, conceptual_only: true };
    downloadBlob(new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' }), 'logos-parador-container-layout.json');
  }
  function svgString() {
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', NS); clone.setAttribute('viewBox', `${state.base.x} ${state.base.y} ${state.base.w} ${state.base.h}`);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }
  function exportSvg() { downloadBlob(new Blob([svgString()], { type: 'image/svg+xml' }), 'logos-parador-container-layout.svg'); }
  function exportPng() {
    const scale = 2, w = state.base.w * scale, h = state.base.h * scale;
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.fillStyle = '#06141d'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      cv.toBlob(b => b && downloadBlob(b, 'logos-parador-container-layout.png'), 'image/png');
    };
    img.onerror = () => exportSvg(); // graceful fallback
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString());
  }

  // --------------------------------------------------------------- boot ----
  function bind() {
    $('lmZoomIn') && $('lmZoomIn').addEventListener('click', () => zoom(0.82));
    $('lmZoomOut') && $('lmZoomOut').addEventListener('click', () => zoom(1.22));
    $('lmZoomReset') && $('lmZoomReset').addEventListener('click', reset);
    document.querySelectorAll('[data-setlevel]').forEach(b => b.addEventListener('click', () => applyLevel(+b.getAttribute('data-setlevel'))));
    $('lmExportJson') && $('lmExportJson').addEventListener('click', exportJson);
    $('lmExportSvg') && $('lmExportSvg').addEventListener('click', exportSvg);
    $('lmExportPng') && $('lmExportPng').addEventListener('click', exportPng);
    bindPan();
  }

  async function load() {
    if (!svg) return;
    try {
      const doc = await fetch(DATA).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      state.doc = doc;
      state.base = { x: doc.viewBox.x, y: doc.viewBox.y, w: doc.viewBox.width, h: doc.viewBox.height };
      setVB({ ...state.base });
      bind(); render(doc); applyLevel(1);
      if ($('lmStatus')) $('lmStatus').textContent = `${(doc.modules || []).length} módulos · maqueta conceptual`;
      checkGeoreferencedSource();
    } catch (e) {
      if ($('lmInfo')) $('lmInfo').innerHTML = `<p class="lm-note">No se pudo cargar la maqueta (${esc(e.message)}). ` +
        `Esta vista requiere el build externo (ruta relativa a <code>../data/layout/container-layout.json</code>).</p>`;
    }
  }

  // Source-of-truth check: if the georeferenced layout polygons (edited on Map
  // Calibration over the REAL map) exist, say so — this stylized maquette is
  // secondary/legacy and must not be presented as the primary source.
  function checkGeoreferencedSource() {
    const note = $('lmSourceNote'); if (!note) return;
    fetch('../data/calibration/layout-polygons.seed.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        note.innerHTML = (d && d.usable_area_polygon)
          ? 'Existe un layout <b>georreferenciado</b> sobre el mapa real — esa es la versión vigente.'
          : '';
      })
      .catch(() => { /* offline / no build — banner text already states the source of truth */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
