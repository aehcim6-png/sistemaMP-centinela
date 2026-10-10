# Catálogo de algoritmos, matrices y fórmulas de SistemaMP

Qué cálculos usa el programa, qué pregunta responde cada uno, y qué falta. Se armó leyendo el código (`logic.js`, 269 funciones,
idénticas en centinela y mp2; 105 archivos de prueba) y las reglas que viven en `index.html` (grilla de PM, pautas acumulativas).
Fecha: 2026-10-10. Las dos apps comparten todo esto.

**Regla de la casa:** ningún cálculo inventa un dato que falta. Si no hay muestra suficiente, devuelve "sin dato" o "pocos casos".

---

## 1. Lo que ya tenemos, por pregunta que responde

### 1.1 ¿Cuándo va a fallar y cuánto le queda? (vida y confiabilidad)

| Cálculo | Qué responde | Método |
|---|---|---|
| Weibull (`ajusteWeibull`, por grupo, por equipo, con **censura**) | forma y vida característica de cada componente; ¿falla por desgaste, por azar o temprano? | regresión en papel Weibull + máxima verosimilitud con censura; IC 90% de β y η |
| Confiabilidad R(t) y **condicional** (`confiabilidadWeibull`) | probabilidad de seguir funcionando N horas más, sabiendo que ya lleva t | R(t+h)/R(t) |
| **RBD en serie** (`confiabilidadSistemaEquipo`) | probabilidad de que un camión complete 500 h sin que falle ningún componente mayor | producto de confiabilidades |
| **Kaplan-Meier** + **Log-Rank** + **Cox** (binario) | curvas de supervivencia que usan también los equipos que no han fallado; ¿dos componentes difieren de verdad? ¿cuántas veces más rápido falla uno? | estimador producto-límite; χ²; regresión de riesgos proporcionales |
| **Competing Risks** | ¿qué componente es el más probable que falle primero? | incidencia acumulada |
| **MCF** (Nelson) | cuántas fallas acumuladas esperar por componente | media acumulada de eventos recurrentes |
| **Crow-AMSAA** (NHPP, ROCOF) | ¿la tasa de fallas mejora o empeora con el tiempo? | proceso de Poisson no homogéneo |
| **Kijima I/II** (`kijimaEquipo`, simulación GRP) | ¿qué tan bien restauran las reparaciones? proyección de fallas a 30 días | edad virtual, simulación |
| **RUL híbrido** (`rulWeibull`, `rulHibridoComponente`) | horas útiles que le quedan a cada componente, combinando desgaste y tendencia del aceite | Weibull + factor de aceleración |
| **Intervalo P-F** (`intervalosPF`) | cada cuánto inspeccionar para detectar la falla antes | tiempo real entre alerta de aceite y primer correctivo |
| **TBO Komatsu** (nuevo) | qué cambiar y cuándo según el fabricante; riesgo de falla con las horas del último cambio | Weibull β=3 con el TBO como B5: F(t)=1−0,95^((t/TBO)³) |

### 1.2 Indicadores (fórmulas)

MTBF y MTTR (con error estándar y modelo log-normal para MTTR), MTBF de flota, confiabilidad real, **disponibilidad** operacional
(Ao) e intrínseca (Ai), % flota sin falla, ratio preventivo/correctivo, % correctivo reactivo, **costo relativo** (gasto anual ÷ valor de
compra), cumplimiento de PM a tiempo (`regEsATiempo`), HH de PM estimadas (mediana por equipo+tipo), coeficiente de variación, rendimiento teórico del cargador (R = Q×LF×E×60/Cm), brecha
de rendimiento por ciclo, toneladas perdidas por indisponibilidad, costo de detención por mes, CAPEX/OPEX, gasto proyectado y
presupuesto prorrateado.

**Reglas de PM (en `index.html`):** el hito se repite cada `frecPM` (250 h); múltiplo de 8×f = PM4, 4×f = PM3, 2×f = PM2, el resto PM1; las
pautas son acumulativas (PM2 = PM1 + PM2…); un PM cerrado cubre su hito.

### 1.3 Estadística (para saber si una diferencia es real o ruido)

IC del MTBF (χ²), **Wilson** (proporciones), **Mann-Kendall** (tendencia), regresión y R², **Mann-Whitney U**, **ANOVA**,
**Kruskal-Wallis**, **Levene**, χ² de uniformidad y de independencia, **Bayes empírico Gamma-Poisson** (tasa de fallas estable con pocos
datos), **Beta-Bernoulli** (¿llega al TBO?, nuevo), **Gamma** por momentos (tiempos de entrega, nuevo), **bootstrap** y **Monte Carlo**
(disponibilidad, escenarios "qué pasaría si").

### 1.4 Control de procesos y aceite

Cartas **I-MR** y **EWMA**, **CUSUM** del aceite (¿el desgaste se acelera?), outliers multivariados con **Mahalanobis**
(matriz de covarianza invertida), CUSUM por componente.

### 1.5 Repuestos e inventario

Estado de stock vs. tiempo de entrega, demanda **Poisson**, nivel de servicio (z) y **punto de reorden** con stock de seguridad,
**ABC-XYZ**, rotación, obsolescencia, probabilidad de quiebre dentro del plazo de reposición, proyección de elementos de desgaste,
**colas M/M/c** (¿está saturado el taller?), tiempo de respuesta por proveedor, pedidos trabados, aprobación de OC.

### 1.6 Prioridad y riesgo

**NPR** del FMEA (S×O×D), **señal unificada de reemplazo** (4 de 6 señales), **oportunidad de mantenimiento** (aprovechar una parada),
índice y score de **salud** de flota/equipo, **Calidad de Ejecución del PM** (razón observadas/esperadas con IC Poisson log-normal).

### 1.7 Matrices

| Matriz | Qué decide |
|---|---|
| **Riesgo Probabilidad × Impacto** 5×5 (Bajo/Moderado/Alto/Extremo) | qué riesgo atender primero; con **Criticidad Dinámica** (ajusta la probabilidad según la tendencia Crow-AMSAA) |
| **Jack-Knife** (MTBF × MTTR) | crónico / agudo / complejo / mundial |
| **Criticidad de repuestos** (probabilidad de quiebre × costo) | qué repuesto es más peligroso quedarse sin |
| **ABC-XYZ** | dónde conviene control estricto de inventario |
| **Markov de salud** + Chapman-Kolmogorov | probabilidad de que un equipo esté en cada estado de salud dentro de N semanas |
| **Contingencia componente × ubicación** (χ²) | ¿un tipo de falla se concentra en un lugar? |
| **Riesgo TBO** (nuevo) | Probabilidad Weibull × Impacto por precio de los cambios con último cambio conocido |
| Covarianza (interna) | base del Mahalanobis del aceite |

### 1.8 Datos y texto

Interpolación de horómetro en una fecha, validación de saltos de horómetro, cruce de materiales por palabras (con tolerancia a texto
cortado), clasificación componente/sistema desde el síntoma, reparación de texto mal codificado, detección de conflictos de edición.

---

## 2. Lo que nos falta, por orden de utilidad

Evaluado contra los datos que de verdad tenemos (1.243 correctivos, ~330 cambios de componentes con horómetro, ~8.600 líneas de
compras). "Datos" dice si hoy alcanzan.

| # | Qué falta | Pregunta que contestaría | Datos hoy | Esfuerzo |
|---|---|---|---|---|
| 1 ✅ | **Reemplazo óptimo por costo** (hecho 2026-10-10) (política de reemplazo por edad; vida económica) | ¿cada cuántas horas conviene cambiar este componente, y conviene el alternativo? Minimiza costo por hora: `C(T) = [Cp·R(T) + Cf·(1−R(T))] / ∫₀ᵀ R(t)dt` con Weibull + costo de cambio programado vs. costo de falla | **Sí**: Weibull, precios y costo de detención ya existen | medio |
| 2 | **Costo total de propiedad (LCC) por equipo** y vida económica del equipo | ¿cuándo conviene renovar o dar de baja un equipo? | Parcial (valor de compra, gasto, detención) | medio |
| 3 ✅ | **Optimización con presupuesto limitado** (qué cambios hacer primero) | con $X, ¿qué compro para bajar más riesgo? | **Sí** (riesgo TBO + precio) | medio |
| 4 ✅ | **Pruebas de bondad de ajuste y comparación de modelos** (Kolmogorov-Smirnov/Anderson-Darling, AIC entre Weibull, log-normal y Gamma) | ¿estamos usando la distribución correcta? Hoy se muestra solo R² del papel Weibull | **Sí** | bajo |
| 5 | **Pronóstico de demanda de repuestos con tendencia/estacionalidad** (suavizamiento exponencial/Holt) | ¿cuánto repuesto necesito el próximo año? Hoy se asume demanda estable | Parcial (3–4 años de compras) | bajo-medio |
| 6 ✅ | **Cantidad económica de pedido (EOQ) y política (s,S)** | ¿cuánto pedir, no solo cuándo? Hoy hay punto de reorden pero no lote | Sí | bajo |
| 7 | **OEE** | disponibilidad × rendimiento × calidad | **No**: falta definir la meta de rendimiento por tipo de equipo | depende de la meta |
| 8 | **Productividad de taller** (tiempo llave, backlog envejecido, cumplimiento del programa semanal) | ¿cuánto del tiempo es trabajo y cuánto espera? | **No**: no se registra el tiempo por tarea | alto (hay que capturarlo) |
| 9 | **Cartas de control por atributos** (c/u) de correctivos por equipo | ¿un equipo se salió de su comportamiento normal? | Sí | bajo |
| 10 | **Regresión/Cox multivariable** | ¿influyen la pendiente, la distancia, el turno o el operador en la vida? | **No**: no hay condiciones de operación por equipo | alto (datos) |
| 11 | **Condición con telemetría** (Komtrax/VHMS, vibración, temperatura) | alertas tempranas sin análisis de aceite | **No**: no está integrado | alto (integración) |
| 12 | **Confiabilidad en paralelo / árbol de fallas** | redundancias | Sí, pero aporta poco en flota minera | bajo valor |

Fuera de alcance con estos datos (y por qué): aprendizaje automático predictivo (pocos eventos y causa raíz vacía), análisis de
vibraciones (no hay señales), Arrhenius/temperatura (no hay mediciones).

### 2.1 Matrices que faltan

Hoy tenemos 8 (sección 1.7). Revisé el código y no hay ninguna de estas:

| # | Matriz que falta | Qué decide | Datos hoy | Utilidad |
|---|---|---|---|---|
| M1 ✅ | **Estrategia de mantenimiento (RCM)** (hecha 2026-10-10) por componente: forma β del Weibull × costo de falla vs. cambio × ¿se puede detectar antes (P-F)? | ¿cambio por edad, por condición, dejo correr hasta la falla, o hay que rediseñar? Hoy el programa avisa pero no recomienda la estrategia | **Sí** (β, intervalo P-F, precios, detención) | **Alta** — va junto con el reemplazo óptimo |
| M2 | **Criticidad de equipos multicriterio**: frecuencia de falla × consecuencia (producción, seguridad, ambiente, costo, tiempo de reparación) | qué equipos reciben la atención primero. Hoy la criticidad es una etiqueta manual de 3 niveles (Crítico/Esencial/General) | Producción y costo sí; **seguridad y ambiente no** (hay que definir criterios) | Alta |
| M3 | **Costo × disponibilidad por equipo** (mantener / reparar a fondo / renovar) | complementa el costo total de propiedad | Sí | Media |
| M4 | **Repuestos ABC × VED** (vital / esencial / deseable según cuánto para el equipo) | cuánto stock de seguridad justifica cada repuesto, más allá de su costo (hoy ABC-XYZ) | Sí, derivando el VED de la criticidad | Media |
| M5 | **Proveedores (Kraljic)**: gasto × riesgo de suministro (variabilidad del tiempo de entrega, proveedor único como Komatsu) | qué proveedores son estratégicos, cuáles tienen cuello de botella | Sí (compras + tiempos de entrega con Gamma) | Media |
| M6 | **Prioridad de OT** (urgencia × impacto) para el backlog | en qué orden atender el trabajo pendiente. Hoy se ordena por días | Sí | Media |
| M7 | **Markov de disponibilidad** (estados: operativo / en PM / en falla / esperando repuesto) | disponibilidad de largo plazo y dónde se pierde. Hoy el Markov es solo de salud | Parcial (registros de detención) | Media |
| M8 | **Riesgo inherente vs. residual** (antes y después de ejecutar el PM o el cambio) | cuánto riesgo baja realmente el plan | Sí, con Weibull + TBO | Baja-media |
| M9 | **Cobertura de PM** en forma de matriz (sistema × pauta × fallas posteriores) | qué sistemas no cubre la pauta. Hoy está dentro de Calidad de Ejecución, sin vista matricial | Sí | Baja |
| M10 | Competencias del personal | No se recomienda como ranking de personas (decisión ya tomada: solo análisis descriptivo, sin individuos). Sí como cobertura de certificaciones, que ya existe en Vencimientos | — | No aplica |

---

## 3. Preguntas que el programa todavía NO sabe responder

1. ¿Cada cuántas horas conviene cambiar X? ¿Conviene el alternativo aunque dure menos? (falta #1; hoy solo hay costo por hora medido)
2. ¿Cuánto cuesta una falla de verdad, por equipo (repuesto + mano de obra + detención)? Existe cada pieza, falta unirlas por equipo.
3. ¿Qué equipo conviene renovar o dar de baja? (falta #2)
4. Con presupuesto limitado, ¿qué cambios hago primero? (falta #3)
5. ¿Cuántos repuestos voy a necesitar el próximo año? (falta #5; el plan TBO da la parte determinística)
6. ¿Las fallas dependen de la operación (pendiente, distancia de acarreo, turno, operador)? No hay datos.
7. ¿Qué proveedor da el mejor costo por hora de vida útil? Se puede construir con lo que ya medimos.
8. ¿Cuánto del tiempo del taller es trabajo real y cuánto es espera (repuesto, permiso, herramienta)? No se registra.
9. ¿Estas distribuciones son las correctas? (falta #4)

---

## 4. Observaciones sobre los datos (lo que frena a los algoritmos)

- **Tipo de Causa** vacío en el 100% de los correctivos y **Sistema** vacío en ~23%: limita Pareto por causa, Calidad de Ejecución y RCM.
- **PM** ✅ (2026-10-10): turno, operador, ubicación, AST, LOTO y repuestos usados ahora se guardan en `registros_pm`; los PM anteriores quedan sin esos datos.
- **Compras**: los pedidos no traen N° de parte y el texto viene cortado a ~25 caracteres; el cruce por descripción es aproximado.
- **Origen del repuesto** (original/alternativo) solo está cargado en los turbos; el resto se infiere por el proveedor.
- **Componentes Mayores**: solo 64 de 643 filas tienen instalación real (fecha + horómetro); el resto son filas por defecto.
- **Aplicación** (ligera/normal/severa) es global, no por equipo, y los factores salen del Excel de Komatsu.
- Las tablas `ordenes_compra_historico` y `compras_detalle` se repiten casi por completo. Los análisis nuevos las unen sin duplicar;
  el cruce de costo sugerido de Correctivos las concatena a propósito (98,4% de cobertura, solo propone con botón "usar"), así que puede
  mostrar la misma compra dos veces pero no suma costos.
- La serie 95076 del Excel de Komatsu (tercer WA900) no tiene sigla asignada.

---

## 5. Orden recomendado

1. **#1 Reemplazo óptimo por costo + M1 Matriz de estrategia (RCM)** — van juntos: el algoritmo da los números (cada cuántas horas conviene cambiar) y la matriz
   los presenta como decisión por componente. Cierra el ciclo TBO + precios + Weibull + costo de falla, y responde la pregunta que más plata mueve.
2. **#4 Bondad de ajuste** — barato, y da respaldo a todo lo demás (incluidos Weibull y Gamma).
3. **#3 Optimización con presupuesto** — usa lo que ya construimos.
4. Capturar mejor los datos de la sección 4: sin Tipo de Causa ni Sistema, no hay Pareto de causa raíz que valga.
