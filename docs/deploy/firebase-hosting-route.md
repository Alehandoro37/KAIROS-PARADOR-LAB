# Public Route Prep V1 — Firebase Hosting route mapping

> Cómo empaquetar **KAIROS-PARADOR-LAB** (repo fuente) para servirlo bajo la ruta pública
> `https://kairosacademytech.com/external/landing/logos-parador/` vía **Firebase Hosting**,
> **sin romper GitHub Pages** y **sin tocar la lógica** de Engine v2 / Masterplan / Map
> Calibration (solo packaging). **No hay deploy real en este repo**; aquí solo se prepara el
> build y se documenta la integración.

## 1. Rutas objetivo

| Ruta pública | Contenido |
|---|---|
| `/external/landing/logos-parador/` | Landing pública del proyecto |
| `/external/landing/logos-parador/masterplan/` | Masterplan Blueprint V3.1 |
| `/external/landing/logos-parador/map/` | Map Calibration + OSM Context |
| `/external/landing/logos-parador/journey/` | Visitor Journey (masterplan cinematic, `?journey=1`) |

## 2. Cómo correr el build

```bash
npm run build:external          # genera build/ (idempotente; git-ignored)
npm run serve:external          # sirve build/ en http://127.0.0.1:8090 para probar
# probar: http://127.0.0.1:8090/external/landing/logos-parador/
```

`tools/build-external.mjs` (Node ≥ 16.7, usa `fs.cpSync`) hace:

1. Limpia `build/` y recrea `build/external/landing/logos-parador/`.
2. **Espeja verbatim** `web/`, `geometry-engine/` (v2 + masterplan + map-calibration) y `data/`,
   más `docs/concept/`. **No reescribe ninguna ruta** → todas las relativas (`../../data/…`,
   imports ES, `vendor/leaflet/…`) quedan idénticas y resuelven igual.
3. Escribe las **páginas-redirect** de las rutas limpias (ver §4).

Salida (árbol resumido):

```
build/external/landing/logos-parador/
  index.html                      → redirect a web/            (landing)
  masterplan/index.html           → redirect a ../geometry-engine/masterplan/
  map/index.html                  → redirect a ../geometry-engine/map-calibration/
  journey/index.html              → redirect a ../geometry-engine/masterplan/?journey=1&auto=1
  web/            (landing + css/lab.css + js/main.js)
  geometry-engine/  v2/ · masterplan/ · map-calibration/ (con vendor/leaflet)
  data/           lot.json · costs.json · osm/ · calibration/ · layouts/
  docs/concept/   concept.md
```

## 3. Por qué MIRROR + REDIRECT (y no rewrites)

Las páginas resuelven sus recursos con **rutas relativas** que dependen de la **profundidad**
del archivo servido:

- `geometry-engine/masterplan/index.html` → `fetch('../../data/lot.json')`, imports ES
  `./masterplan-data.js`, etc.
- `geometry-engine/map-calibration/` → `vendor/leaflet/…`, `../../data/…`.
- `web/` (landing) → `css/lab.css`, `js/main.js`, `../data/costs.json`,
  `../geometry-engine/…`.

Si Firebase usara un **rewrite** para servir, p. ej., `…/masterplan/index.html` en la URL
corta `/external/landing/logos-parador/masterplan/`, el navegador tomaría esa URL corta como
base y `../../data/…` apuntaría fuera del árbol → **404**. Por eso:

- **Espejamos** el árbol fuente tal cual (la profundidad se conserva → las relativas funcionan
  exactamente como en GitHub Pages).
- Exponemos las rutas limpias con **redirect** (`<meta http-equiv="refresh">` relativo): la
  entrada `/…/masterplan/` rebota a `/…/geometry-engine/masterplan/`, donde las relativas
  resuelven. Resultado: rutas relativas intactas, **compatible con GitHub Pages y con el
  subpath de Firebase** sin editar una sola ruta de las páginas.

> Las redirects son relativas, así que el árbol funciona bajo **cualquier** base
> (`/`, `/KAIROS-PARADOR-LAB/…`, `/external/landing/logos-parador/…`).

## 4. Config de Firebase Hosting (sample, sin secretos)

`build/` es la carpeta a publicar (`hosting.public`). Como el routing lo resuelven los
directorios + las páginas-redirect, **no hacen falta rewrites**. Solo headers de caché.

```jsonc
// firebase.json (SAMPLE — colócalo en la raíz del proyecto Firebase; no se ejecuta aquí)
{
  "hosting": {
    "public": "build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      { "source": "**/vendor/leaflet/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=604800, immutable" }] },
      { "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=3600" }] },
      { "source": "**/data/**/*.json",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=300" }] }
    ]
  }
}
```

- `public: "build"` sirve `build/external/landing/logos-parador/…` en la URL
  `https://<host>/external/landing/logos-parador/…`.
- Sin secretos, sin API keys, sin functions. Tiles OSM y todo lo demás siguen siendo
  client-side y relativos.

## 5. Integración con `kairosacademytech.com` sin chocar con `kairos-portals-html`

**KAIROS-PARADOR-LAB es el repo fuente**; el sitio de portales gestiona el resto del dominio.
Para no mezclar repos, la vía recomendada es **subtree estático**:

- **Opción A (recomendada):** en el pipeline del repo de portales, copiar la salida de este
  build dentro de su carpeta de hosting bajo el mismo subpath:
  ```bash
  # en el repo de portales, como paso de build:
  (cd ../KAIROS-PARADOR-LAB && npm run build:external)
  cp -R ../KAIROS-PARADOR-LAB/build/external/landing/logos-parador \
        public/external/landing/logos-parador
  ```
  Un solo Firebase site; portales posee las demás rutas y este proyecto posee
  `/external/landing/logos-parador/**`. Sin colisión de rutas, sin duplicar lógica a mano.
- **Opción B:** un **target/site** de Firebase aparte para el subpath (multi-site). Más
  configuración; solo si se requiere aislar despliegues.

En ambos casos el contenido proviene **solo** de `npm run build:external` (reproducible), y
`kairos-portals-html` se integra como **consumidor externo documentado**, no como dependencia
de código.

## 6. Garantías

- **GitHub Pages intacto:** el repo fuente no cambia (las páginas no se editan); `build/` está
  **git-ignored**. El workflow de Pages sigue sirviendo lo de siempre.
- **Rutas relativas:** verificadas bajo el subpath (data JSON, `vendor/leaflet`, módulos ES,
  CSS) — todas 200 al servir `build/`.
- **Idempotente:** `npm run build:external` limpia y regenera; mismo input → mismo output.
- **Sin deploy real** ni Firebase CLI ejecutado contra producción desde este repo.
