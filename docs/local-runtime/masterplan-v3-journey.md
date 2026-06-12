# Masterplan Blueprint V3 — Visitor Journey / Cinematic Experience

> Evolución de V2.1 hacia una **experiencia espacial narrativa e inmersiva** (eco-retreat
> tropical / destination roadside stop / hospitality / cinematic). **PRELIMINAR · CONCEPTUAL
> — NO APTO PARA USO LEGAL / CATASTRAL / CONSTRUCCIÓN.** Todo Canvas 2D, sin Three.js / WebGL
> pesado / Firebase / backend / GIS / frameworks. No modifica `lot.json`, Engine v2 ni Map
> Calibration.

## 1. Qué se agregó (sobre V2.1)

- **Visitor Journey** (modo guiado): botón **Start Journey**, **Prev/Next**, **Auto** (autoplay),
  cámara suave, highlights dinámicos. **9 paradas:** Arrival Gateway · Hidden Parking Garden ·
  Central Organic Plaza · Tropical Restaurant Pavilions · Railway Café · Sunset Lounge · Fire
  Gathering Node · Wellness Grove · Future Expansion Reserve. Cada parada: la cámara centra y
  hace zoom suave, un **spotlight** oscurece el resto, se aplica una **atmósfera** (tono) y
  aparece un **caption narrativo** sobre el canvas.
- **Cámara cinemática** (`camera-utils.js`): vista `{cx, cy, zoom}` en mundo, transiciones
  con easing (`easeInOutCubic`), presets de zoom. Solo recorrido guiado (no pan/zoom libre).
- **Atmósfera ampliada** (`atmosphere-renderer.js`): washes ambient/sunset/night, fog depth,
  halos, canopy shadows, pathway illumination, spotlight de journey, tonos tropicales cálidos.
- **Escala humana** (`landscape-symbols.js`): siluetas, mesas y bancas **sutiles** (no
  caricatura), sembradas de forma determinista cerca de plaza/pabellones/lounge/railway;
  densidad modulada por las experience layers.
- **Railway identity**: el borde ferroviario como identidad central — *Railway Lounge identity
  zone*, *viewing edge/mirador*, **linear lighting** a lo largo del frente y promenade de
  inspiración ferroviaria (sin simulación de trenes).
- **Experience layers** (visuales, sin audio): toggles **Night ambiance · Social energy ·
  Quiet wellness · Market atmosphere** + **Human scale**, que retiñen/cargan la escena.

## 2. Módulos (todos vanilla, Canvas 2D)

```
masterplan.js            orquesta: proyección, marco, resolve+conflictos, cámara, journey, UI, export
masterplan-data.js       programa + JOURNEY (9) + EXPERIENCE_LAYERS + HUMAN_CLUSTERS + TONES
masterplan-export.js     JSON v3 (journey_nodes, experience_layers, atmosphere_settings, …)
bezier-path-utils.js     curvas orgánicas + RNG determinista
landscape-symbols.js     palmas/árboles + escala humana (persona/mesa/banca) + stipple
atmosphere-renderer.js   glow/fire/wedge + washes/fog/halo/shadow/pathway/spotlight
composition-grid.js      jerarquía (ORDER), background, vignette, deck/mirador, label, watermark
camera-utils.js          cámara cinemática (pan/zoom suave, easing)  ← NUEVO en V3
```

## 3. Render loop y performance

- Fuera del journey el render es **bajo demanda** (input/resize): 1 frame, coste despreciable.
- Durante el journey o una transición de cámara corre un `requestAnimationFrame` que muestrea
  la cámara, avanza el autoplay (dwell ~4.2 s) y redibuja; **se detiene** al terminar la
  animación o al parar el journey. ~40 formas + overlays en Canvas 2D → fluido en 60 fps.
- **Riesgos/deuda:** la escala humana usa scatter sembrado (estable, no físico); los washes se
  apilan con alfas bajos (si se activan muchas experience layers a la vez la escena se
  oscurece — intencional). Sin workers, sin assets externos.

## 4. Exports

- **Export JSON** → `masterplan-v3-export.json` (`schema: kairos.masterplan/v3`,
  `conceptual_only: true`): además de los grupos V2 (`experience_zones`, `circulation`,
  `landscape`, `atmosphere_nodes`) añade **`journey_nodes`** (9 paradas con foco, tono, zoom,
  highlight, centro aprox), **`experience_layers`** (estado activo), **`atmosphere_settings`**,
  **`view_corridors`** y **`identity_zones`** (railway). Precisión honesta (~metros).
- **Export PNG** → `masterplan-v3-render.png`: captura el canvas tal cual (glow, washes,
  spotlight y foco del journey incluidos; escena auto-dibujada → canvas no *tainted*).

## 5. Lenguaje visual

Eco-hospitality / tropical retreat / railway heritage / boutique roadside / cinematic landscape
diagram. Tonos cálidos, glow, vegetación; **sin** ingeniería fría, CAD duro, colores agresivos
ni UI corporativa. Todo marcado PRELIMINAR · CONCEPTUAL; banner y marca de agua permanentes.

## 6. Aislamiento

No toca `data/lot.json`, ni `geometry-engine/v2/`, ni `geometry-engine/map-calibration/`. Solo
**lee** `lot.json` y el seed OSM. Client-side, sin backend ni APIs nuevas → Pages + local +
offline (sin seed, el contexto no se dibuja y el resto funciona).
