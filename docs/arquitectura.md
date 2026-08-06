# Arquitectura de SistemaMP Centinela

Explicación textual de cómo está construido el sistema. Para la versión visual,
ver [`plano-sistema.html`](./plano-sistema.html) (ábrelo en cualquier navegador).

## Resumen en una frase

Una página web (sin backend propio) que guarda cada cambio en tres lugares al
mismo tiempo — este computador, Supabase en la nube, y opcionalmente una
carpeta de respaldo — para que nunca dependa de un solo lugar ni de que haya
internet.

## Las piezas

### 1. El frontend — `index.html` + `modules/`

Todo el sistema es HTML/CSS/JavaScript plano, sin framework (nada de React,
Vue, etc.) y sin proceso de compilación de lógica (Vite solo empaqueta y
copia archivos, no transforma el código JS). Se decidió así a propósito: es
más fácil de mantener por una sola persona sesión a sesión que introducir un
framework nuevo a mitad de camino.

- **`index.html`** (~3.300 líneas) — el esqueleto: la barra de navegación, el
  login, el arranque de la aplicación, y la infraestructura compartida entre
  pestañas que no encajaba en un módulo propio (autoguardado a carpeta local,
  auditoría, MFA, gestión de usuarios).
- **`modules/renders/*.js`** (40 archivos) — un archivo por pestaña o
  sub-pestaña del sistema. Cada uno define `window.render<Tab>` (la función
  que dibuja esa pantalla) más los botones/formularios exclusivos de esa
  pestaña. Son scripts planos (`<script src="...">`), no módulos ES —
  comparten el mismo espacio de variables globales que el resto del sistema,
  a propósito, para no arriesgar un cambio de semántica de JavaScript a
  mitad de una migración.
- **`modules/store.js`** — el motor de sincronización (ver sección 3).
- **`logic.js`** — funciones de cálculo puras (sin acceso a pantalla ni a la
  base de datos): fechas de próxima mantención, disponibilidad, similitud de
  materiales, etc. Junto con `store.js`, son los archivos con pruebas
  automatizadas (`tests/*.test.js`, 312 casos, corren con Vitest).

### 2. Dónde vive — Vercel

[Vercel](https://vercel.com) sirve los archivos estáticos (no hay servidor
propio corriendo en ningún lado). Cada push a la rama `main` dispara un build
(`vite build`) y un despliegue nuevo automático. `vite.config.js` tiene un
plugin chico que copia `logic.js`, `vendor/*.js` y toda la carpeta `modules/`
al resultado del build, ya que Vite por diseño no "empaqueta" scripts que no
son módulos ES.

### 3. El motor de sincronización — `modules/store.js`

Todo el sistema lee y escribe datos a través de dos únicas funciones:
`S.g(categoria)` (leer) y `S.s(categoria, valor)` (guardar). Ninguna pantalla
llama directo a Supabase — todas pasan por acá, lo que permite que el resto
del sistema (más de 550 llamadas repartidas en las 40 pestañas) nunca
necesite saber cómo ni dónde se guardan realmente los datos.

Al llamar `S.s(categoria, valor)` ocurren, en este orden:

1. **`localStorage`** — se escribe de inmediato, siempre, funcione o no
   internet. El sistema sigue siendo usable sin conexión.
2. **Supabase** — si la categoría es una de las 31 tablas reales
   (`TABLA_REAL`/`TABLA_SINGLETON`), se envía sin demora un `upsert` (crear o
   actualizar) más un `delete` de las filas que ya no están — pero antes de
   escribir, se hace un chequeo de conflicto (ver más abajo).
3. **Carpeta de respaldo** (opcional) — si alguien conectó una carpeta local
   (botón "Conectar carpeta" en Configuración), 5 segundos después del último
   cambio se escribe ahí un `SistemaMP_Datos.json` con todo. Es "por
   computador": cada equipo que quiera este respaldo tiene que conectar su
   propia carpeta.

### 4. Detección de conflictos (edición concurrente)

Antes de escribir en una tabla real, el sistema compara "lo que esta pestaña
creía que había antes" contra "lo que hay AHORA mismo en el servidor" (una
consulta liviana). Si son iguales, guarda normal. Si son distintos —alguien
más cambió esos datos mientras tanto—, el guardado se cancela, la pantalla se
refresca con lo más reciente, y aparece un aviso. Nunca se sobrescribe en
silencio el trabajo de otra persona.

### 5. Autenticación y roles — Supabase Auth

- **Login**: correo + contraseña contra Supabase Auth. Si la cuenta tiene
  verificación en dos pasos (MFA/TOTP) activada, pide el código de 6 dígitos
  DESPUÉS de validar la contraseña, nunca antes.
- **Roles**: cada usuario tiene un rol (`admin`, `operador` o `lector`)
  guardado en la tabla `user_roles`. El rol se usa para dos cosas, con
  distinto peso:
  - Ocultar/mostrar botones y pestañas en pantalla (primera línea, cosmética).
  - **Row Level Security (RLS) real en Postgres** — cada una de las 31 tablas
    tiene su propia política de quién puede leer/escribir, y 4 tablas
    "mixtas" (equipos, stock_filtros, lubricantes, repuestos) tienen además
    un *trigger* que bloquea a un operador que intente cambiar columnas
    reservadas a admin (precio, datos estructurales del equipo), aunque
    manipule el navegador. El candado real vive en la base de datos, no
    solo en la pantalla.
- **Gestión de usuarios**: crear/activar/desactivar cuentas pasa por una
  única Edge Function (`crear-operador`), no por el frontend directo — es el
  único punto del sistema con privilegio elevado (`service_role`).

### 5b. Rol "lector" (solo lectura) — solo backend por ahora

Tercer rol en `user_roles.role` (además de `admin`/`operador`), pensado para
alguien que necesita VER el sistema sin poder editarlo. La base de datos ya
lo hace cumplir de verdad: `privado.es_editor_activo()` (activo Y rol
admin/operador) reemplazó a `privado.es_usuario_activo()` en el
INSERT/UPDATE/DELETE de todas las tablas operacionales y mixtas — un
usuario `lector` puede leer todo pero cualquier escritura la rechaza
Postgres, sin depender de que el frontend se porte bien
(`20260805215000_agregar_rol_lector_solo_lectura.sql`).

**Deliberadamente incompleto todavía**: la interfaz no oculta ni deshabilita
los botones de crear/editar/eliminar para este rol — un usuario lector los
va a seguir viendo, y si toca uno, la escritura se descarta en el servidor
pero la fila puede parpadear como "editada" en su pantalla hasta el próximo
refresco (porque S.s() actualiza el estado local en optimista antes de
confirmar contra Supabase). Ocultar esos controles en las ~30 pestañas es
un paso aparte, todavía no hecho.

### 6. Estructura de datos en Supabase

~31 tablas, una por categoría (equipos, correctivos, registros_pm, etc.),
más 6 "singleton" de configuración (una sola fila fija: `configuracion`,
`tarifa_hh`, `metas`, etc.). El mapeo completo entre cada categoría del
frontend y su tabla real vive en `TABLA_REAL`/`TABLA_SINGLETON`, dentro de
`modules/store.js`.

El schema (tablas, RLS, triggers) está versionado como código en
`supabase/migrations/*.sql` — cualquier cambio de estructura pasa por un
archivo de migración nuevo, no por una edición manual sin rastro en el panel
de Supabase.

### 7. Límites y respaldo

- **Plan gratis de Supabase**: 500 MB de base de datos (hoy ~22 MB, 4.4%
  usado), 5 GB de ancho de banda al mes, se pausa solo tras 7 días sin uso
  (se reactiva con un clic, sin perder nada, hasta 90 días después). El
  límite más cercano en la práctica no es el tamaño de los datos sino el
  ancho de banda, porque el sistema baja toda la base al iniciar sesión —
  vale la pena revisar el uso real en el panel de Supabase (Settings → Usage)
  de vez en cuando.
- **Respaldo paralelo**: la carpeta local conectada (JSON automático cada 5
  segundos) es la primera red de seguridad fuera de Supabase. También existe
  un botón de "Backup manual" (exporta/importa un JSON completo a mano) en
  Configuración.
- **Si Supabase dejara de existir** (escenario extremo, no algo esperado):
  cada navegador tiene una copia completa en `localStorage`, y el JSON de
  backup permitiría reconstruir los datos en otro backend.

### 8. Monitoreo de errores — Sentry

Cada error real de JavaScript en producción (no solo los que se detectan
probando) queda registrado en Sentry con el usuario y la acción que lo
disparó. El SDK está vendorizado en `vendor/sentry.min.js` (mismo criterio
que jspdf/qrcode/xlsx: nada por CDN en tiempo de ejecución — se generó una
vez con `esbuild` a partir de `@sentry/browser` y se comitea el archivo) y
se inicializa lo más temprano posible en `<head>`, antes que cualquier otro
script. Solo incluye captura de errores y breadcrumbs — sin tracing de
performance ni session replay, que no se pidieron y gastan cuota del plan
gratis aparte. Configuración → "🐞 Monitoreo de errores" (solo admin) tiene
un botón para mandar un error de prueba y confirmar que la conexión sigue
viva.

### 9. Backup automático diario

Todos los días a las 12:00 UTC (~8:00 hora de Chile), un cron job de
Postgres (`pg_cron`) llama a la Edge Function `backup-diario`
(`supabase/functions/backup-diario/`), que junta TODAS las tablas reales
(41, incluye `kv` y `user_roles` para poder reconstruir accesos ante un
desastre total), las comprime (gzip) y las manda por email vía Resend a un
destinatario fijo como adjunto `.json.gz` — sin depender de que la app esté
abierta en ningún navegador (a diferencia del respaldo a carpeta local, que
sí lo necesita).

**Autenticación (corregida 2026-08-06, tras un hallazgo real de una
auditoría propia):** la función ya no confía en nada que mande quien la
invoca. Antes solo exigía que llegara un header `X-Resend-Key` no vacío,
sin comparar su valor contra nada — como la verificación de sesión acepta
la clave pública anónima (la misma que viaja en el HTML servido), cualquier
persona con internet podía invocarla directamente con su propia clave de
Resend y su propio destinatario, y recibir un volcado completo de las 41
tablas usando el permiso de máximo nivel de la función para saltarse RLS.
Ahora la función verifica un secreto propio contra dos funciones SQL
restringidas a `service_role` (`verificar_secreto_cron`,
`obtener_secreto_para_cron` — ni un usuario autenticado normal puede
ejecutarlas) que leen **Supabase Vault**: sin el secreto correcto (header
`X-Cron-Secret`), 401, sin importar qué tan válido sea el resto de la
petición. La clave real de Resend y el destinatario ya no se reciben del
llamador — la función los busca ella misma en Vault, y el destinatario
queda fijo en el código. La programación del cron vive en
`supabase/migrations/20260806014500_asegurar_backup_diario.sql`.

### 10. Papelera (soft-delete con recuperación)

Nada se borra de golpe. Al eliminar cualquier fila (un equipo, un registro
de PM, stock, una orden de trabajo, etc.), el sistema primero la mueve a
una tabla `papelera` — con qué categoría era, quién la eliminó y cuándo —
y recién ahí la saca de la tabla original. Queda recuperable desde
Configuración → Papelera durante 30 días antes de purgarse en serio
(`_purgarPapeleraVieja`, corre sola). `_moverAPapelera` y
`_purgarPapeleraVieja` viven en `modules/store.js` (lógica de datos pura,
sin DOM — mismo criterio que `logic.js`, testeable con Vitest sin arrancar
la app); la pantalla de recuperación (`modules/renders/papelera.js`) sigue
el mismo patrón que el resto de las pestañas.

### 11. App instalable (PWA)

El sistema se puede agregar a la pantalla de inicio del celular como una
app normal — ícono propio, sin la barra de direcciones del navegador.
`manifest.json`, `sw.js` (service worker) y los íconos viven en `public/` a
propósito, no junto al resto del proyecto: Vite renombra con un hash los
archivos que referencia desde una etiqueta `<link>` al compilar, lo que
rompería las rutas internas relativas del manifest; todo lo que está en
`public/` se copia tal cual, sin tocar. El service worker usa la estrategia
red-primero-con-respaldo-en-caché (nunca caché-primero, para no pisar el
sistema de caché-busting por `?v=` que ya usan los `<script>` del sistema)
— solo precachea lo mínimo para poder arrancar sin internet (`index.html`,
`manifest.json`, 2 íconos) y cachea el resto la primera vez que se pide con
éxito.

## Lo que decidimos NO hacer (y por qué)

- **No convertir a módulos ES**: cambiar `<script>` planos a
  `type="module"` cambia reglas de JavaScript (modo estricto, alcance,
  `this`) en miles de líneas a la vez — mucho riesgo para cero beneficio
  real hoy.
- **No backend propio**: agregar un servidor Node/Express entre el
  navegador y Supabase solo se justifica si aparece una razón concreta (una
  regla de negocio que RLS no pueda expresar, un secreto que ni RLS proteja,
  pasos que necesiten reintentos transaccionales reales). Hoy no existe esa
  razón — el patrón ya usado (`crear-operador`) alcanza para lo que hace
  falta.
