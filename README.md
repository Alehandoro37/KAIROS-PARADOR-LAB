# KAIROS PARADOR — LINEAR STATION LAB

Laboratorio web de diseño arquitectónico y geodésico para el proyecto **Kairos Parador**: una estación tropical-industrial de carretera en Guacarí, Valle del Cauca, Colombia.

El objetivo no es hacer un restaurante genérico, sino construir un sistema digital para desarrollar el proyecto por capas: lote, geometría, vías, restricciones, programa, fases, costos, renders y futuro tour virtual.

## Sitio

Cuando GitHub Pages esté activo:

```text
https://alehandoro37.github.io/KAIROS-PARADOR-LAB/
```

El `index.html` raíz redirige a `/web/`.

## Estructura

```text
KAIROS-PARADOR-LAB/
├── README.md
├── index.html
├── web/
│   ├── index.html
│   ├── css/lab.css
│   └── js/main.js
├── geometry-engine/
│   └── v2/
│       ├── index.html
│       └── engine.js
├── data/
│   ├── lot.json
│   ├── costs.json
│   └── layouts/
│       ├── manifest.json
│       └── layout-v0.1.json
├── docs/
│   ├── concept/concept.md
│   └── geometry/geometry-notes.md
└── prompts/
    └── render-prompts.md
```

## Concepto

**Option A — Linear Station**

Kairos Parador se plantea como una estación lineal contemporánea: contenedores gastronómicos como vagones, una marquesina ligera como andén ferroviario, plazoleta sombreada, parqueo lineal y un punto icónico con letras **GUACARÍ**.

## Datos base

- Fuente geométrica: `data/lot.json`, derivado del KML.
- Área KML aproximada: ~1.115 m².
- Área en dossier: ~1.139 m².
- Diferencia pendiente de confirmar con levantamiento topográfico.

## Principios

- No inventar topografía.
- No fijar retiros definitivos sin levantamiento georreferenciado.
- Mantener separadas las capas: lote, ejes viales, eje férreo, restricciones, programa y fases.
- Toda cifra preliminar debe quedar marcada como preliminar.
- Los costos quedan con `null` hasta cotización real.

## GitHub Pages

1. Ir a `Settings → Pages`.
2. Source: `Deploy from a branch`.
3. Branch: `main`.
4. Folder: `/ (root)`.
5. Guardar.

## Próximo sprint

**Setback Layer V1**

Agregar capa editable para recibir:

- eje Panamericana;
- eje férreo;
- vía antigua Guacarí;
- faja vial preliminar;
- retiro férreo preliminar;
- ronda hídrica si aplica;
- cálculo de área útil preliminar.

## Nota

Este repositorio es de diseño conceptual y prefactibilidad. No reemplaza levantamiento topográfico, licencia, estudio de tránsito, consulta normativa, diseño estructural, diseño hidrosanitario ni permisos ambientales.
