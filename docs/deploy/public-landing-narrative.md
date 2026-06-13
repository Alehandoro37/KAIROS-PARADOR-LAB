# Public Landing Narrative V1 — Logos Parador commercial entry

> Landing pública **ligera y comercial** que recibe al visitante en
> `/external/landing/logos-parador/` antes de enviarlo al masterplan / journey / mapa técnicos.
> **No** es deploy, **no** toca producción ni `kairos-portals-html`, **no** cambia Engine v2 /
> Masterplan / Map Calibration / `lot.json`.

## 1. Qué es y dónde vive

- **Fuente versionada:** `external/landing/logos-parador/index.html` (en el repo).
- **Auto-contenida:** un solo HTML con **CSS y SVG inline**, **sin librerías**, **sin fuentes ni
  imágenes externas** → offline-friendly. Solo **rutas relativas**.
- Estilo: premium, tropical, hospitality, carretera + ferrocarril; sobrio, no técnico.

## 2. Secciones

- **Hero:** “Logos Parador — Guacarí” + subtítulo *“Un destino gastronómico, ferroviario y
  tropical junto a la Troncal de Occidente”* + arte SVG (atardecer, palmas, vía hacia el sol,
  polígono del lote abstracto).
- **CTAs:** **Ver Masterplan** (`./masterplan/`) · **Iniciar Journey** (`./journey/`) ·
  **Ver Mapa** (`./map/`). Se repiten al pie de la sección Experience.
- **Why here:** Panamericana / Troncal · Ferrocarril del Pacífico · Río Guabas · Cercanía a
  Guacarí.
- **Experience:** Plaza Logos · Railway Café · Tropical Pavilions · Sunset Lounge · Future
  Wellness.
- **Disclaimer discreto:** *“Visualización conceptual preliminar. No sustituye levantamiento
  topográfico, catastral ni diseño arquitectónico final.”*

## 3. Cómo entra al build

`tools/build-external.mjs` copia la landing como **índice público** de la ruta:

```
build/external/landing/logos-parador/
  index.html        ← COPIA de external/landing/logos-parador/index.html  (landing comercial)
  masterplan/       ← redirect → ../geometry-engine/masterplan/
  map/              ← redirect → ../geometry-engine/map-calibration/
  journey/          ← redirect → ../geometry-engine/masterplan/?journey=1&auto=1
  web/ geometry-engine/ data/ docs/concept/   (mirror verbatim)
```

La landing reemplaza el antiguo *redirect-a-web*; los **redirects internos** de
`masterplan/ · map/ · journey/` se mantienen. Las CTAs de la landing apuntan a esas rutas
relativas, que resuelven a las páginas reales (vía redirect) bajo cualquier subpath
(GitHub Pages o Firebase). El “lab” interno sigue accesible en `web/` (back-link de las páginas).

## 4. Validación

`tools/validate-external-build.mjs` (script `npm run validate:external`) ahora además comprueba:

- La **landing pública** existe y **no** es un redirect.
- Está el **hero** “Logos Parador”.
- Están los **3 CTAs** (`./masterplan/`, `./journey/`, `./map/`) con su etiqueta.
- Está el **disclaimer**.
- Cada CTA **resuelve** a una página de entrada existente.

Se mantienen los checks previos: rutas absolutas peligrosas, `localhost`, `file://`, Google API
keys, `firebase deploy`, archivos críticos, Leaflet vendorizado y los redirects internos.
Devuelve **exit ≠ 0** si algo falla.

## 5. Build + test local

```bash
npm run build:external      # genera build/ (git-ignored)
npm run validate:external   # PASS / FAIL (exit code)
npm run serve:external      # http://127.0.0.1:8090
# abrir: http://127.0.0.1:8090/external/landing/logos-parador/
#   → landing comercial; CTAs llevan a masterplan / journey / map
```

## 6. Notas / riesgos

- En **GitHub Pages del repo fuente**, la landing se sirve en
  `…/KAIROS-PARADOR-LAB/external/landing/logos-parador/`, pero sus CTAs (`./masterplan/`, etc.)
  solo resuelven en el **build** (donde existen los directorios redirect). En la fuente esos
  subdirectorios no están versionados (son artefactos de build). Para una demo completa, usar
  `npm run build:external` + `serve:external`. Las páginas técnicas siguen accesibles
  directamente en Pages bajo `geometry-engine/...`.
- Sin secretos, sin APIs nuevas, sin dependencias. Tiles OSM (en el mapa) siguen siendo la única
  necesidad de red, con degradación elegante.
- Idempotente: la landing es fuente; el build la copia. Mismo input → mismo output.
