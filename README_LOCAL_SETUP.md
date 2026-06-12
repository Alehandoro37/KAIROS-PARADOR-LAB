# KAIROS PARADOR — Linear Station Lab · Guía de ejecución LOCAL / OFFLINE

Esta guía deja el repo **KAIROS-PARADOR-LAB** corriendo en tu computador, sin GitHub Pages
y sin conexión a internet. El proyecto es **100 % estático** (HTML + CSS + JavaScript vanilla +
Canvas 2D + archivos JSON). No hay build, no hay backend, no hay framework.

> **Lo único que necesitas es un servidor estático local.** No por las rutas (ya son
> relativas y funcionan igual en Pages y en local), sino porque el navegador **bloquea
> `fetch()` de archivos JSON cuando abres el HTML con doble clic** (`file://`). Ver
> [§5 CORS](#5-por-qué-no-funciona-con-doble-clic-cors).

---

## 0. TL;DR (lo más rápido)

**macOS** — doble clic en `launch-local.command`
**Windows** — doble clic en `launch-local.bat`

Se abre el navegador en `http://localhost:8080/web/`. Para detener: `Ctrl + C` en la consola.

Alternativa manual, desde la raíz del repo:

```bash
python3 -m http.server 8080
# luego abre http://localhost:8080/web/
```

---

## 1. Requisitos

| Herramienta | ¿Para qué? | ¿Obligatoria? |
|---|---|---|
| **Navegador** (Chrome/Edge/Safari/Firefox) | Renderizar el lab | Sí |
| **Python 3** | Servidor estático `http.server` | Sí *(o Node)* |
| **Node ≥ 16 + npm** | Alternativa con auto-reload (`live-server`) | Opcional |
| **VS Code** | Editar y servir cómodamente | Recomendado |

macOS trae Python 3 preinstalado. En este equipo: `Python 3.9.6`, `Node v22`, `npm 10`.

---

## 2. Abrir el proyecto en VS Code

```bash
cd /Users/alejandrocarrillo/Desktop/KairosProjects/KAIROS-PARADOR-LAB
code .
```

O `Archivo → Abrir carpeta…` y selecciona `KAIROS-PARADOR-LAB`.

Estructura que verás:

```
KAIROS-PARADOR-LAB/
├─ index.html                  ← redirige a /web/
├─ web/                        ← landing (Linear Station Lab)
│  ├─ index.html
│  ├─ css/lab.css
│  └─ js/main.js
├─ geometry-engine/v2/         ← motor interactivo (Canvas)
│  ├─ index.html
│  └─ engine.js
├─ data/                       ← fuente de verdad (JSON)
│  ├─ lot.json                 ← polígono KML (WGS84)
│  ├─ costs.json
│  └─ layouts/ (manifest + versiones)
├─ docs/                       ← concepto, geometría, sitio + local-runtime/
├─ launch-local.command        ← lanzador macOS  (nuevo)
├─ launch-local.bat            ← lanzador Windows (nuevo)
├─ package.json                ← scripts npm     (nuevo)
└─ README_LOCAL_SETUP.md       ← este archivo    (nuevo)
```

---

## 3. Lanzar el servidor local — 3 formas

### Opción A — Lanzadores (cero configuración)
- macOS: `./launch-local.command` (o doble clic en Finder)
- Windows: `launch-local.bat` (doble clic)

Detectan Python o Node automáticamente, sirven en `:8080` y abren el navegador.

### Opción B — Python (recomendada, sin instalar nada)
```bash
cd KAIROS-PARADOR-LAB
python3 -m http.server 8080
```
Abre **`http://localhost:8080/web/`**.

### Opción C — Node + live-server (auto-reload al guardar)
```bash
cd KAIROS-PARADOR-LAB
npm install        # solo la 1ª vez; instala live-server en node_modules/
npm run dev        # sirve en :8080 y abre /web/ con recarga en vivo
```
Scripts disponibles en `package.json`:
| Comando | Qué hace |
|---|---|
| `npm run serve` | `python3 -m http.server 8080` (sin dependencias) |
| `npm run dev` | `live-server` en :8080 con auto-reload, abre el navegador |
| `npm start` | `live-server` en :8080 sin abrir navegador |
| `npm run serve:node` | `npx http-server` en :8080 (cache off) |

> **VS Code Live Server (extensión):** si la tienes instalada, clic derecho sobre
> `web/index.html` → **Open with Live Server**. Sirve en su propio puerto (`5500`).
> Funciona igual; solo cambia el número de puerto.

---

## 4. Abrir en el navegador

| Vista | URL local |
|---|---|
| **Landing (Linear Station Lab)** | `http://localhost:8080/web/` |
| **Geometry Engine v2** | `http://localhost:8080/geometry-engine/v2/` |
| Raíz (redirige a /web/) | `http://localhost:8080/` |

> Entra siempre por **`/web/`**, no por el archivo. Abrir `web/index.html` con `file://`
> rompe los `fetch()`.

---

## 5. Por qué NO funciona con doble clic (CORS)

Al abrir un `.html` directamente, el navegador usa el esquema `file://`. Bajo ese esquema,
`fetch('../data/costs.json')` y `fetch('../../data/lot.json')` se bloquean por la política
**same-origin / CORS** (origen `null`). Síntomas:

- La tabla de **Costos** muestra *"No se pudo cargar /data/costs.json…"*.
- El **Geometry Engine** muestra *"Error"* en el panel de métricas y el canvas no dibuja el lote.

**Solución:** servir por HTTP (`http://localhost`). Cualquiera de las opciones del §3 lo
resuelve, porque entonces el origen es `http://localhost:8080` y los `fetch()` relativos
son same-origin. **No se requiere ningún cambio de código.**

---

## 6. Verificación rápida (checklist)

Con el servidor en marcha:

1. **Landing** `…/web/` → carga el riel lateral, el polígono SVG animado y la tabla de
   Costos con filas (no el mensaje de error). El scrollspy resalta la "estación" activa.
2. **Engine** `…/geometry-engine/v2/` → el **canvas renderiza** el polígono del lote, las
   bandas, los ejes preliminares y los módulos ISO; el panel **Métricas** muestra áreas
   (no "Error").
3. Mueve los sliders → el canvas redibuja en vivo.
4. **Exportar layout (JSON)** → descarga `layout-export-setbacks.json`.
5. Abre las **DevTools → Console / Network**: **0 errores de `fetch()`**, todos los JSON en
   `200`.

Comprobación por terminal (todos deben dar `200`):
```bash
for u in /web/ /web/css/lab.css /web/js/main.js /data/costs.json \
  /geometry-engine/v2/ /geometry-engine/v2/engine.js /data/lot.json \
  /data/layouts/manifest.json; do
  printf "%s  %s\n" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080$u)" "$u"
done
```

---

## 7. Nota importante sobre funcionalidades citadas que NO existen en este repo

La especificación de la tarea menciona elementos que **no están presentes en el código
actual** de la rama `main`. Se documentan aquí para evitar confusión (no se inventaron ni
se añadieron, según las restricciones del encargo):

| Citado en la tarea | Estado real en el repo |
|---|---|
| `data/context-infrastructure.json` | **No existe** (404). El engine solo consume `data/lot.json` y `data/layouts/`. |
| `data/context-kml-normalized.json` | **No existe** (404). |
| Capa **Exposure / Traffic** | No existe. El engine tiene bandas de *retiro vial/férreo/buffer hídrico* y *parqueo/andén*, no capas "Exposure/Traffic". |
| **Presentation Mode** | No existe ningún modo presentación en `engine.js` ni en la landing. |
| **Export PNG** | No existe. El único export es **JSON** (`exportBtn` → `layout-export-setbacks.json`). |

Todo lo demás de la tarea (rutas relativas, canvas, métricas, export JSON, servidor local,
sin errores de fetch) **sí funciona**. Si en el futuro quieres que esas capas/modos existan,
es trabajo nuevo de feature (cambiaría lógica visual) y queda fuera de esta conversión local.

---

## 8. Compatibilidad con GitHub Pages (no se rompió nada)

- **Todas las rutas ya eran relativas** antes de esta tarea; no se modificó ninguna.
- El workflow `.github/workflows/static.yml` sigue publicando el repo entero a Pages en cada
  push a `main`.
- La misma estructura de URLs (`/web/`, `/geometry-engine/v2/`, `/data/...`) resuelve idéntica
  en Pages y en `localhost`. Servir local y publicar en Pages son **operaciones equivalentes**.
- Los archivos nuevos (`package.json`, lanzadores, `.gitignore`, docs) son inertes para Pages:
  Pages sirve estáticos y simplemente ignora estos artefactos de tooling.

---

## 9. Hoja de ruta futura (preparado para esto)

El repo queda listo, sin deuda, para evolucionar:

- **Electron** → empaquetar `web/` + `geometry-engine/` como app de escritorio cargando
  `index.html`; los `fetch()` relativos funcionan bajo el protocolo `file://` de Electron con
  `webSecurity` ajustado o sirviendo desde un `protocol` custom. Ver `docs/local-runtime/architecture.md`.
- **Wrapper móvil** (Capacitor/Tauri) → el mismo bundle estático se incrusta como webview.
- **Motor 3D** → `engine.js` está aislado en `geometry-engine/v2/`; un futuro `v3/` con
  WebGL/Three.js puede consumir la misma `data/lot.json` sin tocar v2.

Detalle técnico en **`docs/local-runtime/`**:
`architecture.md` · `dependency-map.md` · `render-pipeline.md`.
