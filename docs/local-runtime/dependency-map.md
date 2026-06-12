# Mapa de dependencias — Runtime local

> Qué carga qué. Todas las aristas son **rutas relativas**; ninguna sale a internet en
> tiempo de ejecución (no hay CDNs, no hay fuentes web externas, no hay frameworks).

## 1. Grafo de carga

```
index.html
  └─(meta refresh)─▶ web/index.html

web/index.html
  ├─ <link>   css/lab.css
  ├─ <script> js/main.js
  │             └─ fetch ../data/costs.json
  ├─ <a> ../geometry-engine/v2/        (navegación)
  └─ <a> ../docs/concept/concept.md    (navegación)

geometry-engine/v2/index.html
  ├─ <link>   ../../web/css/lab.css     ← CSS compartido con la landing
  ├─ <a>      ../../web/index.html      (volver)
  └─ <script> engine.js
                ├─ fetch ../../data/lot.json                       (obligatorio)
                ├─ fetch ../../data/layouts/manifest.json          (opcional, try/catch)
                └─ fetch ../../data/layouts/<file>.json            (al elegir versión)
```

## 2. Tabla recurso → consumidores → criticidad

| Recurso | Lo carga | Mecanismo | Si falla… |
|---|---|---|---|
| `web/css/lab.css` | `web/index.html`, `geometry-engine/v2/index.html` | `<link>` | Sin estilos (ambas vistas) |
| `web/js/main.js` | `web/index.html` | `<script>` | Sin scrollspy ni tabla de costos |
| `data/costs.json` | `web/js/main.js` | `fetch` | Tabla muestra mensaje de error controlado |
| `geometry-engine/v2/engine.js` | engine `index.html` | `<script>` | Engine no arranca |
| `data/lot.json` | `engine.js` | `fetch` | **Crítico**: panel "Error", canvas no dibuja |
| `data/layouts/manifest.json` | `engine.js` | `fetch` (try/catch) | Selector de versiones queda vacío; el resto funciona |
| `data/layouts/layout-v0.1.json` | `engine.js` | `fetch` (on change) | No carga esa versión |
| `data/layouts/layout-v0.2-setbacks.json` | `engine.js` | `fetch` (on change) | No carga esa versión |

## 3. Dependencias externas

### Runtime (navegador): **NINGUNA**
- 0 librerías JS de terceros. `engine.js` y `main.js` son vanilla.
- 0 CSS/fuentes externas. `lab.css` usa stacks de sistema (`ui-monospace`, `Arial`).
- 0 imágenes remotas. El polígono del hero es SVG inline; los renders son placeholders.
- ⇒ **Funciona 100 % offline** una vez servido.

### Tooling (solo desarrollo, no se envía al navegador)
| Dependencia | Para qué | Obligatoria |
|---|---|---|
| `python3` | `http.server` | Una de las dos |
| `node` + `npm` | `live-server` / `http-server` | Una de las dos |
| `live-server` (`package.json` devDep) | auto-reload | Opcional |

## 4. Archivos referenciados que NO existen (404)

Citados en la especificación pero ausentes en `main` (no consumidos por ningún código):

| Ruta | Quién la pediría | Realidad |
|---|---|---|
| `data/context-infrastructure.json` | — (ningún `fetch` la referencia) | No existe |
| `data/context-kml-normalized.json` | — (ningún `fetch` la referencia) | No existe |

`engine.js` **no** intenta cargarlas, así que su ausencia no genera errores en consola.

## 5. Datos sí versionados (no son artefactos)

`data/**` y `web/assets/renders/.gitkeep` son **fuentes** del lab y se versionan. El único
artefacto generado es `layout-export-*.json` (descarga del botón Export), excluido en
`.gitignore`. `node_modules/` (si se usa la vía npm) también se ignora.

## 6. Acoplamiento y puntos de cambio

- **CSS compartido**: editar `web/css/lab.css` afecta a landing **y** engine a la vez.
- **Contrato de datos**: `engine.js` espera `lot.polygon = [{id,lon,lat}…]` y construye la
  base local con los dos primeros vértices (A,B). `main.js` espera `costs.phases[].items[]`
  con `label` y `value_cop`. Cambiar el esquema JSON obliga a tocar el consumidor.
- **Profundidad de ruta**: si se mueve `geometry-engine/v2/` a otra profundidad, hay que
  reajustar los `../../` de `engine.js` y del `<link>`/`<a>` de su HTML.
