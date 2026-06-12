# Map Calibration Layer V1 — Leaflet + OpenStreetMap

> Capa de **calibración visual PRELIMINAR**. Superpone el polígono de `data/lot.json`
> sobre un mapa base OpenStreetMap para compararlo con la infraestructura cercana.
> **No es catastro, no es topografía, no es georreferenciación oficial.** No modifica
> `data/lot.json`.

## 1. Qué es y cómo se activa

- Página nueva: `geometry-engine/map-calibration/index.html`.
- Se abre desde la landing (`web/index.html` → botón **“Map Calibration”** en el hero) o
  directamente en `…/geometry-engine/map-calibration/`.
- Convive con el Geometry Engine v2 sin tocarlo: es una carpeta hermana independiente.

## 2. Supuesto geográfico (importante)

El brief anticipaba que `lot.json` podría estar en **coordenadas locales (metros)**. En este
repo **no es así**: `data/lot.json` ya está en **EPSG:4326 (WGS84, lon/lat)** —el polígono
fue trazado por el propietario sobre Google Earth (`Logos.kml`). Por tanto **se superpone
directo** sobre OSM sin inventar ningún anclaje catastral.

Eso **no** lo convierte en topografía: el georreferenciado del KML está **sin verificar**.
Para permitir alineación fina sin falsear datos, la capa ofrece una **transformación de
calibración manual** marcada PRELIMINAR, con identidad por defecto (no altera nada hasta que
el usuario la mueve):

```
p' = offset + R(rotaciónDeg) · escala · (p − centroide)
```

- **pivote** = centroide del polígono `lot.json`.
- rotación/escala se aplican en un marco equirectangular local (`cos(lat0)`) para que sean
  visualmente isotrópicas a la latitud del sitio.
- controles: `offsetLat`, `offsetLon` (grados), `escala`, `rotaciónDeg`.
- “Reset calibración” vuelve a identidad; “Reset view” reencuadra al polígono.

La calibración es un **ajuste del usuario**, no una corrección métrica ni una fuente de
verdad. `data/lot.json` sigue siendo la única fuente geométrica y **no se escribe**.

## 3. Dependencias y offline

- **Leaflet 1.9.4 vendorizado** en `geometry-engine/map-calibration/vendor/leaflet/`
  (`leaflet.js`, `leaflet.css`, `images/`). **No CDN, no API key, no billing.** El shell de
  la página funciona offline y en Pages porque el JS/CSS del mapa es local.
- **Solo los tiles** (`https://{s}.tile.openstreetmap.org/...`) requieren internet.
- **Degradación elegante:** si los tiles no cargan (`tileerror`), aparece un aviso “sin
  conexión” y el mapa queda con fondo de contexto oscuro, pero **el polígono, los vértices,
  el centroide, las coordenadas y el export siguen funcionando**.
- El selector **Mapa base** alterna entre *OpenStreetMap* y *Contexto/satélite — placeholder*
  (sin tiles externos, válido offline). El “satélite” es un **placeholder** deliberado: no se
  usa ningún proveedor con clave ni facturación.

## 4. Controles

| Control | Efecto |
|---|---|
| Polígono del lote (toggle) | muestra/oculta el polígono |
| Vértices + centroide (toggle) | muestra/oculta marcadores |
| Mapa base (select) | OSM ↔ placeholder offline |
| Reset view | reencuadra al polígono |
| Calibración (4 sliders) | offset lat/lon, escala, rotación (PRELIMINAR) |
| Reset calibración | vuelve a identidad |
| Exportar calibración (JSON) | descarga `calibration-export.json` |

## 5. Export JSON

`Exportar calibración` descarga un JSON versionado (`schema: kairos.site-calibration/v1`) con:
centro y zoom actuales del mapa, base usada y si los tiles cargaron, **bounds** del polígono,
**centroide** del lote, **polígono transformado**, ruta de la fuente (`../../data/lot.json`),
la **transformación de calibración** y las advertencias **PRELIMINAR**. El archivo semilla
versionado vive en `data/calibration/site-calibration.json` y se carga al iniciar (si está
presente) para fijar vista y calibración inicial.

## 6. Rutas (relativas, un solo origen)

Desde `geometry-engine/map-calibration/`:
- `../../web/css/lab.css` (tema compartido, sin modificar)
- `vendor/leaflet/leaflet.css` · `vendor/leaflet/leaflet.js` (local)
- `fetch ../../data/lot.json` (obligatorio) · `fetch ../../data/calibration/site-calibration.json` (opcional, try/catch)

Mismo contrato que el resto del lab: todo relativo, resuelve igual en
`http://127.0.0.1:8080/` y en GitHub Pages bajo subruta de proyecto.

## 7. Invariantes

1. **No** se modifica `data/lot.json`; **no** se llama topografía/catastro; todo dice PRELIMINAR.
2. Leaflet local ⇒ la app no se rompe sin red (solo se pierden los tiles).
3. La capa es independiente: **no** toca ni importa el Geometry Engine v2 modular.
