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
| Dashboard | Vista general: KPIs, urgentes, próximas PM, tendencias |
| Equipos | Flota completa, horómetros, estado de PM, ficha técnica |
| Registro PM | Registrar cada mantención preventiva ejecutada |
| Correctivos | Órdenes de trabajo por falla, causa raíz, componente |
| Neumáticos | Remanente, cambios, sensores de presión |
| Horómetros | Historial de lecturas por equipo |
| Disponibilidad | % de disponibilidad mecánica, meta y tendencia |
| Análisis Aceite | Muestras de laboratorio, estado por componente |
| Vencimientos | Documentos legales por equipo (revisión técnica, seguro, etc.) |
| Stock & Insumos | Stock Filtros, Lubricantes, Costos, Consumos y Repuestos (control de inventario y órdenes de compra) |
| Predictivo | Diagnóstico automático, alertas cruzadas, backlog |
| Planificación y Agenda | Plan Semanal, Programa Anual, Gantt, Planificador de Materiales, Programación Diaria |
| Pautas | Actividades de mantención por tipo de PM |
| Componentes | Componentes Mayores, Predictivo (incluye Probabilidad de Falla), Destrabe, Informes de Falla, Tren de Rodaje, Historial de Componentes, Estadística (comparativas por equipo/componente/técnico/modelo) |
| Metas & KPIs | Plan vs. real, avance mensual, informes descargables |
| Buscar | Ficha completa por equipo (PM, correctivos, componentes, horómetros, inspecciones, neumáticos, tren de rodaje, aceite, vencimientos, historial, destrabe y costos) + ranking de equipos problemáticos |
| Auditoría de Datos | Cruce automático: horómetros que retroceden, componentes sin validar, OT sin solución — se recalcula solo cada vez que se abre |
| Configuración | Usuarios, seguridad, respaldo, tema, información del sistema |

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

---

Para el detalle completo de cada función (con capturas conceptuales y
ejemplos paso a paso), abre el sistema y ve a la pestaña **❓ Ayuda** — ahí
vive la versión completa de 31 secciones, siempre al día.
