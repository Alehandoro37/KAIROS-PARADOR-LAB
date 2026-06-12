/* KAIROS PARADOR — Masterplan Blueprint V2 / data
 * PRELIMINAR · CONCEPTUAL. Experiential landscape program for the Logos lot — a
 * tropical, open, sequential eco-retreat roadside landmark (NOT a CAD box plan).
 * Parametric and RELATIVE to the lot frame (s = along the A→B frontage, t = depth)
 * so it repositions if the polygon changes. Centres are fractions of (length,
 * depth); sizes are real metres. No hardcoded lat/lon. Not architecture, not
 * cadastre, not structural design. */

export const WARNING = 'NO APTO PARA USO LEGAL / CATASTRAL / CONSTRUCCIÓN';

export const GROUPS = ['program', 'circulation', 'landscape', 'atmosphere'];

export const LAYERS = [
  // program
  { key: 'lot',         group: 'program',     label: 'Lote Logos',                  color: '#8fe5ff' },
  { key: 'context',     group: 'program',     label: 'Contexto OSM',                color: '#5f7d96' },
  { key: 'arrival',     group: 'program',     label: 'Llegada · signage KAIROS',    color: '#ffd36b' },
  { key: 'plaza',       group: 'program',     label: 'Plaza orgánica · corazón',    color: '#ff9e6b' },
  { key: 'pavilions',   group: 'program',     label: 'Pabellones gastronómicos',    color: '#ffb36b' },
  { key: 'railway',     group: 'program',     label: 'Railway lounge · mirador',    color: '#e8b06b' },
  { key: 'future',      group: 'program',     label: 'Reservas futuras (eco/wellness)', color: '#c89bff' },
  { key: 'technical',   group: 'program',     label: 'Zona técnica (discreta)',     color: '#b0553c' },
  // circulation
  { key: 'promenade',   group: 'circulation', label: 'Promenade longitudinal',      color: '#dfeaf2' },
  { key: 'paths',       group: 'circulation', label: 'Senderos experienciales',     color: '#bcd6ea' },
  // landscape
  { key: 'canopy',      group: 'landscape',   label: 'Tropical canopy',             color: '#3f8f64' },
  { key: 'gardens',     group: 'landscape',   label: 'Jardines / pockets',          color: '#7dffa8' },
  { key: 'buffers',     group: 'landscape',   label: 'Buffers verdes',              color: '#5fae7f' },
  { key: 'parkingGreen',group: 'landscape',   label: 'Parqueo velado (gravel+árboles)', color: '#8ba88f' },
  { key: 'palms',       group: 'landscape',   label: 'Palmas (acento)',             color: '#9ad29a' },
  // atmosphere
  { key: 'gathering',   group: 'atmosphere',  label: 'Gathering nodes',             color: '#ffd08a' },
  { key: 'lighting',    group: 'atmosphere',  label: 'Atmosphere lighting',         color: '#ffe1a0' },
  { key: 'fire',        group: 'atmosphere',  label: 'Fogata conceptual',           color: '#ff8a5c' },
  { key: 'lounge',      group: 'atmosphere',  label: 'Música / lounge',             color: '#ffb0d0' },
  { key: 'view',        group: 'atmosphere',  label: 'View corridors → vía',        color: '#bfe8ff' }
];

export const MOOD = [
  { color: '#3f8f64', label: 'Canopy', note: 'sombra tropical, verde profundo' },
  { color: '#ff9e6b', label: 'Corazón', note: 'plaza orgánica, encuentro' },
  { color: '#ffe1a0', label: 'Glow', note: 'luz cálida, noche, fogata' },
  { color: '#dfeaf2', label: 'Promenade', note: 'recorrido secuencial, curvo' },
  { color: '#e8b06b', label: 'Railway', note: 'memoria férrea, mirador' },
  { color: '#bfe8ff', label: 'Vistas', note: 'marcos visuales hacia el tren' }
];

export const groupOf = (key) => (LAYERS.find(l => l.key === key) || {}).group || 'program';

// ---- geometry helpers (s,t metres) -----------------------------------------
function blob(cs, ct, rx, ry, lobes = 0, amp = 0, seg = 40, phase = 0) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * 2 * Math.PI;
    const k = 1 + amp * Math.sin(lobes * a + phase);
    pts.push([cs + rx * k * Math.cos(a), ct + ry * k * Math.sin(a)]);
  }
  return pts;
}
function shoelace(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; s += x1 * y2 - x2 * y1; }
  return Math.abs(s / 2);
}

/* Build the experiential program for a lot of local length L and depth T. */
export function buildExperience(L, T) {
  const els = [];
  const add = (n, o) => { o.n = n; o.group = groupOf(o.layer); els.push(o); return o; };
  const closed = (id, n, layer, pts, style, extra = {}) =>
    add(n, { id, layer, kind: 'closed', smooth: true, style, pts, area: shoelace(pts), ...extra });
  const open = (id, n, layer, pts, extra = {}) =>
    add(n, { id, layer, kind: 'open', smooth: true, pts, ...extra });
  const node = (id, n, layer, s, t, r, extra = {}) =>
    add(n, { id, layer, kind: 'node', s, t, r, conflict: 'center', ...extra });

  const PC = [0.60 * L, 0.42 * T];   // plaza centre (deep half, biased to C)

  // 1 · Lote Logos / 2 · Contexto OSM (drawn by the engine).
  add(1, { id: 'lot', label: 'Lote Logos', layer: 'lot', kind: 'lot', conflict: 'none' });
  add(2, { id: 'context', label: 'Contexto OSM (si disponible)', layer: 'context', kind: 'context', conflict: 'none' });

  // 3 · ARRIVAL — soft drop-off curve + KAIROS signage, vegetal transition.
  open('arrival-dropoff', 3, 'arrival', [[0.42 * L, 1.6], [0.50 * L, 3.0], [0.58 * L, 1.6]], { label: 'Drop-off suave (llegada)', conflict: 'vertices' });
  node('arrival-signage', 3, 'arrival', 0.50 * L, 3.4, 2.2, { label: 'Signage KAIROS', glow: true });

  // 4 · PLAZA CENTRAL — enlarged organic heart.
  closed('plaza', 4, 'plaza', blob(PC[0], PC[1], 12, 5, 6, 0.06), 'solid', { label: 'Plaza Central Logos (orgánica)', conflict: 'center' });

  // 5 · PAVILIONS — independent gastronomic pavilions (round pods, not boxes),
  // separated by greenery, biased to the front/side arc.
  const pang = [215, 265, 315, 25];
  pang.forEach((deg, i) => {
    const th = deg * Math.PI / 180;
    const cs = PC[0] + 14 * Math.cos(th), ct = PC[1] + 5 * Math.sin(th);
    closed(`pavilion-${i + 1}`, 5, 'pavilions', blob(cs, ct, 3.0, 2.6, 4, 0.10), 'solid', { label: `Pabellón gastronómico ${i + 1} (deck abierto)`, conflict: 'center' });
  });

  // 6 · RAILWAY LOUNGE EDGE — linear lounge band hugging the rail-side frontage,
  // plus a mirador/deck node framing the line.
  closed('railway-lounge', 6, 'railway', blob(0.44 * L, 2.9, 15, 1.7, 9, 0.10), 'soft', { label: 'Railway lounge (identity zone)', conflict: 'center', identity: true });
  node('railway-mirador', 6, 'railway', 0.34 * L, 2.2, 2.4, { label: 'Mirador / deck ferroviario (viewing edge)', glow: true, identity: true });
  // Railway-inspired LINEAR LIGHTING along the rail-side frontage (industrial+tropical).
  for (let i = 0; i < 5; i++) node(`rail-light-${i + 1}`, 6, 'railway', (0.30 + i * 0.075) * L, 1.4, 1.3, { label: `Railway linear light ${i + 1}`, glow: true });

  // 7 · FUTURE RESERVES — Eco Suites (inside, deep end) + Wellness Expansion
  // (reserve that reaches beyond the current lot → flagged CONFLICTIVO, meaningful).
  closed('future-suites', 7, 'future', blob(0.83 * L, 0.58 * T, 8, 4, 5, 0.08), 'soft', { future: true, label: 'Future Eco Suites (reserva)', conflict: 'center' });
  closed('future-wellness', 7, 'future', blob(0.96 * L, 0.60 * T, 7, 4, 5, 0.08), 'soft', { future: true, label: 'Future Wellness Expansion (reserva)', conflict: 'vertices' });

  // 8 · TECHNICAL — discreet, tucked at a back corner.
  closed('technical', 8, 'technical', blob(0.46 * L, 0.40 * T, 2.4, 1.8, 0, 0), 'soft', { label: 'Zona técnica (baños/residuos/servicios)', conflict: 'center' });

  // 9 · PROMENADE — organic longitudinal spine, arrival → plaza → deep end.
  open('promenade', 9, 'promenade', [[0.30 * L, 4], [0.42 * L, 6], [PC[0], PC[1]], [0.74 * L, 11], [0.88 * L, 12.5]], { label: 'Promenade longitudinal', conflict: 'vertices' });
  // 10 · EXPERIENTIAL PATHS — soft loops branching off the spine.
  open('path-front', 10, 'paths', [[0.46 * L, 3.5], [0.54 * L, 7], [0.62 * L, 4.5]], { label: 'Sendero (loop frente)', conflict: 'vertices' });
  open('path-back', 10, 'paths', [[0.66 * L, 8], [0.74 * L, 13], [0.82 * L, 10]], { label: 'Sendero (loop fondo)', conflict: 'vertices' });

  // 11 · TROPICAL CANOPY — large soft shade masses (semi-transparent).
  closed('canopy-mid', 11, 'canopy', blob(0.55 * L, 0.60 * T, 18, 6, 6, 0.10), 'veg', { label: 'Tropical canopy (centro)', conflict: 'center' });
  closed('canopy-back', 11, 'canopy', blob(0.80 * L, 0.66 * T, 12, 5, 6, 0.10, 1.2), 'veg', { label: 'Tropical canopy (fondo)', conflict: 'center' });
  // 12 · GARDENS / pockets.
  closed('garden-wedge', 12, 'gardens', blob(0.20 * L, 0.22 * T, 12, 3, 5, 0.14), 'veg', { label: 'Jardín tropical (cuña A)', conflict: 'center' });
  closed('garden-pocket', 12, 'gardens', blob(0.50 * L, 0.30 * T, 6, 2.4, 6, 0.12), 'veg', { label: 'Pocket landscape (plaza)', conflict: 'center' });
  // 13 · GREEN BUFFERS — soft strip along the back edge.
  closed('buffer-back', 13, 'buffers', blob(0.72 * L, 0.73 * T, 14, 2.2, 10, 0.12), 'veg', { label: 'Buffer verde (fondo)', conflict: 'center' });
  // 14 · PARKING VEILED — gravel + trees band hugging the frontage, low presence.
  closed('parking-veiled', 14, 'parkingGreen', blob(0.62 * L, 0.16 * T, 22, 2.2, 12, 0.08), 'faint', { label: 'Parqueo velado (gravel + árboles)', conflict: 'center' });
  // 15 · PALMS — accent trees scattered over edges/parking.
  [[0.34, 0.10], [0.48, 0.10], [0.66, 0.10], [0.80, 0.12], [0.30, 0.30], [0.88, 0.45]].forEach((f, i) =>
    node(`palm-${i + 1}`, 15, 'palms', f[0] * L, f[1] * T, 1.4, { label: `Palma ${i + 1}` }));

  // 16 · GATHERING NODES.
  node('gather-plaza', 16, 'gathering', PC[0], PC[1], 3.0, { label: 'Gathering (plaza)', glow: true });
  node('gather-lounge', 16, 'gathering', 0.70 * L, 0.40 * T, 2.4, { label: 'Gathering (lounge)', glow: true });
  // 17 · ATMOSPHERE LIGHTING — warm glow along the promenade.
  [[0.34, 0.18], [0.46, 0.26], [PC[0] / L, PC[1] / T], [0.74, 0.48], [0.86, 0.55], [0.40, 0.12]].forEach((f, i) =>
    node(`light-${i + 1}`, 17, 'lighting', f[0] * L, f[1] * T, 1.8, { label: `Light node ${i + 1}`, glow: true }));
  // 18 · FOGATA conceptual.
  node('fire', 18, 'fire', 0.58 * L, 0.40 * T, 2.0, { label: 'Fogata conceptual', glow: true });
  // 19 · MÚSICA / LOUNGE.
  node('lounge', 19, 'lounge', 0.66 * L, 0.46 * T, 2.2, { label: 'Música / lounge', glow: true });
  // 20 · VIEW CORRIDORS — visual frames from the plaza/mirador out to the railway
  // (open toward the rail beyond the frontage; apex inside → conflict 'origin').
  add(20, { id: 'view-plaza', layer: 'view', kind: 'wedge', label: 'View corridor (plaza → vía)', conflict: 'origin',
            pts: [[0.58 * L, 6], [0.50 * L, -6], [0.66 * L, -6]] });
  add(20, { id: 'view-mirador', layer: 'view', kind: 'wedge', label: 'View corridor (mirador → vía)', conflict: 'origin',
            pts: [[0.34 * L, 3], [0.29 * L, -6], [0.39 * L, -6]] });

  return els;
}

/* ===================== V3 — Visitor Journey / Cinematic ===================== */

// 9-stop guided narrative. `focus` = element id (the camera centres on it); `tone`
// drives the atmospheric wash; `highlight` = layers emphasised; `zoom` preset.
export const JOURNEY = [
  { id: 'arrival',   title: 'Arrival Gateway',              focus: 'arrival-signage',  tone: 'warm',     zoom: 2.2, highlight: ['arrival', 'promenade'], text: 'Signage KAIROS y una llegada suave entre vegetación: el umbral del eco-retreat.' },
  { id: 'parking',   title: 'Hidden Parking Garden',        focus: 'parking-veiled',   tone: 'day',      zoom: 2.0, highlight: ['parkingGreen', 'palms'], text: 'El auto desaparece: gravel, palmas y árboles velan el parqueo. Cero presencia dura.' },
  { id: 'plaza',     title: 'Central Organic Plaza',        focus: 'plaza',            tone: 'warm',     zoom: 2.3, highlight: ['plaza', 'gathering', 'paths'], text: 'El corazón orgánico: mesas, encuentro, música y luz cálida bajo la marquesina.' },
  { id: 'pavilions', title: 'Tropical Restaurant Pavilions', focus: 'pavilion-1',      tone: 'market',   zoom: 2.4, highlight: ['pavilions', 'lighting'], text: 'Pabellones independientes con decks abiertos, separados por jardín — tropical market.' },
  { id: 'railway',   title: 'Railway Café',                 focus: 'railway-mirador',  tone: 'industrial', zoom: 2.5, highlight: ['railway', 'view'], text: 'El borde ferroviario como identidad: café, mirador y marcos visuales hacia la vía.' },
  { id: 'sunset',    title: 'Sunset Lounge',                focus: 'lounge',           tone: 'sunset',   zoom: 2.4, highlight: ['lounge', 'lighting'], text: 'Tarde cálida: lounge, tonos de atardecer y warmth tropical sobre el andén.' },
  { id: 'fire',      title: 'Fire Gathering Node',          focus: 'fire',             tone: 'night',    zoom: 2.6, highlight: ['fire', 'gathering'], text: 'De noche, la fogata reúne: glow cálido, siluetas y conversación bajo el cielo.' },
  { id: 'wellness',  title: 'Wellness Grove',               focus: 'future-suites',    tone: 'wellness', zoom: 2.1, highlight: ['future', 'gardens', 'canopy'], text: 'Un claro tranquilo: eco-suites futuras entre canopy y jardines — quiet wellness.' },
  { id: 'expansion', title: 'Future Expansion Reserve',     focus: 'future-wellness',  tone: 'day',      zoom: 1.9, highlight: ['future'], text: 'Reserva conceptual para crecer: wellness expansion más allá del lote actual.' }
];

// Visual-only experience layers (no real audio) — toggles that retint/charge the scene.
export const EXPERIENCE_LAYERS = [
  { key: 'night',   label: 'Night ambiance',   tone: 'night',   note: 'azules nocturnos + glow' },
  { key: 'social',  label: 'Social energy',    tone: 'warm',    note: 'más gente + chispa cálida' },
  { key: 'wellness',label: 'Quiet wellness',   tone: 'wellness',note: 'verdes suaves, calma' },
  { key: 'market',  label: 'Market atmosphere',tone: 'market',  note: 'glow de mercado tropical' }
];

// Subtle human-scale clusters (people / tables / benches) anchored by lot fractions.
export const HUMAN_CLUSTERS = [
  { kind: 'table',  cf: 0.60, tf: 0.42, n: 6, spread: 9 },
  { kind: 'person', cf: 0.60, tf: 0.42, n: 10, spread: 11 },
  { kind: 'person', cf: 0.55, tf: 0.30, n: 6, spread: 8 },
  { kind: 'person', cf: 0.66, tf: 0.46, n: 4, spread: 5 },
  { kind: 'bench',  cf: 0.40, tf: 0.13, n: 3, spread: 9 },
  { kind: 'person', cf: 0.34, tf: 0.11, n: 3, spread: 5 }
];

// Atmospheric tone palette (used by both journey stops and experience layers).
export const TONES = {
  warm: '#ffcaa0', day: null, market: '#ffb070', industrial: '#9fb6c8',
  sunset: '#ff8a5e', night: '#0a1a3a', wellness: '#9fe0c0'
};
