# Notas de geometría y método

## Fuente
Única fuente geométrica: `data/lot.json`, polígono trazado en Google Earth (KML, WGS84) por el propietario. **No sustituye levantamiento topográfico.**

## Vértices (lon, lat)
- A: -76.32341647097293, 3.731094179667487
- B: -76.32351406605405, 3.731887640145794
- C: -76.32371668283456, 3.731837248990664
- D: -76.32357451266348, 3.731436431433172

## Método del engine
1. **Proyección** equirrectangular local centrada en el punto de referencia (error despreciable a esta escala, < 1 km).
2. **Área** por fórmula de shoelace; longitudes de lindero por distancia euclidiana en metros proyectados.
3. **Marco local s/t**: `s` = abscisa sobre el lindero oriental A→B (frente a vía/férrea); `t` = profundidad hacia el occidente.
4. **Bandas** (retiro E, parqueo, andén) como franjas en `t`, recortadas al polígono.
5. **Contenedores** ISO (20' = 6.06×2.44 m, 40' = 12.19×2.44 m) colocados sobre el eje `s`; se validan punto-en-polígono por esquina más distancia a linderos occidentales ≥ retiro W.

## Lo que el engine NO hace
- No conoce retiros normativos (Ley 1228, corredor férreo ANI, EOT Guacarí, CVC): los retiros son **parámetros del usuario** y deben verificarse.
- No modela topografía, niveles, ronda hídrica del río Guabas ni redes.

## Siguiente paso geodésico
Cargar el levantamiento topográfico georreferenciado (ejes de calzada y férrea, mojones) como capa adicional y recalcular el área edificable real.
