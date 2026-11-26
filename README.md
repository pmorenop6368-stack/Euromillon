# Euromillon

La aplicación carga `sorteos.json` al abrirse. También se puede importar el mismo histórico desde [sorteos.xlsx](sorteos.xlsx) usando el selector de la aplicación.

## Histórico oficial

Los dos archivos contienen 2.001 sorteos de Euromillones, desde el 13 de febrero de 2004 hasta el 24 de noviembre de 2026. Están ordenados del más reciente al más antiguo. La fuente es el [buscador de resultados de Loterías y Apuestas del Estado](https://www.loteriasyapuestas.es/es/euromillones/resultados), servicio `/servicios/buscadorSorteos` con `game_id=EMIL` y `celebrados=true`.

El Excel usa las columnas `Fecha`, `N1` a `N5`, `E1` y `E2`. La fecha se conserva como texto ISO (`AAAA-MM-DD`) para que la importación no dependa de la configuración regional de Excel.

Los recuentos de estrellas del histórico abarcan distintas reglas. Para comparar frecuencias o evaluar predicciones de estrellas bajo el rango actual de 1 a 12, usa sorteos desde el 27 de septiembre de 2016.
