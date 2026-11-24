# Score de Salud del equipo — especificación, auditoría y plan de validación

Estado: **borrador para decisión** (24-nov-2026). Este documento dice cómo funciona hoy el Score de Salud, qué se encontró al auditarlo con toda la flota, qué parte tiene respaldo y cuál es criterio propio, y cómo se valida antes de usarlo para decidir.

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

## 3. De dónde sale esto: qué está respaldado y qué es criterio propio

**Aviso importante (24-nov-2026):** las referencias de abajo salieron de **una sola búsqueda web y de los resúmenes que mostró el buscador**. Intenté abrir los documentos y **no se pudo** (el entorno no tiene acceso a esos sitios), así que **no están leídas ni verificadas** y no pueden citarse como respaldo hasta que alguien las lea. Lo que sigue es lo que el buscador dijo que contienen, nada más.

| Afirmación | Fuente (sin verificar) | Qué se sabe de verdad |
|---|---|---|
| Un índice de salud suma criterios de condición de 0 a 100, cada uno con un peso | [IBM, Asset Performance Management](https://www.ibm.com/docs/en/SSMNA6_2.1.0/com.ibm.ifeop.doc/overview/ov_concepts.html) | Solo el resumen del buscador. Es documentación de un producto de software, no un estándar. |
| La criticidad se trata aparte de la condición | [PwC para el regulador australiano](https://www.aer.gov.au/system/files/PWC%20-%2015.5%20Asset%20Health%20and%20Criticality%20Method%20-%2028%20February%202018.pdf) | Solo el título y el resumen. No sé si el documento dice eso. |
| Hubo un ejercicio de validación de una metodología de índices de activos | [Ofgem](https://www.ofgem.gov.uk/sites/default/files/docs/2016/01/appendix_2_validation_exercise.pdf) | Solo el título. **No sé contra qué se validó** (el propio buscador dijo que no mostraba si fue contra fallas reales). Es de redes eléctricas, no de flota móvil. |
| El índice debe ser objetivo, verificable y fácil de entender | [Trabajo de la Universidad de Sevilla](https://idus.us.es/server/api/core/bitstreams/8a3e9a1c-78b9-486b-872f-1b433f284970/content) | Solo el resumen. No sé el título ni el autor. |
| Multiplicar por cuánto dato hay | [Patente](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12056671) | Una patente de una empresa: una idea, no una prueba de que funcione. |

**Lo que es criterio propio, sin respaldo externo:**
- La fórmula actual (promedio simple, mismo peso, bandas 55 y 80, probabilidad a 30 días con el tiempo medio entre fallas) la elegí yo al construirla. No viene de ningún estándar. Tampoco la medí contra fallas reales.
- El diseño de la sección 4 es **mi propuesta**, no algo que diga una norma. Se apoya en sentido común de ingeniería de confiabilidad, no en una referencia verificada.
- Lo único que se puede sostener hoy con datos nuestros es la **auditoría de la sección 2** (se calculó con la base real) y el **plan de validación de la sección 5**, que es la forma estándar de probar un modelo: comparar lo que predice contra lo que ocurrió después.

**Para tener un respaldo real** hay que: (a) que alguien lea las fuentes completas (se pueden enviar los PDF aquí, o abrir el acceso a esos sitios en la configuración de red del entorno), o (b) apoyarse en estándares de confiabilidad conocidos (por ejemplo ISO 14224 para datos de fallas, ISO 55000 para gestión de activos) leídos directamente. Hasta entonces, el único respaldo de peso es la validación contra nuestros propios datos.

### 3.1 Marco aportado por el usuario (24-nov-2026) — sin fuente verificada

El usuario entregó un texto (de origen no indicado; parece salida de otro asistente) que dice que el respaldo técnico es ISO 55000 (gestión de activos) e ISO 17359 (monitoreo de condición), aplicados con RCM y FMECA, y que **no existe una tabla única de porcentajes**: cada faena calibra los pesos con sus ingenieros de confiabilidad y los manuales del fabricante. Propone dos capas y una regla de veto:
- **Capa A, por categoría de dato** (suma 100 %): monitoreo de condición (aceite, vibraciones, termografía) 40–50 %; telemetría y alertas 20–30 %; historial de fallas y confiabilidad 15–20 %; cumplimiento preventivo y edad 10–15 %.
- **Capa B, por subsistema del equipo:** por ejemplo tren de potencia 45 %, hidráulico/dirección/frenos 25 %, estructura 15 %, eléctrico y neumático 15 %.
- **Regla del peor factor:** si un parámetro crítico está en cero (hierro crítico en el aceite del motor, falla activa de frenos) el puntaje general se fuerza a menos de 40 % sin importar el promedio.

Qué se puede sostener y qué no:
- **Sostenible por lógica de ingeniería** (aunque no verificado en una fuente): ponderar por categoría y por subsistema, tratar la criticidad por separado, mostrar la confianza del dato y usar un veto cuando una señal crítica está en rojo. El propio texto reconoce que **los porcentajes los define cada faena**, así que **no son un estándar**.
- **No verificado:** los porcentajes «típicos» de la tabla, que SAP o Maximo los usen así, y que ISO 55000 o ISO 17359 prescriban un puntaje de salud. Las dos normas existen, pero hasta donde se sabe no fijan pesos ni umbrales; eso hay que confirmarlo leyéndolas. FMECA se usa para priorizar modos de falla por criticidad (en general con escalas de severidad, ocurrencia y detección), no «calcula matemáticamente» la probabilidad.
- **Consecuencia para nuestro sistema:** los pesos de cualquier versión nueva deben ser **decididos y firmados por quien responde por la confiabilidad de la flota**, no por mí ni por una tabla ajena, y luego **validados con nuestros datos** (sección 5).

## 4. Diseño propuesto (criterio propio; para aprobar antes de cambiar la fórmula otra vez)

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
