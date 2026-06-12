# Site Context — Kairos Parador / Lote Logos

**Coordenada base:** 3.73155, -76.32356  
**Municipio:** Guacarí, Valle del Cauca, Colombia  
**Fuente geométrica del lote:** `data/lot.json` desde KML del propietario  
**Estado:** lectura preliminar de contexto. No sustituye levantamiento topográfico ni consulta normativa.

---

## 1. Lectura territorial

El predio se entiende como un lote lineal y angosto asociado al borde vial de la Troncal/Panamericana y al corredor férreo histórico del Valle del Cauca. Guacarí hace parte del eje agroindustrial del centro del Valle, con relación directa a Buga, El Cerrito, Palmira y Cali.

La condición estratégica no es solamente “frente a una vía”, sino **frente a un sistema de movilidad regional**: carretera nacional, posible bifurcación/local return hacia Guacarí y memoria ferroviaria.

**Hipótesis de diseño:** Kairos Parador debe funcionar como estación de desaceleración: un lugar visible desde el flujo vehicular que justifique detenerse, retornar o entrar al municipio.

---

## 2. Lectura vial

El usuario describe una condición de bifurcación/retorno: flujo norte-sur sobre la troncal, doble calzada, y una salida o vía antigua hacia Guacarí. Esto cambia el diseño: el acceso no debe asumirse como un ingreso frontal simple.

### Implicaciones

- La vista principal probablemente no es perpendicular al lote, sino oblicua desde la aproximación vehicular.
- El letrero y la marquesina deben leerse desde distancia y en movimiento.
- El proyecto debe priorizar seguridad: desaceleración, bahía, maniobra de ingreso/salida y separación peatón-vehículo.
- El parqueo lineal o en ángulo debe quedar subordinado al acceso autorizado, no al revés.

### Pendiente de verificación

- Eje real de calzada.
- Límites de la faja vial.
- Posible servidumbre o zona de reserva vial.
- Punto legal de acceso.
- Sentidos de circulación y retornos reales.
- Visibilidad desde norte-sur y sur-norte.

---

## 3. Lectura ferroviaria

El concepto de estación se apoya en la memoria del Ferrocarril del Pacífico y en la cercanía del corredor férreo. El corredor no debe invadirse. Debe tratarse como borde paisajístico y narrativo.

### Regla de diseño

El frente ferroviario se contempla, no se cruza. El mirador/andén debe funcionar como borde seguro, con baranda, iluminación y señalización, sin incentivar paso sobre rieles.

### Pendiente de verificación

- Eje férreo exacto.
- Ancho real del corredor férreo.
- Titular/administrador del corredor.
- Retiro aplicable.
- Estado de reactivación o mantenimiento.

---

## 4. Lectura comercial

El valor comercial depende de tres condiciones:

1. **Visibilidad:** marquesina larga, iluminación y letras GUACARÍ.
2. **Legibilidad:** el conductor debe entender en segundos qué es el lugar.
3. **Acceso seguro:** si no hay forma clara y autorizada de entrar/salir, el negocio pierde fuerza.

El proyecto debe evitar parecer una fila improvisada de contenedores. La cubierta lineal y la plaza-andén deben dar unidad arquitectónica.

---

## 5. Hipótesis de acceso

Hasta tener topografía y revisión vial, se manejan tres hipótesis:

### H1 — Acceso por vía antigua / ramal a Guacarí
Preferible si permite menor conflicto con la troncal. El proyecto funciona como puerta de entrada al municipio.

### H2 — Acceso desde zona de desaceleración paralela
Posible si la autoridad vial permite bahía o carril de servicio. Requiere estudio y autorización.

### H3 — Acceso restringido / solo retorno próximo
El parador se vuelve más dependiente del letrero y de la claridad del retorno. No se debe diseñar parqueo sin resolver esta condición.

---

## 6. Riesgos a verificar

- Faja de retiro vial nacional.
- Retiro/corredor férreo.
- Acceso autorizado desde vía nacional.
- Drenaje, canales, ronda hídrica o riesgo de inundación.
- Diferencia entre área KML (~1.115 m²) y área documental (~1.139 m²).
- Profundidad variable del lote: en la punta sur no caben módulos; los contenedores deben concentrarse donde la profundidad aumenta.
- Seguridad peatonal frente a vía y rieles.

---

## 7. Recomendaciones para Setback Layer V1

El Geometry Engine debe agregar una capa `constraints` con:

```json
{
  "constraints": {
    "road_axis": { "type": "editable_line", "status": "preliminary" },
    "rail_axis": { "type": "editable_line", "status": "preliminary" },
    "old_guacari_road_axis": { "type": "editable_line", "status": "preliminary" },
    "road_setback_m": { "value": null, "status": "preliminary" },
    "rail_setback_m": { "value": null, "status": "preliminary" },
    "water_or_drainage_buffer_m": { "value": null, "status": "if_applicable" }
  }
}
```

### Reglas funcionales

- Las zonas restringidas deben dibujarse con transparencia roja/ámbar.
- Los módulos dentro de zona restringida deben marcarse como inválidos.
- El área útil debe mostrarse como preliminar.
- El usuario debe poder apagar/encender capas.
- La exportación JSON debe incluir ejes, retiros y advertencias.

---

## 8. Decisión estratégica

Antes de renders definitivos, el proyecto debe contestar:

**¿Desde dónde llega el carro, dónde desacelera, dónde entra, dónde parquea y cómo sale sin riesgo?**

La respuesta a esa pregunta define el plano real más que la estética de los contenedores.
