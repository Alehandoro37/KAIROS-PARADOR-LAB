# Brand Assets — Logos Parador / Kairos

> Cómo está integrado el **logo oficial** en la experiencia pública. **No** se toca geometría,
> Engine v2, Map Calibration core, `lot.json` ni la lógica del masterplan — solo branding en
> `head`/nav/loading/CSS.

## 1. Origen y vendorización

- **Fuente:** asset del usuario en Firebase Storage (URL tokenizada). El logo es el emblema
  **“PARADOR KAIROS”** (oro/negro: reloj + carretera sobre triángulo).
- **Vendorizado localmente** (NO hotlink): el JPG se descargó, se **optimizó** con `sips`
  (máx. 512 px de lado → **512×457, ~31 KB**, baseline) y se copió a:
  ```
  external/landing/logos-parador/assets/logo.jpg
  geometry-engine/masterplan/assets/logo.jpg
  geometry-engine/map-calibration/assets/logo.jpg
  ```
- **Por qué no hotlink:** la URL de Firebase Storage lleva un `token` que **puede rotar** y
  rompería el logo en offline / Pages / Firebase. El asset local es estable y el build lo copia.

## 2. Dónde aparece

- **Navbar / header (arriba-izquierda):** landing (topbar) y panel de masterplan/map (`.brandrow`).
- **Loading overlay / splash:** logo grande sobre el spinner en masterplan y map. El **journey**
  (ruta `journey/` → masterplan con `?journey=1&auto=1`) reutiliza ese splash del masterplan.
- **Responsive:** alturas fluidas (navbar ~38–40 px; splash ~64 px); el JPG a 512 px no se
  pixela en retina a esos tamaños.

## 3. Favicon derivado

- El **favicon** es un **SVG de marca** (`favicon.svg`: sol + rieles), presente en las 3 páginas
  → evita el 404 de favicon de forma definitiva. No se convierte el JPG a `.ico` (sin herramienta
  garantizada); un favicon SVG de marca es la opción robusta.
- **`apple-touch-icon`** apunta al logo (`assets/logo.jpg`) en las 3 páginas (icono rico + evita
  el 404 de `apple-touch-icon`).

## 4. og:image / twitter:image (URL ABSOLUTA — supuesto documentado)

Los crawlers de Open Graph/Twitter **requieren URL absoluta**. Se usa la **ruta pública final**:

```
https://kairosacademytech.com/external/landing/logos-parador/assets/logo.jpg
```

- **Supuesto:** es la URL pública donde quedará el asset tras publicar el build en Firebase
  Hosting bajo ese subpath. Es un **placeholder estable** hasta el deploy real (este repo no
  despliega). Si el dominio/subpath cambia, actualizar esta meta.
- **Fallback documentado:** si esa URL aún no resuelve, puede usarse temporalmente la URL de
  Firebase Storage del asset como `og:image` (no recomendado por el token rotable). El asset
  **vendorizado** es la fuente de verdad para la UI; la URL absoluta es solo para el preview de
  redes sociales.

## 5. Performance

- El logo se carga **una vez por página** (navbar + splash referencian el mismo `assets/logo.jpg`
  → 1 request, cacheado). `decoding="async"` y `width/height` explícitos evitan reflow/CLS.
- ~31 KB por página; el ejemplo de `firebase.json` ya cachea imágenes (`max-age` largo).
- Sin preload agresivo: el logo del navbar es above-the-fold pero pequeño; no amerita
  `<link rel=preload>` dedicado.

## 6. Aislamiento

- Solo cambian `index.html` (head/meta/nav/loading), CSS de presentación y los `assets/logo.jpg`.
- **Ningún** módulo `.js`, geometría, Engine v2, Map Calibration core ni `lot.json` se modifica.
