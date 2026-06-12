/* KAIROS PARADOR — Masterplan Blueprint V1 / data
 * PRELIMINAR · CONCEPTUAL. Parametric conceptual program for the Logos lot, defined
 * RELATIVE to the lot's local frame (s = along A→B frontage, t = depth) so it
 * repositions automatically if the polygon changes. Centres are fractions of
 * (length, depth); sizes are real metres. NO hardcoded lat/lon. Nothing here is
 * architecture, cadastre or buildable design. */

export const WARNING = 'NO APTO PARA USO LEGAL / CATASTRAL / CONSTRUCCIÓN';

export const LAYERS = [
  { key: 'lot',       label: '1 · Lote Logos',            color: '#8fe5ff' },
  { key: 'context',   label: '2 · Contexto OSM',          color: '#5f7d96' },
  { key: 'access',    label: '3·4 · Accesos',             color: '#ffd36b' },
  { key: 'parking',   label: '5 · Parqueo lineal',        color: '#aab4d4' },
  { key: 'plaza',     label: '6 · Plaza Central',         color: '#ff9e6b' },
  { key: 'dining',    label: '7·8·9·10 · Gastronomía',    color: '#ffb36b' },
  { key: 'lodging',   label: '11·12 · Hospedaje (futuro)', color: '#c89bff' },
  { key: 'green',     label: '13 · Jardines tropicales',  color: '#7dffa8' },
  { key: 'paths',     label: '14 · Senderos',             color: '#dfeaf2' },
  { key: 'events',    label: '15 · Zona de eventos',      color: '#ffe08a' },
  { key: 'expansion', label: '16 · Expansión (futuro)',   color: '#9a8bd0' },
  { key: 'technical', label: '17 · Zona técnica',         color: '#b0553c' }
];

// ---- geometry helpers (in s,t metres) --------------------------------------
function rect(cs, ct, w, d) {
  return [[cs - w / 2, ct - d / 2], [cs + w / 2, ct - d / 2], [cs + w / 2, ct + d / 2], [cs - w / 2, ct + d / 2]];
}
function ellipse(cs, ct, a, b, seg = 28) {
  const p = [];
  for (let i = 0; i < seg; i++) { const th = (i / seg) * 2 * Math.PI; p.push([cs + a * Math.cos(th), ct + b * Math.sin(th)]); }
  return p;
}
function shoelace(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; s += x1 * y2 - x2 * y1; }
  return Math.abs(s / 2);
}

/* Build the 17-element conceptual program for a lot of local length L and depth T.
 * Returns plain objects with geometry already resolved to (s,t) metres. */
export function buildBlueprint(L, T) {
  const els = [];
  // n = canonical element number (1..17). Some elements have several shapes
  // (5 gastronomic modules, 2 gardens, 2 paths) — they share their parent's n.
  const add = (n, o) => { o.n = n; els.push(o); return o; };

  // 1 · Lote Logos — drawn from the real projected polygon by the engine.
  add(1, { id: 'lot', label: 'Lote Logos', layer: 'lot', kind: 'lot' });
  // 2 · Contexto OSM — drawn from the seed by the engine if available.
  add(2, { id: 'context', label: 'Contexto OSM (si disponible)', layer: 'context', kind: 'context' });

  // 3 · Acceso principal — gateway at the road frontage, wide half.
  add(3, { id: 'access-main', label: 'Acceso principal', layer: 'access', kind: 'access',
        pts: [[0.55 * L, 0.0], [0.55 * L, 0.16 * T]] });
  // 4 · Acceso de servicio — frontage near the B/C end.
  add(4, { id: 'access-service', label: 'Acceso de servicio', layer: 'access', kind: 'access',
        pts: [[0.88 * L, 0.0], [0.88 * L, 0.13 * T]] });

  // 5 · Parqueo lineal — band along the frontage (road side), oriented along s.
  const parking = rect(0.60 * L, 0.17 * T, 46, 5.5);
  add(5, { id: 'parking', label: 'Parqueo lineal', layer: 'parking', kind: 'poly', pts: parking, area: shoelace(parking) });

  // 6 · Plaza Central Logos — ellipse, biased to the deep (C) half of the lot.
  const plazaC = [0.62 * L, 0.42 * T];
  const plaza = ellipse(plazaC[0], plazaC[1], 8, 4.5);
  add(6, { id: 'plaza', label: 'Plaza Central Logos', layer: 'plaza', kind: 'poly', pts: plaza, area: Math.PI * 8 * 4.5 });
  // 7 · Centro de mesas — inner ring of the plaza.
  const tables = ellipse(plazaC[0], plazaC[1], 4, 2.5);
  add(7, { id: 'tables', label: 'Centro de mesas', layer: 'dining', kind: 'poly', pts: tables, area: Math.PI * 4 * 2.5 });

  // 8 · Restaurantes / módulos gastronómicos around the plaza (5 modules, all n=8).
  for (let i = 0; i < 5; i++) {
    const th = (18 + i * 72) * Math.PI / 180;
    const cs = plazaC[0] + 10.5 * Math.cos(th), ct = plazaC[1] + 3.8 * Math.sin(th);
    const r = rect(cs, ct, 4.5, 3);
    add(8, { id: `module-${i + 1}`, label: `Módulo gastronómico ${i + 1}`, layer: 'dining', kind: 'poly', pts: r, area: 4.5 * 3 });
  }
  // 9 · Restaurante principal — anchor behind the plaza.
  const main = rect(0.64 * L, 0.50 * T, 11, 4.5);
  add(9, { id: 'restaurant-main', label: 'Restaurante principal', layer: 'dining', kind: 'poly', pts: main, area: 11 * 4.5 });
  // 10 · Café / mirador ferroviario — at the frontage facing the rail.
  const cafe = rect(0.42 * L, 0.13 * T, 6, 3.2);
  add(10, { id: 'cafe-mirador', label: 'Café / mirador ferroviario', layer: 'dining', kind: 'poly', pts: cafe, area: 6 * 3.2 });

  // 11 · Hostal / hotel boutique (futuro).
  const hostal = rect(0.82 * L, 0.60 * T, 13, 5.5);
  add(11, { id: 'hostal', label: 'Hostal / hotel boutique (futuro)', layer: 'lodging', kind: 'poly', future: true, pts: hostal, area: 13 * 5.5 });
  // 12 · Spa / wellness (futuro).
  const spa = rect(0.91 * L, 0.58 * T, 8.5, 4.5);
  add(12, { id: 'spa', label: 'Spa / wellness (futuro)', layer: 'lodging', kind: 'poly', future: true, pts: spa, area: 8.5 * 4.5 });

  // 13 · Jardines tropicales — soft green buffers (shallow A-end + back strip).
  const g1 = [[8, 0.8], [34, 0.8], [30, 9.5], [10, 2.5]];
  add(13, { id: 'garden-wedge', label: 'Jardines tropicales (cuña)', layer: 'green', kind: 'poly', pts: g1, area: shoelace(g1) });
  const g2 = [[60, 15.5], [84, 20.5], [83, 21.8], [58, 16.2]];
  add(13, { id: 'garden-back', label: 'Jardines tropicales (fondo)', layer: 'green', kind: 'poly', pts: g2, area: shoelace(g2) });

  // 14 · Senderos peatonales — spine + longitudinal connector (both n=14).
  add(14, { id: 'path-spine', label: 'Sendero (eje acceso–plaza)', layer: 'paths', kind: 'polyline', pts: [[0.55 * L, 1.0], [plazaC[0], plazaC[1]], [0.64 * L, 0.55 * T]] });
  add(14, { id: 'path-long', label: 'Sendero longitudinal', layer: 'paths', kind: 'polyline', pts: [[30, 7], [plazaC[0], 8], [83, 9]] });

  // 15 · Zona de eventos — open area beside the plaza.
  const events = rect(0.52 * L, 0.34 * T, 16, 5);
  add(15, { id: 'events', label: 'Zona de eventos', layer: 'events', kind: 'poly', pts: events, area: 16 * 5 });

  // 16 · Área de expansión futura — extends beyond the current lot on purpose
  // (its conflict flag is meaningful: future growth would need land outside).
  const exp = [[0.93 * L, 2], [1.06 * L, 4], [1.07 * L, 20], [0.92 * L, 18]];
  add(16, { id: 'expansion', label: 'Área de expansión futura', layer: 'expansion', kind: 'poly', future: true, pts: exp, area: shoelace(exp) });

  // 17 · Zona técnica — baths / waste / services, tucked at a back corner.
  const tech = rect(0.46 * L, 0.40 * T, 5, 3);
  add(17, { id: 'technical', label: 'Zona técnica (baños/residuos/servicios)', layer: 'technical', kind: 'poly', pts: tech, area: 5 * 3 });

  return els;
}
