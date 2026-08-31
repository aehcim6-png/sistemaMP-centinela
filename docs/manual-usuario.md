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
| Dashboard | Vista general: KPIs, urgentes, próximas PM, tendencias — con filtro (5 botones arriba) para mostrar solo el bloque que te interesa: Salud de Flota, Disponibilidad, Gráficos, Equipos Urgentes o Costos y Stock |
| Equipos | Flota completa, horómetros, estado de PM, ficha técnica |
| Registro PM | Registrar cada mantención preventiva ejecutada |
| Correctivos | Órdenes de trabajo por falla, causa raíz, componente, modo de falla clasificado (Cód.Falla) y AST/LOTO/Autorizado — buscador por palabra clave (incluye historial 2022-2024) con alerta si el mismo equipo repite 3+ veces |
| Neumáticos | Remanente, cambios, sensores de presión, gráfico de desgaste con fecha de cambio por neumático — "Resumen flota" proyecta cuántos neumáticos vas a necesitar por mes/semestre/año |
| Horómetros | Historial de lecturas por equipo |
| Disponibilidad | % de disponibilidad mecánica, meta y tendencia |
| Análisis Aceite | Muestras de laboratorio, estado por componente |
| Vencimientos | Documentos legales por equipo (revisión técnica, seguro, etc.) |
| Stock & Insumos | Stock Filtros, Lubricantes, Costos, Consumos y Repuestos (control de inventario y órdenes de compra) — cada ítem tiene un botón 📈 "Tendencia y Proyección de Compra" con gráfico: historial real por mes/semestre/año y en qué fecha conviene pedirlo. Botón 📊 "Resumen" (por categoría) proyecta el gasto total hasta fin de año |
| Planificación y Agenda | Plan Semanal, Programa Anual, Gantt, Planificador de Materiales, Programación Diaria |
| Pautas | Actividades de mantención por tipo de PM |
| Componentes | Componentes Mayores (vida útil por pieza, con columna de Riesgo que combina vida útil + análisis de aceite + retrabajo reciente), Predictivo (incluye Probabilidad de Falla y Dotación de Taller — dotación real vs. carga de trabajo, con tendencia y proyección a futuro), Destrabe, Informes de Falla, Tren de Rodaje, Historial de Componentes, Estadística (comparativas por equipo/componente/técnico/modelo, más un Pareto de Modo de Falla) |
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
