# Euromillon

La aplicación carga `sorteos.json` al abrirse. También se puede importar el mismo histórico desde [sorteos.xlsx](sorteos.xlsx) usando el selector de la aplicación.

## Histórico oficial

Los dos archivos contienen 2.001 sorteos de Euromillones, desde el 13 de febrero de 2004 hasta el 24 de noviembre de 2026. Están ordenados del más reciente al más antiguo. La fuente es el [buscador de resultados de Loterías y Apuestas del Estado](https://www.loteriasyapuestas.es/es/euromillones/resultados), servicio `/servicios/buscadorSorteos` con `game_id=EMIL` y `celebrados=true`.

El Excel usa las columnas `Fecha`, `N1` a `N5`, `E1` y `E2`. La fecha se conserva como texto ISO (`AAAA-MM-DD`) para que la importación no dependa de la configuración regional de Excel.

Los recuentos de estrellas del histórico abarcan distintas reglas. Para comparar frecuencias o evaluar predicciones de estrellas bajo el rango actual de 1 a 12, usa sorteos desde el 27 de septiembre de 2016.

## Generador y laboratorio

Cada combinación tiene cinco números y dos estrellas. El generador usa Web Crypto y evita duplicados dentro del lote. En un sorteo justo una apuesta simple tiene 1 posibilidad entre 139.838.160 de acertar los cinco números y las dos estrellas, y un 7,708 % de obtener algún premio del sorteo principal. [Reglas oficiales](https://www.loteriasyapuestas.es/es/centro-de-ayuda/como-se-juega/jugar-a-euromillones)

La evaluación usa regresión logística multietiqueta con regularización y actualización tras cada sorteo. Para cada predicción, el modelo y el método de frecuencias solo conocen los sorteos anteriores. Se emplean los primeros 104 sorteos del formato de 12 estrellas para inicialización. La columna de premios mide la proporción de combinaciones que habrían obtenido cualquier premio, incluidos los menores.

Con el histórico incluido, el modelo obtuvo 77 premios en 957 sorteos (8,05 %), las frecuencias obtuvieron 76 (7,94 %) y el azar tiene una tasa esperada de 7,71 %. Estos datos no demuestran una ventaja del modelo. Ejecuta `node --test` para verificar probabilidades, combinaciones, rangos históricos y evaluación.

## Parejas y cadencia

**Con qué valores suele salir** muestra la frecuencia marginal y los acompañantes históricos de cada número o estrella. La frecuencia condicional divide el número de sorteos donde salieron juntos por el número de sorteos donde salió el valor seleccionado. Las referencias para un sorteo justo son 4/49 para un número acompañante y 1/11 para una estrella acompañante.

La cadencia muestra diferencias de posición en el histórico. Busca la separación con mayor exceso estandarizado frente al azar hasta un máximo de 52 sorteos. Para una pareja seleccionada, el contraste usa 499 simulaciones con el mismo número de apariciones, repitiendo la búsqueda de la mejor separación en cada simulación. Si se exploran varias parejas, la cifra de cada pareja no corrige esa búsqueda adicional.

El laboratorio evalúa también una estrategia de parejas que elige el valor más frecuente y sus acompañantes más repetidos sin utilizar sorteos futuros. En el histórico incluido obtuvo algún premio en 71 de 957 sorteos (7,42 %).
