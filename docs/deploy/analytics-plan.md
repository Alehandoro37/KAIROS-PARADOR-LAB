# Analytics Plan (placeholder — nothing installed)

> **No hay analytics instalado en este repo.** Este documento + `data/public-events-schema.json`
> son **solo una especificación** para integrar medición de producto **más adelante**, fuera de
> este repo, con consentimiento y sin claves embebidas. Ninguna página emite eventos hoy. **No**
> hay SDK, red, cookies ni IDs persistentes en el código actual.

## 1. Eventos previstos

Definidos en `data/public-events-schema.json` (`schema: kairos.public-events/v1`):

| Evento | Cuándo | Props |
|---|---|---|
| `landing_view` | Se muestra la landing pública | `path`, `referrer` |
| `cta_masterplan` | Clic en *Ver Masterplan* | `from` (landing\|nav) |
| `cta_journey` | Clic en *Iniciar Journey* | `from` |
| `cta_map` | Clic en *Ver Mapa* | `from` |
| `export_png` | Descarga PNG del masterplan | `view`, `zoom` |
| `export_json` | Descarga JSON (masterplan o contexto) | `view`, `schema` |
| `journey_start` | Inicio del Visitor Journey | `auto` |
| `map_context_load` | Carga de contexto OSM en el mapa | `radiusM`, `features`, `source` |

## 2. Cómo se integraría (cuando se decida medir)

- Un **wrapper opcional** (no incluido) leería el schema y enviaría los eventos a un proveedor
  (p. ej. GA4 / Plausible / Firebase Analytics) **sin** claves en el repo: el ID viviría en la
  config del hosting/portales, no en KAIROS-PARADOR-LAB.
- La instrumentación sería **aditiva**: pequeños `data-event="…"` o llamadas a un `track()` opcional
  en los CTAs/botones — **sin tocar** la geometría, el render ni los módulos de cálculo.
- Respetar **Do Not Track** y un banner de consentimiento antes de cualquier emisión real.

## 3. Privacidad

- Eventos **anónimos** de producto; **no** PII, **no** geolocalización del visitante, **no**
  fingerprinting.
- Hasta que exista consentimiento e instrumentación explícita, el comportamiento es **cero
  telemetría**.

## 4. Estado actual

- `data/public-events-schema.json`: presente, versionado, **inerte** (ningún código lo carga).
- Páginas públicas: **sin** scripts de analytics. El validador (`npm run validate:external`)
  confirma además que el build no contiene claves de Google ni comandos de despliegue embebidos.
