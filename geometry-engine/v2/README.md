# Geometry Engine v2 — estructura modular

> **Engine Modularization V1 — conservative split.** El antiguo `engine.js` (un único
> IIFE) se dividió en módulos ES **sin cambiar comportamiento visual**: mismo canvas,
> mismos sliders, mismos cálculos, mismo export JSON, mismas rutas. La lógica se movió
> tal cual; sólo se reubicaron las variables de cierre en `runtime/state.js`.

## Carga

`index.html` carga un único punto de entrada como módulo:

```html
<script type="module" src="engine.js"></script>
```

`engine.js` sólo registra el handler de `resize` y arranca `init()`. Todo lo demás se
importa con rutas **relativas** (`./…`, `../…`), que resuelven idéntico bajo un servidor
estático local (`http://127.0.0.1:8080/geometry-engine/v2/`) y bajo GitHub Pages
(subruta de proyecto). No hay rutas absolutas ni CDNs.

## Mapa de módulos

```
engine.js                 entry: addEventListener('resize') + init().catch()
├─ render/canvas.js       resize, fit, pathPoly, drawBand, drawLineST, drawModule, draw
│   ├─ core/basis.js          toST, fromST            (frame s,t)
│   ├─ core/modules.js        computeModules, sampleAreas
│   │   ├─ core/constraints.js   isRestrictedST
│   │   └─ geo/polygon.js        area, pointInPoly
│   └─ ui/params.js            params, constraints, updateOutputs → ui/dom.js
└─ runtime/init.js        init, applyLayout, loadManifest (fetch lot/manifest/layouts)
    ├─ geo/projection.js      projectLL
    ├─ geo/vector.js          sub, add, mul, dot, len, norm
    └─ runtime/config.js      LOT_URL, MANIFEST_URL, ids, ISO, PAD
runtime/state.js          estado mutable compartido (DOM refs, lot, local, basis, …)
debug/inspect.js          placeholder documentado (no importado, sin efecto)
```

## Carpetas

| Carpeta | Rol | Contenido |
|---|---|---|
| `geo/` | Geometría pura (sin DOM ni estado) | `projection.js`, `polygon.js`, `vector.js` |
| `core/` | Frame `(s,t)` y lógica de dominio | `basis.js`, `constraints.js`, `modules.js` |
| `render/` | Pipeline Canvas 2D | `canvas.js` |
| `ui/` | Controles ↔ valores | `dom.js`, `params.js` |
| `runtime/` | Config, estado y arranque | `config.js`, `state.js`, `init.js` |
| `debug/` | Reservado (placeholder) | `inspect.js` *(no importado)* |

## Invariantes

1. **Rutas relativas** en todos los imports y `fetch` — no introducir `/data/…` absoluto
   (rompería Pages bajo subruta).
2. `data/` sigue siendo la **fuente de verdad única**; nada de geometría se duplica.
3. El comportamiento visual es el del split: cualquier cambio futuro de features va aparte.
