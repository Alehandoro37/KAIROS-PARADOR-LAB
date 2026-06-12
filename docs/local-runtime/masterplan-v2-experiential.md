# Masterplan Blueprint V2 — Experiential Landscape Redesign

> Evolución de **Masterplan Blueprint V1** (commit `adf11fa`) hacia una experiencia
> **hospitality + landscape + placemaking**: tropical, abierta, secuencial, tipo eco-retreat
> roadside landmark — menos CAD/cajas, más boutique eco-destination. **PRELIMINAR ·
> CONCEPTUAL — NO APTO PARA USO LEGAL / CATASTRAL / CONSTRUCCIÓN.** No es arquitectura
> constructiva, no es cálculo estructural, no es catastro. No modifica `lot.json`, ni el
> Geometry Engine v2, ni la capa Map Calibration.

## 1. Qué cambió respecto a V1

Se **evolucionó** (no se reescribió desde cero) la misma tripleta de módulos:
`masterplan.js` · `masterplan-data.js` · `masterplan-export.js`, conservando el **modelo
paramétrico relativo al lote** (marco `s,t`), la **proyección** y la **detección de
conflictos**. Cambios:

- **Geometría orgánica:** formas suaves (`blob` + suavizado por **bezier cuadrático**) en vez
  de rectángulos CAD. Plaza **agrandada** y circular/orgánica.
- **Pabellones independientes:** los restaurantes dejan de ser “locales pegados” → pods
  redondeados separados por vegetación (decks/terrazas conceptuales).
- **Circulación orgánica:** promenade longitudinal curva + senderos en loop (curvas suaves).
- **Identidad ferroviaria:** railway lounge lineal + mirador/deck + **view corridors** que
  enmarcan visualmente la vía/tren (se abren más allá del frente, hacia el corredor férreo).
- **Paisaje en capas:** tropical canopy, jardines/pockets, buffers verdes, palmas de acento.
- **Parqueo velado:** banda de “gravel + árboles” de baja presencia visual sobre el frente.
- **Reservas futuras:** *Future Eco Suites* y *Future Wellness Expansion* como reserva
  conceptual (no un hotel/spa completo).
- **Atmósfera:** nodos de **luz cálida** (glow), **fogata**, **música/lounge**, gathering
  nodes — sugeridos con degradados radiales.

## 2. Capas y grupos

Cuatro grupos: **program · circulation · landscape · atmosphere**. Capas nuevas pedidas:
*experiential paths, landscape zones, atmosphere lighting nodes, gathering nodes, view
corridors, railway lounge edge* — todas presentes. La UI ofrece **toggles maestros por grupo**
(Atmosphere / Landscape / Circulation) además del toggle por capa, y una **mood legend** que
describe el carácter (canopy, corazón, glow, promenade, railway, vistas).

## 3. Modelo paramétrico y conflictos (conservado)

- Marco local del lote: `s` a lo largo del frente A→B (lado vial/férreo), `t` profundidad.
  Centros por **fracción** de `(len, maxT)`; tamaños en **metros**. Sin lat/lon hardcodeado.
- **Conflicto** por elemento, con modos: `vertices` (todas las vértices dentro), `center`
  (centro dentro — apto para vegetación orgánica que abraza bordes), `origin` (apex dentro —
  para los *view corridors*, cuyo cono se abre a propósito hacia la vía fuera del lote), `none`
  (lote/contexto). Las formas en conflicto se dibujan con contorno rojo punteado y `!`.
  *Future Wellness Expansion* se extiende a propósito hacia/más allá del extremo profundo →
  su conflicto es **significativo** (reserva que requeriría suelo adicional).

## 4. Render (Canvas 2D)

Composición mejorada: fondo con degradado radial cálido; vegetación **semitransparente** en
capas (canopy al fondo); circulación curva; programa orgánico; **glow** radial en nodos de
atmósfera; **view corridors** como cuñas con degradado hacia la vía; jerarquía visual por orden
de dibujo. **Export PNG nativo** (`canvas.toBlob`) — al dibujarse todo localmente (sin tiles
externos) el canvas **no** queda *tainted*.

## 5. UI

Toggles por grupo (**Atmosphere/Landscape/Circulation**) + por capa · **mood legend** ·
**Reset view** · **Export JSON** · **Export PNG** · panel de **áreas aproximadas** (por grupo,
lote, conteo de conflictivos) · banner **“NO APTO PARA USO LEGAL / CATASTRAL / CONSTRUCCIÓN”**
y marca de agua PRELIMINAR · CONCEPTUAL.

## 6. Export JSON (extendido)

`masterplan-v2-export.json` (`schema: kairos.masterplan/v2`, `status: "PRELIMINAR CONCEPTUAL"`,
**`conceptual_only: true`**): frame (len/fondo/centroide), área del lote, `counts`, y los
grupos **`experience_zones` · `circulation` · `landscape` · `atmosphere_nodes`** (cada objeto
con capa, tipo, área aprox, `future`, `conflictive`, geometría en `(s,t)` metros y centro aprox
lat/lon), `areasByLayerApproxM2`, `precisionNote` y `warnings`.

## 7. Precisión honesta

Coordenadas y áreas **APROXIMADAS** (~metros), derivadas de un polígono **trazado a mano**
sobre Google Earth. Áreas a m² entero, longitudes 1 decimal, lat/lon 5 decimales. No se
muestran 7 decimales que aparenten exactitud catastral. **Sirve para exploración experiencial
preliminar**, no para linderos, áreas legales ni construcción.

## 8. Aislamiento

No modifica `data/lot.json`, ni `geometry-engine/v2/`, ni `geometry-engine/map-calibration/`.
Independiente (solo **lee** `lot.json` y el seed OSM). Client-side, sin backend, sin APIs
nuevas → local runtime + GitHub Pages + offline (el seed es estático; sin él, el contexto
simplemente no se dibuja y el resto funciona).
