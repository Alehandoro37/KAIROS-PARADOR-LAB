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

## 4. Degradación elegante y cadena de fallback

**Cadena de fallback si Overpass falla/expira:** `localStorage` → seed estático → banner.

- Si hay **cache en localStorage** se muestra ese contexto + banner “mostrando cache de
  localStorage”.
- Si no, se intenta el **seed estático** `data/osm/osm-context-seed.json` + banner “mostrando
  seed estático”.
- Si tampoco, banner “Contexto OSM no disponible” y el mapa/polígono/calibración **siguen
  intactos**.
- Sin internet, el resto de la página funciona (Leaflet es local; `lot.json` y calibración son
  locales). Solo se pierde la posibilidad de **traer** contexto nuevo.

## 5. Cache (Pages-safe: GitHub Pages NO permite escritura)

**GitHub Pages sirve un filesystem read-only: la app NUNCA escribe al repo en runtime.**

- **Cache runtime = `localStorage` del navegador.** Clave **`kairos.osmContext.v1`**. Objeto:
  `{ timestamp, bbox, centroid, radius, featureCounts, geojson }`. Se guarda tras cada fetch
  exitoso.
- **Seed / fallback versionado = `data/osm/osm-context-seed.json`** (archivo **estático** de
  respaldo, **nunca** se sobrescribe desde la app). En este repo viene poblado con un snapshot
  OSM real del entorno (mismo esquema que el cache: `{ ..., geojson }`).
- **Export = descarga manual** (botón **“Export context JSON”**): genera y descarga un archivo;
  **no** intenta escribir al repo.
- **Clear cache** borra **solo** `localStorage` (no toca archivos).
- Al abrir, la restauración es **pasiva** (sin red a Overpass): primero `localStorage`, luego
  el seed estático. Eso **no** es un fetch a Overpass.

## 6. Export

**“Export context JSON”** descarga `calibration-context-export.json` (`schema:
kairos.calibration-context/v1`) con: **bbox**, **centroide**, **radio**, **timestamp**,
**endpoint** y **query Overpass**, **featureCounts** por capa + total, el **geojson** y
**advertencias PRELIMINAR**.

## 7. Rutas (relativas, un solo origen)

Desde `geometry-engine/map-calibration/`:
- `osm-context.js` (local) · usa `window.MapCalibration.map` expuesto por `calibration.js`.
- `fetch ../../data/osm/osm-context-seed.json` (seed estático de fallback, opcional, try/catch).
- `fetch https://overpass-api.de/api/interpreter` (externo, **solo** al pulsar el botón).
- Cache runtime: `localStorage` (sin ruta de archivo; no se escribe a disco).

Todo client-side; sin backend → **Pages-compatible**.

## 8. Fuera de alcance (explícito)

Sin routing, sin simulación de tráfico, sin predicciones de IA, sin Three.js, sin backend,
sin persistencia compleja. Solo lectura y visualización de contexto OSM, marcado PRELIMINAR.
