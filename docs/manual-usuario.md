# Manual de Usuario — SistemaMP Centinela

> **Esta es una copia portable, para leer sin abrir el sistema.** La versión
> completa y siempre actualizada vive DENTRO del sistema, en la pestaña
> **❓ Ayuda** (31 secciones con capturas de pantalla conceptuales, índice
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

Si dos personas editan la misma fila casi al mismo tiempo, el sistema detecta
el conflicto, avisa, y pide reintentar sobre los datos frescos. Nunca se
pierde en silencio el cambio de uno de los dos.

## 6. Mapa de pestañas

| Pestaña | Para qué |
|---|---|
| Dashboard | Vista general: KPIs, urgentes, próximas PM, tendencias — con filtro (5 botones arriba) para mostrar solo el bloque que te interesa: Salud de Flota, Disponibilidad, Gráficos, Equipos Urgentes o Costos y Stock. En Equipos Urgentes, la tarjeta "🔴 Riesgo Alto" cuenta los componentes en riesgo de falla inminente — un clic lleva directo a la lista en Componentes. En Costos y Stock, la tarjeta **Neumáticos Críticos** cuenta los que ya llegaron a su límite real de cambio (remanente u horas) y deben cambiarse ahora. 8 tarjetas llevan además una etiqueta 📈 **Adelanto** (predictiva, corregible esta semana: Cumplimiento PM, Backlog, Stock Crítico, Neumáticos Críticos) o 📉 **Retraso** (resultado del período ya cerrado: Disponibilidad, MTBF, Costo/RAV, Confiabilidad) — para distinguir de un vistazo qué números todavía se pueden cambiar y cuáles solo sirven para explicar lo que ya pasó |
| Torre de Control | Un clic en cualquier equipo abre su detalle: Score de Salud (avisa si se calculó con pocas señales — menos confiable), forma real de falla (Weibull) y, cuando hay suficiente historial, una versión rápida de **Edad Virtual** — si las reparaciones dejan el equipo realmente restaurado o solo tapan el síntoma (factor Q, 0 = sin evidencia de desgaste acumulado, cerca de 1 = las fallas vuelven cada vez más rápido pese a repararse). La versión rigurosa (**Kijima**, con el factor q real ajustado por máxima verosimilitud en vez de una comparación simple, más una proyección de fallas esperadas a 30 días) vive en Componentes → Predictivo |
| Equipos | Flota completa, horómetros, estado de PM, ficha técnica |
| Registro PM | Registrar cada mantención preventiva ejecutada |
| Correctivos | Órdenes de trabajo por falla, causa raíz, componente, modo de falla clasificado (Cód.Falla) y AST/LOTO/Autorizado — buscador por palabra clave (incluye historial 2022-2024) con alerta si el mismo equipo repite 3+ veces. El botón **⚡ Registro Rápido** es la vía corta desde el celular en terreno: solo equipo, qué pasó y urgencia — el resto se completa después. Si el campo Costo queda vacío, el sistema cruza el texto de la OT contra las Órdenes de Compra reales del mismo equipo y sugiere un monto ("💡 usar") cuando encuentra un candidato confiable; al cerrar una OT sin costo, avisa (sin bloquear) por si conviene revisarlo antes. El checkbox **💰 Carga de costos pendiente** filtra la tabla a solo las OT sin costo cargado y las ordena por el componente que más conviene priorizar (el que más aporta a los análisis de costo real de toda la flota), con un panel de avance por componente |
| Neumáticos | Remanente, cambios, sensores de presión, gráfico de desgaste con fecha de cambio por neumático — "Resumen flota" proyecta cuántos neumáticos vas a necesitar por mes/semestre/año, con una segunda tabla Weibull con censura que aprovecha también los neumáticos todavía montados (no solo los ya cambiados) para una vida útil más precisa |
| Horómetros | Historial de lecturas por equipo |
| Disponibilidad | % de disponibilidad mecánica, meta y tendencia — vista mensual muestra también la **Disponibilidad Intrínseca (Ai)**: cuánto de la indisponibilidad es solo fallas, separado de la mantención que la propia empresa programó. Debajo de la proyección Monte Carlo (30/60/90 días) hay un **Simulador What-If**: dos campos ("mejora de confiabilidad", "mejora de velocidad de reparación", en %, a tu elección) muestran cuánto subiría la disponibilidad proyectada y cuántas fallas menos habría si se cumpliera ese escenario, comparado contra la proyección base |
| Análisis Aceite | Muestras de laboratorio, estado por componente — un aviso aparte ("🔺 aceleración de desgaste detectada") marca cuando varias muestras seguidas de un mismo equipo/componente/metal vienen subiendo de forma sostenida, aunque ninguna sola haya cruzado el umbral de alerta del laboratorio |
| Vencimientos | Documentos legales por equipo (revisión técnica, seguro, etc.) |
| Stock & Insumos | Stock Filtros, Lubricantes, Costos, Consumos y Repuestos (control de inventario y órdenes de compra) — cada ítem tiene un botón 📈 "Tendencia y Proyección de Compra" con gráfico: historial real por mes/semestre/año y en qué fecha conviene pedirlo. Botón 📊 "Resumen" (por categoría) proyecta el gasto total hasta fin de año. Costos → **Costo Relativo de Mantenimiento**: gasto real en repuestos (histórico de Órdenes de Compra) ÷ valor de compra de cada equipo, anualizado — sin mano de obra, solo aparece con suficiente historial. **Presupuesto vs Real**, para el mes en curso, compara el gasto contra el presupuesto **prorrateado a la fecha** (días transcurridos del mes), no el mes completo — para no mostrar "bajo presupuesto" engañoso a comienzos de mes. **MTBF/MTTR**: junto al MTBF y al MTTR de cada equipo aparece su **intervalo de confianza 95%** (ej. "430h ⚠️ IC95%: 77–16.984h (1 intervalo)") — con pocas fallas o reparaciones registradas el número puntual puede ser muy poco confiable, y el aviso ⚠️ marca justo esos casos (menos de 5 fallas/reparaciones) para no mostrar una precisión que en realidad no existe |
| Planificación y Agenda | Plan Semanal, Programa Anual, Gantt, Planificador de Materiales, Programación Diaria |
| Pautas | Actividades de mantención por tipo de PM |
| Componentes | Componentes Mayores (vida útil por pieza, con columna de Riesgo que combina vida útil + análisis de aceite + retrabajo reciente, un filtro para ver solo un nivel de riesgo, y una columna "Días Est. (MTBF)" que estima cuánto falta para la próxima falla cruzando el MTBF típico de ese tipo de componente en toda la flota), Predictivo — selector con varias sub-vistas, todas con el mismo filtro de equipo: Probabilidad de Falla; **🎯 Matriz de Riesgo** (Probabilidad × Impacto, cruza automáticamente el riesgo de componentes, equipos, stock y fallas reincidentes, sin carga manual, con un bloque de **Criticidad Dinámica** que ajusta la Probabilidad de cada componente según si su tasa de fallas real viene mejorando o empeorando con el tiempo); Tasa de Falla por Ubicación (compara qué tan seguido falla la flota en Pit/Rampa/Planta); **Señal Unificada de Reemplazo** (candidato a evaluar cuando 4 de 6 señales reales coinciden en el mismo equipo); **⏳ RUL — Vida Útil Remanente** (cuántas horas le quedan de verdad a cada componente de cada equipo, combinando su curva de desgaste con la tendencia real del aceite; ordena de más a menos urgente); **🔁 Kijima — Factor de Restauración** (qué tan bien restauran las reparaciones a cada equipo — de "como nuevo" a "no cambió nada" — con una proyección de fallas esperadas a 30 días); **🧰 Mantenimiento Oportunista** (sugiere adelantar el cambio de otro componente cuando el equipo ya va a parar por otro motivo, con el ahorro estimado en mano de obra); **📦 Criticidad de Repuestos** (la misma Matriz de Riesgo aplicada a stock, con probabilidad real de quiebre según demanda y tiempo de entrega); **🔧 Efectividad del Mantenimiento** (si los PM realmente alargan el tiempo hasta la próxima falla, o no); **📅 Patrones Ocultos de Falla** (si hay un patrón real por mes o por turno, o es solo ruido de muestra chica); y 👷 Dotación de Taller (dotación real vs. carga de trabajo, con tendencia y proyección a futuro). Destrabe, Informes de Falla, Tren de Rodaje, Historial de Componentes (incluye una segunda tabla Weibull con censura, que aprovecha también los componentes todavía instalados sin haber fallado, y una tabla de Confiabilidad de sistema por equipo a 500h que combina la confiabilidad de todos los componentes de cada equipo — pensada como piezas en serie: si cualquiera falla, para el equipo — señalando cuál es el más débil), Estadística (comparativas por equipo/componente/técnico/modelo, un Pareto de Modo de Falla, y en la vista Por Componente cuatro tablas adicionales para toda la flota: Kaplan-Meier — curva de supervivencia que aprovecha también los equipos que siguen en servicio sin haber vuelto a fallar —, MCF — cuántas fallas acumuladas esperar de cada componente a futuro —, Crow-AMSAA — si la tasa de fallas de cada componente viene mejorando o empeorando con el tiempo — y Competing Risks — qué componente es más probable que falle primero en toda la flota; en la vista Por Técnico, un test ANOVA sobre el MTTR indica si el tiempo de reparación realmente difiere entre técnicos o es ruido de muestra chica) |
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
vive la versión completa de 31 secciones, siempre al día.
