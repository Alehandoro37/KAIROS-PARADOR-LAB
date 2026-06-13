# Operational Intelligence Layer V1 — conceptual investment dashboard

> Capa de análisis **operativo/comercial CONCEPTUAL** del ecosistema público de Logos Parador.
> **No** toca el motor geométrico (Engine v2), el core de Map Calibration ni la
> geometría/render base del masterplan. Modular y desacoplada.
>
> ⚠️ **Disclaimer central:** *Conceptual operational visualization — not financial advice or
> investment solicitation.* Todas las verticales, fases e índices son **ilustrativos**; **no**
> son proyecciones financieras, oferta ni solicitud de inversión.

## 1. Qué es y cómo se activa

- Nueva ruta pública: **`/external/landing/logos-parador/investment/`**.
- Página: `external/landing/logos-parador/investment/index.html` (premium dark tropical,
  mobile-first, CSS inline, sin frameworks).
- Módulo: `web/js/investment-dashboard.js` (vanilla; sin backend, sin analytics, sin pagos).
- Datos: `data/business/` (JSON versionado, **valores conceptuales** marcados como tales):
  - `operational-model.json` — modelo híbrido y verticales (Food, Wellness, Eco-Stay, Retail,
    Railway) con `mixWeight` (peso del **mix experiencial**, conceptual, **no** ingresos) y
    métricas conceptuales (visitorFlow, stayHours, experienceDensity).
  - `phases.json` — Fases 0–4 con `progress` = avance **conceptual de definición de diseño**
    (no ejecución, no calendario, no compromiso).
  - `experience-economy.json` — pilares (gastronomía, wellness, eco-retreat, railway,
    hospitality), densidad de experiencia por zona, permanencia y flujo **conceptuales**.

## 2. Features

- **Toggles por vertical** (Food / Wellness / Eco-Stay / Retail / Railway): activan/desactivan
  cada vertical.
- **Índices conceptuales** recalculados sobre las verticales activas:
  - *Visitor flow* (índice 0–100 conceptual) — afluencia relativa ilustrativa, no un aforo.
  - *Stay duration* (~horas conceptuales) — permanencia ilustrativa ponderada.
  - *Experience density* (nivel Baja/Media/Alta) — riqueza de experiencias simultáneas.
- **Opportunity cards** por vertical, **timeline de fases** con avance conceptual, **pilares**
  de experience economy.
- **Export**: snapshot **JSON conceptual** (`kairos.operational-snapshot/v1`, `conceptual_only:
  true`). **Sin PDF**, sin backend.

## 3. Diseño y rutas

- Coherente con la landing (mismos tokens), **mobile-first**, sin librerías pesadas.
- **Navegación cruzada**: Landing ↔ Masterplan ↔ Journey ↔ Map ↔ **Investment** (links
  relativos; “Investment” añadido a la nav de landing, masterplan y map).
- Rutas relativas: la página carga `../web/js/investment-dashboard.js` y el dashboard hace
  `fetch('../data/business/*.json')`. Resuelven bajo el **build** (donde `web/` y `data/` se
  espejan dentro de `logos-parador/`); el favicon/logo (`../favicon.svg`, `../assets/logo.jpg`)
  resuelven también en la fuente. Como el resto del landing externo, la vista plena es vía
  `npm run build:external`.

## 4. Build & validación

- `tools/build-external.mjs` incluye `investment/` (vía la copia recursiva de la landing) y el
  dashboard/datos (vía los mirrors de `web/` y `data/`); avisa si la ruta faltara.
- `tools/validate-external-build.mjs` comprueba: ruta `investment/`, `web/js/investment-dashboard.js`,
  los 3 JSON de `data/business/`, el **disclaimer prominente**, los contenedores del dashboard,
  la **navegación cruzada** (las 4 páginas enlazan a `investment/`) y **sin analytics/tracking
  real** (gtag/GA/mixpanel/segment/hotjar/fbq…), además de los checks previos.

## 5. Límites (explícito)

- **Sin** autenticación, backend, Firebase Functions, bases de datos, analytics reales, pagos
  ni dashboards administrativos.
- **Sin** cifras financieras reales: nada de moneda, ingresos, ROI ni proyecciones precisas. Las
  ponderaciones (`mixWeight`, %) son de **diseño experiencial**, no de revenue.
- **No** se modifica `data/lot.json`, Engine v2, Masterplan core ni Map Calibration core.
