# Manual de Usuario — SistemaMP Centinela

> **Esta es una copia portable, para leer sin abrir el sistema.** La versión
> completa y siempre actualizada vive DENTRO del sistema, en la pestaña
> **❓ Ayuda** (33 secciones con capturas de pantalla conceptuales, índice
> navegable, y las novedades de cada actualización). Este archivo es un
> resumen para imprimir, mandar por correo, o leer en el celular sin
> necesitar conexión.

## 1. ¿Qué es SistemaMP Centinela?

Un sistema de gestión de mantenimiento para una flota de equipos mineros
(Besalco Minería — Centinela Ripios OXE). Es una página web: se abre en
Chrome o Edge, necesita internet e iniciar sesión, y los datos se comparten
en vivo entre todos los que la usan al mismo tiempo — no dependen de un
computador ni un navegador en particular.

## 2. Primeros pasos

1. **Inicia sesión** con tu correo y contraseña. Si no tienes cuenta, un
   administrador te la crea desde Configuración → Crear Usuario del Sistema
   (quedas bloqueado hasta que te activen).
2. Revisa el **Dashboard** — estado general de la flota.
3. Ve a **Equipos** — confirma que tu flota esté completa y correcta.
4. Revisa **Pautas** — las actividades de mantención preventiva por tipo de
   equipo.
5. Empieza a registrar mantenciones.

## 3. Flujo diario recomendado

**Mañana** — Dashboard (urgentes y alertas) → Predictivo (qué intervenir hoy)
→ Repuestos (semáforo de stock).

**Durante el día** — Inspección Diaria → Registro PM (con horómetro real) →
Correctivos si hay falla. El stock se descuenta solo.

**Cierre** — Actualiza horómetros → revisa Consumos y Costos → carga muestras
de Análisis de Aceite si llegaron.

**Semanal** — Plan Semanal (asignar técnicos, cerrar semana) → Avance → Gantt
→ Destrabe (trabajos bloqueados) → Componentes Mayores → Disponibilidad →
exportar informes para gerencia.

**Mensual** — Metas (plan vs. real) → Informes KPI → ajustar metas del
próximo mes.

## 4. Conceptos clave del mantenimiento preventivo

Cada equipo tiene ciclos de PM: **PM1** (250h), **PM2** (500h), **PM3**
(1.000h), **PM4** (2.000h). Un PM mayor incluye los menores (un PM4 hace
también PM1+2+3). El sistema calcula solo cuándo toca cada uno según el
horómetro real del equipo, y avisa con colores: 🔴 urgente, 🟡 próxima,
✅ al día.

## 5. Roles y permisos

- **Operador** — registra PM, correctivos, inspecciones, movimientos de
  stock, mediciones, etc.
- **Admin** — además crea/activa usuarios, edita datos estructurales del
  equipo (sigla, modelo, precios), y ve Configuración completa.

Estos permisos los revisa la base de datos misma en cada acción, no son solo
un candado de pantalla — no se pueden saltar manipulando el navegador.

**Perfiles de acceso por pestaña** (opcional, independiente del rol): a una
cuenta Operador se le puede asignar además un **perfil** que oculta el menú
y bloquea la navegación a todas las pestañas salvo las suyas — para que, por
ejemplo, "el comprador" solo vea Stock & Insumos, sin las otras 15 pestañas
de por medio. Un admin la asigna al crear el usuario o editarlo después
(Configuración → Crear Usuario del Sistema). Perfiles disponibles hoy:
**Horómetro** (solo Horómetros), **Comprador** (solo Stock & Insumos),
**Planificador** (Planificación y Agenda, Correctivos, Pautas, Registro PM).
Sin perfil asignado, la cuenta ve las 16 pestañas completas (comportamiento
de siempre) — un Admin SIEMPRE ve todo, tenga perfil cargado o no.

Si dos personas editan la misma fila casi al mismo tiempo, el sistema detecta
el conflicto, avisa, y pide reintentar sobre los datos frescos. Nunca se
pierde en silencio el cambio de uno de los dos.

## 6. Mapa de pestañas

| Pestaña | Para qué |
|---|---|
| Dashboard | Vista general: KPIs, urgentes, próximas PM, tendencias — con filtro (5 botones arriba) para mostrar solo el bloque que te interesa: Salud de Flota, Disponibilidad, Gráficos, Equipos Urgentes o Costos y Stock. En Equipos Urgentes, la tarjeta "🔴 Riesgo Alto" cuenta los componentes en riesgo de falla inminente — un clic lleva directo a la lista en Componentes. En Costos y Stock, la tarjeta **Neumáticos Críticos** cuenta los que ya llegaron a su límite real de cambio (remanente u horas) y deben cambiarse ahora. 8 tarjetas llevan además una etiqueta 📈 **Adelanto** (predictiva, corregible esta semana: Cumplimiento PM, Backlog, Stock Crítico, Neumáticos Críticos) o 📉 **Retraso** (resultado del período ya cerrado: Disponibilidad, MTBF, Costo/RAV, Confiabilidad) — para distinguir de un vistazo qué números todavía se pueden cambiar y cuáles solo sirven para explicar lo que ya pasó. El gráfico "Tendencia Disponibilidad — Últimos 6 Meses" lleva debajo un veredicto (Mann-Kendall): si la mejora o el deterioro que se ve en las barras es una tendencia real (95% de confianza) o solo variación normal mes a mes |
| Torre de Control | Un clic en cualquier equipo abre su detalle: Score de Salud (avisa si se calculó con pocas señales — menos confiable), forma real de falla (Weibull) y, cuando hay suficiente historial, una versión rápida de **Edad Virtual** — si las reparaciones dejan el equipo realmente restaurado o solo tapan el síntoma (factor Q, 0 = sin evidencia de desgaste acumulado, cerca de 1 = las fallas vuelven cada vez más rápido pese a repararse). La versión rigurosa (**Kijima**, con el factor q real ajustado por máxima verosimilitud en vez de una comparación simple, más una proyección de fallas esperadas a 30 días) vive en Componentes → Predictivo. **Proyección de salud a 4 semanas**: con suficiente historial real de la flota completa, muestra la probabilidad de que el equipo esté Sano/Alerta/Crítico dentro de un mes — no es una curva ajustada, es la frecuencia real con que la flota pasó de un estado de salud a otro |
| Equipos | Flota completa, horómetros, estado de PM, ficha técnica |
| Registro PM | Registrar cada mantención preventiva ejecutada (y si quedó completa según pauta) |
| Correctivos | Órdenes de trabajo por falla, causa raíz, componente, modo de falla clasificado (Cód.Falla) y AST/LOTO/Autorizado — buscador por palabra clave (incluye historial 2022-2024) con alerta si el mismo equipo repite 3+ veces. El botón **⚡ Registro Rápido** es la vía corta desde el celular en terreno: solo equipo, qué pasó y urgencia — el resto se completa después. Si el campo Costo queda vacío, el sistema cruza el texto de la OT contra las Órdenes de Compra reales del mismo equipo y sugiere un monto ("💡 usar") cuando encuentra un candidato confiable; al cerrar una OT sin costo, avisa (sin bloquear) por si conviene revisarlo antes. El checkbox **💰 Carga de costos pendiente** filtra la tabla a solo las OT sin costo cargado y las ordena por el componente que más conviene priorizar (el que más aporta a los análisis de costo real de toda la flota), con un panel de avance por componente. Junto a Causa Raíz hay un campo **Tipo de Causa** (Física = qué se rompió, Humana = qué se hizo o dejó de hacer, Latente = qué lo permitió — sistema/procedimiento/decisión), opcional. El botón **Causas Latentes Repetidas** agrupa por componente las causas Latentes que se repiten 2+ veces — si se repite en equipos distintos, es evidencia de que el problema es de proceso, no un caso aislado. Junto a Tipo de Causa hay un campo **Categoría MTTR** (Acceso, Diseño, Información o Intervención — los 4 factores reales que afectan el tiempo de reparación), opcional. El botón **MTTR por Categoría** suma las horas reales de reparación por categoría, para ver de un vistazo en cuál se pierde más tiempo de taller. Junto a Costo hay un campo **CAPEX/OPEX** (si el gasto se capitaliza o se lleva a resultados del período), opcional — el botón **CAPEX vs OPEX** suma el costo real clasificado en cada categoría, con su % del total; una tarjeta **Sin Tipo de Causa** (cuántas OT cerradas todavía no tienen Física/Humana/Latente ni Sistema), el filtro **Clasificación pendiente** (las más recientes primero) y una columna **Sistema** editable para completarlo después — sin esos dos datos no se puede separar una falla humana de una física ni saber qué sistema volvió a fallar. Al cerrar una OT sin Tipo de Causa aparece un aviso (no bloquea) |
| Neumáticos | Remanente, cambios, sensores de presión, gráfico de desgaste con fecha de cambio por neumático — "Resumen flota" proyecta cuántos neumáticos vas a necesitar por mes/semestre/año, con una segunda tabla Weibull con censura que aprovecha también los neumáticos todavía montados (no solo los ya cambiados) para una vida útil más precisa |
| Horómetros | Historial de lecturas por equipo |
| Disponibilidad | % de disponibilidad mecánica, meta y tendencia — vista mensual muestra también la **Disponibilidad Intrínseca (Ai)**: cuánto de la indisponibilidad es solo fallas, separado de la mantención que la propia empresa programó. **📉 Producción Perdida por Detención**: cruza las horas reales de detención contra el rendimiento teórico del fabricante (Q real de ficha técnica × Factor de Llenado/Eficiencia/Tiempo de Ciclo reales de terreno) para mostrar cuántos m³ no se entregaron — hoy activo solo para Cargador Frontal; el botón **⚙️ Configurar Rendimiento por Modelo** permite cargar esos 3 datos operativos por modelo (los datos de fábrica ya vienen cargados y no son editables). Debajo de la proyección Monte Carlo (30/60/90 días) hay un **Simulador What-If**: dos campos ("mejora de confiabilidad", "mejora de velocidad de reparación", en %, a tu elección) muestran cuánto subiría la disponibilidad proyectada y cuántas fallas menos habría si se cumpliera ese escenario, comparado contra la proyección base |
| Producción | Carga el Reporte de Producción por turno (foto) para que el sistema calcule Rendimiento real por equipo — botón **📷 Leer reporte de turno (foto)**, mismo flujo que las otras lecturas por foto: el sistema prellena las filas leídas (Producción CAEX y Pérdida por Indisponibilidad, por ahora), vos revisás, destildás lo que no corresponda y recién ahí confirmás — nunca se guarda solo. El % de OEE todavía no se muestra: falta definir una meta de Rendimiento por tipo de equipo (no se inventa un valor nominal sin ese dato). **💸 Costo de Downtime por Equipo**: toneladas perdidas por indisponibilidad × Margen por Tonelada (Configuración → Tarifas y Metas) — si falta el margen, muestra solo las toneladas sin inventar un costo. **🔁 Rendimiento Teórico por Tiempo de Ciclo**: cuántas vueltas/hora darías si se repitiera sin pausas la MEDIANA del tiempo de ciclo real medido ese mes (no un parámetro de catálogo) — sirve para CAEX y Carguío por igual. La columna **Consistencia (CV)** marca si esos ciclos fueron parejos (Estable) o erráticos (Variable/Errático, señal de tránsito irregular o esperas intermitentes). La **Brecha** (solo CAEX, donde además hay rendimiento real medido) muestra cuánta producción se pierde en esperas que no quedan registradas como detención formal |
| Análisis Aceite | Muestras de laboratorio, estado por componente — un aviso aparte ("🔺 aceleración de desgaste detectada") marca cuando varias muestras seguidas de un mismo equipo/componente/metal vienen subiendo de forma sostenida, aunque ninguna sola haya cruzado el umbral de alerta del laboratorio; otro aviso ("🧪 combinación de metales inusual") marca cuando ningún metal solo está fuera de rango, pero la combinación completa de metales sí es rara comparada con el historial real de ese tipo de componente (Distancia de Mahalanobis) |
| Vencimientos | Documentos legales por equipo (revisión técnica, seguro, etc.) |
| Stock & Insumos | Stock Filtros, Lubricantes, Costos, Consumos y Repuestos (control de inventario y órdenes de compra) — cada ítem tiene un botón 📈 "Tendencia y Proyección de Compra" con gráfico: historial real por mes/semestre/año y en qué fecha conviene pedirlo. Botón 📊 "Resumen" (por categoría) proyecta el gasto total hasta fin de año — en Filtros y Lubricantes (los únicos con fecha real de consumo) ese mismo modal incluye **🔄 Rotación y Obsolescencia**: cuánto rota el inventario al año y qué % de ítems/valor no tuvo consumo hace más de 12 meses o nunca, con el top 10 de ítems obsoletos por valor. Costos → **Costo Relativo de Mantenimiento**: gasto real en repuestos (histórico de Órdenes de Compra) ÷ valor de compra de cada equipo, anualizado — sin mano de obra, solo aparece con suficiente historial. **Presupuesto vs Real**, para el mes en curso, compara el gasto contra el presupuesto **prorrateado a la fecha** (días transcurridos del mes), no el mes completo — para no mostrar "bajo presupuesto" engañoso a comienzos de mes. **MTBF/MTTR**: junto al MTBF y al MTTR de cada equipo aparece su **intervalo de confianza 95%** (ej. "430h ⚠️ IC95%: 77–16.984h (1 intervalo)") — con pocas fallas o reparaciones registradas el número puntual puede ser muy poco confiable, y el aviso ⚠️ marca justo esos casos (menos de 5 fallas/reparaciones) para no mostrar una precisión que en realidad no existe. Arriba de la tabla, una card **% Correctivo Reactivo** mide en HORAS (no en cantidad de intervenciones) cuánto del tiempo de taller fue reactivo vs. preventivo ese período (umbral de industria &lt;20% ideal), y la **Matriz Jack-Knife** ubica cada equipo en 1 de 4 cuadrantes (mundial/crónico/agudo/complejo) cruzando su MTBF y MTTR contra la mediana de la flota — el cuadrante "complejo" (falla seguido y tarda mucho en repararse) aparece primero. **Carta de Control I-MR**: con al menos 6 meses de historial, señala el mes exacto en que el costo total salió del comportamiento normal (límites fijos calculados sobre toda la serie), distinto de un mes simplemente más caro que el anterior. **Carta de Control EWMA**: junto a la I-MR, sobre la misma serie — detecta una tendencia que se acumula de a poco mes tras mes, aunque ningún mes individual sea una señal por sí solo. El botón **📦 Compras — Proveedores** (junto al selector de vista) muestra el tiempo de respuesta real por proveedor (solo pedidos ya recibidos en bodega, con su costo total acumulado), los **Pedidos Potencialmente Trabados** (los pedidos todavía abiertos —OC Firmada/por Firmar— que ya llevan más días transcurridos que lo normal para ese proveedor) y el **Tiempo Interno de Aprobación de OC** por comprador (Pedido → aprobación/envío al proveedor, que se envía automático el mismo día que se aprueba — mide solo la parte que la empresa controla, sin mezclar el despacho del proveedor). Repuestos → **📐 Proyección de Elementos de Desgaste**, desglosada por pieza específica (cuchilla, ripper, cantonera, entrecalza, entrediente/GETS, canillera, puntera, zapata, rodillo, oruga/cadena, deslizadera — cada una por separado, no mezcladas): cuánto se viene consumiendo de verdad, en número entero (no se compra media pieza), proyectado a semana/mes/semestre/año — no una vida útil teórica asumida, sino la frecuencia real de cambios ya registrada en Correctivos. El precio unitario es editable en la misma tabla (se guarda en este navegador) para ver el Gasto proyectado sin depender de que Stock tenga cargado un precio real para estas piezas |
| Planificación y Agenda | Plan Semanal, Programa Anual, Gantt, Planificador de Materiales, Programación Diaria |
| Pautas | Actividades de mantención por tipo de PM |
| Componentes | Componentes Mayores (vida útil por pieza, con columna de Riesgo que combina vida útil + análisis de aceite + retrabajo reciente, un filtro para ver solo un nivel de riesgo, y una columna "Días Est. (MTBF)" que estima cuánto falta para la próxima falla cruzando el MTBF típico de ese tipo de componente en toda la flota), Predictivo — selector con varias sub-vistas, todas con el mismo filtro de equipo: Probabilidad de Falla; **🎯 Matriz de Riesgo** (Probabilidad × Impacto, cruza automáticamente el riesgo de componentes, equipos, stock y fallas reincidentes, sin carga manual, con un bloque de **Criticidad Dinámica** que ajusta la Probabilidad de cada componente según si su tasa de fallas real viene mejorando o empeorando con el tiempo); Tasa de Falla por Ubicación (compara qué tan seguido falla la flota en Pit/Rampa/Planta); **Señal Unificada de Reemplazo** (candidato a evaluar cuando 4 de 6 señales reales coinciden en el mismo equipo); **⏳ RUL — Vida Útil Remanente** (cuántas horas le quedan de verdad a cada componente de cada equipo, combinando su curva de desgaste con la tendencia real del aceite; ordena de más a menos urgente); **🔍 Intervalo de Inspección (P-F)** (cada cuánto conviene inspeccionar cada tipo de componente, medido con el intervalo P-F real de esta flota — desde que el aceite detecta una aceleración de desgaste hasta el primer correctivo real de ese componente — sin usar ningún valor de tabla genérico); **🔁 Kijima — Factor de Restauración** (qué tan bien restauran las reparaciones a cada equipo — de "como nuevo" a "no cambió nada" — con una proyección de fallas esperadas a 30 días); **🧰 Mantenimiento Oportunista** (sugiere adelantar el cambio de otro componente cuando el equipo ya va a parar por otro motivo, con el ahorro estimado en mano de obra); **📦 Criticidad de Repuestos** (la misma Matriz de Riesgo aplicada a stock, con probabilidad real de quiebre según demanda y tiempo de entrega); **🗂 ABC-XYZ de Repuestos** (clasifica cada repuesto por cuánto gasto anual concentra — A/B/C — y qué tan predecible es su consumo mes a mes — X/Y/Z —, para saber dónde conviene un control estricto y dónde no vale la pena el esfuerzo, más allá del riesgo de quiebre; incluye el **Punto de Reorden**: a qué stock pedir de nuevo para no quebrar antes de que llegue la reposición, con 95% de nivel de servicio — un repuesto errático pide antes que uno predecible con el mismo consumo promedio); **🔧 Efectividad del Mantenimiento** (si los PM realmente alargan el tiempo hasta la próxima falla, o no — con un test Mann-Whitney U que dice si esa diferencia es estadísticamente real o todavía no alcanza para confirmarla); **📅 Patrones Ocultos de Falla** (si hay un patrón real por mes o por turno, o es solo ruido de muestra chica; más una tabla que cruza componente con ubicación, para saber si un tipo de falla en particular se concentra en un lugar en particular, o si ese lugar simplemente tiene más fallas de todo por igual); y 👷 Dotación de Taller (dotación real vs. carga de trabajo, con tendencia y proyección a futuro, más un Modelo de Colas — con la dotación actual, cuánto tiempo espera en promedio una OT antes de que un técnico la tome y qué tan saturado está el taller). **🏭 Fallas Repetitivas (Flota)** marca con **🔬 Amerita Análisis de Causa Raíz** cualquier componente con 3+ correctivos del mismo tipo (igual que activaría un CMMS real) y ahí mismo habilita un checklist **FMEA** con las causas típicas de ese componente: calificás Severidad/Ocurrencia/Detección (1-10 cada una) y el sistema calcula el **NPR** (S×O×D) en vivo, ordenando las causas de más a menos prioritaria — agrupación relativa propia para priorizar, no un umbral de norma certificada. Destrabe, Informes de Falla (con el botón **Trazabilidad Aviso → Orden**: qué Informes de Falla nunca generaron una OT real de taller dentro de los ±3 días siguientes — un reporte de que algo pasó, sin el trabajo correspondiente registrado), Tren de Rodaje, Historial de Componentes (cada cambio guarda su **Origen** — original (Komatsu), alternativo, reparado o reacondicionado —; incluye una segunda tabla Weibull con censura, que aprovecha también los componentes todavía instalados sin haber fallado, y una tabla de Confiabilidad de sistema por equipo a 500h que combina la confiabilidad de todos los componentes de cada equipo — pensada como piezas en serie: si cualquiera falla, para el equipo — señalando cuál es el más débil), Estadística (comparativas por equipo/componente/técnico/modelo — en Por Equipo, un MTBF estabilizado por Bayes Empírico complementa el MTBF crudo, con un número real incluso para equipos con una sola falla registrada —, un Pareto de Modo de Falla, y en la vista Por Componente cuatro tablas adicionales para toda la flota: Kaplan-Meier — curva de supervivencia que aprovecha también los equipos que siguen en servicio sin haber vuelto a fallar, con un Log-Rank Test para elegir dos componentes y saber si la diferencia entre sus curvas es real o ruido de muestra chica, más un Hazard Ratio (regresión de Cox) que dice cuántas veces más rápido falla uno respecto del otro —, MCF — cuántas fallas acumuladas esperar de cada componente a futuro —, Crow-AMSAA — si la tasa de fallas de cada componente viene mejorando o empeorando con el tiempo — y Competing Risks — qué componente es más probable que falle primero en toda la flota; en la vista Por Técnico, el % documentado y el % de reingreso de cada técnico llevan su intervalo de confianza 95% (Wilson) debajo — con pocas OT, dos técnicos que parecen distintos pueden en realidad no serlo, y el rango real lo muestra; un test ANOVA sobre el MTTR indica si el tiempo de reparación realmente difiere entre técnicos o es ruido de muestra chica, acompañado de un segundo test (Kruskal-Wallis) que confirma lo mismo sin asumir que el MTTR se distribuye normal — los tiempos de reparación reales casi nunca lo son —, y un tercer test (Levene) que responde una pregunta distinta: no si el promedio/mediana difiere, sino si un técnico es mucho más inconsistente que el resto aunque su típico sea igual); **Calidad de Ejecución (PM)** — después de un PM, ¿vuelve a fallar el mismo sistema que cubría su pauta más de lo normal para ese equipo? Vista descriptiva por franja horaria, tipo de PM y "PM completo según pauta"; muestra "pocos casos" cuando no alcanza y no evalúa personas; **TBO Komatsu** — el plan de cambio por horas del fabricante (Excel TBO jun-2024: HD785-7, WA900-8R, D375A-6R y D65EX) cruzado con los cambios reales y las compras: **qué toca cambiar y cuánto falta** (horas, días y fecha estimada, por equipo o de toda la flota; vencidos y a menos de 1.000 h arriba), **cuánto dura lo que cambiamos — original vs alternativo** contra el TBO, **precios por ítem** (lista Komatsu en USD y lo realmente pagado, separando original de alternativo) y el **gasto por familia** dentro y fuera del plan. Con las fórmulas del Excel: **tipo de aplicación** (ligera/normal/severa ajusta el TBO), **riesgo de falla** (Weibull: 5% al llegar al TBO), una **Matriz de Riesgo** probabilidad × impacto y el **costo por hora** de cada componente (precio ÷ duración real) para comparar original con alternativo. Un **plan de compra** cruza cada cambio próximo con el stock, los pedidos abiertos y el tiempo real de entrega del repuesto: dice qué **pedir ya**, qué planificar y cuándo pedir, con presupuesto y un botón **Crear OC** (deja una orden Pendiente; no compra solo). La probabilidad de que un cambio **llegue a su TBO** se estima con Beta–Bernoulli (con intervalo, sin falsos 0%/100% con pocos casos) y el tiempo de entrega de los repuestos con una **Gamma** (probabilidad de llegar a tiempo y percentil 90). **Reemplazo óptimo por costo**: cada cuántas horas conviene cambiar un componente (y si conviene el alternativo), según el costo de una hora detenida que ingresás, con una **matriz de estrategia** (cambio por edad / por condición / dejar correr / investigar la causa). **¿Estamos usando la distribución correcta?**: compara Weibull, log-normal, Gamma y exponencial con los datos reales (AICc, error en los percentiles y p-valor por bootstrap con un botón). **Con plata limitada**: escribís el presupuesto y el programa elige qué repuestos comprar primero para evitar la mayor pérdida esperada, y lo compara con comprar por urgencia. En **Predictivo → ABC-XYZ**, la columna **Lote (Q) · S** dice cuánto pedir de cada repuesto (lote económico) y hasta qué nivel reponer; el costo por pedido y el costo de mantener los ingresás vos. Los "cambios que debería llevar" son teóricos; el tiempo que falta se cuenta desde el último cambio registrado cuando existe |
| Metas & KPIs | Plan vs. real, avance mensual, informes descargables — cada indicador fuera de meta explica su causa probable (tooltip), la compara contra el mes anterior, se puede ver como cadena visual con un clic, avisa si viene empeorando varios meses seguidos aunque todavía esté en verde, y se le puede registrar un compromiso (acción/responsable/fecha) que el sistema marca cumplido o vencido solo. Su sub-pestaña **Resumen Ejecutivo** junta todo eso en una sola pantalla imprimible/exportable — pensada para mandarle a un dueño o gerente que nunca entra al sistema |
| Buscar | Ficha completa por equipo (PM, correctivos, componentes, horómetros, inspecciones, neumáticos, tren de rodaje, aceite, vencimientos, historial, destrabe y costos) + ranking de equipos problemáticos |
| Auditoría de Datos | Cruce automático (5 chequeos): horómetros que retroceden, componentes sin validar, OT sin solución, reportes automáticos por revisar, neumáticos cambiados sin registrar salida — se recalcula solo cada vez que se abre |
| Configuración | Usuarios, seguridad, respaldo, tema (Oscuro/Claro/Azul Minero/Ejecutivo), información del sistema — con una franja de Estado del Sistema arriba de todo (integridad, papelera, datos locales, sincronización, backup) |

## 7. Preguntas frecuentes

**¿Necesito internet para usar el sistema?**
No para seguir viendo y editando datos: el sistema guarda de inmediato en
este computador aunque se corte la conexión, y sincroniza solo con la nube
cuando vuelve.

**¿Qué pasa si edito algo que otra persona también estaba editando?**
El sistema avisa con un mensaje y refresca la pantalla con lo más reciente —
tu cambio no se pierde en silencio, solo hay que revisarlo y volver a
intentar.

**¿Cómo recupero mis datos si algo sale mal?**
Los datos reales viven en Supabase (la nube), no solo en tu navegador.
Además existe un respaldo manual (Backup JSON, en Configuración) y uno
automático a una carpeta local si alguien lo conectó.

**¿Puedo reportar una falla sin entrar al sistema?**
Sí, si un administrador ya autorizó tu número o correo (Configuración →
Reporte de Fallas por WhatsApp/Correo). Escribe al WhatsApp del sistema (o
manda un correo) con el equipo y la falla, por ejemplo:
*"CN-9500 fuera de servicio, falla de turbo"*. Queda registrado directo en
Correctivos — el sistema responde confirmando o avisando si no lo entendió.
Si el mensaje es ambiguo, igual se guarda pero marcado para que un admin lo
revise, nunca se pierde en silencio.

## 8. Guía de Capacitación por Rol

> La versión completa de esta guía (con el mismo contenido) vive **dentro
> del sistema**, en ❓ Ayuda → sección 33 — con su propio botón para
> descargarla/imprimirla sola, sin el resto del manual.

Las secciones anteriores son referencia: sirven para buscar un detalle
puntual. Esta es distinta — enseña en qué orden aprender el sistema según
lo que a vos te toca hacer, con pasos concretos y ejemplos.

**Rol vs. Perfil**: el **rol** (Operador/Admin) decide qué podés hacer; el
**perfil** (Horómetro/Comprador/Planificador/sin perfil) decide qué
pestañas ves. Es opcional — sin perfil asignado, ves todas las pestañas; un
Admin siempre ve todo, tenga perfil cargado o no.

| Si tu trabajo es... | Leé la sección |
|---|---|
| Registrar PM, correctivos, inspecciones en terreno | Operador de Terreno |
| Armar el plan semanal, asignar técnicos, pautas | Planificador |
| Stock, órdenes de compra, proveedores | Comprador |
| Decidir qué intervenir, revisar costos y confiabilidad | Supervisor / Jefe de Mantenimiento |
| Crear usuarios, seguridad, respaldo | Administrador |

### Operador de Terreno

Tu día tipo: llegás, revisás qué equipo te toca, registrás lo que hiciste o
encontraste, y seguís. El sistema calcula el resto.

1. **Registro PM** — elegí el equipo, cargá el horómetro real que marca en
   ese momento (no el que "debería" tener), marcá las actividades
   ejecutadas y guardá. Todo depende de que este número sea real.
   Indicá también si el PM quedó **completo según pauta**: si faltó algo
   (ej. un filtro sin cambiar por falta de stock) marcá "No" y anotá qué
   faltó — así, con el tiempo, se puede ver si los PM hechos a medias
   terminan en falla.
2. **Correctivos** — desde el celular en terreno usá ⚡ Registro Rápido
   (equipo, qué pasó, urgencia); completá Causa Raíz, Tipo de Causa y
   Categoría MTTR después. Si el equipo ya falló 3+ veces por lo mismo, el
   sistema avisa solo.
3. **Inspección Diaria y Neumáticos** — cargá remanente/cambios con fecha
   real; el sistema proyecta solo cuánto vas a necesitar comprar.
4. **Análisis de Aceite** — cargá la muestra apenas llega; el sistema
   compara contra el historial real del componente.

**Errores comunes**: horómetro "a ojo" sin leerlo del equipo; cerrar una OT
sin costo sin revisar la sugerencia ("💡 usar"); saltarse Tipo de
Causa/Categoría MTTR por ser opcionales.

**Horizonte**: hoy — registrar con el horómetro real y dejar el correctivo guardado antes
de irte; esta semana — completar Causa Raíz, Tipo de Causa y Categoría MTTR
de lo que registraste; largo plazo — todo lo que cargás hoy es la materia
prima de las proyecciones: con más meses de datos reales, las fechas y
alertas del sistema se vuelven más confiables.

### Planificador

Con este perfil ves 4 pestañas: Planificación y Agenda, Correctivos,
Pautas, Registro PM.

1. **Plan Semanal** — asigná técnicos a los PM y correctivos de la semana
   y cerrá la semana al terminar, para que quede como histórico real.
2. **Programa Anual y Gantt** — la foto grande del año y la vista visual
   de qué se superpone.
3. **Planificador de Materiales** — antes de programar un PM grande,
   confirmá que el repuesto ya esté en stock o con OC en camino.
4. **Destrabe** — revisalo junto con el cierre semanal: un trabajo trabado
   mucho tiempo es plata parada.

**Ejemplo de semana**: lunes revisás Destrabe → armás el Plan Semanal →
chequeás Planificador de Materiales. Viernes cerrás la semana.

**Horizonte**: esta semana — Destrabe, Plan Semanal y Planificador de Materiales; este mes
— repasar el histórico de semanas cerradas; este año — Programa Anual y
Gantt para ver qué se superpone y mover trabajos antes de que choquen.

### Comprador

Con este perfil ves una sola pestaña: Stock & Insumos.

1. **El semáforo de stock** — lo rojo necesita pedido ya; el botón 📈
   Tendencia y Proyección de Compra te dice, con consumo real, en qué
   fecha conviene pedir.
2. **Generar una OC** — cargá cantidad y proveedor; el estado avanza
   Pedido → OC por Firmar/Firmada → Recibida, y el stock se actualiza solo.
3. **Compras — Proveedores** — tiempo de respuesta real por proveedor y
   gasto acumulado.
4. **Pedidos Potencialmente Trabados** — pedidos abiertos que ya llevan
   más días que lo normal para ESE proveedor.
5. **Tiempo Interno de Aprobación de OC** — mide solo la parte que
   depende de la empresa, separada del proveedor.

**Horizonte**: esta semana — semáforo de stock y Pedidos Potencialmente Trabados; este mes
— Compras — Proveedores (tiempos de respuesta y gasto acumulado) para
priorizar o negociar; hasta fin de año — Tendencia y Proyección de Compra
con consumo real y, en Neumáticos, cuántos vas a necesitar hasta fin de año.

### Supervisor / Jefe de Mantenimiento

No necesitás entender cada fórmula — solo qué pregunta responde cada
pantalla.

- **Dashboard**: tu vistazo diario — empezá por la tarjeta 🔴 Riesgo Alto.
- **Predictivo**: Matriz de Riesgo = "¿qué es lo más urgente de toda la
  flota?" (arrancá siempre acá); RUL = "¿cuántas horas le quedan a este
  componente?"; Señal Unificada de Reemplazo = "¿este equipo ya amerita
  evaluar reemplazo?"; Intervalo P-F = "¿cada cuánto inspeccionar?";
  Kijima = "¿las reparaciones restauran o solo tapan el síntoma?";
  Mantenimiento Oportunista = "¿conviene adelantar otro cambio ya que va a
  parar?".
- **Disponibilidad**: Producción Perdida por Detención traduce horas
  paradas en m³/toneladas no entregadas; el Simulador What-If te deja
  probar escenarios antes de gastar en un proyecto.
- **Costos & Stock (MTBF/MTTR)**: Matriz Jack-Knife (equipos
  crónicos/complejos) y % Correctivo Reactivo.
- **Producción**: Costo de Downtime real y Rendimiento por Tiempo de
  Ciclo con su columna Consistencia (CV).
- **Metas & KPIs → Resumen Ejecutivo**: para reportar lo que ya
  decidiste, no para decidir.

**Flujo semanal de ejemplo**: lunes Dashboard → Matriz de Riesgo → para lo
urgente, RUL o Señal Unificada según corresponda → coordinás con el
Planificador. Fin de mes: Costos & Stock + Metas & KPIs.

**Horizonte**: hoy — Dashboard, tarjeta 🔴 Riesgo Alto; esta semana — Matriz de Riesgo y,
para lo urgente, RUL o Señal Unificada; este mes — Costos & Stock y Metas &
KPIs; este año — las decisiones grandes: Señal Unificada de Reemplazo y
Simulador What-If para probar escenarios antes de gastar, y Presupuesto vs
Real para ver si el año va dentro de lo presupuestado.

### Administrador

1. **Usuarios** — Configuración → Crear Usuario del Sistema: asigná rol
   (Operador/Admin) y, si corresponde, perfil.
2. **Seguridad** — MFA, rotación de contraseñas, bloqueo tras 5 intentos
   fallidos, alerta de dispositivo nuevo.
3. **Respaldo** — backup diario automático + detector de salud que avisa
   solo si algo falla.
4. **Si algo se rompe** — la sección correspondiente de manual-admin.html
   es tu primera parada, antes de tocar Supabase directo.

**Checklist rápido**: rol/perfil correcto en cuentas nuevas · MFA activo
en Admin · revisar mensualmente cuentas de gente que ya no trabaja acá ·
confirmar que llegó el correo del backup diario.

**Horizonte**: cada día — confirmar que llegó el correo del backup diario; cada mes —
revisar cuentas de gente que ya no trabaja acá; cada año — se recomienda
ensayar una vez el procedimiento documentado de restauración, para saber que
funciona antes de necesitarlo.

**¿Qué pasa si me quedo inactivo mucho rato con la sesión abierta?**
A los 55 minutos sin usar el mouse/teclado aparece un aviso en pantalla
("¿Sigues ahí?") con cuenta regresiva. Si no haces nada, a la hora completa
la sesión se cierra sola — vuelve a entrar con tu clave normalmente. Es por
seguridad, para que un computador compartido no quede con una sesión
olvidada abierta.

**Se me olvidó mi contraseña, ¿qué hago?**
En la pantalla de inicio de sesión, toca "¿Olvidaste tu contraseña?", escribe
tu correo y te llega un link para definir una nueva clave — no hace falta
pedirle a un administrador que te la resetee. Por seguridad, el sistema
muestra el mismo mensaje exista o no ese correo registrado, así que si no
te llega nada revisa que hayas escrito bien tu correo (y la carpeta de spam).

**¿Por qué me pide cambiar la contraseña de repente?**
Por seguridad, el sistema pide renovarla cada 90 días (con un aviso previo
desde los 80). Si te aparece la pantalla de "Contraseña vencida" al entrar,
es justamente eso — no es un error, solo hay que definir una nueva para
seguir. También puedes cambiarla cuando quieras, sin esperar a que te lo
pida: **Configuración → Mi contraseña → Cambiar mi contraseña**.

**Vi un 🆕 al lado de un acceso en "Accesos recientes", ¿qué significa?**
Marca la primera vez que ESE dispositivo entra a tu cuenta. Si lo reconoces
(tu celular nuevo, un computador que recién configuraste), no hay nada que
hacer. Si no lo reconoces, cambia tu contraseña y avisa a un administrador
— probablemente ya te haya llegado un correo o WhatsApp avisando lo mismo
apenas ocurrió el acceso.

**¿Cómo sé si me faltan o me sobran técnicos?**
En **Componentes → Predictivo → 👷 Dotación de Taller** hay un **Índice
Carga/Capacidad**, por mes/semestre/año y proyectado a futuro:
- **100%** = la dotación actual está justa (cubre exactamente la carga real).
- **Bajo 100%** (ej. 70%, 43%) = hay menos trabajo que gente disponible →
  **sobran técnicos**.
- **Sobre 100%** (ej. 110%) = hay más trabajo que lo que la dotación actual
  alcanza a cubrir → **faltan técnicos**.

Es fácil leerlo al revés la primera vez: el número mide cuánto trabajo hay
*en relación a* la gente que tienes, no cuánta gente sobra directamente. Más
carga que gente (arriba de 100%) = faltan manos. Menos carga que gente
(abajo de 100%) = sobran manos.

**¿Cómo sé cuándo comprar un repuesto, filtro o aceite?**
En **Stock Filtros**, **Lubricantes** y **Control de Repuestos**, cada fila
tiene un botón **📈** ("Tendencia y Proyección de Compra"): muestra el
consumo/compra real de ese ítem por mes/semestre/año, cuántos meses de
cobertura le quedan al stock actual, en qué mes se agotaría, y la fecha
sugerida para pedirlo (restando el tiempo de entrega del proveedor). Si el
ítem todavía no tiene historial real, el sistema lo dice en vez de
inventar un número.

**¿Cuánto voy a gastar en total en filtros, aceite o repuestos este año?**
En **Stock Filtros**, **Lubricantes** y **Control de Repuestos**, botón
**📊 Resumen** (arriba de la tabla) — a diferencia del 📈 (que es por
ítem), este suma TODOS los ítems de esa categoría con historial real: el
ritmo de consumo/compra reciente de cada uno × su precio, con una tarjeta
destacada de cuánto vas a gastar hasta fin de año y el desglose por
mes/semestre/año. No usa correctivos (no hay ningún ítem de stock
vinculado a un correctivo en la base de datos) ni reemplaza Predictivo →
Stock/Lubricantes vs. Próximos PM (esa es la proyección exacta según el
calendario de PM ya agendado).

**¿Cómo sé cuántos neumáticos voy a necesitar este año?**
En **Neumáticos → Resumen flota** hay una sección "Proyección de reemplazos
por período" (Mes/Semestre/Año), con una tarjeta destacada de cuántos
neumáticos — y cuánto costo — vas a necesitar hasta fin de año. No es un
promedio: es la suma de la fecha de cambio real que cada neumático ya
calcula por su cuenta (gráfico de desgaste, botón 🔍 en cada fila),
agrupada por período.

**¿Puedo ver solo una parte del Dashboard, sin todos los bloques a la vez?**
Sí. Arriba del tablero hay 5 botones — 🩺 Salud de Flota, 📊 Disponibilidad,
📈 Gráficos, 🔴 Equipos Urgentes, 💰 Costos y Stock — y con un clic apagas
el que no te interesa ver en el momento (por ejemplo, dejar solo "Salud de
Flota"). Es solo visual: los cálculos y avisos automáticos de la flota
siguen funcionando igual, esté el bloque mostrado o no. Tu elección queda
guardada y se recuerda la próxima vez que entras.

---

Para el detalle completo de cada función (con capturas conceptuales y
ejemplos paso a paso), abre el sistema y ve a la pestaña **❓ Ayuda** — ahí
vive la versión completa de 33 secciones, siempre al día.
