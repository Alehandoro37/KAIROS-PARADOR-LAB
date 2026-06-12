# Arquitectura — Runtime local

> Ámbito: cómo está montado **KAIROS-PARADOR-LAB** para ejecutarse en local/offline y por
> qué esa misma forma sirve sin cambios en GitHub Pages, Electron, móvil o un futuro v3 3D.

## 1. Naturaleza del sistema

Sitio **estático puro**. No hay servidor de aplicación, base de datos ni paso de build.
El "runtime" es el navegador + un servidor estático que entrega ficheros tal cual.

```
┌──────────────────────────────────────────────────────────────┐
│  Servidor estático (python http.server | live-server | Pages) │
│  Sirve el árbol del repo bajo un único origen HTTP            │
└───────────────┬──────────────────────────────────────────────┘
                │  HTTP GET (HTML, CSS, JS, JSON)
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Navegador (un origen → fetch() relativo = same-origin)       │
│                                                                │
│  /web/index.html ──┐                                           │
│     css/lab.css    │  Landing: scrollspy + tabla de costos     │
│     js/main.js  ───┘  fetch('../data/costs.json')              │
│                                                                │
│  /geometry-engine/v2/index.html ──┐                            │
│     engine.js  ────────────────────┘  IIFE, Canvas 2D          │
│        fetch('../../data/lot.json')                            │
│        fetch('../../data/layouts/manifest.json')               │
│        fetch('../../data/layouts/<version>.json')              │
└──────────────────────────────────────────────────────────────┘
```

## 2. Componentes

| Componente | Ruta | Rol | Dependencias runtime |
|---|---|---|---|
| Redirección raíz | `index.html` | `meta refresh` → `./web/` | — |
| Landing | `web/index.html` + `web/css/lab.css` + `web/js/main.js` | Narrativa del proyecto, scrollspy, tabla de costos | `data/costs.json` |
| Geometry Engine v2 | `geometry-engine/v2/index.html` + `engine.js` | Motor geométrico interactivo en Canvas | `data/lot.json`, `data/layouts/*` |
| Fuente de datos | `data/` | Verdad geométrica y económica (JSON) | — |

Los dos frentes (landing y engine) son **independientes**: comparten `web/css/lab.css` y la
carpeta `data/`, pero no se importan entre sí. Se puede abrir cualquiera por separado.

## 3. Principio de rutas: todo relativo, un solo origen

- `engine.js` resuelve datos con `../../data/...` (sube dos niveles desde
  `geometry-engine/v2/`).
- `web/js/main.js` resuelve con `../data/costs.json` (sube uno desde `web/`).
- No existe **ninguna** ruta absoluta (`/data/...`), ni URL `http(s)://`, ni `file://`
  hardcodeada. Verificado por escaneo del árbol completo.

Consecuencia: el mismo árbol resuelve idéntico bajo cualquier origen —
`http://localhost:8080/`, `https://usuario.github.io/KAIROS-PARADOR-LAB/` o un `app://`
de Electron— **sin tocar código**.

## 4. Por qué hace falta un servidor (y solo eso)

El único impedimento para "doble clic y listo" es el esquema `file://`: el navegador trata
cada archivo como origen `null` y **bloquea `fetch()`** de los JSON. Sirviendo por HTTP, el
origen pasa a ser `http://localhost:8080` y los `fetch()` relativos son same-origin → permitidos.
No es un problema de rutas; es la política de seguridad del navegador. Ver
`../local-runtime/render-pipeline.md` §CORS y `README_LOCAL_SETUP.md` §5.

## 5. Modos de ejecución soportados

| Modo | Cómo | Cambios de código |
|---|---|---|
| Local Python | `python3 -m http.server 8080` | ninguno |
| Local Node | `live-server` / `http-server` | ninguno |
| Lanzadores | `launch-local.command` / `.bat` | ninguno |
| GitHub Pages | `.github/workflows/static.yml` (push a `main`) | ninguno |

## 6. Trayectoria futura (sin reescribir el núcleo)

- **Electron**: ventana que carga `index.html`. Para conservar los `fetch()`, lo más limpio
  es registrar un `protocol` interno (p. ej. `app://`) que sirva el árbol como origen único,
  evitando relajar `webSecurity`. La capa de datos no cambia.
- **Wrapper móvil** (Capacitor/Tauri): el bundle estático se incrusta como webview con un
  origen local; idéntico contrato de rutas.
- **Motor 3D (v3)**: crear `geometry-engine/v3/` consumiendo la misma `data/lot.json`
  (mismo `projectLL` lon/lat→metros). `v2` queda intacto y navegable en paralelo. El
  aislamiento por carpeta de versión es deliberado para esto.

## 7. Invariantes a respetar

1. Mantener **todas las rutas relativas** — no introducir `/data/...` absoluto (rompería
   Pages bajo subruta de proyecto).
2. `data/` es **fuente de verdad única**; la geometría no se duplica en código.
3. Cada versión del engine vive en su carpeta (`v2/`, futura `v3/`) y no rompe a las demás.
