# Pipeline de render — Geometry Engine v2

> Cómo `geometry-engine/v2/engine.js` pasa de `data/lot.json` a píxeles en el `<canvas>`.
> Documentación de lectura; **no** describe cambios al código (la lógica visual no se tocó).

## 1. Arranque (`init`)

1. `fetch('../../data/lot.json')` → objeto `lot` con `polygon` (vértices lon/lat WGS84).
2. `projectLL(lot.polygon)` → proyección equirectangular local lon/lat→metros centrada en el
   centroide: `mLon = 111320·cos(lat0)`, `mLat = 111320`. Da coordenadas planas `{x,y}` en m.
3. Se construye la **base local** `basis` a partir de los dos primeros vértices A,B:
   - `u` = dirección unitaria A→B (eje longitudinal **s**).
   - `n` = normal a `u` (eje transversal **t**, profundidad).
   - `len` = |A→B|; `maxT` = profundidad máx. del polígono en t.
   Esto define el sistema **(s,t)** en el que se razonan retiros, bandas y módulos.
4. `loadManifest()` puebla el `<select>` de versiones (try/catch: si falla, sigue).
5. Listeners: cada slider/`select` dispara `updateOutputs()` + `draw()`. `resize` reajusta el
   canvas a `devicePixelRatio`.

## 2. Bucle de dibujo (`draw`) — se reejecuta en cada input

```
params()        ← lee sliders de bandas/módulos (parkBand, walkBand, boxType…)
constraints()   ← lee sliders de retiros (road/rail/oldRoad/water + axisOffset)
   │
   ├─ sampleAreas(c)     muestreo en malla 0.4 m → {total, restricted, useful}
   ├─ computeModules(p,c) coloca cajas ISO en (s,t); valida esquina a esquina
   │
   ▼  pintar en orden (de fondo a frente):
   1. clear + fondo #061526
   2. bandas: retiro E efectivo, buffer hídrico, parqueo, andén   (drawBand)
   3. ejes preliminares: vial / férreo / vía antigua              (drawLineST)
   4. polígono del lote (relleno + borde cian)                    (pathPoly)
   5. módulos válidos (relleno ámbar) y rechazados (punteado óxido)(drawModule)
   6. watermark "PRELIMINAR — PENDIENTE TOPOGRAFÍA"
   │
   ├─ lastExport = {...}   snapshot serializable (params, constraints, metrics, módulos)
   └─ metricsEl.innerHTML  áreas y conteos en el panel "Métricas"
```

## 3. Transformaciones geométricas

| Función | Qué hace |
|---|---|
| `toST(p)` / `fromST(s,t)` | convierte entre coordenadas mundo (m) y base local (s,t) |
| `isRestrictedST(st,c)` | marca un punto como restringido si pisa retiro vial/férreo (t bajo) o buffer hídrico (t alto) |
| `pointInPoly(pt,poly)` | ray casting: ¿el punto está dentro del polígono del lote? |
| `area(poly)` | área por fórmula del cordón (shoelace) |
| `computeModules` | por cada caja: calcula 4 esquinas en (s,t)→mundo; **válida** si las 4 caen dentro del polígono y fuera de toda restricción; si no, **rechazada** con motivo |
| `sampleAreas` | recorre la malla 0.4 m en (s,t): suma área total dentro del polígono y la fracción restringida → área útil |

## 4. Mapeo mundo → píxeles (`fit`)

`fit(pt)` calcula el bounding box del polígono proyectado, deriva una `scale` única para
encajarlo en `canvas - 2·pad` y **invierte el eje Y** (mundo: +Y arriba; canvas: +Y abajo).
`resize()` fija `canvas.width/height = clientSize · devicePixelRatio` y aplica
`ctx.setTransform(dpr,…)` para nitidez en pantallas Retina. Todo el dibujo trabaja en
unidades CSS; el DPR solo escala el backing store.

## 5. Export (único output del engine)

Botón **"Exportar layout (JSON)"** → serializa `lastExport` a un `Blob`
`application/json`, crea un `<a download="layout-export-setbacks.json">` y dispara la descarga
con `URL.createObjectURL`. **No hay export PNG**: el único formato de salida es JSON.

## 6. CORS — la única razón por la que importa servir

Todo el pipeline depende del paso 1 (`fetch` de `lot.json`). Bajo `file://` ese `fetch`
se bloquea (origen `null`) → `init()` cae en el `catch` → el panel muestra "Error" y el canvas
queda sin lote. Servido por HTTP (origen `http://localhost:8080`), el `fetch` relativo es
same-origin y el pipeline corre completo. Por eso "ejecutar local" = "servir estático", no
"cambiar rutas". Ver `README_LOCAL_SETUP.md` §5 y `architecture.md` §4.

## 7. Verificación visual esperada

Sirviendo y abriendo `…/geometry-engine/v2/`:
- El canvas dibuja el **polígono cian** del lote sobre fondo oscuro.
- Aparecen ejes punteados (vial cian, férreo ámbar, vía antigua) y la marca de agua diagonal.
- Con los valores por defecto hay **3 módulos** ISO 20'; mover `boxStart`/`boxCount`/retiros
  los reposiciona y algunos pasan a **rechazados** (punteado óxido) si salen del polígono o
  pisan una restricción.
- El panel **Métricas** reporta área KML, restringida, útil y conteo válidos/rechazados.
- DevTools → Network: `lot.json`, `manifest.json` y los `layout-*.json` en `200`,
  **0 errores de fetch**.
