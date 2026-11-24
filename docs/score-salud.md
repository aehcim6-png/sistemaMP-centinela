# Score de Salud del equipo — especificación, auditoría y plan de validación

Estado: **borrador para decisión** (24-nov-2026). Este documento dice cómo funciona hoy el Score de Salud, qué se encontró al auditarlo con toda la flota, en qué se puede apoyar un índice de salud de activos y cómo se valida antes de usarlo para decidir.

## 1. Qué es hoy (tal como está en el código)

- **Para qué sirve:** ordenar los equipos por «cuánto atender» (Mapa de Salud del Dashboard, Torre de Control, Buscar, avisos de «cruzó a salud baja»).
- **Fórmula:** promedio simple de las señales que tienen dato: Componentes (% con más de 1.000 h de vida restante), Neumáticos (% que no toca cambiar), Aceite (última muestra por componente, ventana de 90 días), Confiabilidad (probabilidad de operar 30 días sin falla a partir del tiempo medio entre fallas) y Riesgo TBO (% de componentes sin riesgo). Todas pesan igual.
- **Bandas:** menos de 55 crítica, 55–79 advertencia, 80 o más buena. Son valores elegidos a criterio, **sin calibrar ni validar** (el inventario de algoritmos lo declara «criterio propio, sin umbral certificado»).
- **Lo que nunca se hizo:** comprobar que un puntaje bajo anticipa más fallas que uno alto.

## 2. Auditoría con los datos reales (24-nov-2026, 42 equipos)

Señales con dato por equipo (sin contar Riesgo TBO, que no se pudo medir en esta auditoría):

| Señales con dato | Equipos |
|---|---|
| 0 | 9 (CA-10712, CN-10093, CN-10424, CN-7578, GE-10019, GE-15174, MC-4922, TI-9941, TI-9942) |
| 1 | 9 (las camionetas CA-10505, CA-10506, CA-5979, CA-6146, CA-9927; CN-10321, CN-10322; TI-5142, TI-5146) |
| 2 | 10 |
| 3 | 8 |
| 4 | 6 |

- **Con la regla de «mínimo 2 señales» (cambio del 24-nov, aún sin publicar) 18 de 42 equipos quedarían «sin datos suficientes».** Antes recibían nota con una sola señal.
- **La señal de aceite** solo existe, con muestras de los últimos 90 días, en 12 equipos; **componentes con dato real** (instalación y horómetro cargados) en 18.
- **Confiabilidad dominada por el conteo de correctivos:** los camiones con 100 a 250 fallas registradas desde 2022 (CN-9501 con 250, CN-9500 con 208, CN-9503 con 205…) tienen un tiempo medio entre fallas de 65 a 160 h y una confiabilidad a 30 días de **0,1 % a 10,6 %**. Casi todos los equipos activos quedan cerca de 0 en esta señal, así que no distingue a unos de otros y arrastra su nota hacia abajo.
- **Dos definiciones de falla:** el Score del Dashboard y la Torre cuenta como falla cada correctivo de clase «correctiva»; Buscar usa solo las paradas de 24 h o más (la definición que dio el usuario el 23-oct-2026 y que usa el MTBF del Dashboard). El mismo equipo puede mostrar notas distintas en dos pantallas.
- **Equipos nuevos:** el aceite de asentamiento, las pocas fallas y la clasificación de OT dejaban en crítico a equipos con pocas horas (CN-7578 con 0, BD-10139 con 30, CN-10160 con 46). Los cambios del 24-nov corrigen estos tres casos; **no se revisaron antes del resto de la flota**, y la auditoría de arriba muestra que el problema de fondo es más amplio.

## 3. En qué se puede apoyar (índice de salud de activos)

Lo que se encontró en la práctica del sector (no es un estándar único; es una familia de métodos):

- Un índice de salud agrega varios **criterios de condición**, cada uno en escala 0 (muy malo) a 100 (como nuevo), con un **peso** que refleja su importancia ([IBM, Asset Performance Management](https://www.ibm.com/docs/en/SSMNA6_2.1.0/com.ibm.ifeop.doc/overview/ov_concepts.html)).
- La **criticidad** del activo se trata aparte de su condición, para ordenar o ponderar la atención ([PwC para el regulador australiano, método de salud y criticidad](https://www.aer.gov.au/system/files/PWC%20-%2015.5%20Asset%20Health%20and%20Criticality%20Method%20-%2028%20February%202018.pdf)).
- Las metodologías regulatorias de índices de activos del Reino Unido se **validaron con datos de varias empresas** ([Ofgem, ejercicio de validación](https://www.ofgem.gov.uk/sites/default/files/docs/2016/01/appendix_2_validation_exercise.pdf)).
- Un índice debe basarse en **medidas objetivas y verificables**, reflejar si el activo sirve para seguir en servicio y ser fácil de entender (criterios de Hjartarson y Otal citados en [este trabajo de la Universidad de Sevilla](https://idus.us.es/server/api/core/bitstreams/8a3e9a1c-78b9-486b-872f-1b433f284970/content)).
- Algunas implementaciones multiplican cada componente por **cuánto dato hay disponible** ([ejemplo de patente](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12056671)).

Límite de esta revisión: no encontré una fuente que muestre una validación contra el historial real de fallas. Eso hay que hacerlo con nuestros datos (sección 5).

## 4. Diseño propuesto (para aprobar antes de cambiar la fórmula otra vez)

1. **Cada señal con su regla escrita, escala 0–100 y vigencia del dato.** Un dato viejo no cuenta (ya hecho para aceite: 90 días).
2. **Confiabilidad redefinida:** no el conteo de todos los correctivos desde 2022, sino las **paradas de 24 h o más de los últimos 12 meses** por cada 1.000 h operadas, comparadas con el promedio de su tipo de equipo. Una sola definición de falla en todas las pantallas.
3. **Confianza del dato visible:** la nota se muestra siempre con «n de total señales». Menos de 2 señales: «sin datos suficientes».
4. **Pesos escritos y criticidad aparte:** los pesos van documentados (parten iguales y solo cambian si la validación lo respalda); la criticidad ordena la atención, no cambia el puntaje.
5. **Bandas calibradas con la flota** (percentiles, revisadas cada trimestre) en vez de 55/80 fijos.

## 5. Plan de validación (lo que respalda el Score)

- **Prueba central:** para una fecha pasada T, calcular el Score de cada equipo con lo que se sabía ese día y contar las paradas de 24 h o más en los 30 y 60 días siguientes. Medir si el cuarto inferior del Score concentra más paradas que el resto (razón de paradas y correlación de rangos). **Si no supera al azar, el Score no se usa para decidir.**
- **Datos disponibles:** el sistema guarda una foto diaria de salud por equipo desde el 12-oct-2026, pero con la fórmula anterior. La fórmula nueva parte el 25-nov-2026. Se puede reconstruir hacia atrás las señales que tienen fecha (aceite, fallas, componentes) para una prueba retrospectiva, y acumular fotos nuevas para validar de verdad en 60 a 90 días.
- **Regla de cambios (lo que faltó):** toda modificación de la fórmula necesita (a) una tabla **antes y después de toda la flota**, no solo de los equipos que motivaron el cambio, (b) su prueba, (c) una anotación en el inventario de algoritmos y (d) subir `SALUD_EQUIPO_METODO_DESDE` para no comparar con fotos de otra fórmula.

## 6. Pendientes de decisión

- Aprobar el diseño de la sección 4 (en particular la nueva Confiabilidad) y los plazos de validación.
- Decidir si se publica antes el cambio del 24-nov (aceite, mínimo de señales y clasificación de OT) o se espera a la tabla antes/después de toda la flota.
