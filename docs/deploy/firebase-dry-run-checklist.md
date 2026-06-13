# Firebase Hosting — Dry Run Checklist (Logos Parador external landing)

> Pasos **seguros** para publicar el build externo en
> `https://kairosacademytech.com/external/landing/logos-parador/`. **Este repo no hace deploy.**
> Aquí solo se prepara y se valida; el `firebase deploy` lo ejecuta una persona, fuera de este
> repo, contra el proyecto Firebase correspondiente. **No** se toca `kairos-portals-html` ni la
> lógica de Engine v2 / Masterplan / Map Calibration.

Acompaña a:
- `docs/deploy/firebase-hosting-route.md` — mapeo de rutas y por qué MIRROR+REDIRECT.
- `docs/deploy/firebase-hosting.logos-parador.example.json` — config **de ejemplo** (no activa).
- `tools/build-external.mjs` — genera `build/` (idempotente, git-ignored).
- `tools/validate-external-build.mjs` — valida el build (exit ≠ 0 si algo falla).

## 1. Generar el build

```bash
npm run build:external      # → build/external/landing/logos-parador/ (git-ignored)
npm run validate:external   # falla con exit≠0 si algo está mal
```

`validate:external` comprueba: el build existe; existen las rutas (`/`, `masterplan/`, `map/`,
`journey/`, `web/`, `geometry-engine/`, `data/`); existen los archivos críticos (módulos del
masterplan, calibration/osm-context, **Leaflet vendorizado**, `data/lot.json`, seed OSM,
calibración, costos); las **páginas-redirect** apuntan al destino correcto; y **no** hay rutas
absolutas peligrosas, `localhost`, `file://`, **Google API keys** (`AIza…`) ni un `firebase
deploy` embebido en el build.

## 2. Probar localmente (antes de cualquier publish)

```bash
npm run serve:external      # sirve build/ en http://127.0.0.1:8090
```

Verifica en el navegador (deben cargar, sin errores de consola ni 404):

| Ruta a abrir | Esperado |
|---|---|
| `http://127.0.0.1:8090/external/landing/logos-parador/` | Landing (redirect → `web/`) |
| `…/logos-parador/masterplan/` | Masterplan V3.1 (redirect → `geometry-engine/masterplan/`) |
| `…/logos-parador/map/` | Map Calibration + OSM (redirect → `geometry-engine/map-calibration/`) |
| `…/logos-parador/journey/` | Visitor Journey (redirect → masterplan `?journey=1&auto=1`) |

Comprueba que **DevTools → Network** muestra `data/lot.json`, `data/osm/osm-context-seed.json`,
`vendor/leaflet/leaflet.js` y los módulos ES en **200** bajo el subpath (rutas relativas OK).

## 3. Publicar en Firebase Hosting (lo hace un humano, fuera de este repo)

> **No ejecutar desde este repo.** Estos comandos son la guía para el operador.

**Opción A (recomendada) — subtree estático dentro del repo de portales:**

```bash
# en el repo de portales (NO aquí):
(cd ../KAIROS-PARADOR-LAB && npm run build:external && npm run validate:external)
rm -rf public/external/landing/logos-parador
cp -R ../KAIROS-PARADOR-LAB/build/external/landing/logos-parador \
      public/external/landing/logos-parador
# luego el deploy normal del repo de portales (su propio firebase.json):
# firebase deploy --only hosting        ← lo corre el operador, no este repo
```

El repo de portales posee las demás rutas; este proyecto posee únicamente
`/external/landing/logos-parador/**`. Sin colisión.

**Opción B — site/target Firebase aparte** usando el ejemplo
`firebase-hosting.logos-parador.example.json` (con `public:"build"`): cópialo como `firebase.json`
del proyecto Firebase y `firebase deploy --only hosting:<target>`. Más configuración; solo si se
requiere aislar despliegues.

## 4. Qué **NO** copiar / publicar

- **`node_modules/`**, `.git/`, `*.log`, `.DS_Store` (el ejemplo de config los ignora).
- **`tools/`, `docs/`, `prompts/`, `README*`, `launch-local.*`, `package*.json`** del repo
  fuente: **no** forman parte del sitio público; solo se publica el contenido de
  `build/external/landing/logos-parador/`.
- El propio **`build/` no se versiona** (git-ignored); se regenera con `npm run build:external`.
- **Sin secretos**: no copiar claves, `.env`, ni credenciales de Firebase.

## 5. Cómo NO romper las rutas relativas

- **No** aplanar el árbol ni mover `data/`, `web/` o `vendor/leaflet/` a otra profundidad: las
  páginas resuelven con `../../data/…` / imports relativos / `vendor/leaflet/…` y dependen de la
  estructura espejada. Publica el árbol **tal cual** lo genera el build.
- **No** usar `rewrites` que sirvan un archivo profundo en una URL corta (rompería `../../`).
  Las URLs limpias se logran con las **páginas-redirect** estáticas (ya incluidas).
- **No** introducir rutas absolutas (`/data/…`): romperían bajo el subpath. El validador lo
  detecta.
- `cleanUrls`/`trailingSlash` se dejan explícitos en el ejemplo para no alterar la resolución de
  `index.html` en cada directorio.

## 6. Checklist final (marcar antes de publicar)

- [ ] `npm run build:external` corre sin error.
- [ ] `npm run validate:external` → **PASS** (exit 0).
- [ ] Las 4 rutas cargan en `serve:external` sin 404 ni errores de consola.
- [ ] `data/*.json`, `vendor/leaflet`, módulos ES y CSS en **200** bajo el subpath.
- [ ] GitHub Pages del repo fuente sigue intacto (no se editó ninguna página).
- [ ] El operador copia **solo** `build/external/landing/logos-parador/` al hosting.
- [ ] El `firebase deploy` lo ejecuta el operador, **no** este repo, **no** contra producción en
      esta etapa de dry-run.
