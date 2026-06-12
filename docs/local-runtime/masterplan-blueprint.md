# Masterplan Blueprint V1 — Conceptual Spatial Design Overlay

> Capa **conceptual** de diseño maestro sobre el lote Logos. Dibuja los 17 elementos del
> programa de forma **paramétrica y relativa** al polígono WGS84 de `data/lot.json`, con el
> contexto OSM ya validado como referencia. **PRELIMINAR · CONCEPTUAL — NO APTO PARA USO
> LEGAL / CATASTRAL / CONSTRUCCIÓN.** No es arquitectura, no es catastro. No modifica
> `lot.json` ni el Geometry Engine v2 ni la capa Map Calibration.

## 1. Qué es y cómo se activa

- Página nueva: `geometry-engine/masterplan/index.html`.
- Se abre desde la landing (`web/index.html` → botón **“Masterplan Blueprint”**) o directo en
  `…/geometry-engine/masterplan/`.
- Módulos ES (relativos, Pages-compatibles):
  `masterplan.js` (motor + render Canvas 2D) · `masterplan-data.js` (programa paramétrico) ·
  `masterplan-export.js` (export JSON + PNG).

## 2. Por qué Canvas 2D (no Leaflet)

El render conceptual se dibuja en un **Canvas 2D** propio (proyección equirectangular local
del polígono, igual criterio que el Engine v2). Ventaja clave: el **export PNG es nativo**
(`canvas.toBlob`) y sin tiles externos no hay *tainting* de CORS. El lote se dibuja en
**proporciones reales** y el contexto OSM (vías/férreo/agua del seed) se proyecta como líneas
tenues alrededor para orientación. Es un “mapa” conceptual fiel en proporción, sin imágenes
de tiles.

## 3. Modelo paramétrico (relativo al lote)

- Se construye el marco local del lote: `s` = eje longitudinal a lo largo del frente A→B
  (lado vial), `t` = profundidad hacia el interior. `len` y `maxT` se derivan del polígono.
- **Cada elemento se posiciona por fracciones de `(len, maxT)`** y se dimensiona en **metros
  reales**. Así, si el polígono cambia, el programa se **reubica** automáticamente; los
  tamaños de los módulos siguen siendo reales.
- **No se hardcodea lat/lon.** Todo deriva del polígono y su centroide.
- **Conflicto:** un elemento es **CONFLICTIVO** si alguno de sus vértices cae **fuera** del
  polígono (test punto-en-polígono en coordenadas mundo). Se dibuja con contorno rojo punteado
  y un `!`, y se marca `conflictive:true` en el export. Ej.: el *Área de expansión futura* se
  extiende a propósito más allá del lote actual → su conflicto es **significativo** (el
  crecimiento requeriría suelo fuera del predio).

## 4. Los 17 elementos

1 Lote Logos · 2 Contexto OSM (si disponible) · 3 Acceso principal · 4 Acceso de servicio ·
5 Parqueo lineal (banda hacia el frente vial) · 6 Plaza Central Logos (elipse) · 7 Centro de
mesas · 8 Restaurantes / módulos gastronómicos (anillo alrededor de la plaza) · 9 Restaurante
principal · 10 Café / mirador ferroviario (al frente, hacia el corredor férreo) · 11 Hostal /
hotel boutique (futuro) · 12 Spa / wellness (futuro) · 13 Jardines tropicales · 14 Senderos
peatonales · 15 Zona de eventos · 16 Área de expansión futura · 17 Zona técnica
(baños/residuos/servicios).

Geometría: edificios = rectángulos conceptuales; plaza = elipse; restaurantes = módulos en
anillo alrededor de la plaza; zonas verdes/eventos/parqueo = áreas suaves; senderos = líneas;
parqueo orientado a lo largo del frente vial (A→B, sensiblemente paralelo a la vía OSM).

## 5. UI

Toggles por capa (12 grupos) con leyenda de colores · **Reset view** · **Export JSON** ·
**Export PNG** · panel de **áreas aproximadas** (lote, huella del programa, por capa, conteo de
conflictivos) · banner prominente **“NO APTO PARA USO LEGAL / CATASTRAL / CONSTRUCCIÓN”** y
marca de agua diagonal **PRELIMINAR · CONCEPTUAL**.

## 6. Exports

- **Export JSON** → `masterplan-export.json` (`schema: kairos.masterplan/v1`,
  `status: "PRELIMINAR CONCEPTUAL"`): versión, fecha, frame (len/fondo/centroide), área del
  lote, lista de objetos (capa, tipo, área aprox, `future`, `conflictive`, geometría en `(s,t)`
  metros, centro aprox lat/lon), áreas por capa, fuente (`lot.json` + `osm-context-seed.json`),
  `precisionNote` y `warnings`.
- **Export PNG** → `masterplan-render.png`: captura del canvas conceptual.

## 7. Precisión honesta (recordatorio de auditoría)

Coordenadas y áreas son **APROXIMADAS** (~metros), derivadas de un polígono **trazado a mano
sobre Google Earth**. **No se muestran 7 decimales** que aparenten exactitud catastral: áreas a
m² entero, longitudes a 1 decimal, lat/lon a 5 decimales (~1 m). Verdad geográfica precisa /
levantada en el sistema: **ninguna**. Esto sirve para **exploración espacial preliminar**, no
para linderos, áreas legales ni construcción.

## 8. Aislamiento

- **No** modifica `data/lot.json`, ni `geometry-engine/v2/`, ni `geometry-engine/map-calibration/`.
- Independiente: no importa código de otras capas. Solo **lee** `lot.json` y el seed OSM.
- Client-side, sin backend, sin APIs nuevas → local runtime y GitHub Pages compatibles.
