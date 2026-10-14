# Inventario de algoritmos, fórmulas, matrices y diagramas de SistemaMP

Para cada cálculo del programa: **qué es, para qué sirve, de dónde viene, cómo lo calcula aquí, dónde se ve y qué no dice**. Se armó leyendo el código (`logic.js`, 321 funciones públicas y 27 internas, y las pantallas de `modules/renders/`) y buscando cada método en internet. Fecha: 2026-10-13. Las dos apps (centinela y mp2) comparten todo esto.

> **Regla de la casa:** ningún cálculo inventa un dato que falta. Si no hay datos suficientes, el resultado es "sin dato" o "pocos casos", y cuando el programa tiene que suponer algo (por ejemplo 8 h para un correctivo sin duración) lo dice.

## Cómo leer este documento

**Nivel de la fuente** (en cada ficha, campo *De dónde viene*):

- 🟢 **Fuente verificada**: la búsqueda encontró una fuente seria (norma, manual de un organismo como NIST, documentación de SAS o JMP, artículo académico) que respalda el método.
- 🟡 **Referencia secundaria**: el método es estándar, pero lo que se encontró fue un blog, un curso o la ficha de una herramienta comercial. Sirve para ubicar el método, no como cita formal.
- 🔵 **Criterio propio**: el programa lo definió con sus propios datos; no hay una norma detrás. Está documentado, pero hay que tratarlo como una regla de la casa.
- ⚪ **Sin fuente encontrada**: es un método clásico, pero esta búsqueda no trajo una fuente que citar.
- 📄 **Dato del fabricante**: viene de un archivo del fabricante (el Excel de TBO de Komatsu) que cargó el usuario; no hay fuente en internet.

**Cómo se hizo la búsqueda y qué límites tiene.** Se hicieron 32 búsquedas. No fue posible abrir las páginas completas, así que cada fuente respalda *lo que dice el resumen de la búsqueda* y nada más. Las fórmulas de cada ficha son las que el código de verdad calcula; cuando el código dice que se verificó contra una librería de referencia (scipy, statsmodels, pymannkendall), eso se cita como "según el comentario del código", sin repetir esa verificación.

**Ejemplos reales.** Los marcados como *Ejemplo real* salen de los datos cargados en la base de centinela al 13-oct-2026, calculados con las mismas funciones del programa. Ojo con el período: la tabla de OT formales (`correctivos`) tiene 1.243 registros entre ene-2025 y jul-2026 y **casi no tiene registros desde abril de 2026** (2 en abril, 1 en junio, 3 en julio); el resto del historial reciente vive en `correctivos_historico`, que no trae duración ni horómetro. Por eso los ejemplos de fallas cubren sobre todo **ene-2025 a mar-2026**. Además, ningún correctivo trae el campo *componente* (0 de 1.243): el programa lo deduce del texto del síntoma.

## Hallazgos de la revisión (lo que hay que corregir o saber)

1. **"A&S1" de EN 15341.** El código (`costoRelativoMantenimiento`) llama "A&S1" al indicador costo de mantención ÷ valor de reposición. Las fuentes encontradas lo llaman **E1** en EN 15341 (equivalente a la métrica 1.5 de SMRP). No se pudo verificar "A&S1"; hay que revisarlo contra la norma 2019+A1:2022. Un texto externo afirma que "A&S" es *Administration & Supplies* y que A&S1 sería costo de materiales ÷ costo total de mantenimiento; **eso no coincide con la definición del programa y no está respaldado**: sus fuentes son videos, blogs y traductores, no la norma, y la propia fórmula que da es ambigua (propone dos distintas según la revisión). Una nueva búsqueda tampoco halló la lista de códigos.
2. **Jack-Knife.** El diagrama original (Knights) cruza **número de fallas** contra MTTR. El del programa cruza **MTBF** contra MTTR (hay herramientas comerciales que hacen lo mismo). Es una adaptación válida, pero no es la versión original.
3. **Mann-Kendall.** Las etiquetas "mejorando / empeorando" suponen que *más alto es mejor* (así se usa con la disponibilidad). Para un conteo de fallas hay que leerlas al revés.
4. **NPR (FMEA).** El manual AIAG-VDA reemplazó el NPR por la "Prioridad de Acción" y IEC 60812:2018 admite alternativas; el NPR del programa sigue siendo una práctica común, pero con límites conocidos (dos riesgos distintos pueden dar el mismo número). Sus bandas son propias.
5. **ISO 31010.** Fuentes secundarias indican que IEC 31010:2019 incluye la matriz consecuencia/probabilidad como la técnica n.º 29, con limitaciones declaradas (subjetividad, escalas ambiguas, el nivel de un riesgo depende de cuán fino se describa, los riesgos no se suman y no debe ser el único método en casos complejos o de alta consecuencia). No se pudo leer el texto de la cláusula, así que sigue sin confirmarse palabra por palabra; el producto P × C de 1 a 25 es el que usa el programa.
6. **Weibull por regresión vs. máxima verosimilitud.** El programa usa dos: regresión de rango mediano (rápida, sin censura) y MLE con censura. Se indica en cada ficha cuál usa cada pantalla.
7. **El "porqué" de una disponibilidad baja** suele ser una OT *abierta* sin fecha de salida: cuenta 24 h por día hasta hoy. Ver el ejemplo real de la ficha A1.

## Índice

| Tema | Fichas |
|---|---|
| A. Disponibilidad, fallas y tiempos | A1–A13 |
| B. Vida, supervivencia y tendencia de fallas | B1–B17 |
| C. Estadística: ¿la diferencia es real o ruido? | C1–C19 |
| D. Criticidad, riesgo y prioridad | D1–D14 |
| E. Repuestos e inventario | E1–E12 |
| F. Costos | F1–F6 |
| G. TBO del fabricante (Komatsu) | G1–G10 |
| H. Producción | H1–H3 |
| I. Simulación y pronóstico | I1–I4 |
| J. Neumáticos, PM y reglas del programa | J1–J7 |
| K. Diagramas y gráficos | K1–K13 |
| L. Datos y seguridad | L1–L5 |
| M. Funciones internas (apéndice) | tabla |

Son **123 fichas** y no queda ninguna función exportada de `logic.js` sin mencionar (lo verifica una prueba automática, ver más abajo).

---

## A. Disponibilidad, fallas y tiempos

### A1. Disponibilidad operacional (Ao) e intrínseca (Ai)
- **Tipo:** fórmula (se calcula día a día).
- **Para qué sirve:** responde "¿cuánto del tiempo programado estuvo disponible el equipo?" y, comparando las dos, "¿la disponibilidad baja por fallas o por el mantenimiento que la propia empresa programó?".
- **De dónde viene:** 🟢 Las definiciones coinciden con las de la literatura de confiabilidad: la inherente usa solo fallas (MTBF ÷ (MTBF + MTTR)) y la operacional incluye todas las paradas, también las programadas y la espera de repuestos ([NASA, "Availability: what is it"](https://extapps.ksc.nasa.gov/Reliability/Documents/160727.1_Availability_What_is_it.pdf); [Reliamag](https://reliamag.com/guides/reliability-vs-availability/)). Las fuentes encontradas no incluían el texto de ISO 14224 ni de IEC 60050-192.
- **Cómo lo calcula aquí:** para cada día, horas detenidas del equipo (suma de PM y de correctivos) contra las horas diarias que debería operar (`hrsDia`); el mes es el promedio de los porcentajes diarios. **Ao** incluye PM y correctivos; **Ai** solo correctivos que son fallas reales (una salida marcada como "no falla", por ejemplo sin repuesto o logística, no resta en Ai). Una OT "Fuera de Servicio" con varios días cuenta 24 h por día; si no tiene fecha de salida, **sigue contando 24 h por día hasta hoy**. Si un correctivo no trae duración se asumen **8 h**; un PM sin duración, **4 h**.
- **Dónde se ve:** pestañas Disponibilidad, Dashboard, KPI y Metas. La brecha Ao − Ai es la pregunta de gerencia.
- **Ejemplo real (julio 2026, equipos con más detención):**

| Equipo | Ao | Ai | Qué la baja |
|---|---|---|---|
| CF-8769 | 24,2 % | 24,2 % | OT "Fuera de Servicio" abierta desde el 9-jul, sin fecha de salida: 24 h por día del 9 al 31 de julio, más un correctivo del 4-jul contado como 8 h |
| BD-9533 | 52,7 % | 52,7 % | Igual: OT abierta desde el 18-jul (14 días a 24 h) más un correctivo histórico del 9-jul (8 h) |
| CF-9511 | 83,8 % | 86,0 % | Cinco correctivos de "pantógrafo bloqueado" (17, 18, 24, 25 y 27-jul, 8 h supuestas cada uno), una OT fuera de servicio el 21 (24 h) y un PM de 8,4 h el 23 |
| CN-9500 | 91,4 % | 95,2 % | PM3 de 15,7 h el 1-jul, más tres correctivos históricos de 8 h (dos el 12-jul, 16 h en total, y uno el 26-jul) |

  El algoritmo no supone la causa: suma horas de cada orden y de cada PM y muestra cuáles. Lo que sí supone queda a la vista (8 h por correctivo sin duración, 24 h por día de OT abierta). Lectura útil: la baja de CF-8769 y BD-9533 probablemente es una OT que nadie cerró.
- **Límites:** Ai aquí es *observada* (horas reales detenidas por fallas), no la fórmula de diseño MTBF ÷ (MTBF + MTTR). El supuesto de 8 h y el de "OT abierta = 24 h por día" pueden inflar la indisponibilidad; por eso el pronóstico de disponibilidad (ficha I3) lista aparte los eventos "prolongados".
- **Código:** `dispDownMap`, `dispEquipoMes`, `dispIntrinsecaEquipoMes`, `equiposFueraDeServicioAhora`, `rangoDias`.

### A2. MTBF y MTTR del programa
- **Tipo:** fórmula.
- **Para qué sirve:** MTBF = cada cuántas horas de operación falla un equipo; MTTR = cuánto tarda en repararse en promedio. Son la base de la confiabilidad, el Jack-Knife, la criticidad y los costos.
- **De dónde viene:** 🟢 Definiciones estándar de la ingeniería de confiabilidad (ver las fuentes de disponibilidad en A1).
- **Cómo lo calcula aquí:** **MTBF** = (horómetro de la última falla − horómetro de la primera) ÷ (cantidad de fallas válidas − 1): el promedio de horas de operación *entre* fallas sucesivas, leyendo el horómetro registrado en cada falla (no "horómetro actual ÷ fallas", que cambiaba solo porque pasaba el tiempo). Necesita al menos 2 fallas con horómetro. **MTTR** = promedio de la duración registrada (`"Xh"`) de las reparaciones; si no hay ninguna da 0. Una "falla" es un correctivo, una falla operacional o una salida de servicio marcada "Reparación Inmediata" (`esFallaMTBF`).
- **Dónde se ve:** Stock & Insumos → Costos → MTBF/MTTR, KPI, Dashboard, Ficha de equipo. `mtbfFlotaReal` promedia el MTBF de cada equipo para la flota.
- **Ejemplo real:** CN-9507, 95 fallas registradas entre ene-2025 y feb-2026 (70 con horómetro): MTBF **43 h**, MTTR **12,1 h**. CN-9501: 98 fallas (feb-2025 a mar-2026), MTBF 157 h, MTTR 3,5 h.
- **Límites:** cuenta como "falla" cualquier correctivo; en los datos reales muchos son intervenciones menores (engrase, relleno de fluidos, presurizar neumáticos), así que el MTBF queda bajo y el número de "fallas" alto. Un correctivo sin horómetro no entra al MTBF; sin duración, no entra al MTTR.
- **Código:** `C.mtbfReal`, `C.mttrReal`, `esFallaMTBF`, `mtbfFlotaReal`, `contarFallasMes`, `intervalosFallaFlotaDias`, `duracionesReparacionFlotaHoras`.

### A3. Intervalo de confianza del MTBF (chi-cuadrado)
- **Tipo:** fórmula estadística.
- **Para qué sirve:** dice cuánto confiar en un MTBF. Un equipo con 2 fallas y uno con 50 no tienen la misma incertidumbre.
- **De dónde viene:** 🟢 Método estándar con la distribución chi-cuadrado y tasa de falla constante ([NIST, factores para límites de confianza del MTBF](https://itl.nist.gov/div898/handbook/apr/section4/apr451.htm); [Quanterion, límites para ensayo terminado por tiempo](https://www.quanterion.com/confidence-bounds-on-the-mean-time-between-failure-mtbf-for-a-time-truncated-test/)). Las fuentes advierten que los grados de libertad para ensayos terminados por tiempo son motivo de debate (2r frente a 2r+2).
- **Cómo lo calcula aquí:** con r intervalos y tiempo total T (rango de horómetros): inferior = 2T ÷ χ²(1−α/2; 2r+2), superior = 2T ÷ χ²(α/2; 2r), confianza 95 %. Mismos datos y mismo mínimo (2 fallas) que el MTBF.
- **Dónde se ve:** columna del MTBF en Costos → MTBF/MTTR y en Estadística.
- **Ejemplo real:** CN-10155, 2 fallas: MTBF 430 h, pero el intervalo es **[77 h – 16.984 h]**: el número no dice casi nada. CN-9507 (70 intervalos): MTBF 43 h, intervalo [34 – 55 h]: sí es confiable.
- **Límites:** supone tasa de falla constante (distribución exponencial); si el equipo se desgasta, el intervalo es solo orientativo.
- **Código:** `intervaloConfianzaMTBF`.

### A4. Error estándar del MTTR
- **Tipo:** fórmula estadística.
- **Para qué sirve:** dice cuán preciso es un MTTR (4 h con 2 reparaciones no es lo mismo que 4 h con 40).
- **De dónde viene:** ⚪ Es el error estándar de la media de libro, SE = s ÷ √n; no se recuperó una fuente en esta búsqueda.
- **Cómo lo calcula aquí:** SE = desviación estándar muestral ÷ √(reparaciones con duración); intervalo = media ± z·SE (aproximación normal). Mínimo 2 reparaciones.
- **Dónde se ve:** Costos → MTBF/MTTR y Estadística; la pantalla marca visualmente las muestras de menos de 5.
- **Límites:** aproximación normal; con menos de 5 datos la cobertura real es menor a la nominal. Los tiempos de reparación no son simétricos (ver A5), así que el intervalo es solo orientativo.
- **Código:** `errorEstandarMTTR`.

### A5. Forma real del MTTR (log-normal)
- **Tipo:** distribución de probabilidad.
- **Para qué sirve:** mostrar que el MTTR promedio engaña: casi todas las reparaciones son cortas y unas pocas muy largas, y esas pocas arrastran el promedio.
- **De dónde viene:** ⚪ La log-normal para tiempos de reparación es práctica común en mantenibilidad; esta búsqueda no trajo una fuente específica.
- **Cómo lo calcula aquí:** ajusta una log-normal a las duraciones de toda la flota y muestra mediana, percentil 90 y promedio.
- **Dónde se ve:** Costos → MTBF/MTTR, bloque "Forma real del MTTR".
- **Ejemplo real:** con 732 reparaciones de la flota: **mediana 2,8 h, percentil 90 de 16,8 h, promedio simple 16,3 h**. El promedio es casi seis veces la mediana porque unas pocas reparaciones son enormes (registros de 121, 324 o 696 h, algunos de OT que quedaron abiertas).
- **Límites:** las duraciones muy largas suelen ser OT sin cerrar a tiempo, no reparaciones reales; por eso el programa usa la mediana en la criticidad (D2).
- **Código:** `analisisMTTRLogNormal`, `analisisMTTRPorCategoria`.

### A6. Confiabilidad R(t) con tasa de falla constante
- **Tipo:** fórmula.
- **Para qué sirve:** probabilidad de que el equipo complete un período de operación sin fallar.
- **De dónde viene:** 🟡 Fórmula exponencial R(t) = e^(−t/MTBF), estándar en análisis RAM; esta búsqueda no la recuperó como fuente separada (las relacionadas están en A1 y B1).
- **Cómo lo calcula aquí:** R(t) = e^(−t/MTBF), con el MTBF real del equipo. No se confunde con "% de flota sin falla" del Dashboard (que es un conteo).
- **Dónde se ve:** Dashboard y Ficha de equipo. La versión con Weibull propio es `confiabilidadWeibull` (B1).
- **Ejemplo real:** CN-9501 (MTBF 157 h): probabilidad de operar 250 h sin falla = **20,3 %**. CN-9507 (MTBF 43 h): **0,3 %**.
- **Límites:** supone que la edad no influye (β = 1).
- **Código:** `confiabilidadReal`, `confiabilidadWeibull`.

### A7. % de fallas en el mes, ratio preventivo y % correctivo reactivo
- **Tipo:** indicadores.
- **Para qué sirve:** medir qué tanto del trabajo es preventivo y cuánto tiempo se va en correctivos.
- **De dónde viene:** 🟡 Indicadores habituales de mantenimiento; SMRP y EN 15341 los definen de formas parecidas y las definiciones varían entre fuentes ([Reliamag, referencia de KPI](https://reliamag.com/guides/maintenance-reliability-kpi-reference/) aparece en la búsqueda, sin poder abrir el detalle).
- **Cómo lo calcula aquí:** **ratio preventivo** = PM ejecutados ÷ (PM + correctivos reales), por cantidad; **% correctivo reactivo** = horas de correctivo ÷ horas totales de intervención, por horas (un mes con pocas OT pero largas se ve distinto); **fallas del mes** = correctivos reales (`esFallaMTBF`) del mes.
- **Dónde se ve:** Dashboard, KPI, Metas, Costos.
- **Límites:** depende de que el tipo de OT esté bien clasificado.
- **Código:** `ratioPreventivo`, `porcentajeCorrectivoReactivo`, `contarFallasMes`.

### A8. Cumplimiento de PM a tiempo
- **Tipo:** indicador.
- **Para qué sirve:** ¿cuántos PM se hicieron dentro del plazo?
- **De dónde viene:** 🟡 Equivale al "PM compliance" de SMRP (métrica 5.4.14) y al "schedule compliance"; el criterio de "a tiempo" varía según la fuente (mismo día, +1 día, +20 % del intervalo con tope de 28 días) ([Reliamag, benchmarks de cumplimiento](https://reliamag.com/guides/pm-compliance-rate-benchmarks/)). El estándar que usa el programa es el del propio cliente: su informe de gestión de mantenimiento ("Centinela Ripios OXE", semana del 1 al 7 de enero de 2026) mide las **desviaciones de mantenimiento** como horas entre el horómetro programado y el real de cada PM, con estándar de **±10 % del ciclo (±25 h en el de 250 h)**.
- **Cómo lo calcula aquí:** en los equipos por horas el PM toca al llegar el horómetro a un hito de la grilla de la frecuencia (250, 500, 750 h…, la misma que usa el cálculo del próximo PM), y cada PM cubre el siguiente hito aún no cubierto de su equipo (`desviosPM`). La grilla es fija a propósito (regla definida por el usuario): un PM adelantado a las 220 h o atrasado a las 350 h deja el siguiente en las 500 h, no corrido; sumar 250 h al último PM (300 + 250 = 550) correría el calendario y acumularía un desfase que se confundiría con los PM futuros. El desvío es el horómetro con que se hizo menos ese hito: positivo = atrasado, negativo = adelantado. Dentro de ±10 % del ciclo cuenta como cumplido; fuera de ese margen es una desviación, **sea tarde o temprano**: hecho a las 380 h cuando tocaba a las 250 h está pasado, a las 160 h está adelantado. Si un PM salta uno o más hitos queda como "hito sin registro" (se saltó o se hizo y no se anotó; con estos datos no se distingue) y no cuenta ni a favor ni en contra; un PM repetido casi en el mismo hito tampoco. Los PM anteriores se evalúan igual, porque el horómetro está en todos los registros. Camionetas y buses (por km) usan el desvío en días que se guarda desde el 14 de octubre de 2026. Una sola función decide si un PM fue a tiempo para que Dashboard, KPI y Metas no diverjan (una auditoría encontró que comparaban un texto que nunca existía).
- **Dónde se ve:** Dashboard, KPI, Metas, Registro PM.
- **Límites:** no mide si el PM se hizo en la fecha del programa, solo en qué horómetro; un equipo que no avanza horómetro no se atrasa. No es idéntico a ninguna de las tres variantes de SMRP. Con los datos reales de centinela (380 PM de equipos por horas): 329 evaluables, 61 % dentro del estándar, 50 adelantados y 78 atrasados, y 47 hitos sin registro. Lo mismo medido de otras dos formas (hito más cercano; 250 h desde el último PM real) da 62 %, así que la cifra no depende de cómo se defina el punto en que toca.
- **Código:** `regEsATiempo`, `desviosPM`, `PM_TOLERANCIA_CICLO`.

### A9. Curva S de PM y cumplimiento del programa
- **Tipo:** diagrama + indicador (plan contra real acumulado).
- **Para qué sirve:** ver día a día si el trabajo de PM planificado se está ejecutando, ponderado por horas (un PM4 pesa 12 h y un PM1 3 h).
- **De dónde viene:** 🟡 La curva S plan-contra-real es un recurso estándar de control de proyectos; las fuentes encontradas son de guías de gestión y de valor ganado ([Schedulereader, curvas S](https://www.schedulereader.com/how-to-use-s-curves-for-monitoring-and-reporting-project-progress/); [Czarnigowska, valor ganado](https://www.earnedschedule.com/Docs/Czarnigowska%20-%20Project%20Performance%20Reporting.pdf)). Una curva real sobre la plan indica adelanto; bajo la plan, atraso.
- **Cómo lo calcula aquí:** curva acumulada del plan (PM calendarizados por equipo según la grilla de la ficha J1) contra la curva real (PM ejecutados), para semana, mes, semestre o año; solo se cuentan períodos con base en al menos 50 % de los equipos. Las duraciones por tipo de PM son estándar (editables en Configuración).
- **Dónde se ve:** Planificador y Metas & KPIs → Avance ("Curva S de PM").
- **Límites:** el plan se recalcula con cada lectura de horómetro; no hay un plan congelado contra el cual medir. Las duraciones estándar son un supuesto.
- **Código:** `curvaSPM`, `cumplimientoProgramaPeriodos`, `cumplimientoProgramaMeses`, `periodoRango`, `periodoEtiqueta`, `periodoOpciones`, `PM_DURACION_ESTANDAR_H`, `PM_EQUIVALENCIA`, `pmDuracionesEstandar`, `pmTipoEfectivo`.

### A10. Reportabilidad diaria del cliente (disponibilidad contractual)
- **Tipo:** fórmula + proceso de carga.
- **Para qué sirve:** el cliente pide cada día el estatus de todos los equipos (operativo "OP" o fuera de servicio "FS"); esta pieza lo carga, lo funde sin duplicar y calcula la disponibilidad contractual.
- **De dónde viene:** 🔵 Criterio propio basado en el formato de reporte que entrega el cliente.
- **Cómo lo calcula aquí:** disponibilidad del día = OP ÷ (OP + FS) de los equipos reportados ese día. Une varias hojas en filas únicas por fecha + sigla; recargar lo mismo no cambia nada. Agrupa las filas consecutivas FS en "episodios" (con su motivo y sus reprogramaciones).
- **Dónde se ve:** Disponibilidad → "Reportabilidad diaria del cliente".
- **Límites:** depende de la fiabilidad de la hoja del cliente y del mapa de siglas.
- **Código:** `reportabilidadFechaDeNombre`, `reportabilidadParsearHoja`, `reportabilidadArmarLote`, `reportabilidadFusionar`, `reportabilidadDisponibilidad`, `reportabilidadEpisodios`, `REPORTAB_MAPA_SIGLAS`.

### A11. Trazabilidad aviso → orden
- **Tipo:** algoritmo de cruce.
- **Para qué sirve:** detectar avisos (informes de falla) que nunca tuvieron una orden de trabajo real detrás.
- **De dónde viene:** 🔵 Criterio propio, a partir de la terminología SAP (Aviso de Mantenimiento = el reporte; Orden = el trabajo).
- **Cómo lo calcula aquí:** para cada aviso busca una orden real con la misma sigla y fecha dentro de una ventana de días; cuenta cuántos quedaron sin orden. No usa el puente que hace que un aviso cuente como falla (si no, todo aviso se "vincularía" consigo mismo).
- **Dónde se ve:** Informes.
- **Código:** `trazabilidadAvisoOrden`, `resumenTrazabilidadAvisoOrden`.

### A12. Tiempos de compra: respuesta por proveedor, pedidos trabados, aprobación de OC
- **Tipo:** estadística descriptiva.
- **Para qué sirve:** saber qué proveedor demora más y qué pedidos abiertos llevan más tiempo de lo normal.
- **De dónde viene:** 🔵 Criterio propio con medianas de los datos reales.
- **Cómo lo calcula aquí:** solo pedidos cerrados ("Recepcion Bodega") para el promedio y la mediana por proveedor; un pedido abierto se marca "trabado" si lleva más días que la mediana de su proveedor × 1,5 (con la mediana global como respaldo si el proveedor tiene poca muestra).
- **Dónde se ve:** Costos → "Compras — Proveedores".
- **Código:** `tiempoRespuestaPorProveedor`, `pedidosPotencialmenteTrabados`, `tiempoAprobacionOC`.

---

### A13. Informe de gestión de mantenimiento (desviaciones de PM y equipos fuera de servicio)
- **Tipo:** informe (cálculo + tabla + gráfico).
- **Para qué sirve:** replicar las secciones III y IV del informe semanal que arma el cliente: qué tan cerca del horómetro programado se hizo cada PM y qué equipos siguen fuera de servicio.
- **De dónde viene:** 🔵 Criterio propio, a partir del informe de gestión de mantenimiento del cliente ("Centinela Ripios OXE", semana del 1 al 7 de enero de 2026), que fija el estándar de ±10 % del ciclo.
- **Cómo lo calcula aquí:** III: para los PM del período elegido muestra el horómetro programa (el hito que cubría), el real, la desviación en horas y en % del ciclo, y el % dentro del estándar, que es el mismo número que Dashboard, Informes KPI y Metas (ver A8). IV: los equipos con una salida de servicio todavía abierta (`equiposFueraDeServicioAhora`), con los días que llevan, su sistema o conjunto, lo anotado en el síntoma y la solución, y su último PM. No incluye la certeza de programa, el cumplimiento de programa ni el cierre de backlog (secciones I, II y V del informe), que dependen del Plan Semanal (hoy sin datos) y de tareas pendientes de pauta que el sistema no registra.
- **Dónde se ve:** Metas & KPIs → Informe de gestión.
- **Límites:** el horómetro programa es el hito de la grilla fija de la frecuencia (250, 500, 750 h…), como se definió; el "horómetro programa" que trae el informe del cliente no cae en esos múltiplos y no se pudo explicar. Para los PM por km solo hay desvío en días.
- **Código:** `informeGestionPM`, `informeGestionFS`.

## B. Vida, supervivencia y tendencia de fallas

### B1. Weibull por regresión de rango mediano
- **Tipo:** distribución de probabilidad + método de ajuste.
- **Para qué sirve:** describe *cómo* falla algo en el tiempo con dos números: la forma **β** (β < 1: fallas tempranas; β ≈ 1: al azar; β > 1: desgaste) y la escala **η** (horas en que ya falló el 63 %). Dice si tiene sentido cambiar por edad o conviene vigilar por condición.
- **De dónde viene:** 🟢 La forma de β está en la literatura de confiabilidad (β < 1 mortalidad infantil, β = 1 fallas al azar, β > 1 desgaste; [Reliamag, cómo interpretar un análisis Weibull](https://reliamag.com/cartoons/interpret-weibull-analysis-results/), que además recuerda mirar si el intervalo de confianza de β excluye 1). El método de rango mediano con la aproximación de Benard, F(i) ≈ (i − 0,3) ÷ (n + 0,4), y la recta en papel log-log vienen de [NIST, gráfico de probabilidad Weibull](https://itl.nist.gov/div898/handbook/apr/section2/apr221.htm) y [ReliaWiki, rangos medianos](https://reliawiki.com/index.php/Median_Ranks).
- **Cómo lo calcula aquí:** ordena los intervalos entre fallas (horas del horómetro), les asigna rangos medianos, ajusta una recta en escala log-log y saca β y η, más el R² de esa recta. Pide al menos 5 intervalos. La misma regresión se usa para equipo a equipo (`ajusteWeibull`), para poblaciones de unidades distintas (neumáticos, componentes mayores: `ajusteWeibullVidas`, `analisisVidaUtilPorGrupo`) y para correctivos por componente en toda la flota (`analisisVidaUtilCorrectivosPorComponente`, que agrupa por equipo + componente antes de juntar para no mezclar horómetros de equipos distintos). Las interpretaciones en palabras (`interpretacionFormaWeibull`) y de la bondad de ajuste (`interpretacionAjusteWeibull`, bandas de R² de 0,9 y 0,8, criterio práctico propio, detecta mezclas marcadas de modos de falla pero no sutiles) acompañan al número.
- **Dónde se ve:** Estadística ("Forma real de falla por componente"), Componentes (histórico), Neumáticos, Torre de Control.
- **Ejemplo real (ene-2025 a mar-2026):** CN-9500, 77 intervalos entre fallas: **β = 0,97, η = 62 h, R² = 0,949**. β cercano a 1 significa que la edad no predice la falla (fallan al azar); reemplazar por edad no ayudaría y conviene monitorear por condición. CN-9507: β = 1,08 (n = 64). CF-9510: β = 0,87 (n = 103, levemente tempranas).
- **Límites:** descarta equipos que siguen operando sin haber vuelto a fallar (eso lo resuelve B2). Con modos de falla mezclados el β describe un promedio que no representa a ninguno. Como las "fallas" del programa incluyen intervenciones menores, el β mide el ritmo de las intervenciones, no solo de las averías.
- **Código:** `ajusteWeibull`, `ajusteWeibullVidas`, `analisisVidaUtilPorGrupo`, `analisisVidaUtilCorrectivosPorComponente`, `confiabilidadWeibull`, `interpretacionFormaWeibull`, `interpretacionAjusteWeibull`.

### B2. Weibull con censura (máxima verosimilitud)
- **Tipo:** método de ajuste.
- **Para qué sirve:** lo mismo que B1, pero usando también lo que *todavía no falló*: un componente que sigue montado "sobrevivió al menos hasta acá", y descartarlo sesga la muestra hacia lo que falla rápido.
- **De dónde viene:** 🟢 La máxima verosimilitud con datos censurados es el método estándar; NIST lo describe con un ejemplo Weibull de 20 unidades, 10 falladas y 10 retiradas sin fallar a las 500 h ([NIST, estimación por máxima verosimilitud](https://itl.nist.gov/div898/handbook/apr/section4/apr413.htm)). Las fallas aportan la densidad y las censuras la función de supervivencia. El estimador de β tiene sesgo con muestras chicas o mucha censura ([Makalic y Schmidt, arXiv 2209.14567](https://arxiv.org/pdf/2209.14567)). El código cita a Meeker y Escobar como referencia del método.
- **Cómo lo calcula aquí:** maximiza la log-verosimilitud ln L = r·ln β − r·β·ln η + (β−1)·Σln t(fallas) − Σ(t/η)^β sobre todas las observaciones (η sale en forma cerrada para cada β; β se busca numéricamente). Según el comentario del código se verificó con un script independiente contra parámetros conocidos. Variantes: equipo a equipo agregando el tramo abierto hasta el horómetro actual (`ajusteWeibullEquipoCensurado`), poblaciones agrupadas (`analisisVidaUtilPorGrupoCensurado`) y correctivos por componente en la flota (`ajusteWeibullCorrectivosPorComponenteCensurado`). Las rutinas de máxima verosimilitud sin censura para los cuatro modelos (exponencial, log-normal, gamma, Weibull) alimentan la comparación de B3.
- **Dónde se ve:** Componentes (histórico), Neumáticos, y las pestañas TBO (vida por componente).
- **Límites:** necesita datos con horómetro de instalación y de baja confiables; con pocos eventos el β es inestable.
- **Código:** `ajusteWeibullCensurado`, `ajusteWeibullEquipoCensurado`, `analisisVidaUtilPorGrupoCensurado`, `ajusteWeibullCorrectivosPorComponenteCensurado`, `ajusteWeibullMLE`, `ajusteExponencialMLE`, `ajusteLogNormalMLE`, `ajusteGammaMLE`.

### B3. Comparación de cuatro modelos de vida (AICc y Kolmogorov-Smirnov)
- **Tipo:** selección de modelo.
- **Para qué sirve:** decidir si la vida de un componente se describe mejor con Weibull, exponencial, log-normal o gamma, en vez de asumir Weibull siempre.
- **De dónde viene:** 🟢 El criterio de Akaike corregido para muestras chicas (AICc = AIC + 2K(K+1) ÷ (n−K−1)) se recomienda cuando n/K es bajo ([documentación de MuMIn](https://search.r-project.org/CRAN/refmans/MuMIn/html/AICc.html), que cita a Burnham y Anderson). El p-valor de KS por bootstrap paramétrico es una práctica conocida; no se recuperó fuente específica.
- **Cómo lo calcula aquí:** ajusta los cuatro modelos por máxima verosimilitud, los ordena por AICc y muestra el ΔAICc contra el mejor; opcionalmente un p-valor de KS por bootstrap. Pide al menos 8 datos positivos.
- **Dónde se ve:** TBO (calibración y comparación de modelos).
- **Límites:** con 8 a 15 datos las diferencias entre modelos suelen ser pequeñas.
- **Código:** `compararModelosVida`, `TBO_MODELOS_VIDA`.

### B4. Curva de supervivencia de Kaplan-Meier
- **Tipo:** estimador no paramétrico.
- **Para qué sirve:** probabilidad empírica de seguir sin fallar a cada hora, sin asumir ninguna forma, usando también lo que sigue en servicio.
- **De dónde viene:** 🟢 Kaplan y Meier (1958), *Journal of the American Statistical Association* 53:457–481, "Nonparametric estimation from incomplete observations": producto de (1 − d ÷ n) en cada tiempo de falla, con el supuesto de que la censura es independiente de la vida ([historia del método](https://www.est.ufmg.br/~enricoc/pdf/sobre/Edward%20L.%20Kaplan%20and%20the%20Kaplan-Meier%20Survival%20Curve.pdf); [resumen del estimador](https://www.openriskmanual.org/wiki/Kaplan-Meier_Estimator)).
- **Cómo lo calcula aquí:** S(t_i) = S(t_{i−1}) × (1 − d_i ÷ n_i), con varianza de Greenwood. Las censuras no bajan la curva pero salen del grupo en riesgo. Pide al menos 5 observaciones. Para correctivos se arma por equipo + componente y el tramo abierto hasta el horómetro actual entra como censura.
- **Dónde se ve:** Estadística ("Curva de supervivencia por componente").
- **Límites:** con pocas fallas la curva escalona y su intervalo es ancho.
- **Código:** `kaplanMeier`, `kaplanMeierCorrectivosPorComponente`.

### B5. Prueba log-rank
- **Tipo:** prueba estadística.
- **Para qué sirve:** ¿dos curvas de supervivencia (dos componentes, modelos o ubicaciones) son realmente distintas o es ruido de muestra chica?
- **De dónde viene:** 🟢 Prueba de Mantel (1966), también llamada Mantel-Cox; tiene más poder cuando los riesgos son proporcionales ([Wikipedia, prueba log-rank](https://en.wikipedia.org/wiki/Logrank_test); [Mantel sobre su propia prueba](https://jhanley.biostat.mcgill.ca/bios601/SurvivalAnalysis/MantelOnHisTestForComparingSurvivalCurves.pdf)). Peto y Peto (1972) es otra prueba distinta (tipo Wilcoxon) y no es el origen de esta.
- **Cómo lo calcula aquí:** en cada tiempo de falla compara fallas observadas con las esperadas si ambos grupos tuvieran el mismo riesgo; χ² = (ΣO_A − ΣE_A)² ÷ ΣV con 1 grado de libertad (valor crítico 3,841). Pide 5 observaciones por grupo y al menos una falla.
- **Dónde se ve:** Estadística (comparación de curvas).
- **Límites:** supone riesgos proporcionales; con pocas fallas no detecta diferencias moderadas (ver C14).
- **Código:** `logRankTest`.

### B6. Regresión de Cox (razón de riesgos entre dos grupos)
- **Tipo:** modelo estadístico.
- **Para qué sirve:** cuantificar *cuánto* más rápido falla un grupo que otro ("el grupo B falla 2,3 veces más rápido").
- **De dónde viene:** 🟢 Cox (1972), *Journal of the Royal Statistical Society B* 34(2):187–220, modelo de riesgos proporcionales con verosimilitud parcial ([artículo original](https://www.stat.cmu.edu/~ryantibs/journalclub/cox_1972.pdf)).
- **Cómo lo calcula aquí:** verosimilitud parcial con aproximación de Breslow para empates, un solo β por Newton-Raphson; HR = e^β. Según el comentario del código se verificó contra `statsmodels` (PHReg, Breslow) a 5 decimales; con separación perfecta entre grupos el β diverge y el programa lo declara sin resultado en vez de mostrar un HR absurdo.
- **Dónde se ve:** Estadística (comparación de curvas).
- **Límites:** solo dos grupos; supone riesgos proporcionales.
- **Código:** `coxPHBinario`.

### B7. Riesgos competitivos (¿qué modo de falla gana la carrera?)
- **Tipo:** estimador no paramétrico.
- **Para qué sirve:** probabilidad de que cada modo de falla (motor, transmisión, hidráulico…) sea *la próxima* que saque al equipo de servicio. Kaplan-Meier por componente trata las otras causas como si no existieran y sobreestima cada una.
- **De dónde viene:** 🟢 Estimador de Aalen-Johansen de la incidencia acumulada, estándar cuando hay causas competitivas; Kaplan-Meier trata los eventos competitivos como censura y sobreestima el riesgo ([arXiv 1402.2209](https://arxiv.org/pdf/1402.2209); [introducción en epidemiología](https://www.dovepress.com/an-introduction-to-competing-risks-in-epidemiology-peer-reviewed-fulltext-article-CLEP)).
- **Cómo lo calcula aquí:** CIF_k(t_i) = CIF_k(t_{i−1}) + S(t_{i−1}) × d_{i,k} ÷ n_i. Se agrupa solo por equipo: cada intervalo entre fallas sucesivas es una observación cuya causa es el componente que falló al final; el tramo final abierto es censura.
- **Dónde se ve:** Estadística ("¿Qué modo de falla mata primero?").
- **Límites:** depende de que el componente esté bien clasificado (en los datos reales se deduce del síntoma).
- **Código:** `competingRisks`, `competingRisksPorEquipo`.

### B8. Función media acumulada (MCF)
- **Tipo:** estimador no paramétrico para eventos recurrentes.
- **Para qué sirve:** cuántas fallas acumuladas de un componente esperar, en promedio, por equipo a cierto horómetro: insumo para presupuestar repuestos y mano de obra.
- **De dónde viene:** 🟢 Estimador de Nelson para sistemas reparables; SAS lo documenta en su procedimiento RELIABILITY, con varianza e intervalos, sin asumir estructura del proceso de reparación ([SAS, MCF](https://support.sas.com/documentation/cdl/en/qcug/63922/HTML/default/qcug_reliability_sect013.htm)).
- **Cómo lo calcula aquí:** M(t_i) = M(t_{i−1}) + d_i ÷ n_i, donde n_i son los equipos aún bajo observación en t_i. Por componente y en toda la flota; el fin de observación es el horómetro actual (si no existe, la última falla).
- **Dónde se ve:** Estadística ("Fallas acumuladas esperadas por componente").
- **Límites:** supone que los equipos observados son comparables entre sí.
- **Código:** `mcf`, `mcfCorrectivosPorComponente`.

### B9. Crow-AMSAA (¿mejora o empeora la tasa de fallas?)
- **Tipo:** modelo de proceso de Poisson no homogéneo (ley de potencia).
- **Para qué sirve:** ver si la confiabilidad mejora o empeora en el tiempo calendario.
- **De dónde viene:** 🟢 Modelo de crecimiento de confiabilidad de MIL-HDBK-189 (1981), proceso de Poisson no homogéneo con intensidad Weibull o de ley de potencia; el β indica mejora (< 1) o deterioro (> 1) ([JMP, plataforma de crecimiento de confiabilidad](https://www.jmp.com/support/help/en/18.2/jmp/overview-of-the-reliability-growth-platform.shtml)). Que IEC 61164 (*Reliability growth — Statistical test and estimation methods*) sea el estándar equivalente aparece solo en una página comercial y en un texto externo sin la norma a la vista; se buscó dos veces y no se confirmó su contenido. Las fórmulas del modelo (N(t) = λ·t^β, intensidad ρ(t) = λ·β·t^(β−1) y MTBF instantáneo = 1 ÷ ρ(t)) son las del proceso de Poisson no homogéneo de ley de potencia y coinciden con las de JMP; el programa calcula β y λ, no el MTBF instantáneo.
- **Cómo lo calcula aquí:** N(t) = λ·t^β sobre días calendario; β̂ = n ÷ Σln(T/t_i) corregido por el factor (n−1) ÷ n (para reducir el sesgo conocido del estimador), λ̂ = n ÷ T^β̂, con intervalo al 90 % de β̂ ± 1,645·β̂ ÷ √n: "mejorando" si todo el intervalo queda bajo 1, "empeorando" si queda sobre 1, "sin certeza" si incluye 1. Por componente se juntan las fechas de falla de toda la flota en un solo proceso.
- **Dónde se ve:** Estadística ("Tendencia de la tasa de fallas") y Predictivo (criticidad dinámica, D6).
- **Ejemplo real:** CN-9500 (80 fallas): **β = 0,74, "mejorando"**; CN-9507 (95 fallas): β = 0,70, "mejorando"; CF-9510 (115 fallas): β = 0,91, "sin certeza". Ojo: la mejora puede ser real o reflejar que desde marzo-2026 casi no se cargan OT formales (ver "Ejemplos reales" al inicio).
- **Límites:** el estimador de máxima verosimilitud de β tiene sesgo positivo con pocos datos (el código lo documenta con una simulación). Mide el tiempo calendario, no el desgaste físico.
- **Código:** `crowAMSAA`, `crowAMSAAPorComponente`, `interpretacionCrowAMSAA`.

### B10. Edad virtual y reparación imperfecta (Kijima)
- **Tipo:** modelo de renovación imperfecta.
- **Para qué sirve:** estimar si las reparaciones dejan al equipo "como nuevo" (q = 0) o "como estaba" (q = 1), es decir, si solo tapan el síntoma.
- **De dónde viene:** 🟢 Kijima y Sumita (1986) y Kijima (1988, 1989) generalizaron la reparación perfecta o mínima a un factor intermedio mediante la "edad virtual"; Tipo I rejuvenece solo el último intervalo, Tipo II toda la edad acumulada ([Tanwar, Rai y Bolia 2014, *Reliability Engineering & System Safety* 124](https://ideas.repec.org/a/eee/reensy/v124y2014icp24-31.html); [Gasmi et al.](https://ammsi.imag.fr/Manifestations/Grenoble2016/Gasmi.pdf)). La fórmula exacta de las recursiones aparece en una ficha comercial y no se comprobó contra los artículos de Kijima.
- **Cómo lo calcula aquí:** hay dos versiones. (1) **Proxy simple** (`edadVirtualEquipo`): parte los intervalos entre fallas en dos mitades cronológicas y compara medianas; si la segunda mitad falla más seguido, factorQ se acerca a 1; pide 6 intervalos. (2) **Ajuste real** (`kijimaEquipo`, Tipo I y II con base Weibull censurada, mínimo 5 fallas) con la recursión v + q·x (Tipo I) o q·(v + x) (Tipo II).
- **Dónde se ve:** Predictivo y Torre de Control (señal de degradación); alimenta la señal de reemplazo (D9).
- **Límites:** el proxy es una aproximación declarada, no un ajuste de máxima verosimilitud.
- **Código:** `edadVirtualEquipo`, `kijimaEquipo`.

### B11. Proceso de renovación general: simulación de trayectorias
- **Tipo:** simulación.
- **Para qué sirve:** proyectar miles de futuros posibles de fallas de *un equipo* respetando cuán bien lo restauran sus reparaciones.
- **De dónde viene:** 🟢 Es el proceso de renovación general (GRP) de Kijima descrito en B10, con base de intensidad Weibull.
- **Cómo lo calcula aquí:** parte de la edad virtual actual del equipo, sortea cada próximo tiempo de falla invirtiendo la supervivencia condicional S(v+x) ÷ S(v) = 1 − u, y actualiza la edad virtual tras cada falla con la misma recursión de Kijima.
- **Dónde se ve:** Predictivo (proyección por equipo).
- **Límites:** depende de que el ajuste de Kijima del equipo sea razonable.
- **Código:** `simulacionTrayectoriasGRP`, `simulacionTrayectoriasGRPDesdeKijima`.

### B12. Vida útil remanente (RUL) híbrida
- **Tipo:** fórmula + ajuste por condición.
- **Para qué sirve:** ¿cuántas horas le quedan a *este* componente de *este* equipo? Con un rango entre lo conservador (B10 remanente) y lo típico (B50).
- **De dónde viene:** 🟡 La vida remanente condicional con Weibull es una consecuencia directa de la función de supervivencia: R(t+Δt) ÷ R(t) = 1 − p. El ajuste por aceite (acelerar la edad efectiva cuando el CUSUM detecta desgaste) es 🔵 criterio propio.
- **Cómo lo calcula aquí:** Δt = η·[(t/η)^β − ln(1−p)]^(1/β) − t, con p = 0,10 y p = 0,50, usando el Weibull de toda la flota por tipo de componente y la edad actual (horómetro actual menos última falla). Si el CUSUM de aceite detectó aceleración, la edad efectiva sube hasta un tope (nunca más del doble); sin esa evidencia el RUL queda como el de Weibull puro.
- **Dónde se ve:** Predictivo.
- **Límites:** una instancia sin ajuste Weibull de su categoría o sin horómetro actual se omite; no se inventa un RUL.
- **Código:** `rulWeibull`, `rulHibridoComponente`, `rulHibridoPorComponente`.

### B13. Oportunidad de mantención (agrupar tareas en la misma parada)
- **Tipo:** regla de decisión.
- **Para qué sirve:** cuando un equipo ya va a parar por un componente, ¿conviene cambiar otros que también están cerca de su límite?
- **De dónde viene:** 🔵 Criterio propio (mantenimiento oportunista, a partir de los RUL de B12).
- **Cómo lo calcula aquí:** evalúa un equipo a la vez con al menos 2 componentes con RUL real; toma el de menor RUL como el que dispara la parada y revisa cuáles caen dentro de la frecuencia de PM del equipo. Estima el ahorro con la duración mediana real de intervención y la tarifa de HH configurada; sin esos datos no calcula ahorro.
- **Dónde se ve:** Predictivo.
- **Código:** `oportunidadMantenimiento`, `oportunidadesMantenimientoFlota`, `sugerenciaAgruparPM` (al crear un correctivo, avisa si el próximo PM del equipo está cerca para aprovechar la misma detención).

### B14. Intervalo P-F real y recomendación de inspección
- **Tipo:** método de mantenimiento centrado en confiabilidad (RCM).
- **Para qué sirve:** medir cuánto tiempo pasa entre que una falla es detectable ("P") y cuando el equipo deja de cumplir ("F"), para decidir cada cuánto inspeccionar.
- **De dónde viene:** 🟢 Concepto de la curva P-F de RCM: P es cuando el deterioro es detectable y F cuando el equipo ya no cumple su función; la regla habitual es inspeccionar con un intervalo menor a la mitad del P-F ([Reliamag, qué es la curva P-F](https://reliamag.com/articles/what-is-a-p-f-curve/)). Las fuentes se contradicen sobre si la idea viene de Nowlan y Heap (1978) o de Moubray; y no se encontró SAE JA1011 en la búsqueda.
- **Cómo lo calcula aquí:** en vez de un P-F de tabla, mide el real: "P" es la fecha de alerta CUSUM de aceite y "F" la fecha del primer correctivo posterior del mismo componente en el mismo equipo. Se agrupa por tipo de componente. Sin al menos un caso con ambos extremos no hay P-F medible.
- **Dónde se ve:** Predictivo.
- **Límites:** hay pocos casos con ambos extremos; el P-F mostrado es una medida de esta flota, no una norma.
- **Código:** `intervalosPF`.

### B15. Índice de efectividad del mantenimiento
- **Tipo:** comparación antes/después.
- **Para qué sirve:** ¿el PM funciona, es decir, el equipo tarda más en volver a fallar después de un PM que antes?
- **De dónde viene:** 🔵 Criterio propio; el contraste usa Mann-Whitney (C2) para decir si la diferencia es real.
- **Cómo lo calcula aquí:** para cada equipo con PM reales compara el intervalo hasta la falla siguiente *antes* y *después* de cada PM (necesita al menos 5 intervalos de cada lado). El veredicto sale del cociente de medianas: ≥ 1,2 "efectivo", ≤ 0,8 "no efectivo", entre medio "sin diferencia clara" (cortes 🔵 propios). Además aplica Mann-Whitney (C2) para decir si la diferencia es real o ruido.
- **Dónde se ve:** Predictivo.
- **Límites:** con la cantidad real de PM ejecutados por equipo no hay muestra para dos ajustes por separado; es deliberadamente simple.
- **Código:** `indiceEfectividadMantenimiento`, `interpretacionEfectividadMantenimiento`.

### B16. Probabilidad de falla en 30 días (Poisson)
- **Tipo:** fórmula.
- **Para qué sirve:** probabilidad de que un componente de un equipo falle al menos una vez en los próximos 30 días.
- **De dónde viene:** 🟡 Proceso de Poisson con tasa constante: P = 1 − e^(−30 ÷ MTBF en días), la misma familia de A6.
- **Cómo lo calcula aquí:** MTBF en días calendario del mismo equipo + componente; exige 3 o más eventos (con 1 o 2 el promedio no dice nada y se descarta).
- **Dónde se ve:** Predictivo ("Probabilidad de falla en los próximos 30 días").
- **Código:** `probabilidadFallaDesdeEventos`.

### B17. Confiabilidad de un equipo como sistema en serie (RBD)
- **Tipo:** fórmula.
- **Para qué sirve:** probabilidad de que un equipo complete una misión sin que falle *ninguno* de sus componentes mayores.
- **De dónde viene:** 🟡 En un diagrama de bloques en serie la confiabilidad del sistema es el producto de las de sus componentes; esta búsqueda no trajo una fuente específica.
- **Cómo lo calcula aquí:** producto de R(t) Weibull de cada componente mayor, usando el β y η del tipo de componente en toda la flota (con censura) y la edad actual de *este* componente. Los tipos sin ajuste (menos de 5 cambios o censuras en la flota) se excluyen del producto.
- **Dónde se ve:** Componentes (histórico).
- **Límites:** supone componentes independientes; excluir componentes sin ajuste sobrestima la confiabilidad.
- **Código:** `confiabilidadSistemaEquipo`.

---

## C. Estadística: ¿la diferencia es real o ruido?

Regla común: cada función exige un mínimo de datos (en general 5 por grupo) y, si no lo hay, no devuelve resultado.

### C1. Mann-Kendall y pendiente de Sen (tendencia)
- **Tipo:** prueba estadística no paramétrica.
- **Para qué sirve:** ¿la tendencia de una serie corta (por ejemplo la disponibilidad de 6 meses) es real o ruido de mes a mes?
- **De dónde viene:** 🟡 Prueba de Mann (1945) y Kendall (1975), con la pendiente de Sen (1968, que extiende a Theil 1950); es de uso muy extendido en hidrología, donde se la describe como robusta y sin supuestos de normalidad ([ejemplo en hidrología](https://www.banglajol.info/index.php/JSR/article/view/32560)). La búsqueda no recuperó los artículos originales; las atribuciones salen del conocimiento general. Según el comentario del código, S, Var(S), Z y la pendiente coinciden exactamente con la librería `pymannkendall` en tres series de prueba.
- **Cómo lo calcula aquí:** S = Σ sign(x_j − x_i); Var(S) con corrección por empates; Z con corrección de continuidad; pendiente de Sen = mediana de todas las pendientes par a par.
- **Dónde se ve:** Dashboard ("Tendencia de disponibilidad").
- **Ejemplo real:** sobre las fallas mensuales de la flota (17 meses, ene-2025 a mar-2026) da S = −55, Z = −2,23, pendiente de −5,6 fallas por mes, "significativo". La etiqueta dice "empeorando" porque el módulo supone que más alto es mejor (disponibilidad); para un conteo de fallas la lectura es la inversa. Y el descenso coincide con el cambio de cómo se cargan las OT, así que no prueba una mejora real.
- **Límites:** no corrige autocorrelación ni estacionalidad.
- **Código:** `mannKendallTendencia`.

### C2. Mann-Whitney U
- **Tipo:** prueba estadística no paramétrica.
- **Para qué sirve:** ¿dos muestras independientes son distintas, sin asumir distribución normal?
- **De dónde viene:** 🟢 La documentación de SciPy lo define como prueba para dos muestras independientes y recomienda usarlo con más de 20 observaciones por muestra en su versión asintótica ([SciPy, mannwhitneyu](https://docs.scipy.org/doc/scipy-1.5.1/reference/generated/scipy.stats.mannwhitneyu.html)). Según el comentario del código, U y el p-valor coinciden con SciPy a 6 decimales en tres casos.
- **Cómo lo calcula aquí:** ordena ambas muestras juntas, asigna rangos (promedio en empates) y U = R_A − n_A(n_A+1) ÷ 2, con la desviación corregida por empates. Mínimo 5 por muestra.
- **Dónde se ve:** Predictivo (efectividad del mantenimiento).
- **Límites:** con 5 a 20 datos por muestra la aproximación normal es limitada (SciPy sugiere el método exacto).
- **Código:** `mannWhitneyU`.

### C3. ANOVA de un factor
- **Tipo:** prueba estadística.
- **Para qué sirve:** ¿el MTTR promedio difiere entre técnicos?
- **De dónde viene:** ⚪ Es el ANOVA clásico; no se recuperó una fuente en esta búsqueda.
- **Cómo lo calcula aquí:** razón F entre la variabilidad entre grupos y dentro de ellos, con su p-valor; descarta grupos con menos de 5 observaciones y necesita 2 grupos válidos.
- **Dónde se ve:** Estadística ("Comparativa por técnico").
- **Límites:** supone residuos normales, que los tiempos de reparación no cumplen (ver A5); por eso existe C4.
- **Código:** `anovaUnFactor`.

### C4. Kruskal-Wallis
- **Tipo:** prueba estadística no paramétrica.
- **Para qué sirve:** lo mismo que C3 pero comparando por rangos, sin asumir normalidad.
- **De dónde viene:** 🟡 Se la conoce como el equivalente no paramétrico del ANOVA de un factor ([Statology, sobre Brown-Forsythe](https://www.statology.org/brown-forsythe-test-in-python/)); la búsqueda no recuperó la documentación de SciPy para `kruskal`. Según el comentario del código coincide con SciPy a 3 decimales, con y sin empates.
- **Cómo lo calcula aquí:** H = 12 ÷ (N(N+1)) × Σ(R_i² ÷ n_i) − 3(N+1), con corrección por empates; se compara con chi-cuadrado de k−1 grados de libertad.
- **Dónde se ve:** Estadística ("Kruskal-Wallis").
- **Código:** `kruskalWallis`.

### C5. Prueba de Levene (variante Brown-Forsythe)
- **Tipo:** prueba estadística.
- **Para qué sirve:** ¿un técnico es más *irregular* (a veces muy rápido, a veces muy lento) que otro? Prueba la variabilidad, no el promedio.
- **De dónde viene:** 🟢 SciPy documenta `levene` como prueba de igualdad de varianzas; con la mediana como centro es la variante Brown-Forsythe, y la media corresponde a Levene original ([SciPy, levene](https://docs.scipy.org/doc/scipy-1.5.3/reference/generated/scipy.stats.levene.html)). Según el comentario del código, W y el p-valor coinciden con SciPy.
- **Cómo lo calcula aquí:** W = ((N−k) ÷ (k−1)) × Σn_i(Z̄_i − Z̄)² ÷ ΣΣ(Z_ij − Z̄_i)², con Z_ij = |X_ij − mediana_i|; se compara con una F(k−1, N−k).
- **Dónde se ve:** Estadística ("Levene").
- **Código:** `levenePruebaVarianzas`.

### C6. Chi-cuadrado de uniformidad (patrones ocultos: mes y turno)
- **Tipo:** prueba estadística.
- **Para qué sirve:** ¿las fallas se reparten parejo entre meses o turnos, o hay estacionalidad real?
- **De dónde viene:** 🟡 Prueba de bondad de ajuste χ² = Σ(O − E)² ÷ E, estándar; las fuentes encontradas son cursos y blogs, con la regla práctica de que cada cuenta esperada sea al menos 5 ([ejemplo en libretexts](https://stats.libretexts.org/Courses/Citrus_College/Statistics_C1000%3A_Introduction_to_Statistics/11%3A_Chi-Square_Test)).
- **Cómo lo calcula aquí:** E = total observado × (exposición de la categoría ÷ exposición total); el mes usa los días reales del mes (28,25 en febrero) y el turno asume exposición pareja entre los turnos presentes (supuesto explícito para una operación 24/7); compara con la tabla de chi-cuadrado de k−1 grados de libertad. Reporta un índice observado ÷ esperado por categoría.
- **Dónde se ve:** Predictivo (patrones ocultos).
- **Límites:** el supuesto de exposición pareja por turno es una asunción, no un dato medido.
- **Código:** `testChiCuadradoUniforme`, `patronesOcultosFalla`.

### C7. Chi-cuadrado de independencia (componente × ubicación)
- **Tipo:** prueba estadística.
- **Para qué sirve:** ¿un tipo de falla se concentra en un lugar (pit, rampa, planta)?
- **De dónde viene:** 🟢 Prueba de independencia para tablas R×C ([NIST Dataplot, CHI-SQUARED TEST](https://itl.nist.gov/div898/software/dataplot/refman1/auxillar/chistest.htm)).
- **Cómo lo calcula aquí:** arma la tabla de contingencia con las fallas reales y aplica la prueba.
- **Dónde se ve:** Predictivo.
- **Código:** `testIndependenciaChi2`, `independenciaComponenteUbicacion`.

### C8. Tasa de falla por ubicación
- **Tipo:** comparación de medianas (versión simplificada de un modelo de riesgos proporcionales).
- **Para qué sirve:** ¿en qué ubicación fallan los equipos más seguido?
- **De dónde viene:** 🔵 Criterio propio, declarado como versión *simplificada*: no es una regresión de Cox porque no hay horas de exposición por ubicación.
- **Cómo lo calcula aquí:** razón = mediana de días entre fallas de la ubicación ÷ mediana del resto; menor a 1 = esa ubicación falla más seguido. Mínimo 5 fallas por ubicación.
- **Límites:** muestra una asociación, no una causa (equipos más viejos pueden concentrarse en un lugar).
- **Código:** `tasaFallaPorUbicacion`.

### C9. Intervalo de Wilson para una proporción
- **Tipo:** fórmula estadística.
- **Para qué sirve:** poner margen de error a un porcentaje con muestra chica ("80 % documentado" con n = 15 puede estar entre 55 % y 93 %).
- **De dónde viene:** 🟢 Wilson (1927), *Journal of the American Statistical Association* 22:209–212; invierte la prueba de puntuación y se comporta bien con n chico o p cerca de 0 % o 100 %, donde el intervalo normal simple (Wald) falla ([arXiv 2109.12464](https://arxiv.org/pdf/2109.12464)). Según el comentario del código coincide a 4 decimales con `statsmodels` en 6 casos.
- **Cómo lo calcula aquí:** centro = (p̂ + z²/2n) ÷ (1 + z²/n); margen = z·√(p̂(1−p̂)/n + z²/4n²) ÷ (1 + z²/n); 95 %.
- **Dónde se ve:** Estadística (tablas de técnico).
- **Código:** `wilsonIC95`.

### C10. R² de una regresión lineal
- **Tipo:** fórmula.
- **Para qué sirve:** decir qué tan bien una recta explica las mediciones (hoy, la proyección de desgaste de neumáticos: antes la "confianza" solo contaba cuántas mediciones había).
- **De dónde viene:** ⚪ R² = 1 − SSE ÷ SST, fórmula de libro; sin fuente recuperada.
- **Dónde se ve:** Neumáticos (proyección).
- **Código:** `r2RegresionLineal`.

### C11. Carta de control I-MR (individuos y rango móvil)
- **Tipo:** control estadístico de procesos.
- **Para qué sirve:** detectar el mes exacto en que un valor (costo mensual, por ejemplo) sale del comportamiento normal.
- **De dónde viene:** 🟢 NIST escribe los límites del gráfico de individuos como x̄ ± 3·MR̄ ÷ 1,128 (1,128 = d₂ para n = 2); 3 ÷ 1,128 ≈ 2,66, y 3,267 es el factor D₄ del rango móvil ([NIST, gráfico de individuos](https://itl.nist.gov/div898/handbook/pmc/section3/pmc322.htm)). Los valores 2,66 y 3,267 aparecen en guías secundarias, no en la página de NIST.
- **Cómo lo calcula aquí:** límites a x̄ ± 2,66·MR̄ y a 3,267·MR̄; mínimo 6 puntos.
- **Dónde se ve:** Costos ("Carta de control I-MR — Costo total mensual"). La pantalla muestra una **tabla** con el límite y el estado de cada mes ("fuera de control" o no), no un gráfico de línea.
- **Código:** `cartaControlIMR`.

### C12. Carta de control EWMA
- **Tipo:** control estadístico de procesos con memoria.
- **Para qué sirve:** detectar una deriva lenta y sostenida (el costo subiendo mes a mes sin que ninguno cruce el límite), donde la carta anterior es poco sensible.
- **De dónde viene:** 🟢 Roberts (1959); NIST explica que el Shewhart es poco potente para cambios pequeños (de 1 a 1,5 desviaciones) y que los límites EWMA son más angostos porque el estadístico es un promedio ponderado ([NIST, EWMA](https://itl.nist.gov/div898/handbook/mpc/section2/mpc2211.htm); [Wikipedia, gráfico EWMA](https://en.wikipedia.org/wiki/EWMA_chart)). La cita exacta de Roberts dentro de la página de NIST no se confirmó.
- **Cómo lo calcula aquí:** Z_i = λ·X_i + (1−λ)·Z_{i−1}, con λ = 0,2 y L = 3 (valores estándar según el código, que cita a Lucas y Saccucci 1990); límites exactos en cada punto, no la versión asintótica; σ̂ = MR̄ ÷ 1,128, el mismo de la carta I-MR.
- **Dónde se ve:** Costos ("Carta EWMA").
- **Código:** `cartaControlEWMA`.

### C13. CUSUM de aceite
- **Tipo:** control estadístico de procesos con memoria.
- **Para qué sirve:** detectar que el desgaste se acelera por varias muestras seguidas levemente altas, que por sí solas no cruzan el umbral de alerta.
- **De dónde viene:** 🟢 E. S. Page, "Continuous inspection schemes", *Biometrika* 41:100–115 (1954); acumula las desviaciones y avisa cuando la suma supera un umbral ([Wikipedia, CUSUM](https://en.wikipedia.org/wiki/CUSUM)).
- **Cómo lo calcula aquí:** sobre la serie cronológica de un metal en un componente de un equipo; el llamador debe ordenar por fecha. Alimenta el RUL híbrido (B12) y el P-F (B14).
- **Dónde se ve:** Análisis de Aceite y Predictivo.
- **Código:** `cusumAceite`, `cusumAceitePorComponente`.

### C14. Muestra chica: potencia y efecto mínimo detectable
- **Tipo:** aviso estadístico.
- **Para qué sirve:** un resultado "no significativo" con pocos datos no prueba que no haya diferencia; el aviso dice cuán grande tendría que ser la diferencia para que la prueba la viera.
- **De dónde viene:** 🟢 La diferencia mínima detectable entre dos grupos de n datos es d = (z₁₋α/₂ + z₁₋β) · √(2 ÷ n); con α = 5 % y potencia 80 % las z valen 1,96 y 0,84 ([CASRAI, análisis de potencia de sensibilidad](https://www.casrai.org/guides/sensitivity-power-analysis-minimum-detectable-effect)). Para curvas de supervivencia, el cociente de riesgos mínimo detectable exp(2,8·√(1/d₁ + 1/d₂)) es la aproximación de Schoenfeld que cita el código; ⚪ esa fórmula no se recuperó en la búsqueda.
- **Cómo lo calcula aquí:** solo muestra el aviso cuando el resultado NO es significativo y lo detectable es grande (d ≥ 0,8 o cociente ≥ 2). Son aproximaciones orientativas.
- **Dónde se ve:** Estadística (junto a ANOVA, Kruskal-Wallis, Levene y la comparación de curvas).
- **Código:** `efectoMinimoDetectable`, `hrMinimoDetectable`, `avisoMuestraChica`, `avisoMuestraChicaSupervivencia`.

### C15. Detección de atípicos (aceite, compras y pronóstico)
- **Tipo:** reglas robustas.
- **Para qué sirve:** separar errores de digitación y valores absurdos antes de que contaminen costos, aceite o pronósticos, sin borrar nada.
- **De dónde viene:** 🟡 Las reglas con la mediana y la desviación absoluta mediana (MAD) escalada con 1,4826 son estándar; el corte de 3,5 es el de Iglewicz y Hoaglin, pero las fuentes encontradas son blogs y calculadoras, no el libro ([ejemplo](https://metricgate.com/calculator/robust-z-score-modified)). La distancia de Mahalanobis comparada con un cuantil de chi-cuadrado también es estándar ([apuntes de ETH Zurich](https://www.stat.ethz.ch/education/semesters/ss2012/ams/slides/v2.2.pdf)); la regla "10 × la mediana *y* 2 × el umbral de alerta" del aceite y la de "50 × la mediana" de las compras son 🔵 criterios propios.
- **Cómo lo calcula aquí:** `aceiteOutliers` marca un metal cuando vale ≥ 10 veces la mediana histórica de su tipo de aceite *y* supera 2 veces el umbral fijo de alerta (exigir las dos evita descartar desgaste real severo); `outliersMultivariadosAceite` usa Mahalanobis sobre los seis metales a la vez; `ordenesSinOutliers` separa líneas de OC con precio unitario sobre 50 veces la mediana de ese mismo ítem (con 5 o más compras); `pronRecortarAtipicos` recorta por encima de mediana + k × 1,4826 × MAD. Nunca modifican ni borran el dato original.
- **Código:** `aceiteOutliers`, `outliersMultivariadosAceite`, `ordenesSinOutliers`, `pronRecortarAtipicos`.

### C16. Análisis de componentes principales (PCA) y comparación con pares
- **Tipo:** técnica multivariada.
- **Para qué sirve:** resumir varios indicadores por equipo (fallas por 1.000 h, horas por reparación, % de días fuera de servicio, uso diario, horómetro) en 2 o 3 ejes y ver qué equipos se alejan del grupo.
- **De dónde viene:** 🟢 Pearson (1901) la definió como la recta que mejor ajusta los datos; Hotelling (1933) mostró que las cargas son los vectores propios de la matriz de covarianza (o de correlación si las variables están estandarizadas) ([RIT, apuntes de PCA](https://www.cs.rit.edu/~ago/courses/635/pca_part1_cs635.pdf); [Gower, revisión histórica](https://emis.univie.ac.at/journals/JEHPS/Decembre2008/Gower.pdf)).
- **Cómo lo calcula aquí:** estandariza cada variable, arma la matriz de correlación, saca valores y vectores propios con el método de Jacobi, y los puntajes son los datos estandarizados por los vectores. Retiene los ejes con autovalor > 1 (criterio de Kaiser, máximo 5), calcula T² por equipo contra el valor crítico de chi-cuadrado y mide la **estabilidad** dejando un equipo afuera cada vez. Pide al menos 8 equipos con todos los datos y 3 variables con variación. La **comparación con pares** usa el z robusto (mediana y MAD); |z| ≥ 2,5 es "fuera de lo normal del grupo" y requiere al menos 4 equipos con la variable.
- **Dónde se ve:** Estadística ("Mapa de equipos — comparación con sus pares").
- **Límites:** con pocos equipos los ejes son inestables; si se mezclan tipos de equipo el primer eje solo separa los tipos; un equipo "atípico" muchas veces es un dato malo (por eso se descartan antes los horómetros imposibles).
- **Código:** `pcaAnalisis`, `pcaVariablesEquipos`, `paresZRobusto`, `_eigenSimetrica`.

### C17. Bayes empírico (Gamma-Poisson) para tasas de falla con poco historial
- **Tipo:** estimación bayesiana.
- **Para qué sirve:** un equipo con pocas fallas no se descarta ni se muestra con una tasa cruda poco fiable: se combina su dato con lo que se sabe de toda la flota.
- **De dónde viene:** 🟢 Estimación empírica de Bayes para conteos de Poisson con un prior Gamma común ajustado por momentos, usada en confiabilidad (Vaurio 1987, [*Risk Analysis* 7](https://ideas.repec.org/a/wly/riskan/v7y1987i3p329-338.html); documentación de [RADS del INL](https://rads.inl.gov/Pages/AboutHTMLFiles/RADSempBayes.htm)). Hay estudios que muestran que funciona bien con muestras de más de 40 y que con muestras chicas conviene una modificación.
- **Cómo lo calcula aquí:** hiperparámetros por método de momentos (la varianza real entre equipos es la observada menos el ruido de Poisson esperado); la tasa estabilizada de cada equipo mezcla su tasa cruda con la de la flota según cuánta exposición tiene.
- **Dónde se ve:** Estadística.
- **Límites:** con muy pocos equipos los hiperparámetros son inestables.
- **Código:** `bayesEmpiricoGammaPoisson`.

### C18. Distribuciones auxiliares (Beta, Gamma) y comparación bayesiana
- **Tipo:** funciones de probabilidad.
- **Para qué sirve:** son la base de los cálculos del TBO y de los plazos de entrega: probabilidad de que un cambio llegue a su TBO con pocos casos, probabilidad de que un repuesto llegue en N días y comparación de repuestos original contra alternativo.
- **De dónde viene:** 🟢 Con un prior Beta(a, b) y k éxitos en n ensayos el posterior es Beta(a+k, b+n−k); para comparar dos proporciones se actualizan por separado y se calcula P(θ₁ > θ₂) numéricamente ([R-bloggers, test binomial bayesiano](https://www.r-bloggers.com/2018/01/bayesian-binomial-test-in-r/); [guía de MD Anderson](https://biostatistics.mdanderson.org/SoftwareDownload/SoftwareFiles/BBDD/BetaBinomialDistributionDemoUsersGuide.pdf)). Que la Gamma modele los plazos de entrega es 🔵 criterio propio.
- **Cómo lo calcula aquí:** `betaBernoulliPosterior` (prior uniforme, intervalo creíble al 90 %), `probabilidadMayorBeta` (integral por regla de Simpson con 2.000 intervalos), `ajusteGammaMomentos` (k = media² ÷ varianza, θ = varianza ÷ media; pide 5 datos), `gammaCDF`, `gammaCuantil` (bisección), `betaPDF`, `betaCuantil`.
- **Dónde se ve:** TBO ("original vs. alternativo", plan de compras).
- **Código:** `betaBernoulliPosterior`, `probabilidadMayorBeta`, `betaCuantil`, `betaPDF`, `ajusteGammaMomentos`, `gammaCDF`, `gammaCuantil`, `tboProbLlegaAntes`.

### C19. Correlación entre aceite y fallas (¿el análisis de aceite anticipa fallas?)
- **Tipo:** razón entre tasas (lift).
- **Para qué sirve:** comprobar si una muestra de aceite en ALERTA o PRECAUCIÓN realmente fue seguida por una falla del mismo equipo y componente, más seguido que una muestra NORMAL. Si el análisis no anticipa nada, no sirve para decidir.
- **De dónde viene:** 🔵 Criterio propio; la razón de dos tasas es estadística descriptiva estándar (⚪ sin fuente específica).
- **Cómo lo calcula aquí:** por categoría de componente, la tasa de "a esta muestra le siguió una falla real del mismo equipo y componente dentro de la ventana (60 días por defecto)" entre las muestras en ALERTA o PRECAUCIÓN contra las NORMAL. Un *lift* mayor a 1 indica que el aceite sí anticipa fallas; cerca de 1, que hoy no anticipa nada. Pide al menos 5 muestras de cada lado; con menos, no dice nada. El componente se compara normalizado (mayúsculas y sin tilde), porque el aceite lo guarda como "TRANSMISION" y los correctivos como "Transmisión".
- **Dónde se ve:** Estadística ("Correlación Aceite ↔ Fallas reales").
- **Límites:** depende de que el componente del correctivo esté bien clasificado (D14).
- **Código:** `correlacionAceiteFallas`, `_normalizarComponente`.
---

## D. Criticidad, riesgo y prioridad

### D1. Matriz de riesgo Probabilidad × Impacto (5 × 5)
- **Tipo:** matriz.
- **Para qué sirve:** ordenar qué atender primero combinando "qué tan probable es" con "cuánto duele". Se usa para componentes, equipos, repuestos y cambios del TBO.
- **De dónde viene:** 🟡 Matriz de 5 × 5 con cinco niveles de probabilidad y cinco de consecuencia, que se multiplican y se agrupan en bandas; es la práctica general de las guías de gestión de riesgo, y un problema conocido es la compresión de rango ([guía de la matriz 5×5](https://safetyculture.com/topics/risk-assessment/5x5-risk-matrix)). Fuentes secundarias dicen que IEC 31010:2019 incluye esta matriz como técnica n.º 29 y le atribuye limitaciones (subjetividad, escalas ambiguas, riesgos que no se suman, no usarla como único método en casos complejos); **no se pudo leer la cláusula de la norma**. Los niveles y las bandas del programa son 🔵 propios.
- **Cómo lo calcula aquí:** Probabilidad (1 a 5) sale de una señal ya calculada en otra parte: el índice de riesgo del componente (`probabilidadComponente`), la severidad de la alerta cruzada del equipo (`probabilidadEquipoSeveridad`), el estado de stock (`probabilidadStockQuiebre`) o la reincidencia (`probabilidadReincidencia`). Impacto (1 a 5) es el quintil del valor en pesos entre los riesgos activos del día (`umbralesImpacto`, mínimo 5 valores; con menos o sin dato de costo el impacto es 3, neutro; `impactoDeValor`). Nivel = P × I (1 a 25): **Bajo** hasta 4, **Moderado** hasta 9, **Alto** hasta 15, **Extremo** desde 16 (`nivelRiesgoPxI`). La criticidad manual de equipo (Crítico/Esencial/General) entra a la misma escala 1-5 con `criticidadEquipoABanda`; `equiposSinCriticidad` cuenta los equipos sin etiqueta.
- **Dónde se ve:** Predictivo ("Grilla Probabilidad × Impacto", "Registro de riesgos"), TBO (riesgo de cada cambio).
- **Límites:** las escalas son relativas a lo que hay cargado ese día; una matriz con pocos riesgos activos no tiene quintiles.
- **Código:** `probabilidadComponente`, `probabilidadEquipoSeveridad`, `probabilidadStockQuiebre`, `probabilidadReincidencia`, `umbralesImpacto`, `impactoDeValor`, `nivelRiesgoPxI`, `criticidadEquipoABanda`, `equiposSinCriticidad`.

### D2. Criticidad de equipos multicriterio (matriz M2: frecuencia × consecuencia)
- **Tipo:** matriz (5 × 5).
- **Para qué sirve:** calcular con datos cuán crítico es cada equipo y compararlo con la etiqueta manual (Crítico / Esencial / General), sin reemplazarla.
- **De dónde viene:** 🔵 Criterio propio, hecho con la estructura de una matriz de riesgo (D1) y puntajes por percentil dentro de la propia flota (igual que las medianas del Jack-Knife).
- **Cómo lo calcula aquí:** **Frecuencia** = fallas por 1.000 h de operación en los últimos 12 meses (con el horómetro; si no hay lecturas suficientes, con las horas/día declaradas), con puntaje 1 a 5 por percentil. **Consecuencia** = promedio ponderado de hasta tres criterios, cada uno de 1 a 5 por percentil: duración típica de la reparación (**mediana**, 35 %), valor de la hora detenida del modelo (35 %) e importancia operacional según la etiqueta (30 %). Un criterio sin variación entre equipos no discrimina y se excluye (los pesos se reparten entre los restantes); se necesitan al menos 2 criterios por equipo y 5 equipos en total. **Nivel** = Frecuencia × Consecuencia: Alta ≥ 15, Media de 8 a 14, Baja menos de 8. La **banda 1-5** que usan otras matrices (`bandaCriticidadEquipo`) es el *peor caso* entre el nivel calculado (Alta 5, Media 3, Baja 1) y la etiqueta manual (Crítico 5, Esencial 3, General 1): nunca se minimiza una señal con la otra.
- **Dónde se ve:** Predictivo ("Criticidad de equipos — frecuencia × consecuencia").
- **Ejemplo real (ventana ago-2025 a jul-2026, horas por horas/día declaradas):** se evaluaron **23 equipos**; 5 quedaron fuera (2 sin horas de operación confiables —un bus y una camioneta con `hrsDia` de 300 y 200— y 3 sin criterios suficientes). Se usaron dos criterios (**duración de reparación 54 %, importancia 46 %**): el costo de la hora detenida no aporta mientras no se configure un valor distinto por modelo. Resultado: **1 Alta (CF-9511: frecuencia 5 × consecuencia 3,1 = 15,5), 10 Media y 12 Baja**. Contra la etiqueta manual coinciden **9 de 23**; en los otros **14** la calculada es *más baja* que "Crítico" (por ejemplo CN-9500: 4 × 3,1 = 12,4, "Media", etiquetado "Crítico"). El algoritmo dice por qué: CN-9507 queda en "Baja" porque su mediana de reparación es 0 h, pese a 27 fallas.
- **Límites:** no mide seguridad ni ambiente (no hay datos registrados) ni producción por tipo de equipo. Como la mediana de reparación es 0–2 h en casi toda la flota (muchos correctivos son intervenciones menores), la consecuencia calculada tiende a ser baja; por eso la banda 1-5 toma el peor caso y no el calculado solo.
- **Código:** `criticidadEquiposMulticriterio`, `bandaCriticidadEquipo`.

### D3. Prioridad de OT (matriz M6: urgencia × impacto)
- **Tipo:** matriz / regla de decisión.
- **Para qué sirve:** ordenar el trabajo pendiente: antes el backlog solo se ordenaba por días.
- **De dónde viene:** 🔵 Criterio propio (producto de urgencia por impacto, de 1 a 25, como en una matriz de riesgo).
- **Cómo lo calcula aquí:** **Impacto** = banda de criticidad del equipo (D2); sin ninguna criticidad se usa 3 y se avisa; un equipo fuera de servicio cuenta 4 como mínimo. **Urgencia** por días pendiente: hasta 1 día = 1, hasta 3 = 2, hasta 7 = 3, hasta 14 = 4, más = 5; un PM vencido cuenta 3 como mínimo y un equipo fuera de servicio 4. Prioridad = urgencia × impacto: **P1** (≥ 15) resolver hoy, **P2** (8 a 14) esta semana, **P3** (4 a 7) programar, **P4** puede esperar.
- **Dónde se ve:** Predictivo ("Backlog inteligente").
- **Ejemplo real (13-oct-2026):** hay 6 OT pendientes y las 6 salen **P1**: MN-5926 (313 días, 25 puntos), CN-9502 (166 días, 25), CF-8769 (96 días, 25) y BD-9533 (87 días, 25), todas con impacto 5 por la etiqueta "Crítico"; y CN-6113 (291 días, 20) y CN-5133 (121 días, 20), con impacto 4 por estar fuera de servicio. El porqué se lee en los factores: urgencia 5 (más de 14 días) × impacto. Con todas saturadas en urgencia, el orden lo da el impacto y luego los días. Son los correctivos abiertos viejos que está pendiente decidir si se cierran.
- **Límites:** los cortes de urgencia y de nivel son convenciones documentadas, no medidas.
- **Código:** `prioridadOT`, `urgenciaPorDias`.

### D4. Matriz Jack-Knife (MTBF contra MTTR)
- **Tipo:** matriz y diagrama (ver también K1).
- **Para qué sirve:** ubicar a cada equipo en uno de cuatro cuadrantes para saber si el problema es que falla seguido, que tarda mucho en repararse o ambas cosas, y cuántas horas pierde al año.
- **De dónde viene:** 🟢 El diagrama Jack-Knife se atribuye a Peter Knights y se usa para priorizar fallas cruzando frecuencia y tiempo de reparación en escala log-log, con cuadrantes "agudo y crónico", "agudo", "crónico" e "ideal"; se lo propone como mejor que Pareto porque considera las dos dimensiones ([Accendo Reliability](https://accendoreliability.com/jack-knife-diagrams-for-reliability-engineering/); [Seecharan, Labib y Jardine](https://pure.port.ac.uk/ws/files/7583768/Labib_post_print.pdf), que lo compara con la grilla de decisión). **Diferencia con el original:** el original usa *número de eventos* contra MTTR; hay herramientas comerciales que usan MTBF, como el programa ([Mobaro](https://support.mobaro.com/en/articles/267290-location-jack-knife-widget)). No se halló la publicación primaria de Knights; los cortes y la construcción salen de fuentes secundarias.
- **Cómo lo calcula aquí:** los cortes son la **mediana de la propia flota** (MTBF y MTTR), mínimo 3 equipos. MTBF alto y MTTR bajo = **clase mundial**; MTBF bajo y MTTR bajo = **crónico** (frecuentes y cortas: causa raíz); MTBF alto y MTTR alto = **agudo** (raras pero largas: mantenibilidad); MTBF bajo y MTTR alto = **complejo** (frecuentes y largas: prioridad uno). Con las horas/día del equipo estima fallas por año = horas al año ÷ MTBF y horas perdidas por año = fallas × MTTR.
- **Dónde se ve:** Costos → MTBF/MTTR ("Matriz Jack-Knife"), con líneas de igual pérdida (K1).
- **Ejemplo real (ene-2025 a mar-2026, 24 equipos con MTBF y MTTR):** medianas de la flota **MTBF 121,5 h y MTTR 7,05 h**; 7 clase mundial, 5 crónicos, 5 agudos y 7 complejos. CN-9507 es "complejo" (MTBF 43 h, MTTR 12,1 h), con unas **1.643 h perdidas al año** estimadas; le siguen CF-9510 (1.296 h) y CN-9503 (1.185 h). La cifra de CN-9507 supone 136 fallas al año, que refleja el ritmo de intervenciones menores más que averías mayores.
- **Límites:** ver A2 (las "fallas" incluyen intervenciones menores) y que los cortes son relativos a la flota.
- **Código:** `matrizJackKnife`, `JK_ACCIONES`.

### D5. NPR (FMEA: severidad × ocurrencia × detección)
- **Tipo:** índice.
- **Para qué sirve:** priorizar qué causa de falla de un componente atacar primero.
- **De dónde viene:** 🟡 Es el número de prioridad de riesgo del FMEA clásico (S × O × D, cada una de 1 a 10). Sus límites son conocidos: dos riesgos distintos pueden tener el mismo NPR (5·5·8 y 10·10·2 dan 200) y el corte es arbitrario; el manual AIAG-VDA lo reemplazó por la "Prioridad de Acción" y IEC 60812:2018 admite alternativas ([Reliamag, cómo hacer un FMEA](https://reliamag.com/guides/how-to-perform-fmea/); [esquema de ejemplo con Prioridad de Acción](https://schematex.js.org/docs/fmea)). Las fuentes son blogs y herramientas, no las normas.
- **Cómo lo calcula aquí:** NPR = S × O × D (1 a 1.000) con las tres calificaciones puestas por un técnico para cada causa; si falta alguna o está fuera de 1–10 no hay NPR. Las bandas de `prioridadNPR` son 🔵 una agrupación propia, *no* un umbral de norma.
- **Dónde se ve:** Predictivo (FMEA por componente).
- **Límites:** subjetivo; no incorpora la severidad como regla de corte (que sí hace la Prioridad de Acción).
- **Código:** `calcularNPR`, `prioridadNPR`.

### D6. Criticidad dinámica de componentes
- **Tipo:** matriz con ajuste.
- **Para qué sirve:** la matriz de riesgo estática es una foto que solo cambia si alguien reevalúa a mano; esta ajusta la probabilidad con la tendencia medida de ese tipo de componente en toda la flota.
- **De dónde viene:** 🔵 Criterio propio sobre D1 y B9.
- **Cómo lo calcula aquí:** +1 nivel de probabilidad si el Crow-AMSAA del tipo de componente en la flota dice "empeorando" (tope 5), −1 si dice "mejorando" (piso 1), sin cambio si "sin certeza" o sin dato.
- **Dónde se ve:** Predictivo ("Criticidad dinámica").
- **Código:** `criticidadDinamicaComponente`, `matrizCriticidadDinamica`.

### D7. Índice de salud de la flota y score de salud por equipo
- **Tipo:** índice compuesto.
- **Para qué sirve:** un solo número por flota (y por equipo) con tendencia semanal y el *motivo* principal de la baja.
- **De dónde viene:** 🔵 Criterio propio: no inventa una fórmula nueva, promedia dimensiones que ya se calculan por separado.
- **Cómo lo calcula aquí:** **Flota**: promedio de cuatro dimensiones (cumplimiento de PM, disponibilidad, stock sano, confiabilidad). **Equipo**: promedio de las dimensiones que describen a una unidad (componentes mayores, neumáticos, aceite, confiabilidad). Si falta una dimensión se promedia con las disponibles, nunca se rellena. `motivoPrincipalSalud` y `peoresDimensionesSalud` dicen cuál arrastra más el número; la tendencia semanal compara con la foto guardada de hace 4 a 10 días.
- **Dónde se ve:** Dashboard ("Mapa de salud de la flota"), Torre de Control, Buscar, avisos de WhatsApp y correo.
- **Límites:** es un promedio simple; no hay un umbral certificado.
- **Código:** `indiceSaludFlota`, `scoreSaludEquipo`, `equiposConSaludFlota`, `motivoPrincipalSalud`, `peoresDimensionesSalud`, `recomendacionDimensionSalud`, `registrarSnapshotSalud`, `tendenciaSaludSemanal`, `valorPrevioSalud`, `SALUD_EQUIPO_METODO_DESDE`, `tboSaludFlotaAuto`.

### D8. Cadena de Markov de salud y proyección a N semanas
- **Tipo:** modelo probabilístico.
- **Para qué sirve:** probabilidad de que un equipo esté en cada estado de salud dentro de N semanas.
- **De dónde viene:** 🟢 Las probabilidades de transición en n pasos son la n-ésima potencia de la matriz de una paso (ecuación de Chapman-Kolmogorov, P^(m+n) = P^(m)·P^(n)); la matriz debe ser estocástica: filas que suman 1 ([ProofWiki](https://ProofWiki.org/wiki/Chapman-Kolmogorov_Equation); [ProbabilityCourse](https://www.probabilitycourse.com/chapter11/11_2_3_probability_distributions.php)).
- **Cómo lo calcula aquí:** cuenta transiciones reales entre fotos de salud separadas por 4 a 10 días, juntas para toda la flota; un estado de origen con menos de 5 transiciones descarta la matriz completa; la proyección multiplica el vector de estado por la matriz N veces.
- **Dónde se ve:** Torre de Control.
- **Límites:** supone que el estado de la semana siguiente solo depende del estado actual.
- **Código:** `matrizTransicionSalud`, `proyeccionSaludNSemanas`.

### D9. Señal unificada de reemplazo
- **Tipo:** regla de conteo.
- **Para qué sirve:** marcar un equipo como "candidato a evaluar su reemplazo" cuando varias señales ya calculadas coinciden.
- **De dónde viene:** 🔵 Criterio propio. No es un puntaje inventado: cuenta señales que ya existen.
- **Cómo lo calcula aquí:** cuenta cuántas de seis señales están encendidas para el mismo equipo: Weibull β > 1,5; un componente mayor en riesgo alto; reincidencia; alerta cruzada de severidad ≥ 5; edad virtual con factor q ≥ 0,67; costo relativo de mantenimiento ≥ 15 % al año. Umbral: 4 de 6.
- **Dónde se ve:** Predictivo.
- **Límites:** el umbral de 4 de 6 se eligió por pedido del usuario para conservar la misma exigencia relativa (75 %) que el diseño original de 3 de 4.
- **Código:** `senalUnificadaReemplazo`.

### D10. Causas latentes repetidas
- **Tipo:** regla de agrupación.
- **Para qué sirve:** detectar que el mismo problema vuelve en equipos *distintos*, prueba de que la causa es del sistema de mantención y no de una máquina.
- **De dónde viene:** 🟡 El marco de causa raíz con causas físicas, humanas y latentes es práctica estándar de análisis de causa raíz; esta búsqueda no trajo una fuente.
- **Cómo lo calcula aquí:** agrupa por componente (no por equipo) las OT con tipo de causa y marca una causa latente cuando se repite en 2 o más eventos.
- **Dónde se ve:** Correctivos.
- **Código:** `causasLatentesRepetidas`.

### D11. Pareto
- **Tipo:** diagrama y regla de corte (ver K5).
- **Para qué sirve:** identificar los pocos equipos, componentes o modos de falla que concentran la mayor parte del problema.
- **De dónde viene:** 🟢 Juran generalizó la observación de Pareto (1906) al control de calidad con el gráfico de barras ordenado y la línea acumulada; el reparto 80/20 es un patrón, no una ley ([iSixSigma](https://www.isixsigma.com/dictionary/trivial-many/)).
- **Cómo lo calcula aquí:** ordena de mayor a menor, calcula el porcentaje y el acumulado, y marca como "vital" toda fila hasta la que cruza el 80 % (la que cruza el umbral también cuenta).
- **Dónde se ve:** Estadística (Pareto de modos de falla, "Equipos con más fallas", "Componentes que más fallan"), Correctivos.
- **Ejemplo real (1.126 fallas, ene-2025 a jul-2026):** por equipo, CF-8769 concentra **10,7 %** (120 fallas), CF-9510 10,2 %, CN-9501 8,7 %, CN-9507 8,4 %, CN-4656 8,0 %: cinco equipos suman **46 %**. Por componente, el mayor grupo es "sin clasificar" (**28,9 %**), seguido de Neumáticos (12,3 %), GET/Cuchillas (8,0 %), Sistema eléctrico (5,1 %) y Engrase/Lubricación (4,6 %). Que "sin clasificar" sea el primero es el hallazgo: **ningún correctivo trae el campo componente** y el programa lo deduce del texto del síntoma.
- **Código:** `paretoAcumulado`.

### D12. Calidad de ejecución del PM (¿hay más fallas de lo esperado después de un PM?)
- **Tipo:** algoritmo estadístico (razón observado ÷ esperado).
- **Para qué sirve:** detectar PM que dejan al equipo con más fallas de lo normal en los días siguientes, y ver si eso depende del horario en que se hizo, del tipo de PM o de si se hizo completo.
- **De dónde viene:** 🔵 Criterio propio. La razón observado ÷ esperado con un intervalo log-normal de un conteo de Poisson es una técnica estadística conocida; no se recuperó una fuente en esta búsqueda (⚪).
- **Cómo lo calcula aquí:** para cada PM real y cada sistema que su pauta cubre (la pauta es acumulativa: el PM2 incluye al PM1), mira si el equipo tuvo una falla real *de ese sistema* en los 7 días siguientes (**observado**: 0 o 1). Lo compara con lo **esperado**: la fracción de días de ese equipo y sistema en que, en general, hay una falla en los siguientes 7 días. Los PM cuya ventana aún no termina se descartan (censura). El resultado es la razón observado ÷ esperado con **intervalo al 95 %** (más exigente que el 90 % del resto del sistema porque se comparan muchos grupos a la vez); con menos de 10 eventos observados no se calcula rango ni se emite lectura. Divide por franja horaria de entrada (00–06, 06–12, 12–18, 18–24), por tipo de PM y por si el PM se registró como completo, incompleto o sin dato. La señal es "sobre", "bajo" o "no concluyente" según si el intervalo queda entero sobre 1, bajo 1 o incluye 1.
- **Dónde se ve:** Estadística ("Calidad de ejecución del mantenimiento preventivo").
- **Límites:** el sistema de cada falla sale del campo "sistema" del correctivo, que está vacío en cerca de 23 % de las OT; por eso `clasificacionPendienteOT` (D13) mide cuántas faltan. No prueba causalidad: una falla tras un PM puede no tener relación con él.
- **Código:** `calidadEjecucionPM`, `sistemasDeTexto`, `sistemasCubiertosPorPM`, `validarPMCompleto`, `estadoPMCompleto`, `_lecturaRazonCE`, `_relativoCE`, `_fraccionDiasConFallaCE`.

### D13. Clasificación pendiente de OT y reparación de texto
- **Tipo:** reglas de calidad de datos.
- **Para qué sirve:** medir cuántas OT cerradas no tienen sistema ni tipo de causa (sin eso no hay Pareto por causa raíz ni calidad de ejecución) y evitar que un texto mal codificado parta un grupo en dos.
- **De dónde viene:** 🔵 Criterio propio.
- **Cómo lo calcula aquí:** `clasificacionPendienteOT` y `resumenClasificacionOT` cuentan las OT cerradas (correctivos y fallas operacionales) sin sistema o sin tipo de causa (el tipo de causa está vacío en el 100 % de los correctivos reales). `repararMojibake` corrige texto guardado con la codificación equivocada ("DÃ­a" por "Día"): sin eso, el chi-cuadrado por turno contaba "Día" y "DÃ­a" como turnos distintos. `validarPMCompleto` y `estadoPMCompleto` registran si el PM se hizo completo; un registro anterior a ese campo es "sin dato", nunca "completo" (contarlo como completo inflaría la calidad).
- **Dónde se ve:** Correctivos (tarjeta "Cerradas sin solución") y Registro PM.
- **Código:** `clasificacionPendienteOT`, `resumenClasificacionOT`, `repararMojibake`.

### D14. Deducción del componente desde el texto del síntoma
- **Tipo:** regla de texto (palabras clave).
- **Para qué sirve:** el campo *componente* de la OT casi nunca se llena (0 de 1.243 correctivos en los datos reales), pero muchas pantallas lo necesitan: Pareto, Weibull por componente, Kaplan-Meier, Sankey, riesgos competitivos. Esta regla lo deduce.
- **De dónde viene:** 🔵 Criterio propio, construido a pasadas con evidencia de filas reales revisadas una por una (por ejemplo "joystick", "tolva", "afex").
- **Cómo lo calcula aquí:** busca palabras clave del texto del síntoma (sin distinguir mayúsculas) contra una lista ordenada de más de 40 categorías (Asiento, Batería, Neumáticos, Frenos, Transmisión, Turbo, Mangueras/Fugas, GET / Cuchillas, Tren de Rodaje, Sistema AFEX…); la primera que calza gana, así las específicas van antes que las genéricas (por ejemplo "Motor" va al final). Si nada calza, el componente queda vacío ("sin clasificar"). `sistemasDeTexto` hace lo análogo para seis sistemas (motor, hidráulico, frenos, neumáticos, eléctrico, transmisión).
- **Dónde se ve:** Estadística, Predictivo, Costos (diagramas de Sankey).
- **Ejemplo real:** de 1.126 fallas, **325 (28,9 %) quedan sin clasificar**; las categorías más grandes que sí se deducen son Neumáticos (138), GET/Cuchillas (90), Sistema eléctrico (57) y Engrase/Lubricación (52).
- **Límites:** es una aproximación por palabras; un síntoma escrito de forma inusual no se clasifica, y una clasificación equivocada mueve una falla a otro componente.
- **Código:** `_componenteDeSintoma`, `_CATEGORIAS_COMPONENTE`, `sistemasDeTexto`, `_subpiezasDeSintoma`, `_SUBPIEZAS_DESGASTE`.

---

## E. Repuestos e inventario

### E1. Estado de stock (cuándo comprar)
- **Tipo:** regla de decisión.
- **Para qué sirve:** la pregunta real no es "¿tengo menos de un mes?" sino "¿me quedo sin stock *antes* de que llegue la reposición?".
- **De dónde viene:** 🔵 Criterio propio (cobertura contra plazo de entrega).
- **Cómo lo calcula aquí:** se compra cuando la cobertura en meses cae por debajo del plazo de entrega; plazo por defecto 34 días, o el propio del ítem. Es la fuente única: antes había tres fórmulas distintas y el Dashboard marcaba "OK" cosas que iban a quebrar.
- **Dónde se ve:** Stock Filtros, Lubricantes, Movimientos, Repuestos, Dashboard.
- **Código:** `stockEstado`.

### E2. Demanda de repuestos (Poisson)
- **Tipo:** estimación de demanda.
- **Para qué sirve:** demanda mensual esperada de cada repuesto, base de las probabilidades de quiebre y del punto de reorden.
- **De dónde viene:** 🟡 La demanda de repuestos suele ser lenta e intermitente; la literatura modela la ocurrencia con Poisson y advierte que Poisson simple subestima la variabilidad cuando hay sobredispersión (alternativa: Poisson mezclada con Gamma, o Croston y su corrección SBA) ([Lengu, Syntetos y Babai 2014, EJOR](https://orca.cardiff.ac.uk/id/eprint/65447/); [guía de demanda Gamma-Poisson](https://metricgate.com/docs/gamma-poisson-spare-parts/)). La búsqueda no encontró una fórmula cerrada que combine Croston con Poisson: las fuentes lo tratan como simulación o cuantil.
- **Cómo lo calcula aquí:** λ mensual = consumo del ítem ÷ meses entre su primer movimiento y el último mes observado por el sistema; los meses de consumo cero cuentan como dato real, pero los anteriores a que el ítem existiera no (así un repuesto nuevo no diluye su demanda en 24 meses).
- **Dónde se ve:** Predictivo y Stock ("Demanda mensual real (Poisson)").
- **Límites:** supone consumo estable; no corrige sobredispersión ni intermitencia.
- **Código:** `analisisDemandaRepuestos`.

### E3. ABC y XYZ de repuestos
- **Tipo:** clasificación.
- **Para qué sirve:** ABC = valor anual de consumo (dónde está la plata); XYZ = qué tan estable es la demanda. Juntas dicen dónde conviene control estricto.
- **De dónde viene:** 🟡 ABC por valor acumulado y XYZ por variabilidad de la demanda son definiciones habituales ([guía de clasificación de inventario](https://www.cleverence.com/articles/for-business/inventory-classification-methods-4721/), un blog; el reparto típico es A cerca de 70–80 % del valor). Los cortes del programa son 🔵 propios.
- **Cómo lo calcula aquí:** valor anualizado = consumo mensual × 12 × precio unitario real; se ordena de mayor a menor y se acumula: **A** hasta 80 %, **B** hasta 95 %, **C** el resto. **XYZ** por coeficiente de variación mensual: **X** ≤ 0,5, **Y** hasta 1,0, **Z** más (más alto que los 0,25 y 0,5 típicos de retail porque la demanda de repuestos es más intermitente). Exige historial mínimo y precio real; sin precio, el ítem se excluye.
- **Dónde se ve:** Predictivo ("ABC-XYZ de repuestos").
- **Código:** `analisisABCXYZRepuestos`.

### E4. ABC × VED (vital, esencial, deseable) — matriz M4
- **Tipo:** matriz 3 × 3.
- **Para qué sirve:** agregar la criticidad del equipo al ABC: un repuesto barato pero vital no debe quedar sin control.
- **De dónde viene:** 🟡 VED clasifica por criticidad: **Vital** (su falta detiene la operación o crea riesgo), **Esencial** (afecta el desempeño pero se puede sortear), **Deseable** (impacto limitado); suele superponerse a ABC-XYZ ([misma guía](https://www.cleverence.com/articles/for-business/inventory-classification-methods-4721/)). Los niveles de servicio y las categorías de control del programa son 🔵 propios.
- **Cómo lo calcula aquí:** el VED de cada repuesto sale de la banda del equipo **más crítico** que lo usa (banda 5 = Vital, 3 o 4 = Esencial, 1 o 2 = Deseable; `bandaCriticidadEquipo`, D2). Como el campo "equipo/modelo" del repuesto es texto libre ("HD785-7/WA900/D375", "BD-10139 Bulldozer", a veces una marca de filtro), `equiposDeRepuesto` separa el texto en palabras y busca cada una en el modelo, la sigla o el tipo (palabra completa; ignora las de menos de 3 letras y genéricas; si nombra una sigla concreta manda esa). Sin calce el repuesto queda **sin VED**, sin inventar. Categorías de control: **I** = AV, AE, BV (estricto); **II** = AD, BE, CV (moderado); **III** = BD, CE, CD (simple). El VED fija además el **nivel de servicio** del stock de seguridad: Vital 99 %, Esencial 95 %, Deseable 90 %.
- **Dónde se ve:** Predictivo (ABC-XYZ: columna y matriz VED, criticidad de repuestos).
- **Ejemplo real:** de los 159 repuestos de la carga real, solo **97 (61 %)** calzan con algún equipo; **62 quedan sin VED** porque su campo "equipo/modelo" está vacío o no coincide con ninguno. Completar ese campo con el modelo o la sigla es lo que más mejora la cobertura.
- **Código:** `equiposDeRepuesto`, `vedRepuestos`, `matrizABCVED`, `vedDeBanda`, `VED_NIVEL_SERVICIO`, `ABCVED_CATEGORIA`.

### E5. Probabilidad de quiebre y criticidad de repuestos
- **Tipo:** matriz (Probabilidad × Impacto).
- **Para qué sirve:** cuánto *riesgo real* hay de quedarse sin un repuesto antes de que llegue el pedido, y cuánto duele si pasa.
- **De dónde viene:** 🔵 Criterio propio sobre D1; la probabilidad usa la distribución de Poisson de E2.
- **Cómo lo calcula aquí:** P(quiebre) = 1 − P(demanda en la ventana ≤ stock disponible), con la demanda esperada en la ventana λ_ventana = λ_mensual × (plazo en días ÷ 30); `probabilidadQuiebreABanda` la lleva a la escala 1–5. El **impacto** es el peor caso entre "cuesta caro" (quintiles) y "lo usa un equipo crítico".
- **Dónde se ve:** Predictivo ("Criticidad de repuestos").
- **Límites:** supone demanda Poisson (ver E2).
- **Código:** `probabilidadQuiebreLeadTime`, `probabilidadQuiebreABanda`, `matrizCriticidadRepuestos`.

### E6. Punto de reorden con stock de seguridad
- **Tipo:** fórmula.
- **Para qué sirve:** cuándo pedir, según cuánto varía la demanda.
- **De dónde viene:** 🟡 Fórmula estándar de teoría de inventarios: punto de reorden = demanda durante el plazo + stock de seguridad, con stock de seguridad = z × σ de la demanda en el plazo, y z según el nivel de servicio (z ≈ 1,28 para 90 %, 1,65 para 95 %, 2,33 para 99 %) ([resumen de fórmulas](https://www.cleverence.com/articles/for-business/inventory-model-formulas-5827/), un blog). El código cita a Silver, Pyke y Peterson y a Chopra y Meindl.
- **Cómo lo calcula aquí:** ROP = μ_L + z·σ_L, con μ_L = μ_mensual × (plazo ÷ 30), σ_L = σ_mensual × √(plazo ÷ 30), σ_mensual = CV × μ_mensual; z admitido para 0,90, 0,95, 0,975 y 0,99; redondea hacia arriba. Según el comentario del código, se verificó con Monte Carlo de 2 millones de iteraciones que la probabilidad de no quebrar coincide con el nivel de servicio a 4 decimales. "Bajo reorden" = stock de bodega + pendiente < ROP. Plazo por defecto 34 días.
- **Dónde se ve:** Predictivo (ABC-XYZ: punto de reorden).
- **Límites:** supone demanda mensual independiente y normal.
- **Código:** `puntoReordenSeguridad`, `puntosReordenRepuestos`.

### E7. Lote económico de pedido (EOQ) y política (s, S)
- **Tipo:** fórmula.
- **Para qué sirve:** *cuánto* pedir (el punto de reorden dice *cuándo*).
- **De dónde viene:** 🟡 Modelo del lote económico de Harris-Wilson, Q* = √(2DS/H), que equilibra el costo de pedir y el de mantener ([resumen](https://www.cleverence.com/articles/for-business/inventory-model-formulas-5827/)). La búsqueda no trajo el artículo de Harris (1913) ni una fuente sobre políticas (s, S).
- **Cómo lo calcula aquí:** costo anual TRC(Q) = (D ÷ Q)·K + (Q ÷ 2)·h con h = tasa × precio; Q* = √(2·D·K ÷ h); como el costo es plano cerca del óptimo, el entero se elige comparando TRC; el lote se topa a un máximo de meses de demanda. La razón TRC(kQ*) ÷ TRC* = (k + 1/k) ÷ 2 muestra cuánto cuesta equivocarse. Política (s, S): s = punto de reorden, S = s + Q; con stock bajo s se pide S − stock. K (costo por pedido) y la tasa de mantención son **supuestos del usuario**. Si el plan de PM supera al consumo histórico, se usa el plan.
- **Dónde se ve:** Predictivo (políticas de reposición).
- **Límites:** demanda estable, un solo proveedor, sin descuentos por volumen ni vencimiento.
- **Código:** `loteEconomicoPedido`, `eoqRazonCosto`, `politicasReposicionRepuestos`.

### E8. Reposición alimentada por el programa de PM
- **Tipo:** cálculo de demanda planificada.
- **Para qué sirve:** el punto de reorden mira el consumo pasado; pero parte de lo que se consume (filtros, lubricantes) ya está calendarizado en el programa de PM.
- **De dónde viene:** 🔵 Criterio propio.
- **Cómo lo calcula aquí:** `pmProgramadosEquipo` calendariza los PM de cada equipo con su ritmo real; `demandaPlanificadaPM` suma lo que cada PM consume según la pauta; `planReposicionPM` lo cruza con el stock (bodega + pendiente) y el plazo de entrega: **pedir ya** (el quiebre llega antes que el pedido), **planificar**, **cubierto** o **sin plan**. `pautaResolverStock` usa el mismo criterio de vinculación de la pauta con el stock que el descuento automático.
- **Dónde se ve:** Stock Filtros ("Plan de reposición según el programa de PM") y Predictivo.
- **Código:** `pmProgramadosEquipo`, `pautaResolverStock`, `demandaPlanificadaPM`, `planReposicionPM`, `planReposicionAuto`, `demandaMensualPlanPorNParte`.

### E9. Rotación y obsolescencia del inventario MRO
- **Tipo:** indicadores.
- **Para qué sirve:** cuánto capital hay inmovilizado sin uso.
- **De dónde viene:** 🟡 Rotación = consumo ÷ valor del inventario, definición habitual; el código aclara que usa el stock vigente porque no hay historial de inventario promedio.
- **Cómo lo calcula aquí:** **rotación anual** = valor consumido (anualizado según los meses reales de historial) ÷ valor del inventario actual. **Obsolescencia** = % de ítems (y % del valor) con stock > 0 sin consumo en los últimos 12 meses; un ítem que nunca se movió cuenta como obsoleto; sin stock no entra.
- **Dónde se ve:** Stock ("Rotación y obsolescencia").
- **Código:** `rotacionInventarioMRO`, `obsolescenciaStockMRO`.

### E10. Proyección de elementos de desgaste
- **Tipo:** estimación de consumo.
- **Para qué sirve:** cuántas cuchillas, cantoneras, zapatas, rodillos u otras piezas de desgaste se consumen por semana, mes, semestre y año.
- **De dónde viene:** 🔵 Criterio propio (tasa de Poisson simple por tipo de equipo y pieza).
- **Cómo lo calcula aquí:** cuenta, por tipo de equipo y pieza detectada en el texto del síntoma, los eventos por mes; λ = eventos ÷ meses entre el primero y el último; exige 3 o más eventos y una cantidad mínima de meses.
- **Dónde se ve:** Repuestos ("Proyección de elementos de desgaste").
- **Código:** `proyeccionElementosDesgaste`.

### E11. Modelo de colas M/M/c (dotación del taller)
- **Tipo:** modelo de investigación operativa.
- **Para qué sirve:** con la dotación actual, ¿cuánto espera en promedio una OT antes de que un técnico la tome y qué tan saturado está el taller?
- **De dónde viene:** 🟢 Fórmula de Erlang C: con carga ofrecida A = λ ÷ μ y utilización ρ = A ÷ c < 1, da la probabilidad de que un trabajo deba esperar; es el estándar para dimensionar dotación ([TU Berlin, modelos M/M/c y Erlang](https://commit-web.commit.tu-berlin.de/en/book/fsp/chapter/ch18/section/s05); [Wolfram, ErlangC](https://reference.wolfram.com/language/ref/ErlangC.html)). Supone llegadas de Poisson y tiempos de servicio exponenciales.
- **Cómo lo calcula aquí:** λ = correctivos reales que llegan, μ = 1 ÷ MTTR, c = técnicos; acumula los términos A^k ÷ k! por razón sucesiva (evita desbordes). Si ρ ≥ 1 no devuelve tiempo de espera (el sistema es inestable). Según el comentario del código, el caso c = 1 coincide con M/M/1 y se verificó contra la recursión de Erlang B.
- **Dónde se ve:** Predictivo ("Modelo de colas M/M/c").
- **Límites:** las reparaciones no son exponenciales (ver A5), así que el tiempo de espera es orientativo.
- **Código:** `modeloColasMMC`.

### E12. Estadísticas de predictivo desde órdenes de compra
- **Tipo:** estadística descriptiva.
- **Para qué sirve:** costo y pedidos por mes y por ítem desde las compras reales, base de varias vistas de Predictivo.
- **De dónde viene:** 🔵 Criterio propio; el plazo de entrega queda fijo en 34 días porque el histórico no trae fecha de recepción.
- **Código:** `predFromOrdenes`.

---

## F. Costos

### F1. Costo relativo de mantenimiento
- **Tipo:** indicador.
- **Para qué sirve:** cuánto se gasta al año en mantener un equipo comparado con lo que vale: sirve para ver cuáles gastan desproporcionadamente.
- **De dónde viene:** 🟢 EN 15341 define indicadores económicos de mantenimiento; el de costo de mantenimiento sobre valor de reposición del activo figura como **E1** y equivale a la métrica 1.5 de SMRP ("Annual Maintenance Cost per Replacement Asset Value") ([resumen de la norma](https://iteh.es/catalog/standards/sist/f91a043f-bc6d-410c-b01d-356e0f4718b4/sist-en-15341-2019-kpra1-2022); [comparación de métricas EN 15341 y SMRP](https://www.processingmagazine.com/home/article/55345158/maintenance-groups-compare-best-practices)). **El código lo llama "A&S1": esa etiqueta no se pudo verificar** y hay que revisarla contra la edición 2019+A1:2022. Una fuente antigua cita un valor típico de 2 a 4 % anual para E1; es de una edición retirada y no sirve como meta.
- **Cómo lo calcula aquí:** gasto real en repuestos y materiales (órdenes de compra) ÷ valor de compra real del equipo, **anualizado** (cada equipo tiene un historial de distinto largo). Exige al menos 90 días de historial y un valor de compra real; si no, no hay indicador. **No incluye mano de obra** (el costo de los correctivos está vacío en el 100 % de los registros). Marca con ⚠️ los equipos donde una sola línea de OC explica ≥ 50 % del gasto (puede ser un error de tipeo o una reparación grande real).
- **Dónde se ve:** Costos → "Costo Relativo de Mantenimiento", señal de reemplazo (D9).
- **Límites:** proxy parcial (solo repuestos y servicios); depende de que el valor de compra esté cargado.
- **Código:** `costoRelativoMantenimiento`, `costoRelativoMantenimientoFlota`, `_concentracionMaximaOC`.

### F2. Costo total de propiedad (TCO) por equipo
- **Tipo:** modelo de costos.
- **Para qué sirve:** cuánto cuesta *tener* un equipo por hora de operación (capital + mantención + detención), compararlo con su modelo y ver si renovar podría convenir.
- **De dónde viene:** 🟢 El costo del ciclo de vida (life cycle costing) es una práctica normada: IEC 60300-3-3 es la guía de aplicación y busca decidir entre alternativas minimizando el costo total de propiedad ([IEC 60300-3-3](https://webstore.iec.ch/en/publication/31206)). La búsqueda no trajo fuente sobre vida económica ni cotas de renovación; la "razón variable ÷ capital nuevo" es 🔵 criterio propio.
- **Cómo lo calcula aquí:** en la misma ventana de datos de cada equipo (desde su primera compra hasta el último mes completo): **capital por hora** = amortización contable por hora (`valorHoraAmort`, del listado "Horas a Amortizar"), o valor de compra ÷ vida contable (camión 26.000 h, cargador 18.000 h, bulldozer 17.000 h, valores de referencia del mismo listado); **mantención por hora** = gasto en repuestos y servicios; **detención por hora** = horas detenidas por falla × costo de hora detenida de Configuración (US$135/h por defecto, o el valor por modelo). Compara cada equipo con la mediana de su modelo (si hay 3 o más unidades). **Cota de renovación:** mientras el costo variable por hora sea menor que el capital por hora de una unidad nueva del mismo modelo, renovar no conviene aunque la unidad nueva no gastara nada en mantención. `tcoConciliarValor` compara el valor contable implícito (amortización × vida) con el valor de compra cargado y avisa si difieren más de 15 %.
- **Dónde se ve:** Costos → "Costo Total de Propiedad" y Buscar (por equipo).
- **Límites:** no incluye mano de obra propia; las salidas de servicio sin duración cuentan 8 h; es una cota, no un veredicto.
- **Código:** `tcoEquipo`, `tcoFlota`, `tcoFlotaAuto`, `tcoCapitalPorHora`, `tcoConciliarValor`, `TCO_VIDA_CONTABLE_H`, `parsearHorasAmortizar`, `costoHoraDetDe`, `costoHoraDetPropio`.

### F3. Diagramas Sankey de costo y de horas de reparación
- **Tipo:** diagrama (ver K2).
- **Para qué sirve:** ver de dónde viene el costo anual y dónde se va el tiempo de reparación, con franjas de ancho proporcional a la cantidad.
- **De dónde viene:** 🟡 Los diagramas de Sankey llevan el nombre del capitán Matthew Sankey, que en 1898 mostró así la eficiencia energética de una máquina de vapor; el ancho de la franja es proporcional al flujo ([Wikipedia, diagrama de Sankey](https://en.wikipedia.org/wiki/Sankey_diagram)). Hay discrepancia entre fuentes sobre antecedentes anteriores de Minard.
- **Cómo lo calcula aquí:** **Costo anual**: concepto (capital, mantención, detención) → tipo de equipo → los 10 equipos de mayor costo, con el costo *anualizado* de `tcoFlota` (F2). **Horas de reparación**: tipo de equipo → equipo → componente, con las fallas de los últimos 12 meses que **tienen duración registrada** (las que no, no se inventan y se cuentan aparte); lo que no tiene componente aparece como "Sin componente registrado" y nunca se esconde dentro de "Otros". Los equipos y componentes fuera del top se agrupan en "Otros".
- **Dónde se ve:** Costos → "Flujo de horas y costo".
- **Ejemplo real (ago-2025 a jul-2026, correctivos con duración):** **6.378 h** en 350 reparaciones (159 más sin duración, que no entran). Por tipo: camiones 1.836 h, motoniveladoras 1.528 h, cargadores 1.375 h, "sin tipo" 700 h (OT de equipos que ya no están cargados). Por equipo, MN-5926 aporta **1.045 h**, casi todas de dos OT: una de 696 h cuyo texto es un cambio de ampolleta y otra de 311 h (probables errores de carga de la duración). Por componente: **"Sin componente registrado" 2.078 h (33 %)**, mangueras/fugas 997 h, radiador/enfriamiento 837 h, focos 715 h.
- **Límites:** el costo no incluye mano de obra y cada equipo usa su propia ventana; el diagrama de horas depende de que las OT tengan duración y componente (hoy no tienen componente, y la deducción desde el texto no siempre alcanza).
- **Código:** `sankeyCostoTCO`, `sankeyHorasReparacion`, `sankeyLayout`.

### F4. CAPEX y OPEX, presupuesto prorrateado
- **Tipo:** indicadores.
- **Para qué sirve:** separar gasto de capital y de operación, y comparar el gasto del mes en curso contra un presupuesto mensual repartido por días transcurridos.
- **De dónde viene:** 🔵 Criterio propio. La clasificación CAPEX/OPEX no se infiere del texto: es un campo manual de la OT; sin clasificación, la OT no entra.
- **Cómo lo calcula aquí:** suma por clase las OT clasificadas con costo > 0. `presupuestoProrrateado` reparte el presupuesto por días transcurridos solo en el mes en curso (un mes cerrado usa el presupuesto completo).
- **Dónde se ve:** Costos y Correctivos.
- **Código:** `analisisCapexOpex`, `presupuestoProrrateado`.

### F5. Costo sugerido de un correctivo por cruce con compras
- **Tipo:** algoritmo de cruce de texto.
- **Para qué sirve:** como el costo del correctivo casi nunca se carga, sugiere uno buscando compras del mismo equipo cercanas en fecha y con detalle parecido al síntoma o solución.
- **De dónde viene:** 🔵 Criterio propio.
- **Cómo lo calcula aquí:** para el mismo equipo, compras dentro de una ventana de 15 días y con un puntaje de coincidencia de palabras (con tolerancia a texto truncado) de al menos 0,6; ordena por puntaje y cercanía en fecha. Solo *sugiere*; una persona decide.
- **Dónde se ve:** Correctivos (al cerrar una OT) y Costos.
- **Código:** `costoSugeridoPorCruce`, `precioMaterial`.

### F6. Arriendo vs compra (seco, húmedo y comprar)
- **Tipo:** modelo de costos comparativo.
- **Para qué sirve:** decidir, por modelo de equipo y por hora de operación, entre arrendar **seco** (tú pones operador, combustible, mantención y neumáticos), arrendar **húmedo** (todo incluido, con disponibilidad garantizada) o **comprar**.
- **De dónde viene:** 🔵 Criterio propio: no hay una norma que lo defina. Usa el costo del ciclo de vida de F2 (IEC 60300-3-3 como guía general) y suma los costos que el sistema no mide con valores que escribe el usuario. Las tarifas de arriendo sugeridas son 🟡 una estimación sin fuente (tabla pegada por el usuario) y los litros por carga son capacidades de estanque de listados de concesionarios (no oficiales).
- **Cómo lo calcula aquí:** todo en UF por hora. **Costos propios** = operadores × costo mensual ÷ horas al mes + mecánicos × costo mensual ÷ horas al mes + litros por carga ÷ horas entre cargas × precio neto del diésel + neumáticos por hora + repuestos y servicios por hora. Lo que mide el sistema: horas por día de los equipos, valor de compra, vida contable (la propia o la de referencia del programa), repuestos y servicios por hora (la mantención por hora del TCO de F2) y neumáticos por hora (precio de cada neumático montado ÷ su vida programada). **Seco con tus costos** = tarifa seca + costos propios, con rango entre la tarifa mínima y la máxima. **Seco más barato por** = húmedo − seco con tus costos (positivo: conviene el seco), con su rango y su punto medio. **Por hora productiva**: cada tarifa ÷ su disponibilidad (la garantizada del húmedo, la propia del seco). **Disponibilidad de equilibrio** = seco medio ÷ (húmedo medio ÷ disponibilidad garantizada): si tu disponibilidad en seco fuera menor, el húmedo saldría más barato. **Comprar** = valor de compra × (1 − valor residual) ÷ vida contable + costos propios. **Chequeo**: lo que pagarías en tarifa seca durante todo el contrato, en veces el valor de compra. Si falta un dato, ese componente queda fuera del total y la fila se marca incompleta con la lista de lo que falta; los valores sugeridos (dotación de 2 operadores por turno de 12 h con relevo 7x7, litros por carga y tarifas por modelo) se marcan como tales hasta que el usuario los confirma.
- **Dónde se ve:** Costos → "Arriendo vs compra". Los supuestos se guardan en Configuración (`cfg.arriendoVsCompra`) y solo un administrador puede cambiarlos.
- **Ejemplo real (HD785-7, UF a $39.000):** costos propios 2,07 UF/h (operadores 4 → $13.200/h, mecánicos 4 → $12.300/h, combustible a $300/L con 1.308 L cada 12 h → $32.700/h, neumáticos $10.600/h, repuestos $11.800/h); seco con tus costos 5,3 a 6,1 UF/h contra húmedo de 8,0 a 10,0; el seco sale más barato por 1,9 a 4,7 UF/h; disponibilidad de equilibrio 55 %; comprar 3,1 UF/h; el seco, durante 4 años, equivale a 3,2 veces el valor de compra del camión.
- **Límites:** no incluye cambios mayores del plan del fabricante, seguros, lavado, supervisión, pañol ni financiamiento. El consumo de combustible se estima con el estanque completo cada 12 horas. Los equipos por kilómetros (camionetas, buses) no entran. Las tarifas de arriendo son estimaciones: conviene reemplazarlas por cotizaciones reales.
- **Código:** `arriendoVsCompra`, `arriendoDefectoModelo`, `ARRIENDO_GENERAL_DEFECTO`.

---

## G. TBO del fabricante (Komatsu)

El TBO (*Time Between Overhaul*, tiempo entre cambios mayores) viene de un archivo Excel del fabricante (`TBO_Besalco_Mineria_jun_24.xlsm`) para los modelos Komatsu de Besalco Centinela. **📄 Los datos del plan son del fabricante: no hay fuente en internet que los respalde ni los contradiga.** Lo que el programa agrega encima (riesgo, costo, decisión) son cálculos propios con métodos estándar, que se detallan en cada ficha.

### G1. Plan de cambios por horas y estado de la flota
- **Tipo:** regla de programación.
- **Para qué sirve:** qué componentes toca cambiar y cuándo, según las horas del fabricante.
- **De dónde viene:** 📄 Archivo del fabricante. El factor de aplicación (ligera 120 %, normal 100 %, severa 80 %) viene de la macro del propio Excel; el Excel de Komatsu viene calculado en "Normal".
- **Cómo lo calcula aquí:** para cada equipo con plan TBO (`tboClaseModelo` asocia el modelo a una clase; si el modelo no es idéntico, lo marca como aproximado), calcula por ítem cuántos cambios "debería" llevar (piso de horas ÷ TBO) y las horas hasta el próximo. Con un cambio real conocido en el historial de componentes: horas desde el cambio = horómetro − horómetro del cambio, y las que faltan = TBO − eso (puede ser negativo = vencido). Sin dato, usa el plan teórico (marcado "teórico": no sabe si el cambio se hizo). Sin dato de uso, supone 10 h/día = 300 h/mes como el Excel.
- **Dónde se ve:** TBO, Dashboard (alertas), Buscar.
- **Código:** `tboPlanEquipo`, `tboEstadoFlota`, `tboResumenAlertas`, `tboUltimoCambioFn`, `tboClaseModelo`, `tboFamiliaDeClase`, `tboCompMap`, `TBO_COMP_MAP`, `TBO_FAMILIAS`, `TBO_ITEMS`, `TBO_APLICACION`, `TBO_GUIA_APLICACION`, `TBO_FUERA`.

### G2. Riesgo Weibull del TBO (β = 3, el TBO es el B5)
- **Tipo:** fórmula.
- **Para qué sirve:** convertir "llegó al TBO" en una probabilidad de falla real para ese componente.
- **De dónde viene:** 📄 La hoja oculta "Weibull" del Excel es una Weibull con β = 3 cuyo B5 (5 % de fallas) es justo el TBO; el código lo verificó contra las 18 × 600 celdas de la tabla. La forma de la función de supervivencia es estándar (ver B1).
- **Cómo lo calcula aquí:** F(t) = 1 − 0,95^((t ÷ TBO)^β); con t = TBO da 5 %. El Excel muestra 5 % fijo mientras no se cumple el TBO; aquí se muestra el valor real (menor). El riesgo a un horizonte de h horas dado que ya lleva t sin fallar es 1 − S(t+h) ÷ S(t). `tboProbNivel` lo lleva a la escala 1–5 con cortes en B5/B10/B20/B35. `tboMatrizRiesgo` lo cruza con el impacto (quintil del precio) en la matriz de D1.
- **Dónde se ve:** TBO (matriz de riesgo, fichas).
- **Límites:** β = 3 es un supuesto del fabricante; con 5 o más cambios medidos el programa ajusta su propio Weibull (G4).
- **Código:** `tboRiesgoWeibull`, `tboRiesgoHorizonte`, `tboProbNivel`, `tboMatrizRiesgo`, `TBO_BETA`.

### G3. Vida por origen: original contra alternativo
- **Tipo:** comparación bayesiana.
- **Para qué sirve:** ¿el repuesto original dura más que el alternativo o reparado?
- **De dónde viene:** 🟢 Comparación de dos proporciones con posteriores Beta (ver C18).
- **Cómo lo calcula aquí:** mide cuánto duró cada instalación real (horas de horómetro hasta el siguiente cambio del mismo componente en el mismo equipo), agrupada por componente y origen. El origen sale del campo del historial; si está vacío se infiere por la compra del mismo equipo (proveedor Komatsu = original, otro = alternativo; busca la compra más cercana entre 45 días antes y 15 después). `tboComparaOrigen` da P(θ_original > θ_alternativo) con los intervalos creíbles de cada fila: con pocos cambios es un indicio, no una prueba.
- **Dónde se ve:** TBO ("Vida por origen").
- **Código:** `tboVidaPorOrigen`, `tboClasificarOrigen`, `tboOrigenPorCompra`, `tboComparaOrigen`.

### G4. Costo por hora y edad óptima de cambio
- **Tipo:** modelo de optimización.
- **Para qué sirve:** cuál es la edad a la que conviene cambiar un componente por costo, comparado con dejarlo correr hasta la falla.
- **De dónde viene:** 🟡 Es la política de reemplazo por edad de Barlow y Proschan: reemplazar en la falla o a la edad T, lo primero; el óptimo T\* equilibra cambiar demasiado pronto contra arriesgar fallas caras, solo existe si la tasa de falla crece (β > 1) y fallar cuesta más que un cambio programado ([estudio sobre estimación secuencial de políticas óptimas](https://calhoun.nps.edu/entities/publication/484f6b1d-993e-4837-aea2-5ed280751560); [ficha de la política](https://metricgate.com/calculator/optimal-age-replacement-policy)). No se recuperó el libro original (1965).
- **Cómo lo calcula aquí:** costo por hora a la edad T = (Cp·R(T) + Cf·(1 − R(T))) ÷ ∫₀ᵀ R(t) dt, con R Weibull y la integral por Simpson; busca el mínimo por grilla y sección áurea. Lo compara con "dejar correr hasta la falla": Cf ÷ MTTF. **Cp** = repuesto + mano de obra + parada programada; **Cf** = repuesto + mano de obra + parada por falla (horas detenidas × costo de hora detenida). `tboParametrosVida` define β y η: con 5 o más cambios medidos ajusta Weibull; con 1 a 4 usa β = 3 y una η que calza con la mediana observada; sin datos, el modelo del fabricante; nunca mezcla orígenes (mezclar sesga β hacia abajo). `tboCostoPorHora` compara el costo por hora del original contra el alternativo. Si no hay óptimo interior (β ≤ 1, Cf ≤ Cp o el mínimo casi no mejora), lo dice con el motivo.
- **Dónde se ve:** TBO (costo por hora y política óptima).
- **Límites:** el costo de hora detenida es un supuesto configurable (US$135/h por defecto o el valor propio de cada modelo).
- **Código:** `tboReemplazoOptimo`, `tboCostoPoliticaEdad`, `tboIntegralR`, `tboMTTFWeibull`, `tboParametrosVida`, `tboPoliticaOptimaFilas`, `tboCostoPorHora`, `tboAjustesCosto`, `TBO_COSTO_HORA_DET_USD`.

### G5. Matriz de estrategia RCM (forma de la falla × consecuencia)
- **Tipo:** matriz 3 × 3.
- **Para qué sirve:** qué estrategia seguir para cada componente: cambiar por edad, vigilar por condición, dejar correr o investigar la causa.
- **De dónde viene:** 🔵 Criterio propio con la lógica de RCM (la forma de la falla determina si la edad sirve). La asociación de las formas β con las acciones está respaldada por B1.
- **Cómo lo calcula aquí:** filas por forma: **temprana** (β < 0,9), **azar** (β < 1,2), **desgaste** (β ≥ 1,2); columnas por consecuencia Cf ÷ Cp: **baja** (< 2), **media** (2 a 5), **alta** (> 5). Cada celda tiene una estrategia, por ejemplo "azar × bajo: dejar correr hasta la falla"; "desgaste × alto: cambio por edad a T\*".
- **Dónde se ve:** TBO (política) y fichas.
- **Código:** `tboClaseForma`, `tboClaseConsecuencia`, `TBO_RCM_MATRIZ`, `tboEstrategiaRCM`.

### G6. Plan de compras y decisión de compra
- **Tipo:** regla de decisión.
- **Para qué sirve:** para cada cambio próximo, ¿hay que pedir ya, planificar, o ya está cubierto?
- **De dónde viene:** 🔵 Criterio propio.
- **Cómo lo calcula aquí:** cruza el plazo de entrega real (mediana de los pedidos ya recibidos de ese tipo; con menos de 3 pedidos usa la mediana de todos; sin datos, 34 días), el stock disponible, los pedidos abiertos y el precio. **Cubierto** (hay stock) · **en camino** (hay pedido abierto) · **pedir ya** (días hasta el cambio ≤ plazo + margen de 7 días) · **planificar** (hasta 45 días más) · **no urgente**. `pedirAntesDe` = fecha del cambio − (plazo + margen). Además, `tboProbLlegaAntes` usa una Gamma ajustada a los plazos reales (C18) para estimar la probabilidad de que un repuesto llegue en N días.
- **Dónde se ve:** TBO ("Plan de compras").
- **Código:** `tboPlanCompras`, `tboDecisionCompra`, `tboLeadTimeFn`, `tboTiemposEntrega`, `tboStockFn`, `tboPedidosAbiertosFn`, `tboCantidadItem`.

### G7. Presupuesto limitado: problema de la mochila 0/1
- **Tipo:** optimización.
- **Para qué sirve:** con una plata limitada, ¿qué repuestos comprar primero para evitar la mayor pérdida esperada?
- **De dónde viene:** 🟢 Problema de la mochila 0/1, que se resuelve por programación dinámica en O(n·W); la regla voraz por valor/peso no es óptima ([apuntes de Bowdoin](https://tildesites.bowdoin.edu/~ltoma/teaching/cs231/2017fall/Lectures/knapsack.pdf)).
- **Cómo lo calcula aquí:** el beneficio de cada candidato = probabilidad de que falle dentro del horizonte (Weibull condicional) × consecuencia de una falla no programada (Cf − Cp del modelo óptimo si hay costo de hora detenida; si no, el precio del repuesto). Los costos se redondean hacia arriba a una unidad, así el resultado nunca excede el presupuesto. Compara con la regla "por urgencia" y con el orden voraz. Solo entran filas con último cambio real y con precio.
- **Dónde se ve:** TBO ("Optimización con presupuesto").
- **Código:** `tboMochila`, `tboCandidatosPresupuesto`.

### G8. Calibración del modelo del fabricante contra la flota
- **Tipo:** validación de modelo.
- **Para qué sirve:** ¿el riesgo que calcula el modelo coincide con lo que pasó en la flota?
- **De dónde viene:** 🔵 Criterio propio con herramientas estadísticas: razón observado/esperado, intervalos por bootstrap, puntaje de Brier contra una tasa constante, prueba de uniformidad de F(vida) por Kolmogorov-Smirnov y un modelo ajustado dejando un equipo afuera. La búsqueda no trajo fuente específica del puntaje de Brier.
- **Cómo lo calcula aquí:** cada tramo entre dos cambios registrados es una vida observada y el tramo abierto hasta hoy es censurado; cada 500 h el modelo predice la probabilidad de cambio en las próximas 500 h y se anota si ocurrió. Dos cambios del mismo componente en el mismo equipo a menos de 24 h se toman como uno solo cargado dos veces. Pide al menos 8 tramos.
- **Dónde se ve:** TBO ("Calibración").
- **Límites:** el historial no dice si el cambio fue por falla o preventivo; lo que se contrasta es el "tiempo hasta el cambio".
- **Código:** `tboVidasObservadas`, `tboCalibrarGrupo`, `tboCalibracionFlota`, `tboCalibracionAuto`.

### G9. Ficha de componente
- **Tipo:** decisión integrada.
- **Para qué sirve:** juntar en un solo lugar el riesgo, el costo y la decisión de un componente, para que las pantallas no se contradigan.
- **De dónde viene:** 🔵 Criterio propio.
- **Cómo lo calcula aquí:** combina tres señales: probabilidad de falla en el horizonte (≥ 35 % cambiar ya, ≥ 15 % planificar, ≥ 5 % vigilar), el plan del fabricante (vencido) y la política económica (RCM). Pasar el TBO no obliga a parar: si el costo de fallar casi no supera al de cambiar, un ítem vencido pasa a "planificar". `tboPctSano` = % de componentes con cambio registrado que no están en riesgo; es una de las dimensiones del score de salud del equipo (D7).
- **Dónde se ve:** Buscar ("Componentes — riesgo, costo y decisión"), Dashboard, Torre de Control.
- **Código:** `tboDecisionFicha`, `tboFichasEquipo`, `tboFichasFlota`, `tboPctSano`, `tboSaludFlotaAuto`.

### G10. Cruce de compras con el plan del fabricante
- **Tipo:** reglas de clasificación.
- **Para qué sirve:** poner precio real a cada ítem del plan y saber qué parte del gasto el plan del fabricante no cubre (desgaste, rodado, lubricantes, fijaciones, servicios).
- **De dónde viene:** 🔵 Criterio propio. Los listados "Sugerido" (precios en US$ del camión HD785-7) son 📄 del fabricante.
- **Cómo lo calcula aquí:** `tboUnirCompras` une las dos tablas de compras sin duplicar (clave pedido + sigla + detalle + costo; gana el histórico); `tboFamiliaDeCompra` clasifica cada línea con reglas ordenadas (gana la primera que calce); `tboCruzarCompras` suma por familia y por origen; `tboPrecioItem` da el precio de cada ítem (lo realmente pagado, separado en original y otros proveedores); `tboCruzarSugerido` compara el precio sugerido con la última compra por N° de parte (con tolerancia a texto cortado a 25 caracteres); `tboNormalizarPN` normaliza el N° de parte.
- **Dónde se ve:** TBO ("Gasto contra el plan").
- **Código:** `tboUnirCompras`, `tboCruzarCompras`, `tboFamiliaDeCompra`, `TBO_REGLAS_COMPRA`, `TBO_PRECIO_RX`, `tboPrecioItem`, `TBO_SUGERIDO`, `tboCruzarSugerido`, `tboNormalizarPN`.

---

## H. Producción

### H1. Rendimiento teórico del cargador frontal
- **Tipo:** fórmula.
- **Para qué sirve:** cuántos m³ por hora debería mover un cargador, para estimar producción perdida por detención.
- **De dónde viene:** 🟢 Producción horaria = capacidad del balde × ciclos por hora × factor de llenado × eficiencia (ciclos por hora = 3.600 ÷ segundos de ciclo); Caterpillar la usa con ciclo base de 27 a 33 s para material suelto, y recomienda dividir el volumen requerido por el factor de llenado ([Caterpillar, productividad de cargadores](https://www.cat.com/en_US/articles/for-owners/how-to-calculate-cat-wheel-loader-productivity.html); la forma con ciclos por hora aparece en una [hoja de resumen de ingeniería civil](https://supertutor.ph/resources/exams/cele-civil-engineering/construction-management-methods/construction-methods-equipment-and-operations/cheat-sheet/)). El código cita la fórmula R = Q × LF × E × 60 ÷ Cm, publicada por Cosrec R&H, y la verificó con el ejemplo del usuario (Q = 1,30; LF = 0,85; E = 0,75; Cm = 1,00 da 49,73 m³/h).
- **Cómo lo calcula aquí:** con los cuatro parámetros del modelo cargados; si falta alguno, no hay resultado. Cruza ese rendimiento con las horas reales de detención del cargador (`produccionPerdidaPorDetencion`): un equipo sin horas reales o sin parámetros completos no aparece.
- **Dónde se ve:** Disponibilidad ("Producción perdida por detención").
- **Código:** `rendimientoTeoricoCargadorFrontal`, `produccionPerdidaPorDetencion`.

### H2. Rendimiento real y costo de downtime
- **Tipo:** indicadores.
- **Para qué sirve:** cuánta producción real se pierde por indisponibilidad y cuánto cuesta.
- **De dónde viene:** 🔵 Criterio propio con datos de los reportes de turno.
- **Cómo lo calcula aquí:** **rendimiento real** = vueltas totales ÷ horas totales del mes (ponderado por horas reales de cada turno; mínimo 3 turnos); **toneladas perdidas** = suma de lo que el supervisor calculó en el papel (no exige mínimo); **costo de downtime** = toneladas perdidas × margen por tonelada (campo opcional de Configuración: sin él, no hay costo; 0 toneladas sí da $0).
- **Dónde se ve:** Producción ("Costo de downtime por equipo").
- **Código:** `rendimientoRealEquipoMes`, `tonPerdidaIndisponibilidadMes`, `costoDowntimeMes`.

### H3. Rendimiento por ciclo, brecha y coeficiente de variación
- **Tipo:** indicadores.
- **Para qué sirve:** medir si el equipo rinde lo que su ciclo real permitiría y qué tan irregulares son sus ciclos.
- **De dónde viene:** 🟡 El coeficiente de variación (desviación estándar ÷ media) es una medida estándar de dispersión; las bandas de lectura (`interpretacionCV`) son 🔵 una agrupación propia, *no* un umbral de norma.
- **Cómo lo calcula aquí:** `rendimientoPorCicloEquipoMes` usa la **mediana** del tiempo de ciclo real del mes (mínimo 3 turnos); `brechaRendimientoCiclo` = lo que el ciclo permitiría menos lo logrado (positiva = se pierde en esperas que no quedan como detención formal; puede ser negativa); `coeficienteVariacion` usa la desviación muestral (n − 1).
- **Dónde se ve:** Producción ("Rendimiento teórico por tiempo de ciclo").
- **Código:** `rendimientoPorCicloEquipoMes`, `brechaRendimientoCiclo`, `coeficienteVariacion`, `interpretacionCV`.

---

## I. Simulación y pronóstico

### I1. Proyección Monte Carlo de la disponibilidad de la flota
- **Tipo:** simulación.
- **Para qué sirve:** un rango de disponibilidad futura de la flota, en vez de un solo número.
- **De dónde viene:** 🟢 El remuestreo con reemplazo es el bootstrap de Efron (1979, *Annals of Statistics* 7:1–26), descrito como una forma de método Monte Carlo basada en los datos observados ([Efron 1979](https://projecteuclid.org:443/euclid.aos/1176344552); [resumen](https://en.wikipedia.org/wiki/Bootstrapping_(statistics))). La búsqueda no trajo una fuente que ligue el bootstrap específicamente con disponibilidad.
- **Cómo lo calcula aquí:** remuestrea con reemplazo los intervalos entre fallas y las duraciones reales de la flota para construir miles de historias futuras sobre un horizonte, y resume la disponibilidad de cada una contra las horas diarias programadas de la flota. Mínimo 8 intervalos y 5 duraciones; si no alcanza, no hay resultado.
- **Dónde se ve:** Disponibilidad ("Proyección Monte Carlo de disponibilidad de flota").
- **Código:** `simulacionMonteCarloDisponibilidad`, `intervalosFallaFlotaDias`, `duracionesReparacionFlotaHoras`.

### I2. Simulador What-If de políticas de mantenimiento
- **Tipo:** simulación de sensibilidad.
- **Para qué sirve:** probar un escenario hipotético: "¿y si mejoramos la confiabilidad un 20 %?" o "¿y si con más stock reparamos 30 % más rápido?".
- **De dónde viene:** 🔵 Criterio propio (análisis de sensibilidad sobre la distribución empírica de I1).
- **Cómo lo calcula aquí:** escala los intervalos (`factorIntervalo` > 1 = fallas más espaciadas) y las duraciones (`factorDuracion` < 1 = reparaciones más rápidas) con un factor que *elige quien pregunta*; compara con el escenario base con la misma muestra y semilla. Con factores 1 coincide exacto con el escenario base (probado).
- **Dónde se ve:** Disponibilidad ("Simulador What-If").
- **Código:** `simulacionWhatIf`, `compararEscenariosMantenimiento`.

### I3. Pronóstico de disponibilidad por equipo, con prueba retrospectiva
- **Tipo:** simulación + validación.
- **Para qué sirve:** disponibilidad esperada de cada equipo en el próximo período y cuánto acierta el método.
- **De dónde viene:** 🟢 La evaluación con orígenes móviles (repetir el pronóstico desde varias fechas pasadas con solo lo que se sabía entonces) es práctica estándar y es más confiable que una sola partición ([viñeta de rolling origin](https://packages.oit.ncsu.edu/cran/web/packages/greybox/vignettes/ro.html)); la simulación es la de I1.
- **Cómo lo calcula aquí:** simula miles de trayectorias con los eventos de falla del propio equipo (mínimo 5 eventos y 60 días de datos) y las duraciones por tipo de PM; si el último registro tiene más de 14 días la historia se corta ahí (no se cuentan como "sin fallas" los días sin carga). Un "Fuera de Servicio" sin fecha de término es un evento abierto: no entra a las duraciones y, si lleva más días que el 90 % de las detenciones cerradas, se asume que sigue fuera todo el horizonte y se lista aparte como "prolongado". Si se le pasan el historial de componentes y las compras, activa un ajuste opcional por edad de componentes. `backtestPronosticoDisponibilidad` repite el pronóstico desde k fechas pasadas y reporta la **cobertura**: el % de veces que lo real cayó dentro del rango P10–P90 (se esperaría cerca de 80 %).
- **Dónde se ve:** Disponibilidad ("Pronóstico de disponibilidad por equipo").
- **Límites:** pocos orígenes son evidencia anecdótica; se asume que el plan de PM se cumple.
- **Código:** `pronosticoDisponibilidadEquipos`, `backtestPronosticoDisponibilidad`.

### I4. Pronóstico de series mensuales (costo y pedidos)
- **Tipo:** selección de modelo por prueba retrospectiva.
- **Para qué sirve:** proyectar el gasto de compras de los próximos meses.
- **De dónde viene:** 🟢 El suavizamiento de tendencia amortiguada es de Gardner y McKenzie (1985); si 0 < φ < 1 la tendencia se amortigua y los pronósticos se acercan a una asíntota ([Gardner y McKenzie 1985](https://www.bauer.uh.edu/egardner/3301H%20Operations%20Management/ESG%20Publications/1985%20Forecasting%20trends.pdf)). Croston con la corrección de Syntetos-Boylan (factor 1 − α/2) es el método habitual para demanda intermitente ([guía de Croston](https://metricgate.com/docs/croston-method), una ficha comercial; [Lengu, Syntetos y Babai](https://orca.cardiff.ac.uk/id/eprint/65447/)). Holt-Winters es el estándar estacional; no se recuperó fuente en esta búsqueda.
- **Cómo lo calcula aquí:** siete modelos candidatos (promedio histórico, promedio de 12 meses, suavizamiento simple, tendencia amortiguada de Holt, estacional, Holt-Winters y Croston-SBA, el estacional y Holt-Winters exigen 24 o más datos y Croston solo entra si al menos 30 % de los meses son cero) y elige por **prueba retrospectiva de origen móvil**. Recorta antes los atípicos (mediana + 3,5 × 1,4826 × MAD). Pide al menos 12 datos. `mesesFinalesIncompletos` quita del final los meses con menos de 40 % de las líneas de la mediana (una carga atrasada bajaría el pronóstico sin que el gasto haya bajado).
- **Dónde se ve:** TBO ("Pronóstico de gasto en repuestos: próximos 12 meses").
- **Código:** `pronosticarSerie`, `PRON_MODELOS`, `serieMensualDe`, `mesesFinalesIncompletos`, `mesesSiguientes`.

---

## J. Neumáticos, PM y reglas del programa

### J1. Grilla de PM (PM1 a PM4) y próximo mantenimiento
- **Tipo:** regla.
- **Para qué sirve:** decidir cuál es el próximo PM de un equipo y de qué tipo es.
- **De dónde viene:** 🔵 Regla de la casa, a partir de la pauta del fabricante: el hito se repite cada `frecPM` (250 h por defecto); un múltiplo de 8 × f es **PM4**, de 4 × f **PM3**, de 2 × f **PM2** y el resto **PM1**. Las pautas son acumulativas (el PM2 incluye el PM1).
- **Cómo lo calcula aquí:** la grilla de hitos (múltiplos de f desde el horómetro cero) es siempre fija: un PM hecho un poco antes o después no corre el calendario. Si un PM se hizo *anticipado*, el hito cubierto no se vuelve a pedir; ese hito no puede estar más de f ÷ 4 por delante del horómetro actual (corta casos imposibles). Estados por días: **vencida** (< 0), **urgente** (hasta 7), **próxima** (hasta 30), **al día**. Un hito pendiente que el usuario marca a mano (con motivo obligatorio) gana si es más temprano.
- **Dónde se ve:** Equipos, Registro PM, Dashboard, Planificador.
- **Código:** `C.tipoPM`, `C.tierMultPM`, `C.proxPM`, `C.estado`, `C.alertaPM4`, `C.recalc`, `validarMotivoPmPendiente`.

### J2. Duración estimada de un PM (HH plan)
- **Tipo:** estimador.
- **Para qué sirve:** cuántas horas-hombre planificar para un PM.
- **De dónde viene:** 🔵 Criterio propio.
- **Cómo lo calcula aquí:** mediana de las duraciones reales registradas del mismo equipo y tipo de PM; la mediana de la flota para ese tipo como respaldo.
- **Dónde se ve:** Costos (HH), KPI, Predictivo, resumen semanal.
- **Código:** `hhPlanEstimator`, `duracionHM`.

### J3. Programa de cambio de neumáticos
- **Tipo:** agrupación de proyecciones.
- **Para qué sirve:** cuántos neumáticos cambiar por semana, mes, semestre o año, con una curva S de avance real más lo que falta.
- **De dónde viene:** 🔵 Criterio propio sobre la proyección de desgaste (regresión lineal de las mediciones de remanente, con R² de C10).
- **Cómo lo calcula aquí:** la fecha de cambio de cada neumático la calcula la proyección de desgaste; el programa solo la **agrupa por período**. Como las horas restantes son las de la última medición, ancla la fecha en esa medición y los que ya pasaron su fecha se informan aparte como "vencidos". La curva S = cambios ya hechos del período + los vencidos + los que vencen de hoy a fin del período. No hay un plan congelado contra el cual medir cumplimiento.
- **Dónde se ve:** Neumáticos ("Programa de cambios").
- **Ejemplo real:** la última medición de neumáticos cargada es del 1-ago-2026 y **74 neumáticos tienen su última medición hace más de 45 días**, por lo que su proyección está desactualizada: la limitación principal es la frescura de las mediciones, no el cálculo.
- **Código:** `neuProgramaCambios`, `neuCambiosRealizados`, `agruparPeriodo`.

### J4. Estado de componentes mayores y estimación de horómetro en una fecha
- **Tipo:** reglas.
- **Para qué sirve:** cuánta vida les queda a los componentes mayores y qué horómetro tenía un equipo en una fecha pasada.
- **De dónde viene:** 🔵 Criterio propio. `compEstado` no inventa un porcentaje cuando falta la fecha de instalación ("⚪ Falta instalación").
- **Cómo lo calcula aquí:** `compEstado`: horas usadas = horómetro actual − horómetro de instalación (un original usa el horómetro completo); vencido si restan ≤ 0 h, planificar < 1.000 h, monitorear < 2.000 h. `horomEnFecha` interpola entre las dos lecturas vecinas; antes del historial traza la recta desde el inicio operacional; nunca devuelve negativo ni pasa el horómetro actual. `tasaDiariaReal` calcula el ritmo real (h/día) descartando saltos implausibles (más de 4 veces el ritmo nominal).
- **Dónde se ve:** Componentes, Buscar, KPI, Calendario de reemplazos.
- **Código:** `compEstado`, `horomEnFecha`, `tasaDiariaReal`, `construirLecturaHistorial`.

### J5. Vencimientos de documentos y lubricantes
- **Tipo:** reglas.
- **Para qué sirve:** cuándo vence un documento (revisión técnica, sistema AFEX, etc.) y si un lubricante está vigente o fue reemplazado.
- **De dónde viene:** 🔵 Criterio propio con periodicidades por tipo de equipo.
- **Cómo lo calcula aquí:** `vencCalcProximo` suma meses a la última fecha topando el día al último del mes destino (el fix de "31 ago + 6 meses"); `vencEstado`: vencido (< 0 días), vence en ≤ 30 días, OK; un documento requerido que nunca se cargó aparece como "Sin registrar (requerido)" y requiere atención. `lubVigente` encadena reemplazos con tope para no colgarse si hay un ciclo.
- **Dónde se ve:** Vencimientos, Lubricantes.
- **Código:** `vencReglaDefault`, `vencCalcProximo`, `vencEstado`, `lubVigente`, `lubEsObsoleto`, `LUB_REEMPLAZO`, `esLubricante`.

### J6. Validación de salto de horómetro
- **Tipo:** regla de calidad de datos.
- **Para qué sirve:** rechazar un horómetro imposible al ingresarlo.
- **De dónde viene:** 🔵 Criterio propio, inspirado en el control de "Report Mantención" del manual de Besalco (±50 h) pero adaptado: el margen escala con los días transcurridos y el ritmo del equipo (4 veces el ritmo nominal).
- **Dónde se ve:** Equipos, Correctivos, Registro PM.
- **Código:** `validarSaltoHorometro`, `lecturasValidas` (en `C`).

### J7. Cierre automático de destrabe al recibir la OC
- **Tipo:** regla.
- **Para qué sirve:** una OT ligada a un pedido de compra se cierra sola cuando la compra llega.
- **De dónde viene:** 🔵 Criterio propio, inspirado en el manual OTR de Besalco.
- **Código:** `resolverDestrabePorOC`.

---

## K. Diagramas y gráficos

Qué dibuja cada pantalla y cómo se lee. Las fichas de la matriz o el cálculo que hay detrás están en las secciones anteriores. Varias pantallas de Estadística (Kaplan-Meier, MCF, Crow-AMSAA, riesgos competitivos, cartas de control) muestran **tablas y barras**, no curvas dibujadas; los gráficos de verdad son los que siguen.

### K1. Gráfico Jack-Knife (MTBF contra MTTR)
- **Qué muestra:** un punto por equipo en escala logarítmica en ambos ejes; el eje X (MTBF) está invertido, de modo que **a la derecha fallan más seguido**. Dos líneas de corte (las medianas de la flota) forman los cuatro cuadrantes, y líneas diagonales de igual pérdida marcan las horas perdidas al año (fallas por año × MTTR, con el ritmo anual mediano de la flota): dos equipos sobre la misma diagonal pierden lo mismo aunque uno falle poco y tarde mucho y el otro al revés.
- **Cómo se lee:** arriba a la derecha (muchas fallas y largas) = "complejos", prioridad uno; abajo a la derecha = "crónicos" (causa raíz); arriba a la izquierda = "agudos" (mantenibilidad); abajo a la izquierda = clase mundial.
- **De dónde viene y qué calcula:** ver D4.
- **Dónde:** Costos → MTBF/MTTR.

### K2. Diagramas de Sankey
- **Qué muestra:** barras (nodos) unidas por franjas curvas cuyo ancho es proporcional a la cantidad; todas las columnas usan la misma escala, así que un mismo ancho es la misma cantidad en todo el diagrama. Las franjas toman el color de la rama de la primera columna.
- **Cómo se lee:** de izquierda a derecha, cómo se reparte el total (costo anual: concepto → tipo → equipo; horas de reparación: tipo → equipo → componente). Pasar el mouse sobre una barra o franja da el valor exacto. En celular el diagrama se desplaza dentro de su caja.
- **De dónde viene y qué calcula:** ver F3.
- **Dónde:** Costos → "Flujo de horas y costo".

### K3. Curva S de PM
- **Qué muestra:** el trabajo de PM planificado y el ejecutado, acumulados día a día y ponderados por horas, para una semana, mes, semestre o año.
- **Cómo se lee:** la curva real sobre la planificada indica adelanto; bajo ella, atraso. Ver A9.
- **Dónde:** Planificador y Metas & KPIs → Avance.

### K4. Curva S del programa de cambio de neumáticos
- **Qué muestra:** avance real (cambios ya hechos) más proyección (vencidos y por vencer) en el período elegido.
- **Cómo se lee:** no mide cumplimiento (no hay plan congelado): muestra lo hecho y lo que falta. Ver J3.
- **Dónde:** Neumáticos → "Programa de cambios".

### K5. Pareto (barras ordenadas con acumulado)
- **Qué muestra:** barras de mayor a menor con el porcentaje acumulado; marca los "vitales" hasta el 80 %. Ver D11.
- **Dónde:** Estadística (modos de falla, equipos con más fallas, componentes que más fallan) y Correctivos ("Prioridad de carga por componente").

### K6. Mapa de equipos (PCA)
- **Qué muestra:** una dispersión de los equipos en los dos primeros ejes del análisis de componentes principales, con los equipos fuera de lo normal del grupo marcados por T² y, aparte, la comparación con sus pares por z robusto.
- **Cómo se lee:** equipos cercanos se parecen en sus indicadores; uno lejano merece una mirada, pero muchas veces es un dato malo. Con pocos equipos los ejes son inestables y el programa lo avisa. Ver C16.
- **Dónde:** Estadística → "Mapa de equipos — comparación con sus pares".

### K7. Calibración del TBO
- **Qué muestra:** por tramos de riesgo predicho, lo predicho contra lo observado, con su intervalo de Wilson.
- **Cómo se lee:** si lo observado cae dentro del intervalo de lo predicho, el modelo del fabricante calibra bien para esa flota. Ver G8.
- **Dónde:** TBO → "Calibración".

### K8. Tendencia de compra de un repuesto
- **Qué muestra:** barras de consumo por período con un promedio móvil. A propósito *no* dibuja una curva de "stock proyectado hacia atrás": no existe un historial de niveles de stock por fecha, solo de eventos de consumo y compra, y esa curva sería inventar datos.
- **Dónde:** Stock y Repuestos.

### K9. Carta Gantt de mantención
- **Tipo:** diagrama de planificación. ⚪ No se buscó fuente (es el gráfico clásico de barras de actividades en el tiempo).
- **Qué muestra:** las actividades de mantención programadas por equipo sobre un calendario, editables.
- **Dónde:** Planificación → Carta Gantt.

### K10. Mapa de salud de la flota y Torre de Control
- **Qué muestra:** un tablero por tipo de equipo con una silueta técnica de cada uno, coloreada por su score de salud; al abrir un equipo, las dimensiones que más lo bajan y qué hacer. El Dashboard muestra un resumen de conteos y la Torre el tablero completo; ambos usan la misma fuente (D7).
- **Dónde:** Dashboard y Torre de Control.

### K11. Matrices de color
- **Qué muestra:** grillas coloreadas por nivel: Probabilidad × Impacto (D1), criticidad de equipos (D2), ABC × VED (E4), estrategia RCM (G5) y Jack-Knife (D4).
- **Dónde:** Predictivo, TBO y Costos.

### K12. Gráficos de barras del Dashboard y del flujo de caja
- **Qué muestra:** barras de ejecuciones de PM por mes, distribución de PM, ratio de mantención y flujo de caja de mantención de los próximos 6 meses.
- **De dónde viene:** 🔵 Visualizaciones propias de indicadores ya descritos (A7, A8).
- **Dónde:** Dashboard y Planificador.

### K13. Plano de arquitectura del sistema
- **Qué muestra:** cómo se conectan las piezas (el equipo del usuario, la nube y el respaldo paralelo) y cuatro diagramas de pasos: abrir la página, iniciar sesión, guardar un cambio y editar a la vez entre dos personas. Es documentación, no un análisis de datos.
- **Dónde:** Configuración → "Ver plano del sistema" (`docs/plano-sistema.html`).

---

## L. Datos y seguridad

### L1. Verificador de integridad
- **Tipo:** reglas de datos.
- **Para qué sirve:** buscar datos *físicamente imposibles* en lo ya guardado ("esto no puede ser cierto", nunca "esto me parece raro"): un horómetro que retrocede, una fecha corrupta, un equipo con un estado desincronizado de sus propios campos.
- **De dónde viene:** 🔵 Criterio propio.
- **Cómo lo calcula aquí:** función pura que recibe las tablas y devuelve hallazgos con severidad: **alta** (dato corrupto o imposible en sí mismo) o **media** (inconsistencia entre dos campos que puede ser caché vieja). No toca la base ni la pantalla.
- **Dónde se ve:** Configuración → verificación de integridad.
- **Código:** `verificarIntegridad`.

### L2. Protección contra inyección de fórmulas en CSV
- **Tipo:** medida de seguridad.
- **Para qué sirve:** evitar que una celda de texto que empieza con `=`, `+`, `-` o `@` se ejecute como fórmula al abrir un CSV exportado en Excel o Sheets.
- **De dónde viene:** 🟢 Es la debilidad CWE-1236, "Neutralización incorrecta de elementos de fórmula en un archivo CSV", conocida como inyección de CSV o de fórmulas; la mitigación habitual es neutralizar las celdas que empiezan con esos caracteres ([MITRE CWE-1236, espejo](https://cve.circl.lu/CWEs/CWE-1236)). La búsqueda no recuperó la guía de OWASP.
- **Cómo lo calcula aquí:** antepone un apóstrofo a las celdas de texto que empiezan con `=`, `+`, `-`, `@`, tabulación o retorno de carro.
- **Dónde se ve:** todas las exportaciones a CSV (KPI, Vencimientos y otras).
- **Código:** `csvCeldaSegura`.

### L3. Edición concurrente
- **Tipo:** regla.
- **Para qué sirve:** detectar que dos personas editaron lo mismo casi a la vez.
- **De dónde viene:** 🔵 Criterio propio.
- **Cómo lo calcula aquí:** compara el conjunto de ids que esta pestaña creía tener antes de guardar con el que hay ahora; si no coincide, hay conflicto.
- **Código:** `hayConflictoIds`.

### L4. Utilidades de fecha, formato y paginación
- **Tipo:** funciones auxiliares.
- **Para qué sirve:** evitar errores sutiles que ya ocurrieron: comparar fechas como texto ("10000-12-31" queda antes que "2025-01-31"), aceptar años corruptos, mostrar números con formato local inestable, escapar texto que va a la pantalla, calcular la mediana ignorando ceros y paginar.
- **De dónde viene:** 🔵 Criterio propio, a partir de bugs reales de auditoría.
- **Código:** `fd`, `fn`, `escapeHtml`, `fechaEsPlausible`, `fechaEsAnterior`, `fechaAyer`, `fechaMismoDiaAnioPasado`, `medianaPositiva`, `pagSlice`, `C`.

### L5. Puentes de datos: historial y avisos como OT
- **Tipo:** reglas de integración.
- **Para qué sirve:** el historial de correctivos 2022–2026 (`correctivos_historico`, cargado desde Excel) y los informes de falla catastrófica no son OT formales, pero cuentan como fallas reales; estos puentes los adaptan a la forma que esperan `esFallaMTBF`, el MTBF, el Weibull y el Pareto.
- **De dónde viene:** 🔵 Criterio propio, a partir de hallazgos de auditoría (reportes que estaban "ciegos" al historial).
- **Cómo lo calcula aquí:** `_otHistComoOt` convierte cada fila del historial en una OT de tipo Correctivo, sin duración ni horómetro (no se inventan); `_informesFallaComoOt` solo cuenta como falla los informes de tipo "Falla Catastrófica" (un "Cambio de Componente Mayor" es un reemplazo planificado y no infla el conteo).
- **Código:** `_otHistComoOt`, `_informesFallaComoOt`.

---

## M. Funciones internas (apéndice)

Funciones de apoyo que usan las fichas anteriores; no se muestran solas en ninguna pantalla.

| Función | Para qué sirve |
|---|---|
| `_normCDF` | Distribución acumulada de la normal; base de varias pruebas (Mann-Whitney, Mann-Kendall, intervalos). |
| `_digamma`, `_trigamma` | Funciones especiales que necesita el ajuste Gamma por máxima verosimilitud (B2). |
| `_betaIncompletaRegularizada`, `_gammaIncRegularizada` | Funciones de distribución de la Beta y la Gamma (C18, G3, G6). |
| `_rngSemilla` | Generador pseudoaleatorio con semilla (mulberry32): las simulaciones y el bootstrap dan los mismos resultados en cada corrida. |
| `_ksUniformeP` | p-valor aproximado de la prueba de Kolmogorov-Smirnov contra una uniforme (G8). |
| `_calibFilas` | Arma los puntos de control de la calibración del TBO (G8). |
| `_tokensMaterial`, `_scoreMaterial` | Separan en palabras y puntúan la coincidencia entre un texto de OT y el detalle de una compra (F5). |
| `_normalizarModelo` | Normaliza un modelo a letras y números en minúscula, porque "HD785-7" y "HD-785-7" son el mismo modelo escrito de dos formas (H1). |
| `_normalizarComponente` | Normaliza el nombre de un componente (mayúsculas, sin tilde) para cruzar aceite con correctivos (B14, C19). |
| `_CATEGORIAS_MTTR` | Las cuatro categorías de tiempo de reparación (Acceso, Diseño, Información, Intervención) que elige una persona en la OT (A5). |
| `_CLASIFICACIONES_COSTO` | CAPEX y OPEX: las dos clases válidas de la clasificación de costo (F4). |
| `_parsearTiempoRespuestaDias` | Convierte el texto "X dias Yh Zm" de un pedido a días (A12). |
| `_gastoProyectadoCategoria` | Proyecta el gasto de una categoría de repuestos con los eventos de consumo y el precio; no usa correctivos porque no existe un vínculo real entre una OT y un ítem de stock. |

---

## Cómo se mantiene al día este inventario

- Cada vez que se agrega un algoritmo, una matriz, una fórmula o un diagrama, se agrega su ficha aquí y se anota en el catálogo (`docs/catalogo-algoritmos.md`, que ordena lo mismo por la pregunta que responde).
- Una **prueba automática** (`tests/inventarioAlgoritmos.test.js`) falla si alguna función exportada de `logic.js` no se menciona en este documento, si una ficha de las secciones A a J y L no declara de dónde viene, o si algún enlace no es `https`.
- Las fuentes se revisan con cada actualización grande. Lo que dice cada una se limita a lo que mostró la búsqueda; donde el nivel es 🟡 o ⚪ conviene conseguir la fuente primaria (la norma, el libro o el artículo) antes de citarla fuera del programa.
- Pendientes de verificación que siguen abiertos tras una segunda búsqueda: el código **"A&S1"** contra EN 15341:2019+A1:2022 (F1; un texto externo propone otra definición y no está respaldado), la cláusula exacta de IEC 31010:2019 sobre la matriz de riesgo (D1), IEC 61164 como estándar de Crow-AMSAA (B9), y las fórmulas exactas de Kijima contra los artículos originales (B10). Para cerrarlos hace falta el texto de cada norma o artículo (no basta un resumen).
