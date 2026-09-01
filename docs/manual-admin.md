# Manual de Administrador — SistemaMP Centinela

Para quien administra el sistema hoy, o para quien lo reciba mañana. Cubre lo
que un operador normal no necesita saber: gestión de usuarios, seguridad,
base de datos, despliegue, y qué hacer si algo se rompe.

Para cómo se conecta todo por dentro, ver [`arquitectura.md`](./arquitectura.md)
y el diagrama [`plano-sistema.html`](./plano-sistema.html).

## 1. Accesos que necesitas tener

- **Cuenta admin dentro del sistema** (rol `admin` en la tabla `user_roles`).
- **Panel de Supabase** (supabase.com) — el proyecto se llama "SistemaMP"
  (`jyhpfwivhwzylkzxrsbt`). Ahí se ve la base de datos real, los logs, y la
  configuración de autenticación.
- **Panel de Vercel** — donde vive el sitio publicado
  (`sistema-mp-centinela.vercel.app`) y el historial de despliegues.
- **Acceso al repositorio de GitHub** (`aehcim6-png/sistemamp-centinela`) —
  todo el código y el historial de cambios vive ahí.

Sin estos tres accesos (Supabase, Vercel, GitHub), nadie puede mantener el
sistema — vale la pena que más de una persona los tenga guardados en un
lugar seguro.

## 2. Gestión de usuarios

Crear, activar y desactivar cuentas se hace desde **Configuración → Crear
Usuario del Sistema** (solo visible para admins). Por dentro, esto llama a
una única función con privilegio elevado (`crear-operador`, una Edge
Function de Supabase) — es el único punto de todo el sistema donde el
frontend puede pedir una acción que normalmente un usuario normal no podría
hacer solo. El código fuente de esa función vive en
`supabase/functions/crear-operador/`.

Un usuario nuevo queda **bloqueado** hasta que un admin lo activa a mano
(pestaña "Pendientes de activar" en la misma tarjeta) — evita que cualquiera
con el link entre sin autorización.

## 3. Seguridad

### Roles

Cada cuenta tiene un rol en `user_roles`: `admin` u `operador`. El rol se usa
para dos cosas:
- Ocultar/mostrar botones en pantalla (cosmético).
- **Row Level Security (RLS) real en Postgres** — el candado que de verdad
  importa. Cada una de las ~31 tablas tiene su propia política; 4 tablas
  (`equipos`, `stock_filtros`, `lubricantes`, `repuestos`) tienen además un
  *trigger* (`proteger_columnas_admin`) que bloquea a un operador que
  intente cambiar columnas reservadas (precio, datos estructurales del
  equipo), aunque manipule el navegador directamente.

### Verificación en dos pasos (MFA)

Cualquier usuario puede activarla desde Configuración → Verificación en dos
pasos. No es obligatoria por ahora, pero conviene activarla al menos en las
cuentas admin.

### Contraseñas

Política mínima configurada en Supabase Auth: 14 caracteres, con
mayúscula/minúscula/dígito/símbolo. Las cuentas nuevas se crean con una
contraseña temporal que fuerza el cambio al primer ingreso.

### Cierre de sesión por inactividad

Desde agosto 2026, a los 55 min sin actividad (mouse/teclado/touch/scroll)
aparece un aviso en pantalla ("¿Sigues ahí?") con cuenta regresiva; si nadie
hace nada, a la hora completa la sesión se cierra sola (`_logout()`). Corre
en cualquier pestaña abierta, no solo la que está en primer plano. Pensado
para el caso de un computador compartido (taller) con una sesión olvidada
abierta.

### Auditoría (trazabilidad — quién cambió qué)

**Configuración → Accesos recientes** — quién entró, cuándo, desde qué
computador, y también los **intentos que NO prosperaron** (clave incorrecta,
cuenta desactivada, o sesión que no logró renovarse), marcados en rojo con
🚫. Antes (hasta agosto 2026) solo se registraban los logins exitosos — un
usuario desactivado que insistía en entrar no dejaba ningún rastro. Los
intentos fallidos se registran vía la Edge Function
`registrar-intento-acceso` (clave de servicio, porque en ese momento no hay
sesión de usuario con la que insertar directo en `changelog`).

**Configuración → Log de cambios** — cada edición, creación o eliminación en
el sistema, con fecha, usuario y detalle.

No confundir con la pestaña **Auditoría de Datos** (agosto 2026, en el menú
principal): esa es otra cosa — no rastrea quién cambió qué, sino si los
datos son consistentes entre sí. Se recalcula sola cada vez que se abre, con
5 chequeos hoy:
1. Horómetros que retroceden entre OT consecutivas del mismo equipo.
2. Componentes mayores con dato genérico de industria sin validar contra un
   reemplazo real.
3. OT cerradas sin ningún texto en "solución".
4. Reportes automáticos por WhatsApp/correo que el parser no pudo clasificar
   con confianza (fuente terminada en "— revisar").
5. **Neumáticos cambiados sin registrar la salida** (agosto 2026): la última
   medición real de una posición trae una serie distinta a la que el
   sistema todavía muestra como montada — señal de que se cambió el
   neumático en terreno pero nadie lo movió a Existencias/De baja.

**Configuración → Uso del sistema** (agosto 2026) — tampoco es auditoría de
quién cambió qué: cuenta cuántas veces se abrió cada pestaña/sub-pestaña en
los últimos 7/30/90 días, para decidir con datos (no a ciegas) dónde vale la
pena seguir invirtiendo. Vive en su propia tabla (`uso_pestanas`), fuera de
`TABLA_REAL` a propósito — se purga sola cada 90 días con un cron diario,
para no crecer sin límite y comerse cuota del plan gratis.

## 4. Base de datos (Supabase)

- **35 tablas reales** (una por categoría: `equipos`, `correctivos`,
  `registros_pm`, etc. — incluye `historial_componentes` e
  `historial_neumaticos`, agregadas en agosto 2026, `correctivos_historico`
  (agosto 2026, planillas Excel 2022-2025 previas a este sistema, alimenta
  Probabilidad de Falla en Predictivo), y `compromisos` (2026-08-31, loop de
  responsabilidad de Metas & KPIs)) + 7 tablas "singleton" de
  configuración. El mapeo completo vive en `TABLA_REAL`/`TABLA_SINGLETON`
  dentro de `modules/store.js`.
- **El schema está versionado como código** en `supabase/migrations/*.sql`.
  Cualquier cambio de estructura (agregar una columna, una tabla, una
  política RLS) debe hacerse como un archivo de migración nuevo — con la
  CLI de Supabase o con `mcp__Supabase__apply_migration` si se está
  trabajando con Claude — nunca como una edición manual sin rastro en el
  panel.
- **Verificar que el schema versionado coincide con la realidad**:
  `supabase db diff` (con la CLI conectada al proyecto) debería salir
  vacío. Si no, alguien hizo un cambio fuera de una migración y hay que
  traerlo a `supabase/migrations/` para no perder el rastro.

### Límites del plan gratis (hoy)

| Recurso | Límite gratis | Uso actual (ago. 2026) |
|---|---|---|
| Tamaño de base de datos | 500 MB | ~22 MB (4.4%) |
| Ancho de banda / mes | 5 GB | no medido desde acá — revisar en Supabase → Settings → Usage |
| Pausa por inactividad | tras 7 días sin uso | se reactiva con un clic, hasta 90 días después |

El límite que más vale la pena vigilar es el **ancho de banda**, no el
tamaño: el sistema baja toda la base de datos completa en cada inicio de
sesión (`_sbLoadHeavy`), así que con más usuarios o más uso diario podría
acercarse al tope antes que el espacio en disco.

## 5. Respaldo y continuidad de datos

Tres copias existen en todo momento (ver `arquitectura.md` para el diagrama
completo):

1. **`localStorage`** de cada navegador — copia de trabajo, siempre al día.
2. **Supabase** — la fuente oficial compartida entre todos.
3. **Carpeta de respaldo local** (opcional, botón "Conectar carpeta" en
   Configuración) — un JSON completo cada 5 segundos. Se conecta **por
   computador**, no una sola vez para todo el sistema.

Además existe un **Backup manual** (exportar/importar un JSON completo a
mano) en la misma pestaña de Configuración — útil antes de cualquier cambio
grande (ej. "Configurar Nueva Empresa", que borra todo).

**Si Supabase quedara inaccesible por completo** (escenario extremo): el
JSON de cualquiera de los respaldos de arriba permite reconstruir todos los
datos en un backend nuevo, siguiendo el mismo mapeo de `TABLA_REAL`.

## 6. Reporte de fallas por WhatsApp o correo (canal de entrada)

Desde agosto 2026 existe un canal adicional para registrar correctivos sin
entrar al sistema: un técnico le escribe a un número de WhatsApp Business (o
manda un correo) y el mensaje se parsea e inserta directo en
`correctivos_historico`. Por dentro son dos Edge Functions de Supabase:
`whatsapp-webhook` (Twilio) y `email-webhook` (Resend).

### Configuración inicial (una sola vez)

1. **Secrets en Supabase** (Project Settings → Edge Functions → Secrets, o
   `supabase secrets set`): `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN`
   (desde la consola de Twilio, Account → API keys & tokens) para WhatsApp;
   el equivalente de Resend para correo ya estaba configurado (se reutiliza
   el mismo usado para las alertas salientes de `alerta-pm`).
2. **Webhook de Twilio**: en la consola de Twilio, Messaging → Try it out →
   Send a WhatsApp message (Sandbox) → Sandbox Settings, campo "WHEN A
   MESSAGE COMES IN": pegar la URL pública de la función,
   `https://jyhpfwivhwzylkzxrsbt.supabase.co/functions/v1/whatsapp-webhook`,
   método POST.
3. **Remitentes autorizados**: Configuración → tarjeta "📥 Reporte de Fallas
   por WhatsApp/Correo" → cargar los números (`+56...`) o correos
   autorizados a reportar. Sin nadie cargado ahí, el canal no acepta ningún
   mensaje aunque las credenciales estén bien configuradas.

No confundir esa tarjeta con "💬 Alertas por WhatsApp" (`alertaWhatsApp`) —
esa es para el envío de alertas de PM (salida), no para autorizar quién
puede reportar (entrada). Son dos tarjetas distintas de Configuración aunque
se vean parecidas y esto causó una confusión real durante la puesta en
marcha.

### Formato del mensaje

`"SIGLA fuera de servicio, falla de X"` (o similar) — el parser
(`supabase/functions/_shared/parseCorrectivo.ts`) reconoce la sigla del
equipo y una palabra clave de falla. Si el mensaje es ambiguo, igual se
registra pero queda marcado `fuente = 'WhatsApp Twilio (auto) — revisar'`,
visible en Auditoría de Datos para que un admin lo revise, en vez de
perderse o insertarse como si fuera un dato certero.

> **Bug real corregido (2026-08-21)**: la verificación de firma de Twilio
> fallaba siempre con 401, incluso con credenciales correctas, porque usaba
> `req.url` (una URL interna que entrega el runtime de Supabase) en vez de
> la URL pública real que Twilio efectivamente firma. Ver el detalle
> completo en [`arquitectura.md`](./arquitectura.md), sección 12.

## 7. Alertas automáticas de salida (correo y WhatsApp)

Dos Edge Functions programadas por `pg_cron` mandan resúmenes sin que nadie
abra el sistema — pensadas para el dueño/gerente que revisa la información
desde afuera:

- **`alerta-pm`** (diaria, 11:00 UTC ~7-8h Chile): TODO lo urgente hoy — PM
  vencido/urgente, stock crítico, documentos por vencer, backlog de
  correctivos, equipos fuera de servicio prolongado, cierres sin evidencia,
  documentación por técnico, alertas de aceite persistentes, reingresos
  tempranos. Se omite el envío si no hay nada urgente ese día.
- **`resumen-semanal`** (lunes, 11:00 UTC): un check-in ejecutivo, no una
  alerta — compara la semana contra la anterior (correctivos, costo, PM
  ejecutados, % documentado), el ranking de equipos con más fallas, y un
  snapshot de solo 4 contadores de lo pendiente hace tiempo (sin repetir el
  detalle diario). A diferencia de `alerta-pm`, SIEMPRE se manda, incluso en
  una semana tranquila.

Ambas leen los mismos destinatarios — Configuración → "📧 Alertas por
Correo" / "💬 Alertas por WhatsApp" (columnas `alertaEmails`/`alertaWhatsApp`
de `configuracion`) — no hay un campo separado para cada una. El canal de
correo (Resend) ya está configurado y no necesita nada adicional; **el canal
de WhatsApp requiere además `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y
`TWILIO_WHATSAPP_FROM` como *secrets* del proyecto** — sin esos tres, ambas
funciones responden igual (correo enviado, WhatsApp con
`"motivo":"No configurado"`) sin que eso afecte el envío del correo.

Mismo patrón de seguridad que `backup-diario` (ver
[`arquitectura.md`](./arquitectura.md), sección 9): el secreto de cada cron
vive en Supabase Vault, nunca en texto plano en el código ni en
`cron.job.command`.

## 8. Despliegue (Vercel)

- Cada push a la rama `main` del repositorio dispara un build (`vite build`)
  y un despliegue automático a `sistema-mp-centinela.vercel.app`.
- El build sí transforma `modules/renders/*.js` (44 archivos, módulos ES
  reales desde la migración de Fase 3, 2026-08-30): Vite los bundlea y
  minifica en un único archivo. `logic.js`, `vendor/*.js` y `modules/store.js`
  siguen siendo scripts planos a propósito — Vite los copia tal cual, sin
  tocarlos (ver `vite.config.js`).
- **Si un despliegue sale mal**: en el panel de Vercel se puede volver
  ("Promote to Production") a cualquier despliegue anterior con un clic —
  no hace falta revertir código a mano bajo presión.
- **Antes de fusionar algo grande a `main`**: siempre se prueba primero en
  el preview automático que Vercel genera para cada rama, y solo se fusiona
  a producción con aprobación explícita.

## 9. Estructura del código

```
index.html              — esqueleto: nav, login, bootstrap, infraestructura compartida
logic.js                — funciones de cálculo puras (con tests)
modules/store.js         — motor de sincronización (S.g/S.s, TABLA_REAL, RLS-aware)
modules/renders/*.js     — un archivo por pestaña/sub-pestaña (44, módulos ES reales)
supabase/migrations/     — schema versionado como código
supabase/functions/      — 11 Edge Functions (crear-operador, alerta-pm, resumen-semanal,
                            backup-diario, whatsapp-webhook, email-webhook,
                            registrar-intento-acceso, avisar-salud-equipo, leer-pauta-pm,
                            leer-informe-correctivo, leer-chequeo-neumaticos,
                            _shared/ parser común)
tests/                   — pruebas de logic.js y store.js (Vitest, 536 casos)
docs/                    — esta carpeta
```

Cada módulo de `modules/renders/` es autocontenido: exporta su
`render<Tab>` (y también lo deja en `window.render<Tab>`, porque el HTML
generado usa `onclick="..."` que no ve bindings de un módulo) más los
botones/formularios exclusivos de esa pestaña.
Las funciones realmente compartidas entre pestañas (helpers de fecha,
`escapeHtml`, el motor de voz genérico, etc.) quedan en `index.html` a
propósito.

## 10. Si algo se rompe — por dónde empezar

1. **¿Es un error de guardado?** Revisar la consola del navegador
   (F12 → Console) — el sistema avisa con un toast rojo cuando un guardado
   falla, y el error real queda ahí también.
2. **¿Es un error de datos incorrectos?** Revisar `Supabase → Logs` y
   comparar contra lo que hay en `localStorage` de ese navegador
   (Application → Local Storage, en las herramientas de desarrollador).
3. **¿El sitio no carga?** Revisar `Vercel → Deployments` — confirmar que el
   último build terminó en verde ("Ready"), no en rojo ("Error").
4. **¿Alguien no puede entrar?** Revisar en Supabase → Authentication que la
   cuenta existe y no está deshabilitada; revisar en `user_roles` que tiene
   un rol asignado y `activo = true`.
5. **¿Un dato desapareció solo?** Antes de asumir que se perdió, revisar si
   `syncEquipos()` lo filtró por no reconocer la sigla del equipo asociado
   (bug conocido para texto libre, corregido en las celdas más comunes en
   agosto 2026 — ver `manual-usuario.md` → sección de novedades dentro del
   sistema).

## 11. Continuidad — si la persona que mantiene esto no está disponible

Este sistema hoy lo entiende y mantiene una sola persona, sesión a sesión.
Para reducir ese riesgo:

- Los tres accesos de la sección 1 (Supabase, Vercel, GitHub) deberían
  quedar guardados en un lugar que más de una persona en la empresa pueda
  alcanzar.
- El código y el schema están versionados (GitHub + `supabase/migrations/`)
  — cualquier desarrollador con esos accesos puede clonar el repositorio y
  entender el sistema completo leyendo este `docs/` y el propio código.
- Antes de cualquier cambio grande, siempre queda un respaldo manual (ver
  sección 5) — no depende de la memoria de nadie.
