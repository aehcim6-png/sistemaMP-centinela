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

### Auditoría

**Configuración → Accesos recientes** — quién entró, cuándo, desde qué
computador. **Configuración → Log de cambios** — cada edición, creación o
eliminación en el sistema, con fecha, usuario y detalle.

## 4. Base de datos (Supabase)

- **31 tablas reales** (una por categoría: `equipos`, `correctivos`,
  `registros_pm`, etc.) + 6 tablas "singleton" de configuración. El mapeo
  completo vive en `TABLA_REAL`/`TABLA_SINGLETON` dentro de
  `modules/store.js`.
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

## 6. Despliegue (Vercel)

- Cada push a la rama `main` del repositorio dispara un build (`vite build`)
  y un despliegue automático a `sistema-mp-centinela.vercel.app`.
- El build no transforma el código JavaScript — solo empaqueta `index.html`
  y copia `logic.js`, `vendor/*.js` y toda la carpeta `modules/` tal cual
  (ver `vite.config.js`).
- **Si un despliegue sale mal**: en el panel de Vercel se puede volver
  ("Promote to Production") a cualquier despliegue anterior con un clic —
  no hace falta revertir código a mano bajo presión.
- **Antes de fusionar algo grande a `main`**: siempre se prueba primero en
  el preview automático que Vercel genera para cada rama, y solo se fusiona
  a producción con aprobación explícita.

## 7. Estructura del código

```
index.html              — esqueleto: nav, login, bootstrap, infraestructura compartida
logic.js                — funciones de cálculo puras (con tests)
modules/store.js         — motor de sincronización (S.g/S.s, TABLA_REAL, RLS-aware)
modules/renders/*.js     — un archivo por pestaña/sub-pestaña (39 en total)
supabase/migrations/     — schema versionado como código
supabase/functions/      — Edge Functions (crear-operador, alerta-pm)
tests/                   — pruebas de logic.js (Vitest, 181 casos)
docs/                    — esta carpeta
```

Cada módulo de `modules/renders/` es autocontenido: define su
`window.render<Tab>` más los botones/formularios exclusivos de esa pestaña.
Las funciones realmente compartidas entre pestañas (helpers de fecha,
`escapeHtml`, el motor de voz genérico, etc.) quedan en `index.html` a
propósito.

## 8. Si algo se rompe — por dónde empezar

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

## 9. Continuidad — si la persona que mantiene esto no está disponible

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
