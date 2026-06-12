# Stability Checkpoint V1 — modular engine verified

Registro de verificación tras `Engine Modularization V1 — conservative split`. Confirma
que la división del antiguo `geometry-engine/v2/engine.js` (IIFE único) en módulos ES
**no cambió el comportamiento**: mismos cálculos, mismo render, mismas rutas, compatible
con runtime local y con GitHub Pages.

## Commits cubiertos

| Hito | Commit | Mensaje |
|---|---|---|
| Infra local | `b848774` | `Local Runtime V1 — offline development setup` |
| Modularización | `52736a7` | `Engine Modularization V1 — conservative split` |

## 1. Integridad de carga (servidor local `python3 -m http.server 8080`)

- Todos los recursos del engine responden **200**: `index.html`, `engine.js` y los 13
  submódulos (`geo/ core/ render/ ui/ runtime/ debug/`), más `data/lot.json`,
  `data/layouts/manifest.json` y `data/costs.json`.
- Los `.js` se sirven como `text/javascript` (local) y `application/javascript` (Pages),
  ambos válidos para `<script type="module">`.
- Carga real en navegador: el log del servidor muestra el grafo completo de imports
  solicitado y `init()` ejecutando sus `fetch` de datos. Únicos 404: `favicon.ico` y
  `apple-touch-icon*.png` (peticiones automáticas del navegador, ajenas a la app y previas
  al cambio).

## 2. Equivalencia de cálculos (prueba headless en Node)

Se compararon los módulos nuevos contra la lógica **original extraída de git** (`HEAD`
previo al split), con los mismos inputs (`data/lot.json` + valores por defecto de los
sliders, y un segundo escenario con todas las restricciones activas):

| Comprobación | Resultado |
|---|---|
| `projectLL` (proyección lon/lat→m) | idéntico |
| `basis.len`, `basis.maxT` (frame s,t) | idéntico |
| `sampleAreas` (área total / restringida / útil) | idéntico |
| `computeModules` (válidos, rechazados, esquinas, motivos) | idéntico |

Escenario por defecto: 1132.96 m² totales, 0 restringida, **3 módulos válidos** (coincide
con la expectativa documentada en `render-pipeline.md §7`). Escenario restringido: 1132.96
m² totales/restringidos, 0 útil, **5 módulos rechazados** — idéntico en ambas versiones.

## 3. Equivalencia de render

Diff de literales (normalizado por espacios) entre la función `draw` original y
`render/canvas.js`: **conjunto idéntico** de colores (`#061526`, `#8fe5ff`, `#ffb36b`,
`#b0553c`, rgba de bandas…), dashes (`[8,6]`, `[2,7]`, `[7,5]`), anchos de línea
(`1.6/2/2.2`), fuentes y rotación de marca de agua (`Math.PI/9`). Sin cambios de color,
offset ni proporción.

## 4. GitHub Pages

El workflow `.github/workflows/static.yml` no se modificó. Ambos commits desplegaron con
éxito (Actions: *Deploy static content to Pages*). El sitio live sirve `engine.js` (el
bootstrap modular) y los submódulos en **200**, sin 404 ni rutas rotas.

## 5. Métricas

- Punto de entrada `engine.js`: ~1.2 KB (solo wiring de `resize` + `init`).
- Total JS del engine v2: ~19 KB en 14 ficheros (antes: 1 fichero). Sin dependencias de
  terceros; sigue siendo vanilla y 100 % offline una vez servido.
- Rendimiento: el pipeline es idéntico (mismo muestreo de malla 0.4 m, mismo `requestAnimation`
  implícito por evento `input`); el coste extra es una sola descarga de 13 ficheros pequeños
  cacheables — sin impacto perceptible en FPS de interacción.

## 6. Deuda técnica / riesgos conocidos

- Estado mutable compartido en `runtime/state.js` (réplica fiel de las variables de cierre
  originales). Es deliberado y conservador; un refactor futuro podría inyectar estado
  explícitamente en vez de importarlo.
- `geo/polygon.js → area()` se conserva aunque no se invoca (era código muerto en el
  original; mantenerlo es lo conservador).
- `debug/inspect.js` es un placeholder sin importar (sin efecto en runtime).
- `package-lock.json` permanece sin versionar (fuera del alcance de `Local Runtime V1`; se
  regenera desde `package.json`).
- Verificación visual por captura de pantalla no realizada (computer-use ocupado por otra
  sesión); la confirmación de render se apoya en la carga real del grafo + `fetch` de datos
  observada en el log del servidor y en la equivalencia numérica/de literales.
