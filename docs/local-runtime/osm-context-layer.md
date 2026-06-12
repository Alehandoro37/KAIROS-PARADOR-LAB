# Context Infrastructure Layer V1 — OSM / Overpass

> Capa **opcional** dentro de `geometry-engine/map-calibration/` que enriquece el mapa con
> infraestructura **real** del entorno (vías, ferrocarril, agua, edificaciones, usos de
> suelo, amenities) obtenida **client-side** de la **Overpass API** pública alrededor del
> centroide del lote. **PRELIMINAR — contexto OSM, no catastro ni topografía.** No hay
> backend, ni Google APIs, ni billing, ni simulaciones. No modifica `data/lot.json` ni el
> Geometry Engine v2.

## 1. Qué es y cómo se activa

- Archivo: `geometry-engine/map-calibration/osm-context.js`, cargado por la página del Map
  Calibration **después** de `calibration.js`.
- Se opera desde el panel, fieldset **“Contexto OSM / Overpass”**: ajustar **radio** (500 m por
  defecto, 100–1500), pulsar **“Cargar contexto (1 consulta)”**. Toggles por capa, opacidad,
  **Limpiar cache** y **Exportar contexto**.
- Es **aditiva**: el mapa, el polígono `lot.json` y la calibración siguen funcionando aunque
  el contexto nunca se cargue. `calibration.js` solo se amplió con un handle de solo lectura
  (`window.MapCalibration`) para compartir el mapa; su comportamiento no cambió.

## 2. Fetch manual, único, con timeout (rate limiting)

- **NO hay auto-fetch al abrir** ni polling. Cada consulta a Overpass ocurre **solo** al pulsar
  el botón → **1 fetch por clic**. Un guard (`inFlight`) impide dos consultas simultáneas.
- **Timeout defensivo** de 25 s vía `AbortController`; la query lleva `[timeout:25]`.
- Endpoint público `https://overpass-api.de/api/interpreter` (POST `data=`). Overpass tiene
  **rate limits públicos**; por eso la política es 1 consulta manual y no reintentos en cadena.

### Query Overpass (alrededor del centroide, radio R)
```
[out:json][timeout:25];
( way["highway"](around:R,LAT,LON);
  way["railway"](around:R,LAT,LON);
  way["waterway"](around:R,LAT,LON);
  way["natural"="water"](around:R,LAT,LON);
  way["building"](around:R,LAT,LON);
  way["landuse"](around:R,LAT,LON);
  node["amenity"](around:R,LAT,LON); );
out geom;
```

## 3. Capas separadas

| Capa | Origen OSM | Render |
|---|---|---|
| roads | `way[highway]` | polilíneas cian |
| rail | `way[railway]` | polilíneas ámbar punteadas |
| water | `way[waterway]`, `way[natural=water]` | líneas/polígonos azul |
| buildings | `way[building]` | polígonos gris translúcido |
| labels | `node[amenity]`, `way[landuse]` | marcadores/polígonos verdes con tooltip |

Cada capa es un `L.layerGroup` propio (toggle independiente). Se dibujan en un **pane**
dedicado (`ctxPane`, z-index 350) **por debajo** del polígono del lote, que se trae al frente
tras cada render. La opacidad afecta a todas las capas de contexto.

## 4. Degradación elegante (sin red / API caída)

- Si Overpass **falla o expira**: si hay **cache local** se muestra ese contexto + banner
  “Overpass no disponible — mostrando cache local”; si **no** hay cache, banner “Contexto OSM
  no disponible” y el mapa/polígono/calibración **siguen intactos**.
- Sin internet, el resto de la página funciona (Leaflet es local; `lot.json` y calibración son
  locales). Solo se pierde la posibilidad de **traer** contexto nuevo.

## 5. Cache local (Pages-safe: sin escritura a disco)

- El cache **real** se guarda en **`localStorage`** del navegador (clave
  `kairos:osm-context-cache/v1`) tras cada fetch exitoso, y como JSON descargable vía
  **Exportar contexto**.
- En **GitHub Pages el filesystem es read-only**: **nunca** se escribe a disco en runtime.
- `data/runtime/osm-context-cache.json` es una **semilla versionada y VACÍA** (`elements: []`).
  Existe para que la ruta sea estable y servir de **fallback** offline si `localStorage` está
  vacío. Puede reemplazarse a mano por un export real y commitearse para precargar contexto.
- Al abrir, la restauración de cache es **pasiva** (sin red): primero `localStorage`, luego la
  semilla. Eso **no** es un fetch a Overpass.

## 6. Export

**“Exportar contexto”** descarga `calibration-context-export.json` (`schema:
kairos.calibration-context/v1`) con: **bbox**, **centroide**, **radio**, **timestamp**,
**endpoint** y **query Overpass**, **conteo de features** por capa + total, momento del fetch,
ruta de fuente y **advertencias PRELIMINAR**.

## 7. Rutas (relativas, un solo origen)

Desde `geometry-engine/map-calibration/`:
- `osm-context.js` (local) · usa `window.MapCalibration.map` expuesto por `calibration.js`.
- `fetch ../../data/runtime/osm-context-cache.json` (semilla, opcional, try/catch).
- `fetch https://overpass-api.de/api/interpreter` (externo, **solo** al pulsar el botón).

Todo client-side; sin backend → **Pages-compatible**.

## 8. Fuera de alcance (explícito)

Sin routing, sin simulación de tráfico, sin predicciones de IA, sin Three.js, sin backend,
sin persistencia compleja. Solo lectura y visualización de contexto OSM, marcado PRELIMINAR.
