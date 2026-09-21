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
- **`modules/renders/*.js`** (45 archivos) — un archivo por pestaña o
  sub-pestaña del sistema. Cada uno exporta su función de dibujo
  (`export function render<Tab>()`) y también la deja en
  `window.render<Tab>` — el puente hace falta porque el HTML generado usa
  `onclick="..."` con nombres de función simples, que no ven bindings de un
  módulo. Son módulos ES reales (`<script type="module">`) desde la
  migración de Fase 3 (2026-08-30): se convirtieron uno por uno, cada uno
  probado (tests + build + Playwright) antes de fusionar, en vez de todos a
  la vez — el riesgo que antes hacía preferible mantenerlos como scripts
  planos. `logic.js` y `modules/store.js` siguen siendo scripts planos a
  propósito (ver sección 2).
  **Carga perezosa (code-splitting, 2026-09-10)**: 43 de los 45 se cargan
  con `dynamic import()` recién al visitar esa pestaña, no todos al
  arrancar — bajó el bundle inicial de ~900kB a ~70kB. `index.html` define
  `_LAZY_VERS` (qué archivo/versión carga cada uno), `_LAZY_EXPORTS` (sus
  funciones públicas) y `_LAZY_CLUSTERS` (grupos que se llaman entre sí sin
  chequeo de que el otro ya cargó — `audit`+`pred`, `metas`+`resumenejec`,
  `reg`+`neu`+`ot`, `comp`+`estadistica` — se cargan siempre juntos, nunca
  uno sin el otro). Como red de seguridad ante un caso cruzado que se le
  escape a esa lista (un `onclick="..."` generado por OTRO archivo, ej.
  `cfg.js` invocando `verLogCambios()` de `log.js`), cada función pública
  queda con un "stub" desde el arranque que, si se llama antes de tiempo,
  carga el archivo real y reintenta. Solo `dash.js` (se dibuja en el
  arranque, antes del login) y `ace.js` (lo usan varias pestañas de forma
  no crítica, pero si nunca cargara el widget de aceite del Dashboard
  quedaría vacío toda la sesión) siguen eager.
- **`modules/store.js`** — el motor de sincronización (ver sección 3).
- **`logic.js`** — funciones de cálculo puras (sin acceso a pantalla ni a la
  base de datos): fechas de próxima mantención, disponibilidad, similitud de
  materiales, etc. Junto con `store.js`, son los archivos con pruebas
  automatizadas (`tests/*.test.js`, 737 casos, corren con Vitest).
- **`tests/e2e/`** (2026-09-10) — pruebas de extremo a extremo con Playwright
  Test, que sí arrancan un navegador real (Chromium) contra un servidor Vite
  local, a diferencia de Vitest (que corre sin DOM). Cubren los flujos que
  antes solo se probaban a mano cada vez: login (CAPTCHA, credenciales
  correctas/incorrectas, cambio de clave obligatorio, token de CAPTCHA
  fresco al registrar un intento fallido), verificación en dos pasos
  (cuenta con MFA activo pide el código de 6 dígitos y no guarda sesión
  hasta confirmarlo), guardado offline (`S.s()` nunca debe fingir un
  guardado en la nube que no llegó), conflicto de edición concurrente
  (`_chequearConflicto` debe abortar sin pisar el cambio de otra persona),
  y la lectura de pauta PM/chequeo de neumáticos por foto (OCR: solo
  prellena o guarda lo tildado, nunca guarda a ciegas). Todas las llamadas
  a Supabase/Cloudflare se
  mockean con `page.route()` — no dependen de, ni gastan cuota de,
  infraestructura real. Corren en CI (`.github/workflows/tests.yml`) después
  de Vitest y `npm audit`, con reintentos automáticos ante un fallo puntual
  de timing (`retries: 2` en CI).

### 2. Dónde vive — Vercel

[Vercel](https://vercel.com) sirve los archivos estáticos (no hay servidor
propio corriendo en ningún lado). Cada push a la rama `main` dispara un build
(`vite build`) y un despliegue nuevo automático. Vite bundlea y minifica de
verdad solo el puñado de módulos ES que `index.html` importa de forma
estática (`dash.js`/`ace.js`, los dos que siguen eager — ver sección 1) en
un único archivo (`dist/assets/index-*.js`), siguiendo su grafo de imports.
Los otros 43 módulos de `modules/renders/*.js` (los de carga perezosa) NO
entran a ese bundle — Vite no puede verlos en el grafo estático porque se
piden con `dynamic import()` usando una ruta armada en tiempo de ejecución
(`_LAZY_VERS`), así que se copian TAL CUAL, sin bundlear ni minificar, a
`dist/modules/renders/*.js` y se sirven como archivos sueltos (verificado
corriendo `npm run build` e inspeccionando `dist/`). `logic.js` y
`modules/store.js` siguen siendo scripts planos (sin `type="module"`) a
propósito, así que Vite tampoco los toca — `vite.config.js` tiene un plugin
chico que los copia igual (junto con `vendor/*.js` y `docs/`).

### 3. El motor de sincronización — `modules/store.js`

Todo el sistema lee y escribe datos a través de dos únicas funciones:
`S.g(categoria)` (leer) y `S.s(categoria, valor)` (guardar). Ninguna pantalla
llama directo a Supabase — todas pasan por acá, lo que permite que el resto
del sistema (más de 550 llamadas repartidas en las 45 pestañas) nunca
necesite saber cómo ni dónde se guardan realmente los datos.

Al llamar `S.s(categoria, valor)` ocurren, en este orden:

1. **`localStorage`** — se escribe de inmediato, siempre, funcione o no
   internet. El sistema sigue siendo usable sin conexión.
2. **Supabase** — si la categoría es una de las 42 tablas reales
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
  - **Row Level Security (RLS) real en Postgres** — cada una de las 42 tablas
    tiene su propia política de quién puede leer/escribir, y 4 tablas
    "mixtas" (equipos, stock_filtros, lubricantes, repuestos) tienen además
    un *trigger* que bloquea a un operador que intente cambiar columnas
    reservadas a admin (precio, datos estructurales del equipo), aunque
    manipule el navegador. El candado real vive en la base de datos, no
    solo en la pantalla.
- **Gestión de usuarios**: crear/activar/desactivar cuentas pasa por una
  única Edge Function (`crear-operador`), no por el frontend directo — es el
  único punto del sistema con privilegio elevado (`service_role`).
- **Resolución de rol resistente a blips de red (2026-09-07)**: buscar el rol
  en `user_roles` justo después del login/al restaurar sesión hacía un solo
  intento — cualquier timeout transitorio o un PostgREST recién despertando
  bastaba para que fallara, y el código caía a `'operador'` por defecto sin
  avisar ni reintentar. Bug real reportado por un admin: entraba como
  administrador y, tras el blip, su propia sesión se veía degradada a
  operador (panel de Configuración desaparecido) sin ningún error visible.
  Ahora `_sbGetRoleConReintento` reintenta hasta 3 veces con espera
  creciente, y si aun así falla, `_resolverRolConCache` usa el último rol
  confirmado con éxito en ese dispositivo (guardado en `localStorage`) en
  vez de asumir `'operador'` a ciegas. Sin ningún rol cacheado todavía
  (primera vez en el dispositivo), sigue cayendo a `'operador'` como piso de
  seguridad — nunca sobre-privilegia por un blip, solo evita
  sub-privilegiar a un admin real.

### 5b. Rol "lector" (solo lectura)

Tercer rol en `user_roles.role` (además de `admin`/`operador`), pensado para
alguien que necesita VER el sistema sin poder editarlo. Dos capas, ninguna
depende de la otra:

**Candado real (backend)**: `privado.es_editor_activo()` (activo Y rol
admin/operador) reemplazó a `privado.es_usuario_activo()` en el
INSERT/UPDATE/DELETE de todas las tablas operacionales y mixtas — un
usuario `lector` puede leer todo pero cualquier escritura la rechaza
Postgres, sin depender de que el frontend se porte bien
(`20260805215000_agregar_rol_lector_solo_lectura.sql`). Además, `S.s()`
(el único choke point por el que pasa cualquier escritura del sistema,
`modules/store.js`) corta antes de tocar cache/localStorage/red si
`window._userRole==='lector'` — así la pantalla nunca muestra un cambio
como "guardado" cuando el servidor lo habría rechazado.

**Cosmético (frontend)**: `_aplicarRolUI()` (`index.html`) recorre los
botones/links de la pestaña o modal recién dibujado y oculta los que
matchean `_RE_ACCION_ESCRITURA` (crear/editar/guardar/importar/borrar,
~20 patrones de nombre de función) cuando el rol es `lector` — para que un
lector no vea controles que de todas formas van a fallar. Se reaplica en
cada `go()` (cambio de pestaña) y cada `sm()` (apertura de modal), porque
cada uno redibuja su contenido desde cero. Verificado con 2 tests E2E
(`rol-lector-ui.spec.js`): un lector no ve "+ Nueva OT"; un admin sí.

### 6. Estructura de datos en Supabase

49 tablas en total (42 "reales" + 7 "singleton" de configuración), una por
categoría (equipos, correctivos, registros_pm, etc. —
incluye `historial_componentes` e `historial_neumaticos`, agregadas en la
auditoría de agosto 2026 para poder responder "cuánto duró cada instalación
real" sin perder el dato cada vez que se actualiza el estado actual, y
`correctivos_historico`, cargada en agosto 2026 desde 3 fuentes previas a
este sistema — 3.285 registros en total: 1.180 de órdenes de trabajo
Excel, 1.680 de planillas "Disponibilidad Mecánica" 2021-2024 (sumadas
2026-08-26) y 425 de mensajes WhatsApp históricos — alimenta el cálculo de
Probabilidad de Falla en Predictivo con más muestra histórica. Las 3
fuentes comparten la misma columna `sistema` (componente) con el mismo
listado de categorías que usa el clasificador de correctivos actuales
(`_CATEGORIAS_COMPONENTE` en `pred.js`) — reconciliadas 2026-08-26 tras
encontrar categorías inconsistentes entre fuentes (ej. "Superestructura" vs
"Soporte de Cabina" para el mismo componente real) y, en la fuente
WhatsApp, 201 registros donde ese campo había quedado con el mensaje
original en vez de una categoría), y `compromisos` (2026-08-31): loop de
responsabilidad de Metas & KPIs — qué acción se comprometió, quién es
responsable y para cuándo, frente a un indicador rojo o con alerta de
tendencia; se evalúa sola contra el valor del indicador cuando se creó
(ver `modules/renders/metas.js`, `verCadenaCausas`/`abrirFormCompromiso`),
más 7 "singleton" de
configuración (una sola fila fija: `configuracion`, `tarifa_hh`, `metas`,
etc.). El mapeo completo entre cada categoría del frontend y su tabla real
vive en `TABLA_REAL`/`TABLA_SINGLETON`, dentro de `modules/store.js`.

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
(50, incluye `kv`/`user_roles` para poder reconstruir accesos ante un
desastre total, y `salud_crons` del detector de salud — sección 35), las
comprime (gzip) y las manda por email vía Resend a un
destinatario fijo como adjunto `.json.gz` — sin depender de que la app esté
abierta en ningún navegador (a diferencia del respaldo a carpeta local, que
sí lo necesita).

**Autenticación (corregida 2026-08-06, tras un hallazgo real de una
auditoría propia):** la función ya no confía en nada que mande quien la
invoca. Antes solo exigía que llegara un header `X-Resend-Key` no vacío,
sin comparar su valor contra nada — como la verificación de sesión acepta
la clave pública anónima (la misma que viaja en el HTML servido), cualquier
persona con internet podía invocarla directamente con su propia clave de
Resend y su propio destinatario, y recibir un volcado completo de las 49
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

Mismo patrón (secreto propio de 32 bytes en Vault, verificado vía
`verificar_secreto_cron`) protege las otras dos funciones que corren solas
por `pg_cron`: `alerta-pm` (diaria) y `resumen-semanal` (lunes, agregada
2026-09-01) — ver [`manual-admin.md`](./manual-admin.md), sección 7, para
qué manda cada una y cómo se configuran los destinatarios.

**Auditoría 2026-09-07 — lista de tablas desactualizada:** la constante
`TABLAS` de esta función se escribió una vez y desde entonces 7 tablas
reales agregadas después (`historial_componentes`, `historial_neumaticos`,
`salud_flota_historico`, `correctivos_historico`, `gestion_compras`,
`compromisos`, `uso_pestanas`) nunca se sumaron — el respaldo diario las
omitía en silencio (42 tablas respaldadas de las 49 reales). Grave en
particular para `correctivos_historico`, donde caen los reportes
automáticos de WhatsApp/correo: sin este fix no quedaban respaldados en
absoluto. Ya corregido; la lista es manual a propósito (ver comentario en
el propio archivo), así que una tabla nueva futura necesita el mismo cuidado
de sumarse acá también.

### 9b. ¿El backup diario es realmente restaurable? (investigación y fix, 2026-09-11)

Pregunta real que nunca se había puesto a prueba: si el proyecto Supabase se
pierde por completo (no una corrupción de datos, sino el proyecto entero:
borrado, cuenta suspendida, etc.), ¿el respaldo diario de la sección anterior
alcanza para levantar el sistema de nuevo? La respuesta, antes de esta
investigación, era **no** — por dos motivos concretos, ya corregidos:

**1. Ocho tablas nunca tuvieron `CREATE TABLE` en ninguna migración.**
`user_roles`, `kv`, `tren_rodaje`, `tren_rodaje_mediciones`,
`historial_componentes`, `historial_neumaticos`,
`movimientos_stock_backup_lub` y `stock_filtros_backup_csv` se crearon a
mano en el dashboard de Supabase en algún momento del historial del
proyecto — el respaldo diario sí las incluye (junta filas de tablas que ya
existen), pero **reconstruir el esquema completo desde el repo en un
proyecto nuevo** habría fallado silenciosamente al llegar a cualquiera de
estas ocho, porque el repo no sabía que existían. Corregido en
`supabase/migrations/20260911120000_formaliza_tablas_creadas_a_mano.sql`:
`CREATE TABLE IF NOT EXISTS` + políticas RLS con guardas `IF NOT EXISTS`
para cada una, copiado 1:1 del esquema real (introspección read-only) — en
los proyectos reales (Besalco, sistema-mp2), donde ya existen, esta
migración es un no-op comprobado (conteo de filas idéntico antes/después:
`user_roles=2, kv=38, tren_rodaje=27` en Besalco); solo importa para poder
levantar el esquema completo en un proyecto nuevo desde cero.

**2. El respaldo nunca incluía las cuentas de Supabase Auth.** `backup-diario`
solo junta tablas de `public` — nunca tocaba `auth.users` (emails,
contraseñas hasheadas, factores MFA). Restaurar las 50 tablas de `public`
a la perfección en un proyecto nuevo dejaba el sistema con **cero logins
funcionando**: `user_roles.user_id` apuntaría a IDs de usuario de Auth que
ya no existen en ningún lado. Corregido: `backup-diario` ahora también junta
`usuariosAuth` (vía `supabase.auth.admin.listUsers`, paginado de a 200) —
por cada cuenta guarda `id`, `email`, `created_at`, `banned_until`,
`user_metadata`, y **solo el tipo** de los factores MFA ya verificados
(nunca el secreto — la Admin API de Supabase no lo expone a nadie, ni
siquiera a `service_role`; esto es información no recuperable bajo ningún
diseño posible).

**El script de restauración — `scripts/restaurar-backup.ts`:** manual,
NO es una Edge Function (una "restaurar" como endpoint HTTP desplegado
sería en sí misma un riesgo de seguridad). Se corre a mano con Deno
instalado aparte, apuntando — vía `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
— al proyecto Supabase **nuevo** que reemplaza al perdido:

```
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxxx \
deno run --allow-net --allow-env --allow-read scripts/restaurar-backup.ts \
  sistemamp-backup-2026-09-11.json.gz
```

Qué hace, en orden:
1. Lee el `.json.gz` (o `.json` ya descomprimido, detecta solo por
   extensión).
2. Lista las cuentas de Auth que ya existen en el proyecto destino y recrea
   (por `email` — nunca por el `user_id` viejo, que no sobrevive) las que
   falten, con una contraseña temporal (mismo generador que `crear-operador`,
   `crypto.getRandomValues`) y `user_metadata.must_change_password: true`
   (mismo mecanismo que el alta normal de un operador).
3. Construye el mapeo `user_id` viejo → nuevo por email, y lo usa para
   remapear `user_roles` antes de insertarla — descarta a propósito el `id`
   autoincremental original de esa tabla (nada más en el sistema lo
   referencia, solo `user_roles.user_id`, así que dejarlo autogenerar de
   nuevo es más simple que pelear con la secuencia).
4. Inserta el resto de las 50 tablas en lotes de 500, en un orden que
   respeta la **única** foreign key real de todo el esquema (confirmado por
   introspección de `information_schema`: `destrabe.idOrdenCompra` →
   `ordenes_compra.id` — todo lo demás usa referencias sueltas por texto,
   no FKs de verdad, así que el orden del resto no importa).
5. Al final imprime un resumen por tabla y la lista de contraseñas
   temporales para avisar directamente a cada persona recreada (no queda en
   ningún log) — quienes tenían MFA activo quedan marcados para que se les
   avise que deben volver a activarlo.

**Qué NO puede recuperar, y por qué:** contraseñas ni secretos de MFA — la
Admin API de Supabase directamente no los expone a nadie. Es una limitación
de la plataforma, no de este script; el flujo de "contraseña temporal +
cambio forzado en el primer login" es lo mismo que ya usa el alta normal de
un operador nuevo.

**Cómo se probó**: las 4 funciones puras (`ordenarTablasParaRestaurar`,
`construirMapaDeIds`, `remapearUserRoles`, `enLotes`) tienen tests
unitarios, y además `ejecutarRestauracion` (la orquestación completa:
recrear cuentas, remapear `user_roles`, insertar en orden FK-safe) se
probó de punta a punta contra un cliente Supabase admin **falso** que
imita fielmente `auth.admin.listUsers/createUser` y `.from().insert()` —
cubre usuario ya existente (no se recrea), usuario faltante (se recrea con
contraseña temporal y marca de MFA), remapeo de `user_roles` por email,
orden `ordenes_compra` antes de `destrabe`, y un error de insert en una
tabla que no corta la restauración del resto. 20 tests en
`scripts/restaurar-backup.test.ts`, corridos con el mismo runner que las
Edge Functions (ver sección 13, "Tests Deno").

**Prueba real contra infraestructura (2026-09-11):** el entorno de
desarrollo no tiene salida de red hacia `*.supabase.co` (política de la
plataforma), así que la ejecución real del script la corrió el usuario en
su propia máquina (Windows, PowerShell + Deno instalado local) contra el
proyecto real y vacío de sistema-mp2 (`mzboxosxbaqtysuqdohj`, 0 datos
reales — el único lugar seguro para probar esto de verdad), con un
respaldo sintético de 2 tablas (`equipos`, `user_roles`) y 2 cuentas: una
que ya existía en el destino (no debía recrearse) y una ficticia nueva
(debía recrearse con contraseña temporal y marca de MFA). Resultado,
verificado con SQL real después de la corrida:
- La cuenta ya existente **no** se recreó (comportamiento correcto).
- La cuenta ficticia se creó de verdad en `auth.users`, vía la Admin API
  real (no simulada), con contraseña temporal y `must_change_password:
  true`.
- `user_roles` se remapeó al **ID nuevo real** generado por Supabase al
  crear la cuenta (no al ID ficticio del respaldo), y con un `id`
  autoincremental fresco (no el original) — exactamente el comportamiento
  documentado arriba.
- `equipos` insertó la fila de prueba sin errores.

Fue la primera ejecución del script contra un proyecto Supabase real, y
funcionó sin necesitar ningún ajuste al código. Los 3 registros de prueba
se limpiaron después (vía SQL) y el proyecto volvió a su estado original.
De paso se confirmó que el nuevo esquema de API keys de Supabase (`secret
key`, prefijo `sb_secret_...`, reemplazo del `service_role` JWT clásico)
funciona sin cambios con `createClient()` de `supabase-js` — no hizo falta
tocar el script para usarlo.

**3. Seis columnas (y un índice) tampoco tenían migración propia — hallazgo
de una auditoría completa (2026-09-14).** El fix del punto 1 arriba cubría
tablas enteras creadas a mano, pero no columnas sueltas agregadas después a
tablas que sí existían en el repo. Comparando `mcp__Supabase__list_migrations`
(71 migraciones aplicadas en la base real) contra los 57 archivos locales,
aparecieron 14 nombres sin archivo correspondiente: 2 ya quedaban cubiertas
por el fix del punto 1, 1 resultó duplicada sin columnas nuevas, 5
(`cargar_whatsapp_equipos_batch_00`..`04`) fueron cargas de **datos**
históricos reales (no de esquema — no se reconstruyen para no arriesgarse a
inventar su contenido exacto; ya están cubiertas por el backup diario +
restauración de arriba) y las 6 restantes sí eran columnas reales en uso,
verificadas contra `information_schema.columns` antes de escribir nada:
`configuracion.alertaEmails`/`presupuestoMensual`, `correctivos.fotos`/
`primeraAtencionEn`, `sensores_neumaticos.horomInstalacion`/`horasAcum`, y
el índice `idx_destrabe_id_orden_compra`. Corregido en
`supabase/migrations/20260914060000_formaliza_columnas_creadas_a_mano.sql`
(mismo patrón `ADD COLUMN IF NOT EXISTS`/`CREATE INDEX IF NOT EXISTS`,
no-op comprobado en ambos proyectos reales, donde ya existían).

### 10. Papelera (soft-delete con recuperación)

Nada se borra de golpe. Al eliminar cualquier fila (un equipo, un registro
de PM, stock, una orden de trabajo, etc.), el sistema primero la mueve a
una tabla `papelera` — con qué categoría era, quién la eliminó y cuándo —
y recién ahí la saca de la tabla original. Queda recuperable desde
Configuración → Papelera durante 30 días antes de purgarse en serio.
`_moverAPapelera` y `_purgarPapeleraVieja` viven en `modules/store.js`
(lógica de datos pura, sin DOM — mismo criterio que `logic.js`, testeable
con Vitest sin arrancar la app); la pantalla de recuperación
(`modules/renders/papelera.js`) sigue el mismo patrón que el resto de las
pestañas.

**Dos capas de purga, no una (2026-09-14)**: `_purgarPapeleraVieja()` corre
del lado del cliente una vez al arrancar la app (`_arrancar()`,
`index.html`) — pero eso significa que si nadie abre el sistema por un
tiempo, la papelera no se poda (una auditoría externa lo señaló como hueco
real: no había ningún mecanismo del lado del servidor, a diferencia de
`uso_pestanas`, que sí tenía su propio cron desde que se creó). Se agregó
`purgar-papelera` (`pg_cron`, mismo mecanismo que ya usa
`purgar-uso-pestanas`): un `DELETE` diario a las 6am UTC contra filas con
más de 30 días, corriendo dentro de Postgres — sin depender de que alguien
abra la app, y sin que esa persona tenga que bajarse toda la tabla primero
solo para podarla.

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

### 12. Canal de reportes por WhatsApp/Correo (entrada)

A diferencia de Sentry o `backup-diario` (que son de *salida*, el sistema
avisando algo), `whatsapp-webhook` y `email-webhook` son de *entrada*: un
técnico le escribe al número de WhatsApp Business de Twilio o al correo de
recepción de Resend ("CN-9500 fuera de servicio, falla de turbo") y el
mensaje se parsea e inserta directo en `correctivos_historico`, sin que nadie
tenga que copiar el chat a mano.

Seguridad en 2 capas, igual criterio en ambas funciones:
1. **Firma criptográfica del proveedor** (Twilio: HMAC-SHA1 con el Auth
   Token; Resend: formato Svix, HMAC-SHA256) — confirma que el mensaje vino
   de verdad del proveedor, no de alguien que adivinó la URL del webhook.
2. **Lista de remitentes autorizados** (`configuracion.whatsappRemitentesPermitidos`
   / `correoRemitentesPermitidos`, editable en Configuración → "📥 Reporte de
   Fallas por WhatsApp/Correo") — sin al menos un remitente cargado, el canal
   no acepta nada. Un mensaje de un número/correo no autorizado se ignora en
   silencio (no confirma ni niega nada, para no dar pistas).

El parser (`supabase/functions/_shared/parseCorrectivo.ts`) nunca inventa un
dato: si no reconoce el equipo o el mensaje es ambiguo (pregunta, posible PM
programado, sin componente identificable), igual lo inserta pero con
`fuente='… (auto) — revisar'`, visible en Auditoría de Datos para que un
humano lo confirme — nunca se descarta en silencio ni se adivina un
componente que no está en el texto.

> **Bug real (2026-08-21), lección para cualquier Edge Function que verifique
> firmas de webhooks:** la verificación de firma de `whatsapp-webhook` usaba
> `req.url` tal cual lo entrega el runtime de Supabase — pero ese valor es una
> URL **INTERNA** (`http://…/whatsapp-webhook`, sin `/functions/v1`), distinta
> de la URL **PÚBLICA** que Twilio realmente usa para firmar
> (`https://…/functions/v1/whatsapp-webhook`, la configurada en la consola de
> Twilio). La firma nunca podía coincidir, sin importar qué tan correcto
> fuera el Auth Token — varias rotaciones de credencial no solucionaron nada
> porque el problema nunca fue la credencial. Se corrigió fijando la URL
> pública real como constante en el código en vez de confiar en `req.url`.
> Moraleja: si una firma de webhook falla de forma consistente pese a
> credenciales verificadas, sospechar primero de la URL usada para firmar
> antes de rotar secretos.

`whatsapp-webhook` además tiene una segunda pasada con IA (Claude) para los
mensajes que el parser por reglas no logra resolver solo — ver sección 16.

### 13. Seguridad de sesión — inactividad y registro de accesos bloqueados

Caso real (auditoría 2026-08-22): un usuario desactivado seguía con la
pestaña abierta en otro computador, y no había forma de confirmar desde el
sistema si su sesión realmente había quedado sin efecto ni si había
intentado volver a entrar.

**Cierre por inactividad** (`index.html`, sin tabla nueva): a los 55 min sin
`mousemove`/`keydown`/`touchstart`/`scroll` aparece un aviso con cuenta
regresiva; a los 60 min, si nadie interactuó, se llama `_logout()` sola.
100% cliente — no depende de ningún timeout del lado de Supabase Auth (que
sigue siendo el candado real: RLS revisa `es_usuario_activo()` en cada
consulta, así que una cuenta desactivada queda sin acceso a los datos de
inmediato aunque la pestaña siga abierta visualmente). El reloj de "última
actividad" se persiste en `localStorage` (`smp_ultima_actividad`), no solo en
una variable en memoria — bug real reportado por el usuario (2026-08-31):
una pestaña de celular en 2do plano mucho tiempo suele recargarse entera al
volver a abrirla, y con la variable solo en memoria esa recarga reiniciaba
el reloj a "ahora", escondiendo que en realidad habían pasado horas.

**Segundo bug relacionado, distinto (2026-09-07):** un equipo de escritorio
que se DUERME (sin recargar la pestaña) tampoco disparaba el cierre al
despertar. El gesto físico de despertarlo (mover el mouse, tocar una tecla)
cuenta como "actividad" y reseteaba el reloj de inactividad ANTES de que el
chequeo periódico (cada 5s) alcanzara a notar que en realidad había pasado
más de una hora dormido — el evento de "actividad" ganaba la carrera contra
el chequeo. Se agregó `_ultimoTick`, una brecha de tiempo independiente
medida en memoria (sin depender de ningún evento de usuario): si entre dos
chequeos consecutivos pasó más tiempo real del esperado, es señal de que el
intervalo estuvo suspendido ese tiempo, sin importar qué evento del sistema
operativo se procese primero al reanudarse.

**Registro de intentos bloqueados** (`registrar-intento-acceso`, Edge
Function nueva): hasta ahora `changelog` solo se llenaba con logins
*exitosos* (`_registrarLogin`, llamado con el token recién obtenido). Un
intento fallido — clave incorrecta, cuenta baneada, o una sesión vieja que
no logra renovarse al recargar — no tiene ningún token de usuario válido con
el que insertar, y la política RLS de `changelog` exige `to authenticated`
(ver sección de RLS más arriba). Se resolvió con el mismo patrón que
`crear-operador`: una función aparte con `SUPABASE_SERVICE_ROLE_KEY` que
inserta saltándose RLS.

Decisión de diseño no obvia: la función se dejó con `verify_jwt=true` (el
default seguro), no con `verify_jwt=false`. El cliente le manda la **anon
key** como `Authorization: Bearer` — eso es un JWT válido firmado por el
proyecto (pasa el gateway) aunque no represente a ningún usuario real. Es el
mismo truco que ya usan endpoints "públicos" de Supabase en general; evita
tener que desactivar la verificación de JWT (que si algún día esa función
creciera y alguien copiara el patrón sin pensarlo, quedaría un endpoint
abierto sin ningún control).

Deliberadamente no distingue "clave incorrecta" de "cuenta bloqueada":
Supabase Auth devuelve el mismo error genérico para ambos casos (no le
filtra a un atacante si una cuenta existe o está baneada), así que tampoco
se puede — ni se debe — distinguir del lado del cliente.

**Tests Deno** (2026-09-10, empezó con `registrar-intento-acceso`, extendido
el mismo día a las 11 Edge Functions restantes + `_shared/parseCorrectivo.ts`):
antes de esto, TODA la lógica que corre en Deno (no solo la de seguridad)
estaba sin ningún test automatizado — Vitest no sirve acá porque estos
archivos corren en el runtime de Deno (Edge Functions), no en Node/navegador.
Cada archivo sigue el mismo patrón: se exportan sus funciones puras (sin
tocar red/DB) y `Deno.serve(...)` se envuelve en
`if (import.meta.main) { ... }` — sin este guard, el solo hecho de
*importar* el archivo desde el test (para llegar a sus funciones
exportadas) levantaba un servidor HTTP real como efecto secundario;
`import.meta.main` es `true` solo cuando Deno ejecuta el archivo
directamente (el caso real en producción/Supabase Edge Runtime), `false`
cuando otro módulo lo importa. `deno.json` en la raíz del repo
(`{"nodeModulesDir": "auto"}`) resuelve los imports `npm:@supabase/supabase-js`
y `jsr:@supabase/functions-js` de estos archivos.

Qué cubre cada uno (140 tests en total):
- `crear-operador`: `randomPassword`/`randomIndex` (política de clave real
  vía `crypto.getRandomValues`, no `Math.random`) y `rolValido`.
- `avisar-dispositivo-nuevo`: las 3 señales de "actividad inusual"
  (dispositivo nuevo, horario fuera de patrón, varios dispositivos nuevos
  en 7 días) extraídas a funciones puras que toman el historial como
  parámetro, más `horaChile`.
- `avisar-salud-equipo`: normalización del motivo, clave de dedup, y el
  armado de los textos de aviso.
- `email-webhook`: `verificarFirmaResend` (HMAC-SHA256 estilo Svix,
  probado con una firma real calculada en el propio test, no un valor
  mágico) y `htmlATexto`.
- `whatsapp-webhook`: el parser por reglas completo (`resolverSigla`,
  `clasificarComponente`, detección de pregunta/mantención programada/
  horómetro) y `verificarFirmaTwilio` (HMAC-SHA1). Incluye un test que
  compara su `CATEGORIAS_VALIDAS` contra `_shared/parseCorrectivo.ts`
  byte a byte — este archivo trae su propia copia inlineada del parser
  (Deno Deploy no resolvía el import cruzado de forma confiable) y ya se
  desincronizó una vez en producción ("Bug real #2", ver comentario en el
  propio archivo); el test lo vuelve a romper en CI si pasa de nuevo.
  `tests/sincroniaComponenteBackend.test.js` (Vitest, ya existente) hace el
  chequeo complementario: compara esta misma lista contra `logic.js`
  directamente, así como la de `alerta-pm` y `_shared/parseCorrectivo.ts`.
- `alerta-pm`: `calcStockEstado`/`calcVencEstado` (misma fórmula que
  `logic.js`), `componenteDeSintoma`, `diasEntreISO`.
- `resumen-semanal`: `pctDelta` (sin dividir por cero cuando la semana
  anterior fue 0), `moneda`, `iso`.
- `backup-diario`: `traerTodasLasFilas` probada con un cliente Supabase
  falso (verifica la paginación real de a 500 filas, no solo que "el
  código compile"), guardarraíles sobre `TABLAS` (sin duplicados, incluye
  las 7 tablas que la auditoría 2026-09-07 encontró faltando), y — sumado
  2026-09-11 tras la investigación de restaurabilidad (sección 9b) —
  `resumirUsuarioAuth`/`traerTodosLosUsuariosAuth` (nunca incluyen
  contraseña ni secreto MFA, solo cuentan factores verificados, paginado
  con el mismo tope defensivo de 50 páginas que `buscarUserIdPorEmail`).
- `leer-pauta-pm`/`leer-informe-correctivo`/`leer-chequeo-neumaticos`: solo
  la validación de `imagenBase64` (falta/tamaño) — son wrappers finos sobre
  Gemini, el grueso de su comportamiento ya lo cubre el flujo de OCR en
  `tests/e2e/ocr.spec.js` (mockeado).
- `scripts/restaurar-backup.ts` (2026-09-11, ver sección 9b): las 4
  funciones puras de orden/remapeo/loteo, más `ejecutarRestauracion` (el
  flujo completo) contra un cliente Supabase admin falso — 20 tests.

Se corren con:
```
deno test --allow-net --allow-env --no-check --config deno.json \
  supabase/functions/ scripts/
```
Para correrlos localmente hace falta tener Deno instalado aparte — **no**
se agregó como dependencia de este proyecto npm (el paquete `deno-bin`,
la única forma práctica de obtener un binario de Deno vía npm, trae 2
vulnerabilidades HIGH transitivas por `adm-zip`, lo que habría roto el
estándar de "0 vulnerabilidades" de `npm audit` recién alcanzado esta
sesión). **En CI sí corren** (`.github/workflows/tests.yml`, después de
`npm audit`): se instala Deno ahí con la acción oficial
`denoland/setup-deno` (no vía npm, así que no afecta el audit del
proyecto), fijada a la misma versión (2.2.7) usada para verificar estos
tests localmente. `deno.lock` va commiteado para que la resolución de
`npm:`/`jsr:` sea determinística.

### 14. Lectura de papeles por foto — OCR con Gemini (2026-08-25)

3 Edge Functions (`leer-pauta-pm`, `leer-informe-correctivo`,
`leer-chequeo-neumaticos`) le sacan una foto a un papel firmado en terreno
(pauta de PM programada, informe de correctivo de taller, o chequeo diario
de neumáticos) y devuelven los campos como JSON estructurado, para
prellenar el formulario correspondiente en vez de tipear todo a mano.
Nacieron de una tarea real de esta sesión: 7 pautas firmadas en PDF que
había que leer y tipear una por una, incluyendo un caso de letra ambigua
(horómetro que podía leerse de dos formas distintas).

**Nunca escriben directo a producción**: solo prellenan el formulario (el
usuario sigue apretando Guardar) — mismo principio de "no inventar" que ya
sigue `parseCorrectivo.ts` (sección 12). Cada respuesta incluye
`camposInciertos`, que marca en amarillo qué campo conviene revisar con más
cuidado antes de confirmar, en vez de asumir que la lectura automática
siempre acertó.

**Modelo**: `gemini-3.6-flash` (Google Generative Language API, llamada
directo por HTTP — sin SDK). `gemini-2.5-flash` quedó deprecado para llaves
nuevas, probado en vivo el 2026-08-25 al desplegar la primera de las tres.

**Por qué Gemini y no otro proveedor**: `GEMINI_API_KEY` es una cuenta
separada de la de Claude.ai del usuario (Google AI Studio, con nivel
gratuito propio) — se eligió específicamente porque no requería medio de
pago para partir.

**Seguridad**: `verify_jwt=true` (el default seguro) ya exige un usuario
logueado real antes de que el código corra — no hace falta validar el
token de nuevo adentro, a diferencia de `crear-operador` (que además
necesita confirmar que el usuario es admin; acá cualquiera que puede usar
la pestaña correspondiente puede usar el OCR).

### 15. Alertas de seguridad de cuenta (2026-09-01/02)

Tres capacidades nuevas, todas leyendo el mismo historial que ya existía en
`changelog` (`accion='Login'`/`'Login bloqueado'`) — ninguna crea
infraestructura de rastreo nueva.

**`avisar-dispositivo-nuevo`** (`verify_jwt=true`, disparada por el cliente
justo después de un login exitoso, best-effort — nunca bloquea el login si
falla): trae el historial de logins de la cuenta (60 días, una sola
consulta) y evalúa 3 señales sobre esos mismos datos:
- dispositivo nunca visto antes,
- horario fuera del patrón histórico de esa cuenta (mínimo 5 logins previos
  para tener base, margen ±1 hora),
- 3+ dispositivos nuevos distintos en los últimos 7 días.

Si dispara más de una señal a la vez, un solo correo/WhatsApp las lista
todas juntas. Reutiliza los secrets ya existentes de `alerta-pm`/`resumen-
semanal` (`RESEND_API_KEY`, `TWILIO_*`).

Simplificación consciente: el historial se filtra por `usuario` = el email
de la cuenta, pero `changelog.usuario` a veces guarda el email y a veces el
nombre visible (según en qué momento del login se escribió) — un
dispositivo ya visto podría, en un caso raro, volver a contar como "nuevo".
Se prefiere avisar de más a quedarse callado: el costo de un falso positivo
es un correo de más, no un riesgo de seguridad.

**`registrar-intento-acceso`** (ya existía para dejar constancia de logins
fallidos, sección 13) se extendió con detección de ráfaga: tras cada
intento bloqueado, cuenta cuántos lleva esa cuenta en los últimos 15
minutos — al llegar exactamente a 5, avisa por correo/WhatsApp (posible
fuerza bruta) y bloquea la cuenta 15 minutos (`ban_duration`, ver sección
11). Avisa solo al CRUZAR el umbral, no en cada intento posterior, para no
saturar si el ataque sigue.

**Fix real (auditoría de seguridad, 2026-09-08):** este endpoint es público
a propósito (sin sesión) y hasta esta fecha confiaba ciegamente en el email
que mandaba el cliente para contar la ráfaga — cualquiera podía golpearlo 5
veces con el correo de un admin conocido, sin saber su clave, y dejarlo
bloqueado 15 minutos repetidamente, sin pasar por ningún navegador real.
Ahora, si hay una `turnstile_secret_key` cargada en Vault, cada intento
debe venir con un `captchaToken` válido (verificado server-side contra
`challenges.cloudflare.com/turnstile/v0/siteverify`) para que CUENTE hacia
el umbral — un script que golpee el endpoint directo con curl ya no logra
acumular intentos ni disparar el bloqueo. El token del widget del login se
gasta en el login mismo (Turnstile es de un solo uso); el cliente resetea
ese mismo widget y espera hasta 4s un token nuevo antes de registrar el
intento, sin bloquear el mensaje de error que ya ve el usuario. Sin
`turnstile_secret_key` configurada, se mantiene el comportamiento de
siempre (mismo criterio de "opcional hasta que se configure a propósito"
que usa el resto del sistema) — ver sección 18 para el resto del mecanismo
de CAPTCHA.

**Marca 🆕 en pantalla** (`Configuración → Accesos recientes`,
`modules/renders/cfg.js`): reproduce en el cliente, sobre el historial
COMPLETO de la cuenta (no solo las 60 filas visibles en pantalla), la misma
definición de "dispositivo nuevo" que usa la Edge Function — primera
aparición cronológica de cada dispositivo distinto. Cálculo puramente
client-side, sin llamada nueva a Supabase.

**Vencimiento de contraseña**: la fecha del último cambio real se guarda en
`user_metadata.passwordChangedAt` (GoTrue/Supabase Auth no trae esto de
fábrica), estampada en cada cambio exitoso de clave. A los 80 días, aviso
blando; a los 90, cambio obligatorio al iniciar sesión (mismo mecanismo que
"primer ingreso", `must_change_password`). Cuentas que cambiaron su clave
antes de que existiera este campo usan `created_at` como respaldo. Un
cambio voluntario (Configuración → Mi contraseña) es la única variante de
la pantalla de cambio con botón "Cancelar" — las otras tres (primer
ingreso, recuperación, vencida) son flujos que deben completarse sí o sí.

### 16. Segunda pasada con IA en el parser de WhatsApp (2026-09-02)

`whatsapp-webhook` (sección 12) llama a Claude (`claude-haiku-4-5-20251001`)
como respaldo del parser por reglas, solo cuando éste no resuelve el
mensaje con confianza — nunca como primera opción, para no pagar el costo
de una llamada a la API en cada mensaje cuando el parser por reglas ya
resuelve bien la mayoría (validado a mano sobre 8 meses de historial real).

La IA recibe como contexto la lista real de siglas de equipo (`equipos`) y
las categorías de componente válidas, y usa `tool_choice` forzado (tool-use
de la API de Anthropic) para devolver JSON estructurado en vez de texto
libre a interpretar. Su salida se valida siempre contra esas mismas listas
antes de usarse — si sugiere una sigla o categoría que no está en ellas, se
descarta, igual que haría el parser por reglas. Requiere el secret
`ANTHROPIC_API_KEY`; sin él, `interpretarConIA()` devuelve `null` de
inmediato y el comportamiento es idéntico al de solo-reglas.

`whatsapp-webhook` quedó **autocontenido** (todo el parser + la llamada a
la IA inlineados en su propio `index.ts`, sin `import` a `../_shared/`) —
mismo criterio que el resto de las Edge Functions de este proyecto. Esto
fue, de hecho, la causa de un bug real descubierto al hacer este cambio:
ver la nota en [`manual-admin.md`](./manual-admin.md), sección 6.

### 17. Sistema de íconos SVG (reemplazo de emoji, 2026-09-07)

`index.html` define un registro `const ICONS={...}` (~50 entradas) de SVG en
línea con trazo consistente (`viewBox="0 0 20 20"`, `stroke="currentColor"`),
usado como `ICONS.nombre` desde cualquier módulo de `modules/renders/` —
sin `import`, porque `ICONS` es una constante de nivel superior de un
`<script>` clásico (no un módulo), y ese ámbito léxico global es compartido
con los módulos ES cargados en la misma página (mismo patrón ya usado para
otras funciones/constantes de `index.html`). Reemplaza emoji sueltos usados
como ícono de botón/título/tarjeta — un emoji renderiza distinto según
sistema operativo/fuente instalada, a veces como un cuadrado vacío.

**Regla dura, nunca romper**: un emoji que además es un VALOR DE DATO real
(🔴/🟡/🟢/⚪/🔵/🟠 en `riesgoNivel`, `prioridad`, estado OK/NOK de
inspecciones, guardado en la base y comparado por código — incluida la Edge
Function `resumen-semanal`) y el marcador `💻` (que `cfg.js` y
`avisar-dispositivo-nuevo` extraen de `detalle` con una regex) **no se
tocan nunca** — no son un ícono de interfaz, son datos.

**Gotcha real encontrado en la migración (2026-09-07): no todo destino
soporta HTML.** Varios reemplazos de emoji→`ICONS.xxx` se hicieron a ciegas
dentro de sitios que en realidad solo aceptan texto plano, y el ícono SVG
quedó mostrándose como el código fuente crudo en vez de renderizar:

- **`toast(m)` usa `element.textContent=m`, no `innerHTML`** — nunca
  soportó HTML. Cualquier ícono dentro de un `toast(...)` debe seguir
  siendo emoji.
- **`<option>` solo soporta texto**, no elementos hijos — un `<svg>` dentro
  de una opción de `<select>` se ve como espacio vacío, no un ícono.
- `alert()` / `confirm()` del navegador son diálogos nativos de solo texto.
- Asignar por `element.textContent=...` (a diferencia de `.innerHTML=...`)
  tampoco interpreta HTML.

Los correos y mensajes de WhatsApp que mandan las Edge Functions tienen la
misma restricción (sin motor HTML/CSS confiable del lado del cliente de
correo/WhatsApp) — ahí el emoji sigue siendo la elección técnicamente
correcta, no un descuido.

### 18. CAPTCHA del login — Cloudflare Turnstile (2026-09-04, activado 2026-09-08)

Widget de Cloudflare Turnstile en login y recuperación de contraseña,
validado server-side por Supabase Auth (GoTrue) vía
`gotrue_meta_security.captcha_token` — no se construyó verificación propia,
se usa el soporte nativo de Supabase para CAPTCHA.

`_TURNSTILE_SITE_KEY` (`modules/store.js`) es la clave pública, incrustada
en el HTML a propósito (así funciona una site key, a diferencia de la
Secret Key que solo vive en la config de Supabase Auth). Mientras esté
vacía, `_renderTurnstileEn()` no dibuja nada y el login sigue funcionando
exactamente igual que sin CAPTCHA — nunca es un requisito por accidente.
Un solo widget (`_turnstileWidgetId`/`_turnstileToken`) se comparte entre
login y recuperación porque nunca están abiertas a la vez; los tokens son
de un solo uso, así que `_resetTurnstile()` pide uno nuevo tras cualquier
intento fallido. El script de Cloudflare se carga por CDN (`async defer`),
no vendorizado como Sentry/jspdf/qrcode/xlsx — el widget necesita hablar en
vivo con los servidores de Cloudflare para el desafío, un archivo estático
no sirve. `vercel.json` permite `challenges.cloudflare.com` en la CSP
(`script-src`, `connect-src`, `frame-src`).

**Cada dominio necesita su propio widget de Cloudflare** (Site Key +
Secret Key, generadas juntas al crearlo) — la Site Key queda atada al
hostname declarado, así que no sirve copiar la de otra instancia sin crear
un widget nuevo apuntando al dominio real de esta. Activado y probado en
vivo (widget se resuelve solo, login funciona) el 2026-09-08 — ver
[`manual-admin.md`](./manual-admin.md), sección 3, para el paso de
configuración en el dashboard de Supabase (Attack Protection).

### 19. Estadística — comparativas de flota y Pareto de fallas (2026-08-31, extendido 2026-09-11)

Sub-pestaña de Componentes (`modules/renders/estadistica.js`) con 5 vistas
sobre el mismo conjunto de fallas combinadas (correctivos actuales +
`otHist`, historial 2022-2025 cargado desde Excel): Por Equipo, Por
Componente, Por Modo de Falla, Por Modelo, Por Técnico. Nace de un pedido
directo del usuario ("nuestro programa tiene predictivo, probabilidad y
destrabe, pero estadística no lo tiene") y consolida cálculos que antes
vivían dispersos en ventanas emergentes de Correctivos (`ot.js`).

**Pareto de fallas**: la vista "Por Modo de Falla" ya aplicaba el
tratamiento completo de Pareto (RCM 101 — de todos los modos de falla,
¿cuáles pocos explican la mayoría?): % del total, barra, % acumulado, y la
marca ⭐ de "pocos vitales" (los primeros que juntos explican el 80% del
total). Las vistas "Por Equipo" ("Bad Actors") y "Por Componente" ya
rankeaban por cantidad de fallas, pero sin ese tratamiento — se veía "quién
falla más" pero no "estos pocos equipos/componentes concentran el 80% de
las fallas de la flota". Extendido el 2026-09-11: se generalizó el cálculo
inline de la vista de Modo de Falla a una función pura nueva,
`paretoAcumulado(lista, campo)` (`logic.js`) — ordena descendente por el
campo de conteo, calcula %/acumulado/vital sin mutar la entrada, cualquier
grupo de "conteo por categoría" puede reusarla — y se aplicó también a
Equipo y Componente, con el mismo estilo visual (barra + fila resaltada
para los ⭐ vitales).

Detalle no obvio en "Por Equipo": el Pareto se calcula sobre TODA la
flota, `.slice(0, 25)` recién DESPUÉS — si se recortara antes, el %/
acumulado quedaría relativo solo a los 25 mostrados (como si fueran el
100% de las fallas), no a la flota completa.

Probado con Vitest (`tests/paretoAcumulado.test.js`, 8 casos: orden, %,
acumulado, marca vital en el borde del 80%, barra relativa al máximo, lista
vacía, campo de conteo configurable, no descarta campos originales) y
verificado visualmente en navegador (Playwright ad-hoc con datos
sintéticos, no parte de la suite permanente): ambas tablas muestran las
columnas nuevas, la barra y la marca ⭐ correctamente.

**Criticidad de equipo (RCM) — ya existía, nunca se cargó (hallazgo
2026-09-11):** al investigar si faltaba una clasificación de criticidad
por equipo (A/B/C, para priorizar PM/stock/respuesta según qué tan clave es
cada activo), se encontró que **ya existe completa**:
`equipos.criticidad` (dropdown Crítico/Esencial/General en Ficha Técnica,
`eq.js`, solo-admin vía `proteger_columnas_admin`) y un consumidor real
(Backlog Inteligente, `pred.js`: un correctivo pendiente en un equipo
"Crítico" pesa más que uno en un equipo de apoyo). El problema no era de
código: una auditoría anterior (2026-08-27, comentario en `pred.js`) ya
había encontrado que el campo estaba `NULL` para los 35 equipos reales de
Besalco — la clasificación nunca se cargó, así que ese consumidor no tenía
ningún efecto real en la práctica. De paso se encontró y corrigió un chequeo
muerto (`eqInfoB.criticidad==='Crítico'||eqInfoB.criticidad==='Alta'` —
`'Alta'` no es una opción posible del dropdown, nunca podía matchear).

Se agregó `equiposSinCriticidad(eq)` (`logic.js`, función pura, probada en
`tests/equiposSinCriticidad.test.js`) y un aviso en la vista "Backlog
Inteligente" que dice cuántos equipos siguen sin clasificar — mismo
criterio que el aviso de "Sin clasificar" del Pareto de Modo de Falla — para
que dejar de cargar este dato deje de ser invisible. No se tocó el esquema
ni la UI de carga (ya existían); esto es puramente un aviso de adopción.

**Cargado (2026-09-14)**: el usuario confirmó una clasificación por tipo de
equipo, reusando el mismo criterio "pesados/producción vs. livianos/apoyo"
que ya usa Dotación de Taller — Camión/Cargador Frontal/Bulldozer/
Motoniveladora → Crítico (19 equipos), Camión Aljibe → Esencial (2),
Camioneta/Bus/Generador/Minicargador/Torre Iluminación → General (14).
Cargado con un `UPDATE` directo (no una migración: es dato real específico
de la flota de Besalco, no un cambio de esquema/comportamiento reutilizable
en otro proyecto) contra los 35 equipos reales, deshabilitando
momentáneamente el trigger `proteger_columnas_admin` (exige rol admin
autenticado vía `auth.uid()`, que no existe en una sesión SQL directa) y
reactivándolo de inmediato después. Verificado: 0 equipos sin clasificar.

### 20. Selector de fecha exacta en el Dashboard + aviso "En vivo" (2026-09-11)

Origen real (conversación con el usuario, mirando el popup de Torre de
Control): "no me dice de qué fecha es el Score de Salud" → al investigar,
el Dashboard sí tenía un selector de Mes/Año que reconstruye varias
secciones (Disponibilidad, Urgentes/Próximas, Confiabilidad, Costos) desde
el historial — pero **siempre resolvía al último día del mes elegido**, sin
poder pedir un día puntual, y encima **varias secciones (Mapa de Salud,
Equipos con Salud Baja, Stock Crítico, Backlog, Criticidad, Dotación) son
siempre "ahora mismo"**, sin decirlo — así que alguien viendo "Mostrando:
Agosto 2026" arriba podía asumir que TODO el tablero era de agosto, cuando
la mitad seguía siendo el estado actual.

**Selector de fecha exacta** (`dash.js`): se agrega `window._dashDia`
(día exacto elegido, o `null` = "todo el mes", el comportamiento de
siempre — Gasto/Ejecuciones/Cumplimiento PM del mes siguen intactos, no se
tocó su semántica mensual). Tres formas de fijar una fecha puntual:
- Botones **Ayer** / **Año pasado** (mismo día y mes, un año atrás) —
  atajos que resuelven la fecha con dos funciones puras nuevas en
  `logic.js`, `fechaAyer(hoyISO)` y `fechaMismoDiaAnioPasado(hoyISO)`
  (`tests/fechaAtajos.test.js`, 7 casos: cruce de mes, cruce de año, 29 de
  febrero bisiesto).
- Un `<input type="date">` (`dashSetFecha()`) para elegir cualquier día.
- El botón **Hoy** vuelve al modo dinámico de siempre (sigue siendo "hoy"
  cada día, sin fijar nada).

La condición de "¿esto es en vivo o reconstruido?" pasó de `esMesActual`
(el MES coincide con el actual) a `enVivo` (la FECHA exacta coincide con
hoy, cuando hay una fecha exacta elegida) — así "Ayer" (que casi siempre
cae dentro del mes actual) se reconstruye de verdad desde
`historial_horometros` en vez de mostrarse como si fuera "ahora" solo
porque el mes coincide. `esMesActual` se sigue usando tal cual cuando no
hay día exacto (compatibilidad total con el comportamiento anterior).

**Aviso "● EN VIVO"**: badge verde agregado al título de los bloques que
nunca cambian con el selector (Mapa de Salud, Equipos con Salud Baja,
Stock Crítico, Backlog, Criticidad, Dotación), para que se distingan de un
vistazo de los que sí respetan la fecha elegida. Mismo aviso, con fecha y
hora exactas del cálculo, en el drawer de Torre de Control (`torre.js`,
`#torreDCalculado`) — el punto de partida real de esta conversación.

Verificado visualmente en navegador (Playwright ad-hoc con datos
sintéticos): los atajos cambian correctamente el label ("Ayer" → fecha de
ayer, "Año pasado" → mismo día del año anterior), el input de fecha se
sincroniza, "Hoy" vuelve a vaciar todo, y los badges aparecen exactamente
donde corresponde (ninguno en las tarjetas que sí varían con el período).

**Segunda pasada, mismo día**: el usuario señaló el "Resumen rápido
lateral" del Dashboard (Flota / HH Acumuladas / Al Día / Riesgo Alto), con
la misma pregunta. Se revisó cada tarjeta:
- **Flota** (`eq.length`) y **🔴 Riesgo Alto** (`compRiesgoAlto`, lectura
  directa del `riesgoNivel` ya calculado y guardado por `comp.js` — nunca
  se recalcula acá) son siempre el estado actual → se les agregó el mismo
  badge "● EN VIVO".
- **HH Acumuladas** (`hhTotal`/`reg.length`) es un acumulado histórico
  TOTAL (`reg.reduce(...)` sobre todos los registros, sin filtro de fecha)
  → mismo caso, badge agregado.
- **Al Día** (`alDia.length`) usa el mismo arreglo `alDia` que ya se
  reconstruye correctamente dentro del bloque `enVivo`/histórico de más
  arriba (Urgentes/Próximas) → **no necesitaba cambio**, ya respeta la
  fecha elegida.
- Se revisaron también las 4 tarjetas de Confiabilidad/Costos (% Flota sin
  falla, Confiabilidad (R), Retrabajo, Costo/RAV): todas filtran
  explícitamente por `dashPeriodo` (el mes elegido) y sus propios
  subtítulos dicen "en el período" → **ya eran correctas, sin badge
  necesario** (el badge es solo para lo que NUNCA cambia con el selector).

Con esto, el badge "● EN VIVO" queda en 9 bloques del Dashboard (los 6
originales + Flota, HH Acumuladas y Riesgo Alto).

**Tercera pasada, mismo día**: el usuario mostró el encabezado global de la
app (`index.html`, `renderHeader()`, el bloque `#hs` visible en TODAS las
pestañas, ya existente desde antes de esta conversación, ya rotulado "Flota
en vivo — no cambia con la pestaña") junto al Dashboard, y señaló dos
cosas: que la tarjeta "Flota" del resumen lateral repite el mismo total de
equipos que ya está siempre arriba (se decidió con el usuario dejarla así,
ya que también aporta el desglose por tipo de equipo que el encabezado no
tiene), y que 3 tarjetas del bloque de Costos (Costo/RAV, Disp. Inherente,
Retrabajo) mostraban un guión grande "—" con la explicación en letra
gris de 8px — a simple vista parecían vacías/rotas en vez de "sin dato
aún". Se agrandó y aclaró ese texto (10px, `var(--tx2)` en vez de
`var(--tx3)`, texto tipo "Sin dato aún · falta cargar el valor de compra")
solo en el estado vacío — el estado con dato real no cambió.

### 21. Reordenamiento del Dashboard en 3 secciones numeradas (2026-09-11)

Origen real: después de las 3 pasadas de "aviso En vivo"/textos claros de
arriba, el usuario insistió en que el problema no era falta de claridad
puntual sino desorden general — "es difícil de entender y está
desordenado" — y mandó dos referencias visuales (capturas de dashboards de
otros sistemas) mostrando secciones numeradas con título real, tarjetas con
jerarquía de tamaño, y un mapa de calor real por equipo en vez de solo
contadores agregados.

**Diagnóstico concreto, no solo "hay mucho"**: revisando el propio código
aparecieron dos colisiones de nombre reales en la misma pantalla —
"Cumplimiento PM" se usaba para dos cálculos distintos (% de equipos Al Día
ahora, dentro del Índice de Salud, vs. % de PMs ejecutados a tiempo este
mes, en la grilla de KPIs) y "Backlog" también (cantidad de OTs pendientes
en la grilla de KPIs vs. semanas de atraso en Costos y Stock) — mismo
nombre, cálculos y unidades distintas, en la misma pantalla.

**Cambios** (`index.html`, `modules/renders/dash.js`), sin tocar ningún
cálculo existente — puramente reordenamiento/etiquetado:
- Clases CSS nuevas `.dash-sec`/`.dash-sec-head`/`.dash-sec-num`/
  `.dash-sec-title`/`.dash-sec-sub` (`index.html`) para encabezados de
  sección reales: número en círculo, título, bajada explicativa, línea
  divisoria — antes no existía ningún separador visual entre bloques
  temáticamente distintos, solo cajas grises apiladas sin fin.
- El Dashboard se reagrupa en 3 secciones narrativas vía un helper interno
  `_dashSeccion()`: **1) Equipos que Requieren Atención Ahora** (tabla de
  urgentes + Próximos PMs), **2) Salud General de la Flota** (Índice de
  Salud, Disponibilidad, Mapa de Salud, Equipos con Salud Baja, KPIs de
  Costos y Stock), **3) Tendencias y Análisis** (los 4 gráficos existentes).
  Cada bloque interno sigue siendo exactamente el mismo HTML/cálculo de
  antes, con los mismos toggles de `dashBloques` — el helper solo envuelve.
- La fila de botones "mostrar/ocultar secciones" (que el usuario confundía
  con pestañas de navegación real, por estar pegada justo debajo de la
  barra de pestañas) se hizo notoriamente más chica/apagada y con el
  prefijo "Mostrar:" para separarla visualmente de la navegación real.
- "Mapa de Salud de la Flota": de 4 numeritos del mismo tamaño pasó a 3
  tarjetas grandes con fondo de color (Crítica/Advertencia/Salud buena,
  mismos umbrales de siempre) más una grilla nueva de un cuadrado por
  equipo (coloreado por banda, clic lleva a su ficha en Buscar) — mismo
  patrón visual "mapa de calor" de las referencias que mandó el usuario,
  con datos 100% reales de `equiposConSaludFlota` (logic.js), sin inventar
  ninguna dimensión nueva.
- Las dos colisiones de nombre: la tarjeta de "Cumplimiento PM" dentro del
  Índice de Salud se renombra (solo en pantalla, el dato `cumplPM` de
  logic.js no cambia de nombre porque también lo usa `kpi.js`) a "Equipos
  al Día"; la tarjeta de conteo de OTs pendientes pasa de "Backlog" a "OTs
  Pendientes", dejando "Backlog" solo para la de semanas de atraso.

**Deliberadamente NO se copió** de las referencias: la columna "Alerta" con
motivo específico por equipo (Aceite Crítico, Vibración Alta, etc.) — hoy
el sistema no calcula un motivo puntual por equipo urgente, solo cuánto le
queda para su PM, y agregar esa columna con datos inventados habría sido
peor que no tenerla. Tampoco se agregó un feed de "Actividad reciente" —
implicaría un log de actividad que no existe todavía en ningún lado del
sistema.

Verificado visualmente en navegador (Playwright ad-hoc, 20 equipos
sintéticos con estados variados): las 3 secciones se ven con su número,
título y línea divisoria; el mapa de calor pinta un cuadrado por equipo; los
nombres ya no chocan entre sí.

### 22. Drawer de Torre de Control: problema principal, recomendación y contexto (2026-09-11)

Origen real: el usuario mostró el drawer de detalle de un equipo (CN-9507,
49.2%, Aceite 16.7%/Confiabilidad 0.2%) y pidió, con una maqueta de texto
detallada, que el drawer diga "por qué" está mal, "qué hacer", y agregue
más contexto y botones de acción — no solo el número y el desglose crudo
que ya mostraba.

**Se construyó con datos 100% reales, nada inventado**:
- `logic.js`: `peoresDimensionesSalud(detalle, max)` (pura, testeada) — las
  1-2 dimensiones más bajas del Score de Salud del equipo, mismo criterio
  de "con dato" que la ya existente `motivoPrincipalSalud` (que da solo la
  peor; esta da varias). `recomendacionDimensionSalud(nombre)` — texto FIJO
  por dimensión (una de las 4: Componentes/Neumáticos/Aceite/Confiabilidad),
  no un diagnóstico por equipo: dice DÓNDE mirar (ej. "Revisar los últimos
  análisis de aceite fuera de NORMAL"), nunca inventa una causa raíz que el
  sistema no puede conocer (no hay telemetría/sensores, solo los datos ya
  cargados). `equiposConSaludFlota` se extiende para devolver también
  `horomActual`/`unidad` (campo aditivo, ningún llamador existente se rompe).
- `torre.js` (`_torreAbrirDrawer`): **Problema principal** — solo se muestra
  si el equipo está en warn/crit (nunca en uno sano, para no inventar un
  problema donde no lo hay), con las dimensiones <80% de
  `peoresDimensionesSalud`. **Qué revisar** — la recomendación de cada
  dimensión listada. **Contexto** — horómetro actual real del equipo, y
  comparación contra el promedio de la flota (calculado sobre los equipos
  con score ya cargados en el drawer, sin nueva consulta). **Tendencia 7
  días** — mismo cálculo de siempre, wording mejorado (Mejorando/Bajando/
  Estable en vez de solo la flecha). **Botón "Crear Orden de Trabajo"** —
  reutiliza el formulario real de Nueva OT Correctivo (`ot.js`, `addOT()`)
  ya existente, solo prellenando el campo Equipo — ningún formulario nuevo.

**Deliberadamente NO se copió** de la maqueta del usuario: alertas
específicas con lecturas de sensor (ej. "Presión de aceite baja: 4.7
mm/s") — el sistema no tiene telemetría, solo sabe si un análisis de
aceite salió NORMAL o no. Botón "Marcar como en revisión" — no existe ese
campo/estado en el esquema. Botón "Contactar al técnico asignado" — no
existe una asignación de técnico por equipo en el sistema. Agregar
cualquiera de estos habría significado inventar datos o funcionalidad que
no existe.

7 tests nuevos (`tests/saludFlota.test.js`) para las 2 funciones puras
nuevas. Verificado visualmente en navegador (Playwright ad-hoc, equipo
sintético con componente sin vida útil restante): el bloque "Problema
principal" y "Qué revisar" renderizan con datos reales calculados, el
horómetro se muestra, y el botón de Crear OT abre el formulario real con
el equipo prellenado.

### 23. Ajuste Weibull real por equipo — más allá de la fórmula de libro (2026-09-11)

Origen real: el usuario compartió una infografía sobre los 4 roles típicos
en un equipo de datos (Ingeniero, Analista, Científico de Datos, BI) y
preguntó cómo vería cada uno a SistemaMP Centinela. La respuesta honesta
para "Científico de Datos" fue que `confiabilidadReal` (la tarjeta
"Confiabilidad (R)") **asume** tasa de falla constante
(`R(t)=e^(-t/MTBF)`, distribución exponencial, β=1 implícito) sin nunca
medir la forma real de falla de cada equipo — el usuario pidió construir
esa pieza que faltaba.

**`logic.js` — 3 funciones puras nuevas, sin librería estadística
externa** (la app no tiene ninguna cargada; todo con `Math.log`/`Math.exp`):
- `ajusteWeibull(horomFallas)`: ajusta β (forma) y η (escala) por
  **regresión de rango mediano** sobre el gráfico de probabilidad Weibull
  — el método estándar de análisis de confiabilidad cuando se hace sin
  software especializado (el mismo que enseña cualquier curso de RCM):
  linealiza la CDF Weibull con x=ln(intervalo), y=ln(-ln(1-F)), estima F
  de cada intervalo ordenado con la aproximación de Bernard
  F_i=(i-0.3)/(n+0.4), y ajusta una recta por mínimos cuadrados. La
  pendiente es β, la ordenada al origen da η. Usa los intervalos entre
  fallas SUCESIVAS (mismo dato crudo que ya usa `mtbfReal`, no uno nuevo),
  con el mismo supuesto de "queda como nuevo tras cada reparación" que ya
  usa implícitamente el MTBF de siempre. Exige **mínimo 5 intervalos (6
  fallas)** — más que el mínimo de 2 fallas de `mtbfReal`, porque acá se
  ajusta una recta, no se promedia, y con pocos puntos la pendiente es
  puro ruido. `null` (nunca `NaN`/`Infinity`) si no alcanza el mínimo, o
  si los intervalos no tienen variación (pendiente indefinida — caso
  degenerado real, cubierto por test).
- `confiabilidadWeibull(ajuste, horasPeriodo)`: `R(t)=e^(-(t/η)^β)`, la
  generalización de la fórmula exponencial de siempre (con β=1 da
  exactamente lo mismo que `confiabilidadReal`).
- `interpretacionFormaWeibull(beta)`: texto fijo según el rango de β —
  <0.9 "fallas tempranas", 0.9-1.1 "fallas aleatorias", >1.1 "desgaste".

`equiposConSaludFlota` se extiende para calcular y devolver también
`weibull` (el ajuste, o `null`) y `hrsDia` por equipo — campos aditivos.

**`torre.js`**: nuevo bloque "Forma de falla (Weibull)" en el drawer,
solo visible cuando hay ajuste (no siempre hay 6 fallas), mostrando β +
su interpretación, y comparando lado a lado la Confiabilidad a 30 días
calculada con la fórmula exponencial de siempre vs. la calculada con la
forma real ajustada — en un caso de prueba con fallas que se acortan en
el tiempo (patrón de desgaste, β≈2.9), la exponencial daba 52% y el
ajuste real 81.3%: la vida característica ajustada (η≈620h) está bien
por encima del horizonte de 30 días (360h), algo que la fórmula que
asume tasa constante no puede capturar.

17 tests nuevos (`tests/weibull.test.js`), incluyendo el caso degenerado
de intervalos sin variación y verificación de insensibilidad al orden de
entrada. Deliberadamente no se agregó ninguna librería de estadística
(scipy/numpy-equivalente): el método de regresión de rango mediano es
suficiente para el volumen de datos real de la flota y no agrega una
dependencia externa a una app que hoy no tiene ninguna para cálculo.

### 24. Weibull de población en Neumáticos — vida real por posición (2026-09-12)

Origen real: el usuario preguntó si el ajuste Weibull recién construido
para equipos "puede servir en los neumáticos". La respuesta honesta: sí,
pero es un uso DISTINTO del método — no intervalos entre fallas repetidas
de un mismo equipo (proceso de renovación), sino la vida completa de
**unidades distintas** de la misma familia — el análisis de vida de
población que enseña cualquier curso de confiabilidad para componentes
reemplazables.

**Decisión de diseño importante, encontrada leyendo el propio código**:
el plan original era agrupar por marca/medida de neumático usando el
`estado` de la tabla `neu` (`'Baja Desgaste'`/`'Baja Imprevisto'`) — pero
el comentario ya existente en `_neuResumenVida()` (`modules/renders/
neu.js`) advierte que ese campo **nunca se usó con datos reales**: no hay
de dónde sacar la vida por marca. La fuente que SÍ tiene datos reales es
`neuHist` (`historial_neumaticos`), agrupada por **posición** (Delantero
Izq, Trasero Der, etc.) — el mismo dato que ya usa
`_neuResumenVida()`/"Resumen flota" para el promedio simple. Se ajustó el
plan para usar esa fuente real en vez de una teóricamente mejor pero vacía
en la práctica.

**`logic.js`**: se refactoriza `ajusteWeibull` para compartir su núcleo de
regresión (`_ajusteWeibullDeMuestra`, interno) con la función nueva
`ajusteWeibullVidas(vidas)` — misma matemática, misma exigencia de ≥5
datos, pero recibe vidas completas en vez de calcular intervalos.
`analisisVidaUtilPorGrupo(items)` agrupa `{grupo, vida}` (genérica, no
sabe qué es "grupo" — podría reusarse para otra población de componentes
reemplazables) y ajusta Weibull a cada grupo por separado, para no
mezclar posiciones con vidas típicas distintas.

**`neu.js`**: `_neuResumenVida()` calcula además `weibullPorPosicion`
(mismas duraciones ya calculadas para el promedio simple, sin medir nada
nuevo) y el modal "Resumen Flota Neumáticos" (`resumenFlotaNeu()`) agrega
una tabla nueva "Forma real de vida por posición (Weibull)" — posición, N°
de cambios, β, η (vida característica) e interpretación en palabras, con
las posiciones sin historial suficiente (mínimo 6 cambios) mostradas
igual pero atenuadas, para que se vea que se está acumulando el dato.

7 tests nuevos (`tests/weibull.test.js`, ampliando el archivo de la
sección 23). Verificado visualmente en navegador (Playwright ad-hoc,
historial sintético de 8 cambios en una posición): la tabla nueva
renderiza β/η/interpretación correctamente — se detectó y corrigió un
problema real de layout en la primera pasada (la columna η quedaba fuera
de la vista del modal por el texto largo de interpretación empujándola;
se resolvió con columnas de ancho fijo y el texto largo al final).

### 25. Weibull de población en Componentes Mayores (2026-09-12)

Origen real: siguiendo la misma lógica de "¿y esto también sirve en
[otra parte del sistema]?" que llevó al Weibull de neumáticos, el usuario
preguntó por Componentes o Correctivos. Antes de elegir, se investigó
cuál tenía datos reales ya disponibles (agente de investigación) — a
diferencia de neumáticos, acá **sí existe** el equivalente exacto a
`historial_neumaticos`: la tabla `historial_componentes` (`compHist`),
con cada reemplazo real de un componente mayor (motor, batería,
alternador, etc.) como su propia fila — y `modules/renders/histcomp.js`
**ya calculaba** la "vida" de cada instalación (horas hasta el siguiente
cambio) agrupada por tipo de componente, para un resumen de
promedio/mínimo/máximo. Es el mismo insumo pre-Weibull que neumáticos,
sin necesidad de descartar ningún plan esta vez.

**Cambios**: en `histcomp.js`, la misma muestra de `horasVida` ya
agrupada por tipo de componente (`statsPorComp`) se ajusta también con
`analisisVidaUtilPorGrupo` (logic.js, ya existente desde la sección 24 —
ninguna función nueva en logic.js esta vez, pura reutilización), y se
agrega una tabla "Forma real de vida por componente (Weibull)" en la
misma pestaña Historial de Componentes, con el mismo formato ya
establecido (Componente, N° cambios, β, η, interpretación; grupos sin
historial suficiente mostrados atenuados).

Sin tests nuevos en `logic.js` (no se agregó ninguna función — se
reutilizó `analisisVidaUtilPorGrupo` tal cual, ya cubierto por los 24
tests de `weibull.test.js` de las secciones 23-24). Verificado
visualmente en navegador (Playwright ad-hoc, 7 reemplazos sintéticos de
"Motor"): la tabla renderiza β=10.34 (desgaste marcado), η≈3.867h,
consistente con la interpretación esperada para un patrón de vida creciente.

### 26. Weibull de población en Correctivos por componente — a nivel flota (2026-09-12)

Origen real: al elegir entre Componentes o Correctivos (sección 25), el
usuario luego pidió seguir también con Correctivos. A diferencia de
Componentes Mayores y Neumáticos, acá no hay "vidas completas" de una
unidad reemplazable — un correctivo es una falla puntual, no el fin de
vida de una pieza física con serie propia. Lo que sí existe es el mismo
patrón usado en MTBF/Pareto de fallas (`estadistica.js`): categorizar cada
correctivo por componente (`o.componente` o, si viene vacío,
`_componenteDeSintoma(o.sintoma)` — el clasificador ya auditado contra
1.243 correctivos reales, ~70% de cobertura) y mirar los intervalos reales
entre fallas sucesivas.

La dificultad nueva: los horómetros de fallas sucesivas solo tienen
sentido **dentro del mismo equipo** (no se puede restar el horómetro de
una falla de motor en CN-1 menos el de CN-2). Pero para tener muestra
suficiente por componente hay que juntar varios equipos. La solución:
calcular los intervalos **equipo por equipo** (igual que
`ajusteWeibull` de la sección 23) y recién después **juntar esos
intervalos entre todos los equipos que comparten la misma categoría de
componente**, antes de ajustar Weibull sobre el conjunto combinado — un
híbrido entre la técnica por-equipo (23) y la técnica por-población (24-25).

**`logic.js`**: nueva función `analisisVidaUtilCorrectivosPorComponente(eventos)` —
agrupa los eventos `{sigla, componente, horom}` por `sigla+componente`,
calcula los intervalos sucesivos dentro de cada grupo (mismo patrón que
`ajusteWeibull`, sin mezclar horómetros entre equipos), junta todos esos
intervalos por categoría de componente en una lista plana
`{grupo, vida}` y se la pasa a `analisisVidaUtilPorGrupo` (ya existente
desde la sección 24 — sin reinventar el ajuste ni la agrupación final).
5 tests nuevos en `weibull.test.js` (29 en total): agrupamiento correcto
sin mezclar equipos, un componente con solo 1 intervalo queda listado con
`ajuste:null` (bajo el mínimo de 5, nunca se inventa un ajuste), se
ignoran eventos sin componente/sigla/horómetro válido, arreglo vacío, y
pureza (no muta los eventos de entrada).

**`estadistica.js`**: en la vista "Por Componente", después de la tabla
Pareto existente, nueva función `_estWeibullPorComponente(eventos)` agrega
una tabla "Forma real de falla por componente — toda la flota (Weibull)"
con el mismo formato ya establecido (Componente, N° intervalos, β, η,
interpretación; columnas con ancho fijo para evitar el bug ya conocido de
la interpretación empujando la columna η fuera de pantalla). Usa los
mismos `eventos` que ya arma `_estFallasCombinadas(ot, otHist)` para el
Pareto — sin nueva fuente de datos.

Verificado visualmente en navegador (Playwright ad-hoc, 8 correctivos
sintéticos de "Motor" repartidos en 2 equipos): la tabla renderiza Motor,
N°=6 intervalos combinados, β=1.13, η=784h, interpretación "Desgaste" —
consistente con el resto de la familia Weibull. Portado a sistema-mp2
(mismo `logic.js`, mismos tests, mismo `estadistica.js` sustituyendo el
emoji "📐" por `ICONS.ruler`) y verificado ahí con el mismo procedimiento
antes de subir.

### 27. Intervalo de confianza 90% (IC90) para β/η — cuánto confiar en la forma ajustada (2026-09-12)

Origen real: tras completar las cuatro variantes de Weibull (equipo,
neumáticos, componentes mayores, correctivos por componente), el usuario
preguntó, viéndolo desde los cuatro roles de datos (Ingeniero, Analista,
Científico, BI), qué fórmula o dato todavía faltaba. Un hueco real: β/η se
mostraban como si fueran ciertos, sin margen de error — con el mínimo de
5-6 datos que exige el ajuste, la recta ajustada puede estar lejos de la
forma real, y no decirlo es aparentar más certeza de la que hay. El caso
de Correctivos (sección 26) lo hace evidente: el β puntual de Motor
(1.13, "Desgaste") tiene un IC90 real de 0.39–1.87, que cruza las tres
zonas de interpretación (tempranas/aleatorias/desgaste) — con solo 6
intervalos pooled, la forma real todavía no se conoce con certeza.

**`logic.js`**: `_ajusteWeibullDeMuestra` (el núcleo de regresión
compartido por las 4 variantes) ahora calcula además el error estándar de
la pendiente (β) y el intercepto de la MISMA regresión de mínimos
cuadrados que ya se usaba (fórmulas estándar de OLS, sin librería
externa), y propaga ese error a η con el **método delta** — η=e^(-intercepto/β)
depende de ambos parámetros de la regresión a la vez, que están
correlacionados entre sí, no son independientes. Nueva función interna
`_intervaloConfianzaWeibull` (no exportada, uso interno) y una tabla fija
de valores críticos t de Student (df=1-30, aproximación normal más allá)
para el **90% de confianza** — el estándar de la industria en análisis de
confiabilidad Weibull (así reporta Minitab/ReliaSoft por defecto), no un
número elegido al azar. El resultado de cada ajuste ahora incluye
`ic90:{betaMin,betaMax,etaMin,etaMax}` (campo aditivo — ningún llamador
existente se rompe por no leerlo), o queda ausente si la varianza sale
indefinida (nunca se inventa un intervalo). `betaMin` se acota a un
mínimo positivo (β&lt;=0 no es interpretable).

4 tests nuevos en `weibull.test.js` (33 en total): con datos muy
regulares el IC90 sale angosto; con el caso real de Correctivos pooled el
IC90 confirma que cruza las tres zonas de interpretación; el caso mínimo
(n=5) sigue devolviendo un IC90 válido; `betaMin` nunca es negativo.

**UI**: se agrega la línea "IC90 x–y" bajo β y η en las 4 pantallas que
muestran un ajuste Weibull — Torre de Control (drawer, por equipo),
Neumáticos (resumen flota, por posición), Historial de Componentes (por
tipo de componente) y Estadística → Por Componente (Correctivos, pooled a
nivel flota). En Torre de Control y en la tabla de Correctivos, además,
cuando el IC90 de β cruza tanto &lt;0.9 como &gt;1.1 se agrega una
advertencia explícita ("rango amplio, todavía no hay certeza sobre la
forma real") en vez de dejar que el usuario confíe en un β puntual que
podría significar cualquier cosa.

Verificado visualmente en navegador (Playwright ad-hoc, una prueba por
cada una de las 4 pantallas): Torre de Control muestra "IC 90%: β entre
2.7 y 3.09" bajo β=2.9 (CN-1, mismo caso de la sección 23); Neumáticos
muestra "IC90 7.63–11.22" bajo β=9.43 y "IC90 2.926–3.058h" bajo η=2.990h;
Estadística → Correctivos muestra "IC90 0.39–1.87" bajo β=1.13 junto con
la advertencia de rango amplio, confirmando que el caso con menos certeza
real efectivamente se marca como tal. Portado a sistema-mp2 (mismo
`logic.js`/tests, mismas 4 pantallas) y verificado ahí antes de subir.

### 28. Detección de outliers en Análisis de Aceite (2026-09-12)

Origen real: siguiendo el mismo repaso por los 4 roles de datos que llevó
al IC90 (sección 27), quedaba un segundo hueco real: `ordenesSinOutliers`
(2026-08) es la ÚNICA detección de errores de digitación de todo el
sistema, y solo cubre costos de órdenes de compra. Un análisis de aceite
con un cero de más en el hierro (ej. 500 en vez de 50 ppm) hoy se
clasifica igual que un desgaste real — nadie lo distingue de una alerta
genuina, y ese dato erróneo contamina cualquier análisis que use aceite
(Índice de Salud, Torre de Control, y cualquier correlación futura entre
aceite y fallas reales).

**`logic.js`**: nueva función `aceiteOutliers(ace)`, mismo criterio que
`ordenesSinOutliers` (mediana de la MISMA categoría, mínimo 5 muestras
para una mediana confiable) pero agrupando por `descriptor` (el tipo de
aceite estandarizado — MOTOR, TRANSMISIÓN, etc. — no `componente`, que es
texto libre por equipo) y por cada uno de los 6 metales de desgaste ya
mostrados en la tabla (hierro, cobre, plomo, aluminio, silicio, cromo). A
diferencia de costos, acá se exigen **dos señales a la vez**, no una
sola: (1) el valor es 10x o más la mediana histórica de ESE metal en ESE
tipo de aceite, Y (2) el valor supera además 2x el umbral fijo de alerta
que ya usa la tabla (`metalCell`, ace.js) — un desgaste real severo
puede superar la mediana igual sin ser un error de digitación; exigir
ambas condiciones evita marcar como "posible error" una alerta genuina
(ej. TRANSMISIÓN con desgaste típico alto pero parejo no se marca, ver
tests). Nunca modifica `estado` ni oculta la muestra — solo la separa
para revisión humana, mismo espíritu que `ordenesSinOutliers`.

**`ace.js`**: nuevo panel de advertencia (mismo estilo que el ya existente
de "alertas persistentes") listando cada posible error con equipo,
descriptor, fecha, metal+valor y la mediana histórica de ese tipo de
aceite, para que el usuario confirme con el laboratorio antes de tratarlo
como una alerta real.

10 tests nuevos en `aceiteOutliers.test.js`: muestra insuficiente no
marca nada; caso real de error de digitación (500 ppm) sí se marca;
desgaste real alto que supera la mediana pero no el umbral fijo NO se
marca (evita falso positivo); valor alto pero estadísticamente normal
para su propio grupo NO se marca; agrupa por descriptor sin mezclar tipos
de aceite; revisa varios metales por muestra; ignora muestras sin
descriptor o con metal en 0; array vacío; pureza (no muta el arreglo
original); nunca modifica el campo `estado`.

Verificado visualmente en navegador (Playwright ad-hoc, 6 muestras
sintéticas de "MOTOR" con un hierro de 500 en la última): el panel
muestra "1 posible error de digitación — confirmar con el laboratorio
antes de tratarlo como alerta real" con "CN-1 · MOTOR · 2026-01-06 ·
hierro=500 · mediana histórica de ese tipo: 11", sin alterar el estado
ALERTA ya cargado en esa fila de la tabla.

### 29. Correlación Aceite ↔ Fallas reales (2026-09-12)

Origen real: eligiendo entre "vida económica óptima" (Científico de
Datos) y "correlación aceite-fallas" (Analista/BI) como siguiente paso
del repaso por los 4 roles de datos, se investigó primero si existían
datos reales de costo preventivo vs. correctivo suficientes para la vida
económica óptima — la investigación encontró que **no**: el campo
`costo` de correctivos es opcional y el propio sistema lo excluye de la
pestaña Costos por no confiable; `costoRef` de Componentes Mayores es
real solo para piezas chicas, y para los componentes grandes (Motor,
Transmisión) el propio código ya documenta que son "estimaciones
genéricas de industria minera, no datos reales de Besalco"; y en ningún
lado existe un campo que distinga costo preventivo de costo por falla.
Construir vida económica óptima ahí habría exigido inventar el costo de
falla — se descartó, y se optó por correlación aceite-fallas, que sí
tiene datos reales de sobra.

El módulo de Análisis de Aceite da por sentado, sin haberlo probado
nunca, que una muestra en ALERTA/PRECAUCIÓN anticipa una falla real —
esta sección lo mide por primera vez con datos reales.

**`logic.js`**: nueva función `correlacionAceiteFallas(ace, eventos,
diasVentana)`. Se investigó primero si había cruce de vocabulario entre
`descriptor` (aceite, dropdown real `#aComp`: Motor/Transmisión/
Hidráulico/Diferencial/Mando Final/Frenos) y `componente` (correctivos,
dropdown real `#oComp`) — coinciden en varias categorías normalizando
mayúsculas/tildes; deliberadamente **no** se inventó ningún alias entre
categorías que no coinciden textualmente (ej. "Hidráulico" no se fuerza
a calzar con "Bomba hidráulica"). Para cada categoría de componente,
compara la tasa de "a esta muestra le siguió un correctivo real del
mismo equipo+componente dentro de 60 días" entre las muestras
ALERTA/PRECAUCIÓN y las NORMAL, y calcula el `lift` (cuántas veces más
probable es la falla tras una ALERTA que tras una muestra NORMAL). Exige
mínimo 5 muestras de cada lado antes de reportar una tasa — con menos,
no se dice nada en vez de inventar un porcentaje sin base.

**`estadistica.js`**: en la vista "Por Componente", después de la tabla
Weibull existente, nueva función `_estCorrelacionAceite(eventos, ace)`
agrega una tabla "Correlación Aceite ↔ Fallas reales — ¿el análisis
anticipa la falla?" con % falla tras ALERTA, % falla tras NORMAL, lift y
una lectura en palabras (lift≥2 = "SÍ anticipa fallas reales"; ≥1.2 =
"anticipa algo, con margen de error"; menor = "hoy no está anticipando
fallas reales — revisar los umbrales de alerta").

11 tests nuevos en `correlacionAceiteFallas.test.js`: sample insuficiente
no reporta tasa; detecta correctamente una tasa alta de ALERTA seguida
de falla real; no cuenta una falla fuera de la ventana de días; no
cuenta una falla anterior a la muestra (solo mira hacia adelante);
compara ALERTA vs NORMAL y calcula el lift (con `lift:null` cuando
`tasaNormal=0`, para no dividir por cero ni inventar un número); lift>1
real cuando ALERTA predice mejor que NORMAL; normaliza mayúsculas/tildes
para cruzar descriptor con componente; no mezcla equipos distintos;
ignora datos inválidos; array vacío; pureza.

Verificado visualmente en navegador (Playwright ad-hoc, 5 muestras
ALERTA de "Motor" con 4 correctivos reales dentro de ventana + 5 NORMAL
con solo 1 correctivo cercano): la tabla renderiza "80% (n=5)" vs
"20% (n=5)", lift "4x" en verde, con la lectura "El aceite SÍ anticipa
fallas reales de este componente".

### 30. Campo de costo en Registro PM — preparación para vida económica óptima (2026-09-12)

Origen real: al descartar "vida económica óptima" (sección 29) por falta
de datos reales de costo, se ofreció como alternativa preparar el
terreno para que sí se pueda construir a futuro, sin inventar nada. El
usuario la eligió como siguiente paso. Este cambio es deliberadamente
**solo de captura de datos, no de análisis**: no agrega ninguna fórmula
ni tabla nueva, solo habilita que el dato empiece a existir.

Investigación previa confirmó el hueco exacto: `correctivos.costo` ya
existe (opcional) pero `registros_pm` (los PM preventivos) no tenía
**ningún** campo de costo — sin él, nunca se podría comparar costo
preventivo real contra costo correctivo real, sin importar cuánto tiempo
pasara.

**Migración** (`20260912150000_agregar_costo_a_registros_pm.sql`):
`alter table registros_pm add column if not exists costo numeric` —
aditiva y nullable, no rompe ninguna fila existente.

**Cambios**: `TABLA_REAL.reg.cols` (`store.js`) suma `'costo'`. En
`reg.js`, nuevo campo "Costo ($)" opcional en el formulario de crear PM
(junto a AST/LOTO) y en el de editar, con un tooltip explicando el
motivo ("permite comparar a futuro el costo preventivo real contra el de
un correctivo"). `saveReg`/`saveEditReg` lo guardan tal cual los demás
campos numéricos del formulario.

Sin funciones nuevas en `logic.js` (no hay fórmula que probar todavía —
es solo un campo de formulario) y sin tests nuevos de lógica pura por el
mismo motivo; el CSV export (`exportCSV`, genérico, lee las columnas
reales de cada fila) ya incluye el campo automáticamente sin cambios
adicionales. Verificado visualmente en navegador (Playwright ad-hoc):
se completa un PM con Costo=$85.000 y se confirma que `S.g('reg')[0].costo`
queda guardado correctamente en el store.

Con este campo capturando datos reales durante un tiempo, la "vida
económica óptima" descartada en la sección 29 pasa de "no se puede
construir sin inventar datos" a "se puede construir cuando haya
suficiente historial real acumulado" — sin haber tocado el modelo
todavía, solo la base para que sea posible.

### 31. Demanda de repuestos con distribución de Poisson (2026-09-13)

Origen real: el usuario compartió contenido sobre modelos estadísticos
usados en confiabilidad minera (Weibull, exponencial, log-normal, normal,
Poisson) y preguntó cuáles aplicaban acá. Se descartaron LSTM/RUL/Digital
Twins/PINNs — exigen telemetría continua de sensores en tiempo real que
este sistema no tiene (es de captura periódica: PM, correctivos, muestras
de aceite cada tanto, no un stream IoT) — y se identificaron dos ideas
reales y construibles sin inventar nada: Poisson para demanda de
repuestos (elegida primero) y log-normal para MTTR (pendiente).

Hueco real encontrado: `stockEstado` (la función que decide "cuántos
meses de cobertura quedan" y dispara COMPRAR/BAJO/OK) divide el stock por
`consumoMes` — un número FIJO tipeado a mano en la tabla de Stock Filtros,
que nunca se actualiza solo ni refleja que la demanda real varía mes a
mes. Pero sí existe un registro real y fechado de cada consumo
(`movimientos_stock`, generado automáticamente al descontar stock en cada
PM — nunca a mano) que hoy solo alimenta el "Consumido" acumulado y el
gasto proyectado en $, nunca la variabilidad real de la demanda. Poisson
es la distribución estándar de teoría de inventario para "cantidad de
unidades demandadas en un período" cuando la demanda viene de eventos
discretos e independientes (cada PM que gasta un filtro) — exactamente el
patrón real de este sistema.

**Detalle metodológico importante**: `movimientos_stock` solo registra
consumo real — nunca hay una fila con `cant=0` para un mes sin consumo de
un ítem. Dividir el total consumido por "cantidad de meses CON alguna
fila" habría ignorado los meses de consumo cero e inflado λ. El
denominador correcto es la cantidad de meses TOTALES observados por todo
el sistema (desde el primer movimiento registrado hasta el último), no
solo los meses con movimiento de ESE ítem en particular — se verificó
explícitamente con un test que compara ambos cálculos.

**`logic.js`**: `analisisDemandaRepuestos(movimientos)` agrupa por
`nParte`, calcula λ (consumo promedio mensual real) sobre el total de
meses observados por el sistema, y devuelve además `probSinConsumo`,
`probAlMenosUno` y `stockSeguridad95` (la cantidad mínima que cubre el
95% de los meses sin quebrar, acumulando la PMF de Poisson término a
término — sin librería externa, mismo criterio que toda la familia
Weibull). Mínimo 3 meses de historial total antes de reportar nada.

**UI**: nueva tabla "Demanda mensual real (Poisson)" dentro del modal
"Resumen — Gasto proyectado en Filtros" (`resumenFlotaStk`, index.html),
mostrando N°Parte, meses observados, λ, P(sin consumo), stock recomendado
al 95% y el stock actual — resaltado en rojo con ⚠️ cuando el stock
actual queda por debajo del recomendado.

8 tests nuevos en `analisisDemandaRepuestos.test.js`: sin historial
suficiente no reporta nada; λ se calcula sobre el total de meses
observados (no solo los meses con consumo de ese ítem, con un caso
explícito que hubiera dado un resultado 3x mayor con el cálculo
incorrecto); las probabilidades coinciden con el valor conocido de e⁻¹
para λ=1; el stock de seguridad crece con λ; agrupa por nParte sin
mezclar ítems; ignora datos inválidos; pureza.

Verificado visualmente en navegador (Playwright ad-hoc, F-100 con 2
unidades consumidas en 3 de 6 meses observados, λ=1): la tabla renderiza
"F-100 · 6 meses · λ=1 · P(sin consumo)=37% · Stock 95%=3 · Stock
actual=2 ⚠️" — marcando correctamente que el stock cargado (2) queda por
debajo de lo que la demanda real recomienda (3).

### 32. MTTR con distribución log-normal (2026-09-13)

Origen real: la segunda idea real identificada en el mismo repaso de
distribuciones estadísticas que llevó a Poisson (sección 31) — elegida
después de esa. El "MTTR Promedio" que ya muestra Costos & Stock
(`mttrReal`) es un promedio simple de horas de reparación, pero los
tiempos de reparación real casi nunca son simétricos: la mayoría son
rápidas y unas pocas se alargan mucho (un repuesto sin stock, un
diagnóstico difícil), lo que arrastra el promedio hacia arriba y lo hace
ver peor de lo que es "típicamente". Log-normal es la distribución
estándar para modelar exactamente ese patrón (el logaritmo de la
duración sigue una normal) — mismo principio que Weibull, aplicado a
"cuánto dura la reparación" en vez de "cuándo va a fallar".

**`logic.js`**: `analisisMTTRLogNormal(horas)` calcula μ/σ (media y
desviación estándar muestral, n-1, del logaritmo de las duraciones
reales — nunca inventadas), y devuelve `mediana` (e^μ, el "típico" real,
no distorsionado por la cola larga), `p90` (e^(μ+1.2816σ) — 1.2816 es el
z-score estándar del percentil 90 de una normal, valor de tabla, mismo
criterio que los t-críticos de Weibull) y `promedioSimple` (para
comparar). Mínimo 5 reparaciones con duración real.

**`cos.js`**: se juntan las reparaciones de CADA equipo (reusando la
misma lista `reparaciones` ya filtrada por `esFallaMTBF`+`duracion` que
ya usa MTTR — mismo universo de equipos que ya cuentan Total
Fallas/MTBF/MTTR, para no divergir con una fuente distinta) y se ajusta
el log-normal a nivel FLOTA. Nueva tabla "Forma real del MTTR — toda la
flota (log-normal)" en la vista MTBF/MTTR, con 3 tarjetas: Mediana real
(vs. promedio simple), P90, y tamaño de muestra.

8 tests nuevos en `analisisMTTRLogNormal.test.js`: muestra insuficiente
devuelve null; ignora horas inválidas; la mediana real queda bajo el
promedio simple cuando hay una reparación excepcionalmente larga (el
caso real que justifica usar log-normal en vez de un promedio); p90
siempre ≥ mediana; con datos log-simétricos mediana≈promedio (caso de
control); pureza.

Verificado visualmente en navegador (Playwright ad-hoc, 5 reparaciones
rápidas de 2-4h + 1 excepcional de 48h): la tabla renderiza "Mediana
real 4.4h — vs. promedio simple 10.3h", "P90 20.4h" y "Muestra: 6",
confirmando que el promedio simple (arrastrado por la reparación de
48h) sobreestima el tiempo "típico" de reparación casi 2.5x respecto a
la mediana real.

### 33. Agrupación oportunista de OTs — sugerir sumar el PM cuando el equipo ya entra al taller (2026-09-13)

Origen real: conversación sobre ideas de mantenimiento minero más
avanzadas (scheduling dinámico, agrupación inteligente de OTs, Monte
Carlo de disponibilidad) — de esas, la única aplicable sin inventar
datos que no existen: cuando un equipo entra al taller por una falla
correctiva imprevista y ADEMÁS le queda poco para su próximo PM
programado, tiene sentido aprovechar la detención y hacer el PM en la
misma visita en vez de parar el equipo dos veces. No requiere ningún
dato nuevo — solo cruza dos cosas que el sistema ya calcula
(`diasParaPM`/`hrsRestantes`, mantenidos por `C.recalc()`).

**`logic.js`**: `sugerenciaAgruparPM(equipo, umbralDias=7, umbralHoras=48)`
es una función pura: si `diasParaPM` o `hrsRestantes` del equipo están
dentro del umbral (por defecto 7 días u 48 horas — lo que se cumpla
primero), devuelve `{tipoPM, diasParaPM, hrsRestantes, fechaProxPM,
vencido}`; si no, `null`. `vencido:true` cuando el PM ya está atrasado
(días u horas negativas) — razón de más para agruparlo, no de menos.
Sin datos calculados (equipo recién creado, sin horómetro) no sugiere
nada — ausencia de dato no se trata como "cerca".

**`ot.js`**: al elegir el equipo en el formulario de nueva OT
(`#oEq`), `oComprobarAgruparPM()` busca el equipo real en `S.g('eq')`,
llama a `sugerenciaAgruparPM` y, si corresponde, muestra un aviso
amarillo bajo el selector: "💡 Este equipo tiene un PM3 próximo/vencido
— ya que está en el taller por esto, considera hacer el PM3 ahora y
evitar una segunda detención", con los días/horas exactos. Es solo una
sugerencia informativa — no crea ni modifica ninguna OT
automáticamente, la decisión la sigue tomando la persona.

8 tests nuevos en `sugerenciaAgruparPM.test.js`: null sin equipo;
sugiere por días cerca; sugiere por horas cerca aunque los días estén
lejos; no sugiere si ambos están lejos; `vencido:true` cuando ya pasó
la fecha; `vencido:false` cuando está cerca pero no vencido; respeta
umbrales personalizados; no confunde "sin dato" con "cero" (no
sugiere si `diasParaPM`/`hrsRestantes` son `undefined`).

Verificado visualmente en navegador (Playwright ad-hoc: equipo con
`horomActual`/`frecPM` tal que la grilla de PM cae exactamente en el
horómetro actual, o sea 0 días/0h restantes): al seleccionar el equipo
en "Nueva OT" aparece el aviso "💡 Este equipo tiene un PM3 próximo /
Faltan 0 día(s) · 0h restantes — ya que está en el taller por esto,
considera hacer el PM3 ahora y evitar una segunda detención" — usando
los valores reales recalculados por `C.recalc()`, no un mock fijo (una
primera versión de la prueba fijaba `diasParaPM`/`tipoPM` a mano y el
propio `recalc()` los sobrescribía con los valores reales; se corrigió
la prueba, no la lógica, una vez confirmado que el conteo real era
correcto).

### 34. Monte Carlo de disponibilidad de flota — proyección honesta a 30/60/90 días (2026-09-13)

Origen real: la segunda idea aplicable del mismo repaso de mantenimiento
avanzado para minería (junto con la sección 33). Todo lo demás de esa
lista se descartó por requerir datos que este sistema no tiene
(sensores, telemetría, datos de planta). Esta sí aplica: en vez de un
solo número "promedio" de MTBF/MTTR (que no dice nada sobre qué tan
seguido las cosas salen peor que el promedio), se remuestrea
(bootstrap) miles de veces el historial REAL de intervalos entre
fallas y duraciones de reparación de TODA la flota, simulando
escenarios futuros posibles — el resultado es un RANGO honesto
(P10-P90), no una falsa certeza de un solo número. Deliberadamente NO
se modela la mantención programada (PM): su fecha ya se conoce con
certeza (`diasParaPM`/`hrsRestantes`), no hay nada aleatorio que
remuestrear ahí — simularlo solo agregaría ruido a un dato que ya es
determinístico.

**`logic.js`**: `intervalosFallaFlotaDias(ot)` agrupa TODAS las fallas
reales (`esFallaMTBF`) de TODA la flota en una sola línea de tiempo
(no por equipo — interesa "cada cuántos días falla algo en la flota")
y devuelve los intervalos en DÍAS CALENDARIO entre fallas sucesivas —
a diferencia de `ajusteWeibull`/`mtbfFlotaReal` (que usan horómetro,
horas de uso), acá se necesita tiempo de calendario porque la
proyección es "de aquí a 30/60/90 días corridos".
`duracionesReparacionFlotaHoras(ot)` extrae las duraciones reales
(mismo parseo "Xh" que ya usa MTTR). `simulacionMonteCarloDisponibilidad
(intervalosDias, duracionesHoras, horizonteDias, horasFlotaDiarias,
nSimulaciones, rngOpcional)` remuestrea con reemplazo (bootstrap
clásico) esos intervalos/duraciones para construir miles de historias
futuras posibles y resume la disponibilidad resultante de cada una:
devuelve `dispP10`/`dispP50`/`dispP90` (percentiles de disponibilidad,
%), `fallasEsperadas` (promedio de fallas simuladas) y el tamaño de
cada muestra real usada. Mínimo 8 intervalos y 5 duraciones — menos que
eso y el remuestreo repite tan poca variedad real que el resultado es
más ruido que señal. `rngOpcional` permite inyectar un generador
determinístico en las pruebas (en producción usa `Math.random`).

**`disp.js`** (pestaña Disponibilidad Mecánica): nuevo panel "🎲
Proyección Monte Carlo de disponibilidad de flota" con 3 tarjetas
(30/60/90 días), cada una con la disponibilidad mediana (P50), el
rango P10-P90 y las fallas esperadas en la flota. `horasFlotaDiarias`
se calcula sumando `hrsDia` de todos los equipos activos (excluyendo
los de unidad `km`, mismo criterio que `mtbfFlotaReal`) — es el
"presupuesto" real de horas de operación que la disponibilidad puede
perder.

14 tests nuevos en `simulacionMonteCarloDisponibilidad.test.js`:
`intervalosFallaFlotaDias`/`duracionesReparacionFlotaHoras` (agrupación,
filtrado de no-fallas, fechas alternativas, intervalos de 0 días);
`simulacionMonteCarloDisponibilidad` null con muestra insuficiente
(intervalos o duraciones) o parámetros inválidos; con muestras
CONSTANTES el resultado es exacto y determinístico sin depender del
azar (cualquier valor de `rng()` elige siempre el mismo dato de una
lista de un solo valor repetido — verificado a mano: 2 fallas
esperadas y disponibilidad exacta en un horizonte de 30 días); a mayor
horizonte, más fallas esperadas; P10≤P50≤P90 siempre, verificado con un
generador determinístico que cicla una secuencia fija (no
`Math.random`, reproducible).

Verificado visualmente en navegador (Playwright ad-hoc: 3 equipos,
10hrs/día cada uno, 10 correctivos reales espaciados cada 5 días con
duraciones reales variadas): el panel muestra "9 intervalos reales
entre fallas y 10 duraciones reales de reparación", y las 3 tarjetas
con disponibilidad ~97% y su rango P10-P90 más las fallas esperadas
por horizonte (5 a 30 días, 11 a 60 días, 17 a 90 días — escala
proporcionalmente con el horizonte, como se espera de un proceso de
llegada real).

**Aclaración real (2026-09-14): alcance de flota, no por equipo.** Un
análisis externo del usuario señaló, correctamente, que
`intervalosFallaFlotaDias`/`duracionesReparacionFlotaHoras` agrupan el
historial de TODA la flota por igual — un motor recién ajustado a cero
horas pesa lo mismo en el remuestreo que uno con 15.000h de uso. Esto
es intencional (esta herramienta responde "¿cada cuántos días falla
algo en la flota?", no "¿qué tan riesgoso es ESTE equipo?" — esa
segunda pregunta ya la responde Weibull por componente y el Índice de
Riesgo de Componentes Mayores, que sí usan las horas reales de cada
equipo), pero el panel no lo aclaraba, así que un gerente podía leer
"proyección de flota" como si fuera "riesgo por máquina". Se agregó
una línea en negrita al panel de `disp.js` remitiendo a Componentes/
Weibull para el riesgo de un equipo puntual — cambio de texto
únicamente, el algoritmo no se tocó porque responde una pregunta
distinta y válida por sí misma.

### 35. Detector de salud del sistema — Capa 1 y Capa 2 (2026-09-14)

Origen real: el usuario preguntó por qué el sistema no tiene "un
detector de situaciones" que avise cuando algo deja de funcionar (ej.
un cron que falla en silencio, o un canal de reportes caído) sin que
alguien tenga que enterarse mirando los logs de Supabase a mano. La
respuesta acordada fue en dos capas: **Capa 1** — un cron que detecta y
avisa directo al humano por correo, sin depender de que haya una
sesión de IA conectada; **Capa 2** — además, despertar una sesión de
Claude para investigar la causa antes de avisar con más detalle. Las
dos están construidas.

Dos señales reales elegidas a propósito para evitar falsos positivos:
1. **Salud de `backup-diario`**: ¿corrió hoy y le fue bien? Tanto el
   éxito como el fallo quedan registrados, así que "nunca corrió" y
   "corrió pero falló" son distinguibles.
2. **Salud del canal de reportes entrantes** (`whatsapp-webhook` +
   `email-webhook`): solo se registra un FALLO real (una excepción no
   manejada, o un `insert` fallido contra `correctivos_historico`) —
   deliberadamente NUNCA se infiere que el canal está roto por la
   AUSENCIA de mensajes un día dado (que nadie reporte nada no es lo
   mismo que el webhook estar caído).

**Tabla `salud_crons`** (`nombre` PK, `ultimaEjecucion`, `exito`,
`detalle`) — cada una de las 3 funciones anteriores le hace un upsert
best-effort al terminar, vía el helper `_shared/registrarSaludCron.ts`
(en `whatsapp-webhook`, copiado inline en vez de importado, mismo
criterio que el resto de esa función — ver sección 16). "Best-effort"
en serio: si el registro falla, se traga el error y nunca afecta la
respuesta real del cron/webhook que lo llamó.

**Edge Function nueva `vigilar-salud-sistema`**: función pura
`evaluarSaludCrons(filas, ahoraISO)` (testeable sin red, 10 casos)
decide si hay problema — `backup-diario` sin fila, con `exito=false`,
o con más de 26h desde la última ejecución exitosa (no corrió hoy); o
alguno de los dos webhooks con un fallo registrado en las últimas 24h.
Si encuentra 0 problemas, no manda nada (mismo criterio "se omite el
envío si no hay nada urgente" que ya usa `alerta-pm`, sección 15, para
no generar ruido diario de "todo bien"). Si encuentra 1 o más, manda un
único correo a `aehcim6@gmail.com` vía Resend con la lista. Mismo
patrón de seguridad que `backup-diario`/`alerta-pm`: secreto propio
(`vigilar_salud_cron_secret`) en Supabase Vault, verificado con
`verificar_secreto_cron`. Programada por `pg_cron` todos los días a las
13:00 UTC, una hora después de `backup-diario` (12:00 UTC), para que ya
haya alcanzado a registrar su resultado del día.

Verificado end-to-end contra el proyecto real (no solo con los tests
unitarios): se invocó `backup-diario` manualmente, quedó registrado en
`salud_crons` (`exito:true`), y al invocar `vigilar-salud-sistema` a
continuación devolvió `{"ok":true,"enviado":false,"motivo":"Sin
problemas detectados"}` — sin mandar ninguna alerta, como corresponde
cuando no hay nada roto.

**Capa 2 — diagnóstico automático (2026-09-14)**: una Rutina de Claude
Code Remote (`trig_01LMZu3L11pn4USz1LKrxqrE`, cron `20 13 * * *`, ~20
min después de `vigilar-salud-sistema`) despierta esta misma sesión
todos los días. Alcance decidido explícitamente con el usuario: **solo
diagnostica, nunca aplica un fix** — si encuentra un problema real
investiga la causa con `mcp__Supabase__get_advisors`/`query_logs`/
`execute_sql` (nunca inventa una causa) y manda un correo aparte con el
diagnóstico; si el problema es de código de este repo, dice cuál sería
el fix pero no lo aplica (no edita, no commitea, no pushea); si es algo
externo (Twilio, Resend, Cloudflare...) lo dice así, con la acción que
le toca al humano. Si no hay ningún problema, termina sin mandar nada
ni responder — mismo criterio de "cero ruido" que Capa 1.

Restricción real encontrada al construirla: las Rutinas de tipo
"sesión nueva por disparo" (`create_new_session_on_fire`) no pueden
recibir el conector de Supabase en esta organización (`the connectors
parameter is not available for this organization`) — una sesión nueva
así arrancaría sin ninguna herramienta `mcp__Supabase__*`. La solución
real: la Rutina se ata en cambio a ESTA sesión existente (modo
"self-bind" de `create_trigger`, sin `create_new_session_on_fire`), que
ya tiene el conector Supabase habilitado — se retoma la misma
conversación cada vez que dispara, en vez de crear una sesión nueva
cada día. Verificado disparando la Rutina a mano (`fire_trigger`): la
sesión recibió el aviso, corrió la consulta real contra
`salud_crons`, y como no había ningún problema, terminó sin mandar
nada — comportamiento correcto confirmado, no asumido.

### 36. Matriz de Riesgo (Probabilidad × Impacto) en Predictivo (2026-09-14)

Origen real: el usuario preguntó si el sistema tiene una "matriz de
riesgo" (mostró de referencia una matriz genérica de gestión de
procesos — identificación → análisis → evaluación P×I → tratamiento).
Decisión acordada explícitamente: **automática, con datos reales**, no
un registro manual tipo corporativo — no inventa riesgos nuevos, cruza
4 señales que el sistema YA calcula en otro lado a los ejes estándar
de una matriz 5×5, para poder priorizar entre categorías distintas con
un criterio único en vez de mirar 4 pantallas separadas. Vive como una
sub-vista nueva ("🎯 Matriz de Riesgo") dentro de Predictivo, no como
pestaña propia.

**Las 4 señales de origen** (ninguna se recalcula, todas ya existen):
1. Índice de Riesgo por componente mayor (`comp.js`, campo
   `riesgoNivel` ya persistido — sección previa "Nivel 1 de alerta
   predictiva de fallas", 2026-09-01).
2. Severidad de alerta cruzada por equipo (`pred.js`, `alertaCruzada()`
   — combina inspección NOK, fallas repetidas, tendencia de costo, PM
   urgente y aceite).
3. Riesgo de quiebre de stock/lubricantes (`pred.js`, `riesgoQuiebre()`
   — misma fuente única `stockEstado()` que usan Stock, Dashboard,
   Plan Semanal, etc.).
4. Componentes reincidentes de flota (`pred.js`, `diagnosticoFlota()`).

**Fórmulas puras nuevas en `logic.js`** (con tests,
`tests/matrizRiesgo.test.js`, 16 casos): `probabilidadComponente`,
`probabilidadEquipoSeveridad`, `probabilidadStockQuiebre`,
`probabilidadReincidencia` mapean cada señal a un eje Probabilidad
1-5 (un riesgo "Bajo"/"Sin datos"/severidad 0 no entra a la matriz —
no es un riesgo activo). El eje Impacto usa `umbralesImpacto()` +
`impactoDeValor()`: en vez de umbrales fijos en pesos (que no tendrían
sentido en la escala de costos de otro cliente), calcula quintiles
sobre los valores $ de los riesgos presentes en ESE render
(`costoRef` de componente, `promCostoMes` de equipo, `precioUnit` de
repuesto/lubricante) — el Impacto queda relativo a "cuánto pesa este
riesgo frente a los demás riesgos de HOY". Un riesgo sin dato de costo
cae en Impacto 3 (ni se oculta ni se sobre/sub-pondera). `nivelRiesgoPxI()`
aplica las 4 bandas clásicas de una matriz 5×5: PxI≤4 Bajo, ≤9
Moderado, ≤15 Alto, &gt;15 Extremo.

**Bug real encontrado escribiendo el test** (no en producción — recién
escrito): el primer cálculo de quintiles usaba
`nums[Math.floor(p*n)]`, que en un set chico hace que el percentil 80
caiga exactamente en el ÚLTIMO elemento del array — el valor más alto
del conjunto quedaba atrapado en Impacto 4, nunca podía llegar a
Impacto 5 (comparado contra sí mismo con `&lt;=`). Corregido a
`nums[Math.ceil(p*n)-1]`.

**Render**: tarjetas resumen por nivel (Extremo/Alto/Moderado/Bajo),
grilla 5×5 (cada celda cuenta cuántos riesgos caen ahí, coloreada por
nivel), y una tabla de registro ordenada de mayor a menor PxI con
origen/riesgo/equipo/P/I/PxI/nivel/detalle. Respeta el filtro de
equipo ya existente de Predictivo (`fPredEq`); stock queda sin filtrar
por equipo, igual que en la vista "Necesita atención".

Verificado con una simulación de extremo a extremo (datos con forma
realista, no productivos) que reproduce exactamente la orquestación de
`pred.js`: confirma que componentes con riesgo Bajo/Sin datos quedan
correctamente excluidos, que el orden por PxI es correcto, y que el
conteo por nivel cuadra. Consulta real contra `componentes_mayores`
(proyecto Besalco) confirmó además que `riesgoNivel` hoy tiene 14
componentes en `🟡 Medio` y ninguno en `🔴 Alto` — la matriz parte de
datos reales, no de un escenario inventado.

**Corrección real (2026-09-14, el mismo día): piso absoluto de
Impacto.** Un análisis externo del usuario encontró un problema real
de diseño: el Impacto es puramente RELATIVO a los riesgos presentes
ese día (quintiles) — un día con solo fallas baratas (ej. una manguera
de $50.000 y una ampolleta de $10.000) igual pinta "Extremo" a la más
cara de las baratas, porque gana el quintil sin importar la escala
real. `impactoDeValor()` ahora acepta un tercer parámetro opcional
`pisoAbsoluto` (en pesos): un valor por debajo del piso queda topado
en Impacto 2, sin importar qué quintil gane — no puede pesar
"alto/extremo" en términos absolutos si en plata real es menor.
`pred.js` calcula el piso como 1% de `configuracion.presupuestoMensual`
(el mismo campo que ya usa Costos para "Presupuesto vs Real") — sin
presupuesto configurado, no hay piso, y la Matriz lo aclara con una
nota bajo la grilla en vez de fingir precisión que no tiene. 4 tests
nuevos en `matrizRiesgo.test.js` (20 en total), incluido el escenario
exacto reportado (manguera $50.000 sin piso → Impacto 5/Extremo; con
piso de $1.000.000 → Impacto 2). Verificado con una simulación que
reproduce el caso real: con un presupuesto de $15.000.000/mes (piso de
$150.000), la manguera de $50.000 bajó de "Extremo" (PxI=20) a "Alto"
(PxI=10) — sigue siendo urgente por estar sin stock (Probabilidad
alta), pero ya no aparenta ser un riesgo financiero extremo.

### 37. Auditoría completa del sistema — 34 huecos reales, 7 corregidos (2026-09-14)

Origen real: en la misma conversación de la Matriz de Riesgo, el
usuario cuestionó directamente el patrón de trabajo — "las mejoras
siempre las traigo de afuera [de otra herramienta de IA]" — pidiendo
una auditoría propia, dura, de TODO el sistema, no solo de lo
construido ese día. Se lanzaron 6 agentes de auditoría en paralelo
(Matriz de Riesgo, Disponibilidad/Salud de Flota, Predictivo,
Costos/Stock, Confiabilidad estadística, Reportes a gerencia), cada
uno con instrucción explícita de leer código real línea por línea y
reportar solo hallazgos con escenario concreto (input → output
incorrecto), no preferencias de estilo.

**Resultado: 34 huecos reales verificados.** De esos, 7 se corrigieron
el mismo día (el bug de percentiles de la sección 36 arriba, más 6
adicionales):

1. **`alertaCruzada` (pred.js) descartaba la severidad de aceite** —
   `var total=severity` se congelaba ANTES del bloque de aceite; el
   `return` usaba `total`, no `severity`. Un equipo con aceite en
   ALERTA real podía devolver `estado:'🟢'` y desaparecer de la Matriz
   de Riesgo (`probabilidadEquipoSeveridad` descarta `severity<2`).
2. **`.includes('URGENTE')` nunca matchea `'VENCIDA'`** — 8 lugares en
   `pred.js` (diagnóstico integral ×5, conteo de flota, `_cruceSistemas`,
   `alertaCruzada`), más un noveno en Backlog Inteligente con un bug
   doble: exigía `URGENTE` (0-7 días) Y `diasParaPM<=0` a la vez,
   matemáticamente solo posible en `d===0` exacto — un equipo
   genuinamente vencido (`d<0`, estado `VENCIDA`) nunca entraba, casi
   código muerto. `estado()` (`logic.js`) hace VENCIDA/URGENTE
   mutuamente excluyentes por diseño — el sistema subestimaba
   sistemáticamente los equipos MÁS atrasados, no solo los "por vencer".
3. **`dispDownMap` (logic.js) descartaba duración real de <1h** — una
   reparación real registrada como `"0h 32min"` parseaba `durH=0` (dato
   REAL medido), pero `0` es falsy en JS y `if(!durH)durH=8` lo
   sobreescribía con 8h asumidas — no era el caso de "sin duración
   registrada" (que el resto del sistema sí asume con honestidad), era
   un dato real siendo tirado.
4. **Meta Anual editable ignorada (metas.js) — veredicto opuesto entre
   pantallas.** La celda "Meta Anual" siempre mostraba `ind.meta` (el
   default hardcodeado), nunca `data.metaAnual`; y la meta de cada mes
   caía directo a `ind.meta` si no había override de ese mes puntual,
   saltándose la Meta Anual custom por completo. Con el mismo dato real
   del mismo mes, "Metas vs Realidad" (que ignoraba la meta custom) y
   "Resumen Ejecutivo" (`resumenejec.js`, que sí hacía el fallback bien)
   podían mostrar semáforos OPUESTOS — verde en la pantalla donde el
   admin configura la meta, rojo en la que se imprime para gerencia.
5. **`EXCLUIDOS` en `alerta-pm` solo se aplicaba en 1 de 9 secciones**
   — se definía pero únicamente se usaba en la sección de PM urgente.
   La más grave: un equipo decomisionado normalmente queda "Fuera de
   Servicio" para siempre (sin `fechaSalida`), así que sin el filtro en
   la sección 5 aparecía en el correo diario TODOS LOS DÍAS, en rojo,
   mezclado con alertas reales. Corregido también en vencimientos
   (sección 3) y backlog (sección 4).

2 tests nuevos de regresión en `disponibilidad.test.js`
(`dispDownMap` con duración real <1h vs. sin ningún dato). `pred.js`,
`logic.js` y `metas.js` no son unit-testeables sin refactor (dependen
de closures/DOM) — verificados con lectura de código, build, suite
completa y Playwright E2E (17/17, uno con flakiness conocida bajo
carga concurrente, confirmado en aislamiento).

**Quedaron 27 hallazgos adicionales sin corregir** en esa auditoría,
documentados como backlog priorizado (no perdidos). **2026-09-16:
7 de esos 27 se corrigieron** (ver sección "7 hallazgos del backlog,
corregidos" más abajo) — quedan 20 pendientes, entre ellos:
`alerta-pm`/`resumen-semanal` sin conectar al detector de salud
(sección 35) corregido, pero compromisos vencidos y "componentes en
riesgo alto" del correo semanal siguen dependiendo 100% de que un
humano abra la pestaña correspondiente, sin ningún aviso proactivo; y
gasto proyectado que puede inflarse hasta 6x en repuestos de compra
esporádica.

## Nudge de costo al cerrar una OT (2)

2026-09-16: `correctivos.costo` seguía en $0 en el 100% de los registros
(el campo existe en el formulario pero nadie lo completa). No se fuerza
desde la creación de la OT (muchos correctivos quedan "en curso" semanas
mientras llega el repuesto, cuando el costo real todavía no se sabe) —
`edOT()` (`ot.js`) ahora, al cambiar el estado a "Cerrada" con costo
todavía en $0, muestra un `confirm()` de aviso (no bloqueante: hay
correctivos legítimamente sin costo — garantía, mano de obra interna ya
contada en otro lado) y, si `costoSugeridoPorCruce` encuentra un candidato
real para esa OT, se lo muestra en el mensaje antes de decidir.

## Señal Unificada de Reemplazo (3) — retomada, ampliada a 6 señales

2026-09-16: se retoma la tarea que había quedado en pausa desde
2026-09-14 (la auditoría completa del sistema tomó prioridad). Diseño
original: 4 señales (Weibull β>1.5, componente con riesgo Alto, Alerta
Cruzada severidad≥5, reincidencia), umbral 3 de 4. Se amplía a 6 señales
—se suman Edad Virtual (factorQ≥0.67) y Costo Relativo de Mantenimiento
(≥15%/año), ambas implementadas después del diseño original— y el umbral
se reescala a **4 de 6** para mantener la misma exigencia relativa (~75%),
a pedido explícito del usuario.

`senalUnificadaReemplazo` (logic.js) es una función pura: recibe las 6
señales ya evaluadas (cada una puede venir `null` si no hay dato
suficiente para ESE equipo — nunca se inventa un valor para completar el
conteo) y cuenta cuántas están encendidas. La UI (`pred.js`, sub-vista
"reemplazo") junta las 6 fuentes reales por equipo:
`equiposConSaludFlota` (Weibull + Edad Virtual), `compMayores` filtrado
por sigla (riesgo de componente), `diagnosticoFlota` de toda la flota/todo
el período (reincidencia — no acotado al mes de la vista Diagnóstico:
la pregunta acá es "¿arrastra un patrón histórico?"), `alertaCruzada`
(ya existía en pred.js) y `costoRelativoMantenimientoFlota`.

**Bug real encontrado y corregido antes de terminar**: el primer intento
comparaba `c.riesgoNivel==='Alto'||c.riesgoNivel==='Extremo'`, pero los
valores REALES de ese campo (confirmados contra la base y contra
`comp.js`/`dash.js`) son `'🔴 Alto'`, `'🟡 Medio'`, `'🟡 Revisar'`,
`'🟢 Bajo'`, `'⚪ Sin datos'` — con emoji, y **sin ningún nivel
"Extremo"** (ese nombre es de la escala de la Matriz de Riesgo, un campo
distinto). Con la comparación original la señal nunca se hubiera
encendido para ningún equipo real. Corregido a `'🔴 Alto'` exacto, mismo
valor que ya usa `dash.js` para su propia tarjeta de "Componentes en
riesgo alto".

10 tests nuevos en `senalUnificadaReemplazo.test.js`.

## Costo sugerido por cruce OT ↔ OC (síntoma/solución vs. detalle real de compra)

2026-09-16: pedido del usuario tras notar, leyendo los correctivos reales,
que el texto de la OT suele mencionar el mismo repuesto/servicio que su
Orden de Compra — ej. real verificado: OT de **CF-9510, 15-mar-2026**,
síntoma "Falla eléctrica", solución "...cambio de alternador y relleno
depósito grasa" → hay una OC del **mismo día**, "Servicio Reparacion
Alter[nador]", **$550.000**.

`costoSugeridoPorCruce(correctivo, ocHist, opts)` (logic.js) tokeniza el
síntoma+solución+componente de la OT y el `detalle` de cada línea de
`ordenes_compra_historico` del MISMO equipo dentro de una ventana de días
(±15 por defecto), y calcula un score de coincidencia — reutilizando
`_tokensMaterial` (el mismo tokenizador que ya usa `precioMaterial` para
repuestos de pauta vs. catálogo de precios). Una complicación real
encontrada al validarlo: el campo `detalle` de `ordenes_compra_historico`
está **truncado a 25 caracteres** en el 100% de las 6.848 filas
("alternador" queda "Alter") — por eso el matcher no exige token exacto,
acepta que un token del detalle (candidato, casi siempre truncado) sea
prefijo de un token de la OT (mínimo 4 caracteres). Umbral 0.6, igual que
`precioMaterial`, para mantener el mismo criterio de "match confiable" en
toda la app.

Devuelve una **lista de candidatos** ordenada por score y cercanía de
fecha — nunca un costo único "confirmado": es una sugerencia para que un
humano la revise y aplique con un clic, no un reemplazo automático del
costo real. Validado con datos reales antes de implementar (no solo el
caso del alternador: se comprobó también que el matcher rechaza
correctamente una OC de $50 sin relación real — "Bateria Ac/dc Power
Wand" — que un cruce ingenuo por palabra suelta hubiera podido confundir
con una OT de "cambio de baterías").

Expuesto en OT (`ot.js`): cuando una OT no tiene costo cargado y el cruce
encuentra un candidato, aparece "💡 $X — usar" junto al campo de costo;
un clic aplica el valor (mismo `edOT()` que ya usa la edición manual). 9
tests nuevos en `costoSugeridoPorCruce.test.js`.

## Costo Relativo de Mantenimiento — primer indicador financiero con costo real

2026-09-16: el usuario compartió un archivo real de Órdenes de Compra
(Iconstruye/Komatsu, 1.335 líneas, 2020-2026). Antes de cargarlo se creó
por error una tabla nueva (`gasto_repuestos_historico`) sin revisar
primero si ya existía algo así — y sí existía: **`ordenes_compra_historico`**
(ya conectada en `store.js` como `ocHist`) tenía 6.748 líneas reales para
34 de los 35 equipos, desde 2022-06-23 hasta 2026-06-15. La tabla nueva se
eliminó (migración `20260916100000`); lo único real que el Excel aportaba
—~100 líneas posteriores al 2026-06-15 (hasta 2026-09-05), sin solape de
N° de OC con lo ya cargado— se insertó directo en `ordenes_compra_historico`
(campo `tipo` en NULL para esas filas: no se inventó la clasificación
Repuesto/Servicio/Filtro/Aceite/Neumático/Grasa que usa el resto de la
tabla, no es derivable de forma confiable solo del texto del detalle).

Con esa base (ahora 6.848 líneas, $7.934.982.746) más el `valorCompra` real
cargado para los 35 equipos, se implementó el **Costo Relativo de
Mantenimiento** — uno de los 48 indicadores EN 15341 (A&S1: costo de
mantenimiento ÷ valor de reposición del activo) — con dos limitaciones
declaradas explícitamente, no ocultas:
- Es gasto en repuestos/materiales, **no** el costo total de mantenimiento:
  `correctivos.costo` sigue en $0 en el 100% de los registros, así que no
  hay mano de obra que sumar.
- Se **anualiza** (`costoRelativoMantenimiento`, logic.js): cada equipo
  tiene historial de OC de distinto largo, así que se divide el gasto total
  por los días de historial reales y se proyecta a 365 días — sumar sin
  anualizar castigaría a los equipos con más años de datos cargados.
  Exige ≥90 días de historial y `valorCompra` real; devuelve `null` si no
  se cumple, nunca un % inventado con datos insuficientes.

`costoRelativoMantenimientoFlota` agrupa por equipo y ordena de mayor a
menor %. Expuesto en Costos → Costo Relativo de Mantenimiento (`cos.js`).
12 tests nuevos en `costoRelativoMantenimiento.test.js`.

## Tasa de falla por ubicación (Cox simplificado) y Edad Virtual (Kijima simplificado)

2026-09-16: el usuario trajo una propuesta externa (código de "Quantum
Annealing"/"Redes Neuronales Informadas por la Física"/"Teoría de Juegos
Evolutivos" para mantenimiento) que se rechazó completa — el código
mostrado generaba sus números con `Math.random()` disfrazado de física
(fatiga atómica, subastas de Nash), sin ningún dato real detrás. Se
identificaron 3 ideas legítimas (de la misma conversación con esa IA, no
del código rechazado) que sí eran calculables con datos reales del
sistema: Cox con covariables no-sensorizadas, Kijima (edad virtual), y un
MDP de reemplazo de activos. El MDP se descartó tras verificar en la base
real que `correctivos.costo` está en **$0 en 1.234 de 1.243 registros**
— el campo existe en el formulario (`ot.js`, "Costo total ($)") pero en
la práctica nadie lo completa; sin costo real no hay nada que comparar
contra `valorCompra`. Se implementaron los otros dos, con el mismo criterio
de honestidad que motivó el rechazo del código cuántico: si el nombre
académico no corresponde exactamente a lo que el dato permite calcular, se
dice explícitamente qué se simplificó y por qué.

- **`tasaFallaPorUbicacion(ot)`** (logic.js) — versión simplificada de un
  modelo de riesgos proporcionales (Cox): compara la mediana de días entre
  fallas de cada `ubicacion` (Pit/Rampa/Planta, campo ya registrado en cada
  correctivo, `ot.js`) contra el resto de la flota. NO es un hazard ratio
  ajustado real — no hay horas de exposición por ubicación, solo se sabe
  DÓNDE ocurrió cada falla, no cuántas horas trabajó cada equipo en cada
  lugar — así que es una asociación, no una causa probada, y el código lo
  dice así. Mínimo 5 fallas por ubicación (mismo umbral que
  `umbralesImpacto`). Expuesto en Predictivo → Fallas Repetitivas (Flota),
  debajo del listado de componentes.
- **`edadVirtualEquipo(horomFallas)`** (logic.js) — proxy simplificado del
  concepto de Kijima (modelos de renovación imperfecta: factor q=0 "como
  nuevo" tras la reparación, q=1 "como estaba" — la reparación no restauró
  nada). Compara la mediana de intervalos entre fallas de la primera mitad
  cronológica del historial de un equipo contra la segunda mitad: si los
  intervalos se acortan, las reparaciones no están restaurando el equipo.
  NO es un ajuste de máxima verosimilitud del q real de Kijima (eso pide
  resolver una verosimilitud no lineal) — es una comparación de medianas,
  documentada como tal. Reutiliza el mismo horómetro de fallas por equipo
  que ya usa `ajusteWeibull` (`otFallasPorSigla`, dentro de
  `equiposConSaludFlota`), mínimo 7 fallas (más exigente que Weibull,
  porque acá se parte la muestra en dos). Expuesto en Torre de Control,
  en el drawer de detalle de cada equipo, junto al bloque de Weibull.

11 tests nuevos en `tests/confiabilidadAvanzada.test.js`.

## Disponibilidad Intrínseca (Ai) además de la Operacional (Ao)

2026-09-15: hasta ahora "Disponibilidad" (`disp.js`/`dispEquipoMes`) era un
solo número que mezclaba el tiempo caído por fallas (correctivos, tabla
`correctivos`) con el tiempo caído por PM planificado (`reg`) — el
equivalente a la Disponibilidad Operacional (Ao) de la terminología RAM
(Reliability/Availability/Maintainability). No había forma de ver "¿la
disponibilidad bajó por una falla, o porque yo mismo programé la
mantención?" — la pregunta real de un gerente al mirar el número.

Se agregó la Disponibilidad Intrínseca (Ai): mismo cálculo día a día que
Ao, pero descontando SOLO el downtime de correctivos, nunca el de PM.
Como `reg` (PM) y `ot` (correctivos) ya estaban separados en la base, es
calculable con datos reales:

- `dispDownMap(reg, ot, hoy, {incluirPM:false})` — mismo mapa de siempre,
  con un parámetro nuevo que salta el loop de `reg` y deja solo `ot`.
- `_dispPctDesdeMapa` — el loop día-a-día que antes vivía dentro de
  `dispEquipoMes` se extrajo a una función compartida, para que Ao y Ai
  midan el mismo mes exactamente de la misma forma y solo difieran en el
  downMap que reciben.
- `dispIntrinsecaEquipoMes(sigla, mes, {downMapCorrectivo,...})` — la
  versión Ai de `dispEquipoMes`. A diferencia de Ao, no usa los overrides
  manuales (`dispCalc`/`dAbr`): esos representan un Ao ya mezclado a mano,
  no hay forma de separar de ahí cuánto era PM y cuánto era falla.
- `disp.js`, vista mensual: bajo la tarjeta de Disponibilidad de flota se
  agregó una línea con el Ai de flota y la brecha Ao−Ai en puntos
  (cuando es relevante), con tooltip explicando qué significa cada una.
  Solo en la vista mensual (donde vive el % que se compara contra meta) —
  diario/semanal/anual no se tocaron.

10 tests nuevos en `disponibilidad.test.js` (el mapa Ai excluye PM y
conserva correctivos; Ai ≥ Ao cuando hubo PM; casos sin dato → null).
Origen: comparación contra contenido de Predictiva21 (curso RAM) —
a diferencia de la mayoría de ese material (glosarios, autoevaluaciones
cualitativas, KPIs que piden datos que el sistema no registra), esta
distinción sí era calculable con datos 100% reales y ya existentes.

## 7 hallazgos del backlog, corregidos (2026-09-16)

El usuario priorizó 7 de los 27 hallazgos de la auditoría completa (sección
anterior) para corregir ahora. Los 7 se verificaron contra el código real
antes de tocar nada (ninguno se asumió del texto del hallazgo solo).

1. **Score de Salud "perfecto" con pocos datos** — `scoreSaludEquipo`
   (`logic.js`) ya devolvía `n` (cuántas de las 4 dimensiones tenían dato),
   pero ningún lugar de la UI lo mostraba: un score 100% con `n=1` se veía
   idéntico a uno con `n=4`. No se tocó el número (nunca se rellena una
   dimensión faltante con un supuesto — eso ya lo evitaba la función). Se
   agregó el aviso donde faltaba: el drawer de Torre de Control (`torre.js`,
   `_torreAbrirDrawer`, nuevo `#torreDScoreN`) ahora muestra "⚠️ calculado
   con solo N de 4 señales — menos confiable" cuando `n<4`; los tiles de la
   grilla de Torre y el Mapa de Salud del Dashboard (`dash.js`) suman lo
   mismo al tooltip. `buscar.js` (Ficha por equipo) ya lo mostraba desde
   antes.

2. **Monte Carlo de disponibilidad no descontaba equipos fuera de
   servicio** — `_mcHorasFlota` (`disp.js`) sumaba `hrsDia` de TODA la flota
   como "presupuesto" de horas de la proyección, incluyendo equipos que
   `equiposFueraDeServicioAhora` (ya calculado más arriba en el mismo
   render, como `fsEnCurso`) marca como aún detenidos hoy — inflando el
   presupuesto con horas que ya se sabe que no se van a operar, y mostrando
   una disponibilidad proyectada mejor de la real. Ahora se excluyen esas
   siglas antes de sumar.

3. **Presupuesto vs Real sin prorratear el mes en curso** — nueva función
   pura `presupuestoProrrateado(presupuestoMensual, mes, hoyISO)`
   (`logic.js`): para el mes EN CURSO, devuelve el presupuesto × (días
   transcurridos / días del mes); para un mes ya cerrado, el presupuesto
   completo, sin tocar. `desviacionPresupuesto` (`cos.js`) ahora recibe el
   mes y prorratea solo cuando corresponde — antes comparaba el gasto real
   de, por ejemplo, los primeros 3 días del mes contra el presupuesto
   COMPLETO, mostrando "bajo presupuesto" (verde) engañoso casi todo el mes.
   La tarjeta indica "(prorrateado a la fecha)" cuando aplica. 6 tests
   nuevos en `presupuestoProrrateado.test.js`.

4. **"Sin repuesto" contado como falla real** — "Registrar salida de
   servicio" (`index.html`) hardcodeaba `criticidad:'Reparación Inmediata'`
   sin importar el motivo (texto libre: "sin repuesto", "accidente",
   cualquier cosa) — y `esFallaMTBF` (`logic.js`) cuenta exactamente esa
   combinación (`tipo==='Fuera de Servicio' && criticidad==='Reparación
   Inmediata'`) como falla real, inflando MTBF/Confiabilidad/Weibull con
   eventos administrativos o logísticos, no mecánicos. No se intentó
   adivinar la clasificación parseando el texto libre de "Motivo" (mismo
   criterio de "nunca inventar un dato" del resto del sistema) — se agregó
   un selector explícito "¿Es una falla real del equipo?" (Sí/No) que decide
   la `criticidad` real, con "Sí" como opción por defecto (mismo
   comportamiento que antes si nadie cambia el selector).

5. **Informes de Falla Catastrófica invisibles para MTBF/Weibull/Pareto** —
   mismo tipo de bug ya corregido una vez para "Fuera de Servicio": la
   tabla `informesFalla` (formulario dedicado para el evento más grave, ver
   `informes.js`) nunca se sumaba a `ot`/`otHist` en ningún cálculo de
   fallas. Nueva función pura `_informesFallaComoOt(informesFalla)`
   (`logic.js`, mismo patrón que `_otHistComoOt`) — solo adapta filas con
   `tipoEvento==='Falla Catastrófica'` (un "Cambio Componente Mayor" es un
   reemplazo planificado, no una falla, y no debe inflar el conteo). Sumada
   al `otConHist` de `dash.js` y `torre.js` (Score de Salud/Confiabilidad,
   Weibull, Edad Virtual), a `otConHistCos` de `cos.js` (MTBF/MTTR por
   equipo) y a `_estFallasCombinadas` de `estadistica.js` (Pareto por
   Equipo/Componente/Modo de Falla). 4 tests nuevos en
   `informesFallaComoOt.test.js`.

6. **`alerta-pm`/`resumen-semanal` sin registrar su propia salud** — ambas
   Edge Functions corrían a diario/semanalmente sin dejar ningún rastro en
   `salud_crons` (sección 35): un fallo real del correo pasaba inadvertido
   hasta que alguien notaba que dejó de llegar. Se sumó `registrarSaludCron`
   (mismo helper ya usado por `backup-diario`/`whatsapp-webhook`/
   `email-webhook`) en los mismos 2 puntos que backup-diario: éxito real
   (incluyendo "nada urgente hoy" en alerta-pm, que es una ejecución válida,
   no un fallo) y el `catch` genérico — más el caso específico de que Resend
   rechace el envío. Registrar solos no bastaba: `vigilar-salud-sistema`
   (el lector de `salud_crons`, sección 7b del manual admin) tenía una
   lista hardcodeada de crons a chequear que no incluía a ninguno de los 2
   — se extendió `evaluarSaludCrons` con un chequeo compartido de
   "cadencia" (nunca registrado / falló / stale) para `alerta-pm` (26h,
   igual que backup-diario) y `resumen-semanal` (8 días, con margen sobre
   los 7 reales). 12 tests nuevos/reescritos en
   `vigilar-salud-sistema/index.test.ts`.

7. **Denominador de la demanda Poisson subestimaba ítems agregados
   recientemente** — `analisisDemandaRepuestos` (`logic.js`) calculaba λ
   dividiendo el consumo total de CADA ítem por los meses observados por
   TODO el sistema. Eso fue una decisión deliberada y verificada en su
   momento (sección 31) para no ignorar los meses de consumo cero de un
   ítem que ya existía — pero tiene un efecto secundario real: un repuesto
   agregado hace 2 meses, con consumo constante esos 2 meses, diluía su λ
   entre 24 meses del sistema completo en vez de los 2 que realmente lleva
   trackeado. El fix preserva el criterio original (el FIN del período
   sigue siendo el último mes observado por el sistema, para no reabrir el
   bug que ese criterio evitaba) pero cambia el INICIO al primer mes con
   movimiento de CADA ítem, no el primer mes del sistema — los meses antes
   de que el ítem existiera ya no cuentan como "demanda cero", porque no son
   un dato real, es que el ítem no se rastreaba todavía. Los 8 tests
   existentes siguen pasando sin cambios (coinciden matemáticamente en todos
   los casos que ya cubrían); se sumó 1 test nuevo específico para el
   escenario de ítem agregado recientemente.

**Verificación**: suite completa (`npx vitest run`, 737/737, incluyendo 10
tests nuevos), `npx vite build`, `npx esbuild` sobre los 5 módulos de
render tocados y las 2 Edge Functions tocadas (sintaxis). Los cambios de UI
(selector de criticidad, avisos de confianza) no se probaron con Playwright
en este pase — verificados por lectura de código contra el HTML/JS real.

## Re-auditoría y 16 hallazgos corregidos (2026-09-16, segunda pasada)

El usuario preguntó por los 27 hallazgos originales del backlog (sección
"37. Auditoría completa"), y se descubrió que esa lista nunca se guardó
completa en el repo — solo quedaron 9 ejemplos resumidos, documentados como
prosa. Se relanzaron los mismos 6 agentes de auditoría (Matriz de Riesgo,
Disponibilidad/Salud de Flota, Predictivo, Costos/Stock, Confiabilidad
estadística, Reportes a gerencia) sobre el sistema **actual** (incluyendo
los 7 fixes de la sección anterior, para no reportarlos de nuevo) — misma
metodología: leer código real, solo hallazgos con escenario concreto
verificado, nada de preferencias de estilo. Resultado: **16 hallazgos
nuevos, verificados** (2 confirmados con SQL directo contra datos reales de
producción). El usuario pidió corregir los 16 en orden de severidad.

### Críticos

1. **`kpi.js` — Informe Componentes/Excel mostraba "VENCIDO" falso**
   (confirmado con datos reales: CN-9502 tenía 5 componentes en este
   estado). `_getCompData()`/`_getEjecutivoData()` usaban una guarda
   invertida a la de `compEstado()` (logic.js) cuando `horomComp>horomActual`
   (error de dato/reseteo de horómetro): en vez de tratar `hrsUsadas=0`
   (instalación posterior al horómetro actual = dato inválido, no se
   inventa desgaste), usaban el horómetro COMPLETO como "horas usadas" —
   la hoja `COMPONENTES` del Excel mostraba "VENCIDO" y la hoja `EJECUTIVO`
   del MISMO archivo mostraba "OK" para el mismo componente. Corregido con
   el mismo guard en ambas funciones.

2. **Gasto Proyectado sin techo real para compras esporádicas** —
   `_gastoProyectadoCategoria` dividía el consumo de los últimos 6 meses
   CON datos por la CANTIDAD de esos meses, no por el span calendario real
   entre ellos — un repuesto comprado 2 veces al año (cada 6 meses) daba
   "1 unidad/mes" en vez de la tasa real (~0.17/mes), inflando el gasto
   proyectado ~5-6x. Se corrigió el denominador a `_contarMesesEntre`
   (mismo criterio ya usado en el fix de Poisson de la sección anterior) —
   para compra mensual consecutiva da el mismo resultado de siempre, solo
   cambia con eventos espaciados en el tiempo.

3. **`_poissonPMF` desbordaba numéricamente** — para λ≳129/mes (plausible
   en un repuesto genérico consumido por buena parte de una flota de ~35
   equipos), `Math.pow(lambda,k)` desbordaba a `Infinity` ANTES de dividir
   por el factorial, y `_stockParaNivelServicio` (que acumula la PMF
   término a término) cortaba de inmediato con un stock de seguridad MUY
   por debajo del correcto — **en silencio, sin ningún error visible**
   (para λ=150, devolvía 142 en vez de 170, un déficit real de 28
   unidades). Reescrito en espacio logarítmico (suma de logaritmos, nunca
   desborda) — mismo valor matemático, sin el desborde intermedio. 1 test
   nuevo de regresión (λ=150).

4. **Informes de Falla Catastrófica seguían invisibles** en `pred.js`
   (Matriz de Riesgo, Probabilidad de Falla, Alerta Cruzada, Señal de
   Reemplazo, Dotación de Taller — 7 construcciones de "ot combinado"),
   `kpi.js` (Excel MTBF-MTTR, Reporte Ejecutivo — 4 lugares), `buscar.js`
   (Ficha por Equipo) y `disp.js` (Monte Carlo) — el fix de la sección
   anterior solo llegó a dash.js/torre.js/cos.js/estadistica.js.
   `_informesFallaComoOt` se sumó en los 12 lugares restantes.

5. **"Registrar salida de servicio" nunca pedía horómetro** — aunque el
   fix anterior ya dejaba que quien registra decida si cuenta como falla
   real (`ssCriticidad`), sin horómetro esas fallas seguían siendo
   invisibles para MTBF/Confiabilidad/Weibull/Edad Virtual (exigen
   `o.horom>0`). Se agregó el campo (precargado con el horómetro actual
   del equipo elegido, ajustable) — opcional, nunca inventado si se deja
   vacío.

### Medios

6. **Disponibilidad Intrínseca (Ai) seguía contando salidas de servicio
   NO-falla** — `dispDownMap` no miraba `criticidad` en absoluto: una
   salida marcada explícitamente "No" en el selector `ssCriticidad` (sin
   repuesto, logística, administrativo) seguía restando a Ai (que debería
   medir SOLO fallas). Se excluye ahora cuando `incluirPM:false` (modo Ai)
   Y `criticidad` está presente y no es `'Reparación Inmediata'` — dato
   histórico sin `criticidad` (anterior a ese selector) sigue contando
   como antes, no se reinterpreta un vacío. 1 test nuevo.

7. **Dashboard: "Tendencia Disponibilidad 6 Meses" casi vacía** — el
   bloque reimplementaba su propio fallback (solo override manual +
   legado de abril-2026) en vez de usar `dispEquipoMes` (la fuente única
   que el propio Dashboard ya usa 60 líneas arriba para el número grande
   de disponibilidad) — para cualquier mes sin override manual (el caso
   normal) la barra quedaba en "—", contradiciendo el KPI principal de la
   misma pantalla. Ahora usa `dispEquipoMes` con el `downMapD` ya
   calculado.

8. **"Total Acumulado" de Costos con mes fantasma** — `mov.js` fechaba
   con un `'2026-01-01'` fijo los movimientos de registros PM importados
   sin `fechaEntrada` NI `fechaEjec` — ese "enero" fantasma se sumaba al
   Total Acumulado sin aparecer en el detalle mensual (que sí filtra por
   fecha real). Ya no se inventa una fecha (`fechaReg:null` en ese caso —
   el descuento de stock sigue ocurriendo igual, solo se deja de fingir
   saber CUÁNDO); `cos.js` y `mov.js` (vista Historial de Consumos) ya
   filtran los movimientos sin fecha real.

9. **Señal "Reincidencia" de Reemplazo ignoraba patrones de flota
   compartidos** — cuando 3+ equipos tenían cada uno 3+ fallas del mismo
   componente (el caso real documentado: "6 camiones del mismo modelo,
   cada uno con reincidencia propia"), `diagnosticoFlota` ya calculaba
   `equiposConcentrados` con todos ellos, pero la Señal Unificada de
   Reemplazo solo marcaba al `equipoMasRepetido` — el resto quedaba sin
   la señal pese a cumplir la misma definición. Se marca ahora a todos los
   de `equiposConcentrados`.

10. **Dotación de Taller ignoraba el turno Noche** — `_capacidadMesDot`
    solo multiplicaba `mecDia`, mientras que la "carga" (`downMapDot`)
    suma horas de PM+correctivo de AMBOS turnos sin distinguir — en una
    operación 24/7 con dotación de noche significativa, el ratio
    Carga/Capacidad quedaba sistemáticamente inflado (ej. mecDia=3,
    mecNoche=10 → antes mostraba ~370% "falta personal" cuando la
    dotación total podía ser adecuada). Ahora suma `(mecDia+mecNoche)`.

11. **`resumen-semanal` sin `EXCLUIDOS` en vencimientos/registros_pm** —
    confirmado con dato real (CN-9506, decomisionado, con un vencimiento
    de Sistema AFEX contado en el snapshot semanal). La query de
    vencimientos ni siquiera traía `sigla`; corregido, junto con
    `registros_pm` (sin manifestación real hoy, mismo gap de código).

12. **`registrarSaludCron` no se llamaba si faltaba `RESEND_API_KEY`** —
    el `return` temprano por falta del secret vive dentro del `try` pero
    nunca pasa por el `catch` (es `return`, no `throw`) — un secret roto
    dejaba a `alerta-pm`/`resumen-semanal` fallando sin ningún rastro en
    `salud_crons`, y el detector recién lo notaba por staleness (hasta 26h
    /8 días después). Se agregó el registro explícito en ese punto.

13. **"Compromisos vencidos" seguía 100% pasivo** — la transición
    Pendiente→Vencido/Cumplido (metas.js) solo corre en el navegador
    cuando alguien abre Metas o Resumen Ejecutivo; si nadie entra esa
    semana, ni la base sabe que un compromiso venció. No se reimplementó
    el chequeo de "mejoró" (exige recorrer la serie mensual completa de
    cada indicador, lógica que solo debe vivir en metas.js), pero
    `resumen-semanal` ahora lee `compromisos` y reporta los que tienen
    `fechaCompromiso` ya pasada y siguen `'Pendiente'` — un hecho simple
    y verificable sin esa lógica, que cierra la brecha real para la
    audiencia semanal (antes: cero canales avisaban esto salvo abrir esa
    pestaña específica).

### Menores

14. **`alertaCruzada` nunca devolvía `null`** — con `severity` arrancando
    en 0 y solo sumando, "Equipos evaluables" (Señal de Reemplazo) nunca
    podía excluir a nadie, ni siquiera un equipo sin ninguna
    inspección/correctivo/tendencia de costo/muestra de aceite real. Se
    agregó un campo `tieneDato` (sin cambiar el contrato de retorno para
    los otros 5 call sites de la función) que solo consulta ese llamador.

15. **`alerta-pm` secciones 6 y 8 sin `EXCLUIDOS`** (Cierres sin
    evidencia, Alertas de aceite persistentes) — sin manifestación
    verificada hoy, mismo hallazgo ya corregido en las secciones 1/3/4/5.

16. **Texto de ayuda en Estadística decía "mínimo 6 intervalos"** cuando
    el código (`_ajusteWeibullDeMuestra`) exige 5 — corregido el texto,
    ningún cálculo estaba afectado.

**Verificación**: suite completa (739/739, incluyendo 2 tests nuevos),
`npx vite build`, `esbuild` sobre los 10 módulos/Edge Functions tocados.
`alerta-pm` y `resumen-semanal` desplegadas a producción
(`jyhpfwivhwzylkzxrsbt`). Los cambios de UI (campo de horómetro) no se
probaron con Playwright en este pase — verificados por lectura de código.

### 38. Kaplan-Meier — curva de supervivencia no paramétrica, complemento a Weibull (2026-09-16)

Origen real: propuesta externa evaluada con el usuario (7 ideas de
confiabilidad/mantenimiento tipo CMMS avanzado — Matriz de Criticidad
Dinámica, Kaplan-Meier+MCF, Crow-AMSAA, Edad de Reemplazo Óptima,
detección de aceleración en aceite, Índice de Deuda de Mantenimiento),
contrastada contra los datos reales disponibles. 6 de 7 viables hoy (Edad
de Reemplazo Óptima sigue bloqueada por lo mismo que el MDP ya descartado
antes: `correctivos.costo` casi sin dato real). El usuario eligió el orden
de prioridad propuesto: Kaplan-Meier+MCF primero, uno por uno, cada uno
probado antes de seguir con el siguiente. Esta sección cubre la primera
mitad (Kaplan-Meier); MCF queda para la siguiente pasada.

El hueco real que cierra: los 4 ajustes Weibull ya existentes (secciones
23-27) descartan por completo las observaciones **censuradas** — un
componente que todavía sigue en servicio sin haber vuelto a fallar no
aporta ningún intervalo cerrado, así que la regresión de rango mediano
simplemente lo ignora. Con muestras chicas (el caso típico acá, mínimo 5
observaciones) eso sesga la curva hacia los componentes que fallan rápido
— los únicos que alcanzan a "cerrar" un intervalo a tiempo para entrar al
cálculo. Kaplan-Meier no ajusta ninguna forma matemática (no asume familia
de distribución): calcula la probabilidad de supervivencia empírica
punto por punto directamente de los datos, y sí puede usar la cola
censurada de cada equipo todavía en servicio como información real
("sobrevivió al menos hasta acá").

**`logic.js`**: dos funciones nuevas.
- `kaplanMeier(observaciones)` — recibe `[{tiempo, censurado}]`. Devuelve
  `null` bajo 5 observaciones (mismo umbral que
  `_ajusteWeibullDeMuestra`) o si no hay ninguna falla real (puro
  censurado, nada que estimar). Para cada tiempo de falla único t_i:
  `S(t_i) = S(t_{i-1}) × (1 − d_i/n_i)`, con `n_i` = observaciones aún "en
  riesgo" (tiempo≥t_i, incluye censuradas) y `d_i` = fallas exactamente en
  t_i. Las censuras no bajan la curva pero sí salen del grupo en riesgo
  después de su propio tiempo. IC90 por punto vía **fórmula de Greenwood**
  (`Var(S)=S²×Σd_i/(n_i×(n_i−d_i))`) con el mismo z=1.645 (90% dos colas)
  que ya usa el IC90 de Weibull (sección 27) — mismo estándar de industria,
  mismo criterio en todo el archivo. Mediana de supervivencia = primer
  tiempo donde S≤0.5 (`null` si la curva nunca llega, en vez de
  extrapolar).
- `kaplanMeierCorrectivosPorComponente(eventos, eq)` — mismo patrón
  híbrido equipo→componente de `analisisVidaUtilCorrectivosPorComponente`
  (sección 26): agrupa por `sigla+componente`, calcula intervalos
  sucesivos dentro de cada equipo (nunca mezcla horómetros entre
  equipos distintos) y junta esos intervalos por categoría de componente
  a nivel flota. La diferencia real frente a la función de Weibull: si el
  equipo sigue en servicio (`eq.horomActual` > horómetro de la última
  falla registrada), agrega una observación censurada con
  `tiempo=horomActual-últimaFalla` — el tramo que el equipo ya lleva sin
  volver a fallar, que Weibull descarta y Kaplan-Meier sí aprovecha. Sin
  dato de equipo, o sin avance de horómetro desde la última falla, no se
  inventa censura.

11 tests nuevos en `tests/kaplanMeier.test.js`: curva exacta calculada a
mano (5 fallas sin censura → `[0.8,0.6,0.4,0.2,0]`, mediana=3); censura
en el último tiempo impide que la curva llegue a 0 (la diferencia real
frente al caso sin censura); tiempos de falla empatados no producen
NaN/Infinity; mediana queda `null` cuando la curva nunca cae a ≤0.5; el
IC90 de Greenwood siempre contiene el punto estimado y respeta [0,1];
observaciones con tiempo≤0 se descartan; agrupamiento por
`sigla+componente` con censura real (caso CN-1/CN-2 Motor, mismo ejemplo
conceptual de la sección 26); sin dato de equipo no se inventa censura;
eventos inválidos se ignoran. Suite completa 750/750.

**`estadistica.js`**: en la vista "Por Componente", nueva función
`_estKaplanMeierPorComponente(eventos, eq)` agrega una tabla "Curva de
supervivencia por componente — toda la flota (Kaplan-Meier)" justo
después de la tabla Weibull ya existente — mismos `eventos` de
`_estFallasCombinadas`, más `eq` (ya disponible en `renderEstadistica`)
para calcular la cola censurada de cada equipo. Columnas: Componente,
Fallas, En servicio (censurados), Mediana de supervivencia (+ S final e
IC90), Lectura en texto plano ("A las Xh, la mitad de los casos reales ya
había fallado" o, si la curva nunca cae a la mitad, que puede ser buena
señal o falta de historial — nunca se afirma una cosa u otra sin dato).
Componentes bajo el mínimo de 5 observaciones se listan atenuados con
"Sin historial suficiente aún", igual que el resto de la familia Weibull.

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`correctivos`/`equipos` vía `tests/e2e/helpers/mock-supabase.js` — sin
tocar la red real de Supabase): 6 correctivos sintéticos de "Motor" en 2
equipos (CN-1: 3 fallas + cola censurada de 800h en servicio; CN-2: 3
fallas, sin cola censurada). La tabla renderiza Motor con 4 fallas, 1
censurado, mediana 1.000h, S final 0% (IC90 0–0%) — coincide exactamente
con el cálculo a mano (2 intervalos de CN-1 + 1 censurado + 2 intervalos
de CN-2 = 5 observaciones, 4 fallas). Sin errores de consola de la
aplicación.

### 39. MCF (Mean Cumulative Function) — fallas acumuladas esperadas por componente (2026-09-16)

Segunda mitad del par "Kaplan-Meier + MCF" (sección 38) elegido por el
usuario como primera prioridad. Kaplan-Meier mide tiempo hasta la
**primera** falla de un componente: una vez que un equipo falla, deja de
aportar información a la curva. Pero un componente reparado sigue en
servicio y puede volver a fallar — un evento **recurrente**, que ni
Weibull ni Kaplan-Meier de este archivo capturan (ambos tratan cada
intervalo/observación como independiente, perdiendo la trayectoria
completa de cada equipo). MCF (Nelson, análisis de eventos recurrentes —
el mismo método que reportan Minitab/ReliaSoft como "Recurrence Analysis")
estima el número acumulado **esperado** de fallas de ese componente por
equipo, en función del horómetro: responde "¿cuántas fallas de Motor
debería esperar, en promedio, un equipo de este tipo a las X horas?" — el
insumo real para presupuestar repuestos y mano de obra a futuro, algo que
ni el MTBF simple ni Weibull contestan directamente.

**`logic.js`**: dos funciones nuevas.
- `mcf(sistemas)` — recibe `[{fin, eventos:[horom,...]}]` (fin = horómetro
  hasta donde ese sistema estuvo bajo observación, eventos = horómetros
  donde falló dentro de esa ventana). `null` bajo 5 fallas totales (mismo
  espíritu del umbral mínimo del resto de la familia, aplicado acá al
  total de eventos, la unidad natural de MCF). En cada horómetro t_i con
  al menos una falla: `M̂(t_i)=M̂(t_{i-1})+d_i/n_i`, con n_i = sistemas aún
  bajo observación (`fin≥t_i`) y d_i = total de fallas exactamente en t_i
  entre esos sistemas. Varianza de **Nelson**
  (`Var(M̂(t))=Σ(1/n_i²)·Σ_j(d_ij−d̄_i)²`, distinta de la fórmula de
  Greenwood de Kaplan-Meier — son estimadores distintos: KM estima una
  probabilidad acotada en [0,1], MCF un conteo acumulado sin techo) con el
  mismo z=1.645 (IC90) del resto del archivo. Eje de "edad" = horómetro
  absoluto, asumiendo que arranca en 0 cuando el equipo entra en servicio
  nuevo — la misma asunción que ya usa el resto del sistema (Torre de
  Control, programa de PM), sin inventar una fecha de instalación de
  componente que este sistema no registra de forma confiable.
- `mcfCorrectivosPorComponente(eventos, eq)` — mismo agrupamiento
  sigla+componente que `kaplanMeierCorrectivosPorComponente` (sección 38),
  pero en vez de intervalos entre fallas sucesivas, usa la trayectoria
  completa de cada equipo (todas sus fallas de ese componente dentro de su
  ventana de observación) — el insumo que MCF necesita para eventos
  recurrentes. `eq` solo para leer `horomActual` (fin de observación
  real); sin ese dato, el fin de observación es la última falla registrada
  (nunca se inventa un tramo adicional).

10 tests nuevos en `tests/mcf.test.js`: curva exacta calculada a mano (5
sistemas con fallas recurrentes y censura escalonada, verificada también
con un script Python independiente); la curva de MCF nunca decrece;
tiempos empatados entre distintos sistemas no producen NaN/Infinity; el
IC90 de Nelson siempre contiene el punto estimado y nunca es negativo;
eventos fuera de la ventana de observación (tiempo≤0 o tiempo&gt;fin) se
descartan; sin ningún evento real devuelve `null`; agrupamiento por
componente usando TODAS las fallas de cada equipo, no solo intervalos
(diferencia real frente a Kaplan-Meier/Weibull); sin dato de equipo no
inventa censura extra. Suite completa 760/760.

**`estadistica.js`**: en la vista "Por Componente", nueva función
`_estMcfPorComponente(eventos, eq)` agrega una tabla "Fallas acumuladas
esperadas por componente — toda la flota (MCF)" después de la tabla
Kaplan-Meier — mismos `eventos`/`eq` ya disponibles en
`renderEstadistica`. Columnas: Componente, Equipos, Fallas totales, Fallas
acumuladas esperadas (+ horómetro de referencia e IC90), Lectura en texto
plano.

Verificado visualmente en navegador (Playwright ad-hoc, mismo mock de
`correctivos`/`equipos` vía `tests/e2e/helpers/mock-supabase.js` usado
para Kaplan-Meier — sin tocar la red real de Supabase): mismos 6
correctivos sintéticos de "Motor" en 2 equipos (CN-1: fallas a
1000/2000/3000h, sigue en servicio hasta 3800h; CN-2: fallas a
500/1600/2500h, sin avance posterior). La tabla renderiza Motor con 2
equipos, 6 fallas totales, 3.5 fallas acumuladas esperadas a 3.000h de
horómetro (IC90 2.2–4.8) — coincide exactamente con el cálculo a mano
(M(500)=0.5, M(1000)=1.0, M(1600)=1.5, M(2000)=2.0, M(2500)=2.5,
M(3000)=3.5, con CN-2 saliendo de observación en 2500h y dejando n=1 para
el último punto). Sin errores de JavaScript de la aplicación.

Con esto se completa el par "Kaplan-Meier + MCF" elegido como primera
prioridad. Sigue Crow-AMSAA, después Matriz de Criticidad Dinámica,
después detección de aceleración de desgaste en aceite (CUSUM) — uno por
uno, cada uno probado antes de seguir con el siguiente, por instrucción
explícita del usuario.

### 40. Crow-AMSAA — tendencia de la tasa de fallas por componente en el tiempo (2026-09-16)

Tercer ítem del orden de prioridad elegido por el usuario, tras completar
Kaplan-Meier+MCF (secciones 38-39). Ninguna de las herramientas de la
familia Weibull/Kaplan-Meier/MCF contesta "¿la confiabilidad está
mejorando o empeorando con el correr del tiempo?": todas miran una
muestra ya cerrada (Weibull), tiempo hasta la primera falla (Kaplan-Meier)
o un conteo acumulado (MCF), pero ninguna mira la evolución sobre el eje
calendario. Crow-AMSAA (ley de potencia no homogénea de Poisson, el
estándar de "reliability growth analysis" de MIL-HDBK-189, el mismo
método detrás del gráfico de Duane que reportan Minitab/ReliaSoft) modela
el conteo acumulado de fallas N(t)=λ·t^β sobre **días calendario** (no
horómetro — acá la pregunta es de gestión/proceso, no de desgaste físico
de una pieza): β&lt;1 = las fallas se están espaciando (mejorando), β≈1 =
tasa estable, β&gt;1 = se están juntando (empeorando, revisar causa raíz o
calidad del repuesto/proveedor).

**`logic.js`**: tres funciones nuevas.
- `crowAMSAA(dias, horizonteDias)` — estimador de máxima verosimilitud de
  MIL-HDBK-189 con dato censurado en el tiempo (T="hoy", no la última
  falla, porque el proceso sigue observándose después): β̂=n/Σln(T/t_i),
  λ̂=n/T^β̂. Con muestras chicas (el caso típico acá) el MLE crudo tiene un
  sesgo positivo conocido — verificado con una simulación Monte Carlo
  (Python, 3.000 corridas de un proceso realmente estable con β
  verdadero=1, n=8): el estimador crudo promedia ~1.14, no 1. Se aplica la
  corrección estándar de MIL-HDBK-189 para dato censurado en el tiempo,
  β̂_corregido=β̂×(n-1)/n, que en la misma simulación baja el promedio a
  ~0.99. IC90 vía aproximación normal asintótica del MLE
  (SE(β̂)≈β̂/√n, mismo z=1.645 del resto del archivo) — más simple que el
  intervalo exacto de chi-cuadrado de MIL-HDBK-189, sin agregar una
  segunda tabla de valores críticos. Mínimo 5 fallas. `null` si la suma de
  logaritmos no es positiva (dato degenerado).
- `interpretacionCrowAMSAA(tendencia)` — texto fijo para las 3
  tendencias posibles: `mejorando` (IC90 de β totalmente bajo 1),
  `empeorando` (IC90 totalmente sobre 1), `sin_certeza` (el IC90 cruza 1 —
  nunca se afirma una dirección sin que el intervalo la respalde).
- `crowAMSAAPorComponente(eventos, hoy)` — junta las fechas de falla de
  TODOS los equipos con ese componente en un solo proceso de llegadas (el
  método de "dato agrupado" de MIL-HDBK-189 para flotas de sistemas
  reparables similares — a diferencia de Weibull/Kaplan-Meier/MCF, que
  agrupan por sigla+componente antes de juntar, acá se agrupa
  directamente por componente porque el proceso de llegadas ya es a nivel
  flota). Eje de tiempo = días calendario desde la primera falla
  registrada de ese componente (+1 para que t_1 nunca sea 0), hasta 'hoy'
  (parámetro opcional para tests deterministas, mismo patrón que
  `dispEquipoMes`/`simulacionMonteCarloDisponibilidad`).

11 tests nuevos en `tests/crowAMSAA.test.js`: tendencia "mejorando" con
IC90 totalmente bajo 1; tendencia "empeorando" con IC90 totalmente sobre
1; con solo 5 puntos el mismo patrón de "empeorando" queda "sin_certeza"
(el IC90 cruza 1 con tan poca muestra — nunca se afirma sin evidencia); la
corrección de sesgo efectivamente reduce β respecto del crudo; el
horizonte T nunca puede ser menor que la última falla observada; tiempos
inválidos se descartan; agrupamiento juntando fechas de todos los equipos
en un solo proceso; eventos sin componente/fecha se ignoran; el eje de
tiempo nunca arranca en 0. Suite completa 771/771.

**`estadistica.js`**: en la vista "Por Componente", nueva función
`_estCrowAmsaaPorComponente(eventos)` agrega una tabla "Tendencia de la
tasa de fallas por componente — toda la flota (Crow-AMSAA)" después de la
tabla MCF. Columnas: Componente, Fallas, β (+ IC90), Tendencia (↓
Mejorando / ↑ Empeorando / Sin certeza, con color), Lectura en texto
plano.

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`correctivos`/`equipos` vía `tests/e2e/helpers/mock-supabase.js`, sin
tocar la red real de Supabase): 6 correctivos sintéticos de "Motor" en 2
equipos, con fechas entre enero 2024 y abril 2025. La tabla renderiza
Motor con β=0.395 (IC90 0.13–0.66), tendencia "↓ Mejorando" — verificado
con un script Python independiente usando la misma fórmula (mismo
resultado exacto: β=0.395, IC90 0.13–0.66). Nota real encontrada durante
la verificación: aunque los gaps ENTRE las 6 fallas sintéticas se acortan
progresivamente (lo que sugeriría "empeorando" mirando solo esas 6
fechas), el resultado real es "mejorando" — porque el horizonte T llega
hasta HOY (17 meses después de la última falla sintética), y ese tramo
largo sin fallas nuevas domina la estimación. Es el comportamiento
correcto de un modelo censurado en el tiempo (no en la última falla): no
un error del cálculo, sino la razón real de por qué T=hoy es la elección
metodológicamente correcta y no T=última falla. Sin errores de JavaScript
de la aplicación.

Con esto, 3 de los 4 ítems del orden de prioridad elegido por el usuario
están completos (Kaplan-Meier+MCF+Crow-AMSAA). Sigue Matriz de
Criticidad Dinámica, después detección de aceleración de desgaste en
aceite (CUSUM) — uno por uno, cada uno probado antes de seguir con el
siguiente.

### 41. Matriz de Criticidad Dinámica (2026-09-16)

Cuarto ítem del orden de prioridad elegido por el usuario, tras
Kaplan-Meier+MCF+Crow-AMSAA (secciones 38-40). Antes de implementar, se
evaluó explícitamente si esto duplicaba la Matriz de Riesgo
(Probabilidad × Impacto) ya existente (sección 36) — la respuesta real es
no: esa matriz es una **foto**. La Probabilidad de cada componente sale
de `riesgoNivel` (Componentes Mayores), un campo que solo cambia cuando
alguien vuelve a evaluar ese equipo A MANO. No hay forma de que esa
matriz "sepa" que un tipo de componente lleva meses fallando cada vez más
seguido, salvo que alguien lo note y actualice `riesgoNivel` por su
cuenta. Crow-AMSAA (sección 40, recién implementado) sí mide esa
tendencia real, a nivel de categoría de componente en toda la flota —
acá se usa para ajustar dinámicamente la Probabilidad de cada instancia
de ese tipo de componente, en vez de dejarla fija hasta la próxima
revisión manual. No es una matriz nueva ni un score inventado: **reusa
tal cual** `probabilidadComponente`/`umbralesImpacto`/`impactoDeValor`/
`nivelRiesgoPxI` de la Matriz de Riesgo estática, con un único ajuste
real encima (la tendencia medida).

**`logic.js`**: dos funciones nuevas.
- `criticidadDinamicaComponente(probEstatica, tendencia)` — +1 nivel de
  Probabilidad si la tendencia real de ese tipo de componente es
  `empeorando` (tope en 5), -1 si es `mejorando` (piso en 1), sin cambio
  si `sin_certeza` o sin dato — nunca se ajusta sin evidencia real de la
  dirección.
- `matrizCriticidadDinamica(compMayores, crowPorComponente)` — una fila
  por cada instancia de componente mayor (equipo+tipo) con Índice de
  Riesgo real (mismo filtro que la Matriz de Riesgo estática), Probabilidad
  estática Y dinámica, Impacto (mismos `umbralesImpacto`/`impactoDeValor`
  sobre `costoRef`), y los 2 niveles PxI resultantes. `cambioNivel` marca
  solo las filas donde la tendencia real efectivamente CAMBIA la banda de
  riesgo (Bajo/Moderado/Alto/Extremo) — el caso que más importa mostrar
  primero: un componente que la matriz estática no marcaría como urgente,
  pero que la tendencia real dice que sí. `crowPorComponente` = salida de
  `crowAMSAAPorComponente` (sección 40), matcheada por el mismo nombre de
  componente (`comp` en `componentes_mayores`) — no se recalcula nada.

11 tests nuevos en `tests/criticidadDinamica.test.js`: ajuste ±1 con
topes correctos; sin tendencia o `sin_certeza` no cambia nada; el Impacto
reusa los mismos umbrales de la matriz estática (verificado con el mismo
caso de 5 componentes calculado a mano); `cambioNivel` marca "escalada"
solo cuando la BANDA cambia de verdad (caso de borde probado
explícitamente: un PxI que baja de 2 a 1 pero se queda en la misma banda
"Bajo" no cuenta como cambio); orden por PxI dinámico descendente;
componentes sin Índice de Riesgo reconocido quedan excluidos, igual que
en la matriz estática; con menos de 5 valores de `costoRef` el Impacto
queda neutral (3) para todos, mismo criterio ya establecido. Suite
completa 782/782.

**`pred.js`**: dentro de la sub-vista existente "🎯 Matriz de Riesgo"
(no una pestaña nueva — es una extensión directa de esa misma vista), se
agrega un bloque "📈 Criticidad Dinámica" después de la grilla y el
registro de riesgos estáticos. Construye los eventos de falla con el
mismo patrón ya usado en el resto de `pred.js`
(`ot.filter(esFallaMTBF).concat(_otHistComoOt(...), _informesFallaComoOt(...))`,
con el mismo fallback `_componenteDeSintoma` que usa Estadística),
calcula `crowAMSAAPorComponente` y `matrizCriticidadDinamica`, y muestra
una tabla con Equipo/Componente/Tendencia/P estática/P dinámica/Nivel
estático→dinámico/Detalle — las filas que escalan de banda quedan
resaltadas, y un aviso arriba de la tabla cuenta cuántas escalan. Respeta
el filtro de equipo ya existente de Predictivo (`fPredEq`), igual que la
grilla estática.

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`correctivos`/`equipos`/`componentes_mayores` vía
`tests/e2e/helpers/mock-supabase.js`, sin tocar la red real de Supabase):
6 correctivos sintéticos de "Motor" en 2 equipos + 5 filas de
`componentes_mayores` (Motor×2, Frenos, Transmisión, Hidráulico). La
tabla de Criticidad Dinámica renderiza las 5 filas con Probabilidad
estática/dinámica, Nivel estático→dinámico y Detalle correctos — con este
historial sintético en particular la tendencia de Motor quedó
"Sin certeza" (muestra chica y fechas muy cercanas a "hoy", el mismo tipo
de caso ya cubierto explícitamente por los tests de `crowAMSAA.test.js`),
así que ningún componente escaló de banda en esta corrida — comportamiento
correcto: sin evidencia real de tendencia, `criticidadDinamicaComponente`
no ajusta nada. Sin errores de JavaScript de la aplicación.

Con esto, los 4 ítems del orden de prioridad elegido por el usuario están
completos salvo el último: detección de aceleración de desgaste en aceite
(CUSUM).

### 42. CUSUM — detección de aceleración de desgaste en Análisis de Aceite (2026-09-16)

Quinto y último ítem del orden de prioridad elegido por el usuario entre
las 7 propuestas evaluadas (secciones 38-41 fueron las 4 anteriores).
Antes de implementar se revisó qué existe hoy en Análisis de Aceite para
no duplicar: `estado` (NORMAL/PRECAUCION/ALERTA) es un umbral fijo por
**muestra individual**; `aceiteOutliers` (2026-09-12) busca un valor
absurdamente alto en UNA muestra (error de digitación); "alertas
persistentes" (`ace.js`) ve 2 muestras SEGUIDAS ya marcadas como problema
por el laboratorio. Ninguno de los tres ve una **tendencia sostenida**
directamente en los números: varias muestras seguidas levemente elevadas
para ese equipo+componente, donde cada una sola no cruza el umbral fijo
de alerta, pero juntas significan que el desgaste se está acelerando de
verdad — y donde "alertas persistentes" no ayuda si el laboratorio nunca
llegó a marcar ninguna de esas muestras como PRECAUCION/ALERTA.

**`logic.js`**: dos funciones nuevas.
- `cusumAceite(valores)` — CUSUM de un solo lado (control de procesos,
  Montgomery "Introduction to Statistical Quality Control", el método
  estándar de la industria para detectar un corrimiento sostenido de la
  media). Solo importa que el metal SUBA (desgaste), nunca que baje.
  μ0 = mediana histórica de la serie (robusta a un outlier suelto, ya
  separado por `aceiteOutliers`). **σ se estima con el rango móvil
  promedio entre muestras consecutivas** (σ=MR̄/1,128, el método estándar
  de Montgomery para "individuals charts" sin subgrupos racionales) — NO
  con la varianza muestral de toda la serie: la varianza simple se infla
  con la propia aceleración que se está buscando, lo que sube su propio
  umbral de detección y la vuelve invisible. Verificado con un caso de
  prueba real (serie estable seguida de una subida sostenida): con
  varianza muestral simple σ=11,19 y el CUSUM JAMÁS cruza el umbral; con
  rango móvil σ=3,99 y sí detecta, exactamente en el punto donde empieza
  la subida real. k (holgura)=0,5σ y h (umbral de decisión)=4σ son los
  valores de tabla estándar de la literatura de control de procesos
  (ARL≈168 en control) — no números elegidos a mano. Mínimo 6 muestras
  (necesita historial suficiente para estimar σ con algo de confianza).
  `null` si la serie es constante (σ=0, no hay variación real que
  evaluar).
- `cusumAceitePorComponente(ace)` — agrupa por `sigla+componente` (mismo
  criterio que "alertas persistentes" de `ace.js`), ordena por fecha, y
  corre `cusumAceite` para cada uno de los 6 metales de desgaste ya
  trackeados (`_ACEITE_UMBRAL_METAL`). Cada metal se evalúa por separado
  — un metal sin historial suficiente no bloquea a otro del mismo grupo
  que sí lo tiene. `fechaAlerta` guarda la fecha real de la muestra donde
  se disparó la alerta, para mostrarla.

11 tests nuevos en `tests/cusumAceite.test.js`: umbral mínimo de 6
muestras; serie constante devuelve `null`; detección exacta calculada a
mano y verificada con un script Python independiente (curva CUSUM punto
por punto); serie estable con ruido normal NO dispara alerta; confirma
explícitamente que la varianza simple pierde sensibilidad frente al rango
móvil (mismo caso, ambos métodos comparados); valores inválidos (≤0) se
descartan; la curva nunca es negativa; agrupamiento y ordenamiento
cronológico correctos aunque las muestras lleguen desordenadas; muestras
sin sigla/componente/fecha se ignoran; un grupo sin ningún metal con
historial suficiente queda excluido del resultado. Suite completa
793/793.

**`ace.js`**: nuevo bloque de aviso "🔺 N aceleración(es) de desgaste
detectada(s) (CUSUM)" en `renderAce()`, en el mismo lugar y con el mismo
estilo visual que ya usan "alertas persistentes" y "posibles errores de
digitación" — equipo, componente, metal, fecha de la muestra donde se
disparó, mediana histórica y valor CUSUM final vs. umbral.

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`analisis_aceite` vía `tests/e2e/helpers/mock-supabase.js`, sin tocar la
red real de Supabase): 9 muestras sintéticas de "Motor" en CN-1, mismos
valores de hierro del caso de prueba a mano (18,20,19,21,20,26,32,40,50),
**todas marcadas `NORMAL` por el laboratorio** (para probar que el CUSUM
detecta la tendencia aunque nadie haya marcado ninguna muestra como
problema). El bloque renderiza "CN-1 · Motor · hierro · desde la muestra
del 2026-06-15 — mediana histórica 21, CUSUM 56.02 (umbral 15.96)" —
coincide exactamente con el cálculo a mano, y confirma el objetivo real
de la herramienta: encontró una aceleración real de desgaste que el
sistema existente (estado por muestra, alertas persistentes) no había
detectado en absoluto. Sin errores de JavaScript de la aplicación.

Con esto se completa el orden de prioridad elegido por el usuario entre
las 7 propuestas evaluadas (Kaplan-Meier, MCF, Crow-AMSAA, Matriz de
Criticidad Dinámica, CUSUM — 5 de 6 ítems viables, implementados uno por
uno con verificación completa en cada paso). Edad de Reemplazo Óptima
queda descartada, sin cambios desde su evaluación inicial: sigue
bloqueada por falta de dato real de costo en `correctivos.costo`.

### 43. Vista "Carga de costos pendiente" en Correctivos (2026-09-16)

Origen real: al cerrar la sección 42, el usuario preguntó si el cruce
`costoSugeridoPorCruce` (ya existente, sección "Costo sugerido por cruce
OT ↔ OC") no resolvía el problema de `correctivos.costo` en 0%. Se
verificó en vivo contra la base real (`jyhpfwivhwzylkzxrsbt`): aplicado
en bloque a los 1.243 correctivos reales, el cruce automático solo
encuentra candidato en 53 (4,3%), y varios de esos matches son ruido
real (ej. "Cambio de plumillas parabrisas" matcheando con "Sensor de
Neumático" por coincidir solo en palabras genéricas como "de") — confirma
que la única vía confiable sigue siendo carga manual, humano revisando
caso por caso (ya sea tipeando el valor o confirmando una sugerencia real
del cruce). El usuario pidió una vista que facilite exactamente eso.

Antes de construirla se armó, con datos reales, el Pareto de qué
componentes conviene priorizar (misma clasificación real que Estadística
→ Por Componente: `esFallaMTBF` + `_componenteDeSintoma` como respaldo
cuando el campo estructurado viene vacío) — sobre 1.126 correctivos
reales que cuentan como falla, el top 10 (Neumáticos, GET/Cuchillas,
Sistema Eléctrico, Engrase/Lubricación, Foco/Ampolleta,
Radiador/Enfriamiento, Asiento, Mangueras/Fugas, Suspensión, Aire
Acondicionado) ya cubre el 63,3% de todas las fallas reales de la flota.

**`ot.js`**: nuevo checkbox "💰 Carga de costos pendiente" en el toolbar
de Correctivos. Al activarlo:
- `_otPrioridadCosto(ot)` (nueva función local, no exportada — mismo
  criterio que `_estFallasCombinadas`/`_estTablaComponente` de
  `estadistica.js`, sin duplicar esa lógica, solo reusando
  `esFallaMTBF`/`_componenteDeSintoma`/`paretoAcumulado` de `logic.js`)
  agrupa por componente clasificado y cuenta, por grupo, cuántas OT ya
  tienen costo cargado vs. cuántas siguen pendientes.
- La tabla principal se filtra a solo OT reales (nunca las que vienen de
  Registro PM/histórico — esas no tienen costo editable) que cuentan
  como falla real y todavía no tienen costo, **ordenadas por el ranking
  de Pareto** de ese componente — se agota primero el componente que más
  aporta a la muestra utilizable de cualquier análisis futuro con costo
  real (vida económica, Weibull con costo, etc.), no un orden arbitrario.
- `_otPrioridadCostoHTML` agrega un panel arriba de la tabla ("Prioridad
  de carga") con Componente/Fallas/Con costo/Pendientes/barra de avance
  por componente, mismos ⭐ "pocos vitales" que ya usa el Pareto de
  Estadística — así se ve de un vistazo dónde rinde más seguir cargando.
  Cada fila visible en la tabla, al no tener costo, sigue mostrando la
  sugerencia existente de `costoSugeridoPorCruce` ("💡 $X — usar") cuando
  hay un candidato real — no se duplica esa lógica, solo se prioriza el
  ORDEN en que aparecen las filas para cargar.
- Sin necesidad de ningún estado nuevo: en cuanto se carga un costo, esa
  fila deja de cumplir el filtro y desaparece de la vista en el próximo
  render — el criterio de salida es el dato real, no una marca manual de
  "visto".

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`correctivos` vía `tests/e2e/helpers/mock-supabase.js`): 5 correctivos
sintéticos (3 de "Neumáticos" —uno con costo ya cargado—, 1 sin
componente estructurado pero con síntoma "cambio de alternador..." que
`_componenteDeSintoma` reclasifica correctamente como "Alternador", 1 de
"Frenos"). Con el checkbox activo, el panel de prioridad muestra
"⭐ Neumáticos: 3 fallas, 1 con costo, 2 pendientes, 33% avance" y "⭐
Alternador"/"Frenos" debajo, y la tabla filtrada muestra exactamente las
4 OT sin costo (la de $500.000 ya cargado queda correctamente excluida).
Sin errores de JavaScript de la aplicación.

### 44. RUL — Vida Útil Remanente híbrida (Weibull + tendencia real de aceite) (2026-09-16)

Primer ítem de un segundo lote de algoritmos "nivel siguiente" propuesto
por el usuario tras completar Kaplan-Meier/MCF/Crow-AMSAA/Criticidad
Dinámica/CUSUM. Del lote de 8 ítems evaluados, 2 quedaron descartados con
evidencia real antes de tocar código: **Delay-Time (inspección óptima)**
— la tabla `inspecciones` tiene **0 filas** en producción, sin ningún
dato no hay distribución delay-time que estimar; **Simulación Age vs
Block Replacement** — mismo bloqueo de siempre, necesita Cf (costo real
de falla no planificada), que sigue en 0% real. Un tercer ítem,
**Actualización Bayesiana de Weibull**, se reemplazó por decisión propia
explicada al usuario: hoy el sistema recalcula Weibull completo desde
cero en cada render con todo el historial disponible (barato, sin
problema de performance que resolver), así que "actualizar
incrementalmente" no aporta nada real acá — un Bayesiano genuino para
Weibull no tiene prior conjugado simple (necesitaría MCMC) y cualquier
atajo (promediar β viejo con nuevo) sería matemática inventada disfrazada
de rigor.

RUL contesta la pregunta que ninguna herramienta anterior contesta
directamente: "¿cuántas horas le quedan de verdad a ESTE componente de
ESTE equipo?". Weibull da la forma de la CATEGORÍA de componente a nivel
flota; CUSUM (sección 42) detecta si el aceite de ESE equipo específico
muestra una aceleración de desgaste real. RUL los combina: vida remanente
condicional de Weibull, ajustada hacia abajo SOLO cuando hay evidencia
real de aceleración — nunca al revés, nunca sin evidencia.

**`logic.js`**: tres funciones nuevas + una extensión.
- `rulWeibull(ajuste, edadActual, p)` — vida remanente condicional
  (el mismo principio detrás de las "vidas B10/B50" que reporta cualquier
  software de confiabilidad, aplicado como REMANENTE desde la edad actual
  t, no desde cero): dado que el componente sobrevivió hasta t, el Δt tal
  que P(falla en [t,t+Δt]|sobrevivió a t)=p cumple R(t+Δt)/R(t)=1−p, que
  para Weibull tiene forma cerrada: Δt=η·[(t/η)^β−ln(1−p)]^(1/β)−t. p=0.10
  (B10 remanente) = estimación conservadora recomendada para programar el
  reemplazo (el mismo criterio "vida de diseño" que ya usa la industria).
  p=0.50 (B50) = mediana. Verificado matemáticamente: R(t+RUL_p)/R(t)=1−p
  exacto para cualquier p, y con β=1 (proceso sin memoria) el RUL mediana
  sale CONSTANTE sin importar la edad — la propiedad "memoryless" real de
  la distribución exponencial, confirmando que la fórmula es correcta.
- `cusumAceitePorComponente` (sección 42) se extiende — aditivo, no
  cambia nada existente — con `factorAceleracion` por metal: compara la
  pendiente real (metal/día, con FECHAS reales, no el índice ordinal de
  la muestra) antes vs. después del punto donde CUSUM detectó la
  aceleración. Acotado a [0,1] con el mismo estilo que ya usa
  `edadVirtualEquipo` (factorQ) — 0 sin diferencia real, cerca de 1
  cuanto más grande el salto real de velocidad de desgaste.
- `rulHibridoComponente(ajuste, edadActual, cusumPorMetal)` — RUL base de
  Weibull, y si algún metal tiene aceleración detectada, ajusta la edad
  efectiva = edadActual×(1+factor) (nunca más del doble) y recalcula — el
  mismo principio de "edad virtual" ya usado en el archivo, aplicado con
  la métrica de aceite. Con varios metales, usa el de MAYOR factor (el
  peor caso manda, nunca se promedia hacia abajo una alerta real).
- `rulHibridoPorComponente(eventos, eq, ace)` — arma el RUL por cada
  instancia real equipo+componente (mismo agrupamiento de Kaplan-Meier/
  MCF), Weibull pooled por categoría (≥5 intervalos ya exigido), edad
  actual = horómetro actual del equipo menos su última falla registrada
  (mismo criterio de censura de Kaplan-Meier). Sin Weibull suficiente o
  sin horómetro actual, esa instancia se omite — nunca se inventa un RUL.

13 tests nuevos en `tests/rulHibrido.test.js`: caso calculado a mano
verificado con script Python (β=2.5, η=5000h, edad=3000h → B10≈410h,
B50≈1944h); verificación matemática R(t+RUL)/R(t)=1−p para varios p;
propiedad memoryless de β=1; B50 disminuye con la edad para β>1 (a
diferencia de β=1); sin aceleración detectada el ajustado=base; con
aceleración (factor 0,787, mismo caso verificado en Python) el RUL cae de
forma consistente (410→185h B10, 1944→1080h B50) y el ajustado nunca
supera al base; con varios metales usa el de mayor factor; instancias sin
Weibull suficiente o sin horómetro se omiten; orden de menor a mayor RUL
(más urgente primero). Suite completa 806/806.

**`pred.js`**: nueva sub-vista "⏳ RUL — Vida Útil Remanente" en
Predictivo (selector `fPredVista`, mismo lugar donde ya viven Matriz de
Riesgo/Criticidad Dinámica/Señal Unificada de Reemplazo — herramientas de
"qué actuar primero a nivel de toda la flota"). Tabla por instancia
equipo+componente: Equipo, Componente, Edad actual, RUL base (B10/B50),
RUL ajustado por aceite (si corresponde, resaltado), Detalle (metal
causante + % de aceleración). Respeta el filtro de equipo ya existente.

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`correctivos`/`equipos`/`analisis_aceite` vía
`tests/e2e/helpers/mock-supabase.js`, sin tocar la red real de Supabase):
6 correctivos sintéticos de "Motor" en CN-1 (Weibull real ajustado sobre
5 intervalos), horómetro actual 9500h (edad real 1.500h desde la última
falla), y el mismo caso de aceleración de aceite ya verificado en la
sección 42 (hierro, factor 79%). La tabla renderiza CN-1/Motor con edad
1.500h, RUL base 61,8h/344,3h, RUL ajustado 21,6h/136,5h (proporción
consistente con edad efectiva=1500×1,79=2685h) — coincide con el pipeline
completo Weibull real→RUL→ajuste CUSUM funcionando de punta a punta. Sin
errores de JavaScript de la aplicación.

Sigue Competing Risks (segundo ítem del orden elegido).

### 45. Competing Risks — qué modo de falla mata primero al equipo (2026-09-16)

Segundo ítem del segundo lote de algoritmos "nivel siguiente". Ninguna de
las herramientas de la familia Kaplan-Meier/MCF/Crow-AMSAA (secciones
38-40) compara componentes entre sí: cada una mira UN componente a la
vez, tratando las fallas de OTROS componentes del mismo equipo como si
nunca hubieran pasado. En presencia de varias causas reales que compiten
por sacar al equipo de servicio, eso es el error clásico de "censura
informativa" en análisis de supervivencia — infla la probabilidad
estimada de cada causa individual porque ignora que otra causa pudo
"ganarle" antes. Competing Risks (riesgos competitivos, el estándar de
confiabilidad exactamente para esta pregunta) sí lo hace bien.

**`logic.js`**: dos funciones nuevas.
- `competingRisks(observaciones)` — estimador de **Aalen-Johansen** (el
  método no-paramétrico estándar para la Función de Incidencia Acumulada
  — CIF —, la misma referencia que reportan Minitab/R `survival` para
  "competing risks regression"): en cada tiempo de evento t_i (de
  cualquier causa), CIF_k(t_i)=CIF_k(t_{i-1})+S(t_{i-1})×(d_i,k/n_i),
  donde S es la supervivencia GLOBAL (todas las causas juntas) hasta
  antes de t_i. Después se actualiza S(t_i)=S(t_{i-1})×(1−d_i/n_i) con el
  total de eventos. Verificado con un caso de prueba a mano (Python):
  ΣCIF_k(∞)+S(∞)=1 exacto — toda la probabilidad se reparte entre "no
  falló" y "falló por causa k", ninguna causa contada de más ni de menos.
  Mínimo 5 observaciones.
- `competingRisksPorEquipo(eventos, eq)` — a diferencia de
  `kaplanMeierCorrectivosPorComponente`/`mcfCorrectivosPorComponente`/
  `rulHibridoPorComponente` (que agrupan por sigla+componente, porque
  comparan la vida de UN componente contra sí mismo entre equipos), acá
  se agrupa SOLO por sigla (equipo): dentro de cada equipo se ordenan
  TODAS sus fallas reales (de cualquier componente) por horómetro, y cada
  intervalo sucesivo es una observación con la causa siendo el componente
  que falló al final de ese intervalo — hay que mirar todos los
  componentes de un mismo equipo juntos, no uno a la vez. Mismo criterio
  de censura de la familia Kaplan-Meier. No segmenta por tipo de equipo
  — quien llama puede pre-filtrar si quiere un análisis por tipo.

8 tests nuevos en `tests/competingRisks.test.js`: caso exacto calculado a
mano y verificado con script Python (2 causas, CIF final Motor=0,8/
Transmisión=0,2, propiedad de conservación ΣCIF+S=1); ranking ordenado de
mayor a menor CIF; caso con 3 causas, varios equipos y tiempos empatados
(verificado también con Python: Hidraulico=0,4/Motor=0,4/Transmision=0,2);
tiempos inválidos descartados; agrupamiento por EQUIPO (no por
componente) confirmado con el wrapper; eventos inválidos ignorados; sin
dato de equipo no inventa censura. Suite completa 814/814.

**`estadistica.js`**: en la vista "Por Componente", nueva tabla "🏆 ¿Qué
modo de falla mata primero? — toda la flota (Competing Risks)" después de
Crow-AMSAA — a diferencia de las 4 tablas anteriores (una fila por
componente con sus propias métricas independientes), acá el ranking es
ÚNICO para toda la flota: cada fila es un componente con su probabilidad
real (CIF) de ser la próxima falla, ordenadas de mayor a menor, con el
primero destacado (🥇).

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`correctivos`/`equipos` vía `tests/e2e/helpers/mock-supabase.js`): 11
correctivos sintéticos de Motor/Transmisión/Hidráulico repartidos en 3
equipos. La tabla renderiza Motor 50%, Hidraulico 40%, Transmision 10% —
suma exacta 100% (con supervivencia final 0%), ranking correctamente
ordenado con el primero resaltado. Sin errores de JavaScript.

Sigue Matriz de Criticidad de Repuestos avanzada.

### 46. Matriz de Criticidad de Repuestos avanzada (2026-09-16)

Tercer ítem del segundo lote de algoritmos "nivel siguiente".
`riesgoQuiebre()` (alimenta Stock de la Matriz de Riesgo, sección 36) ya
usa `stockEstado` — un criterio **determinístico**: meses de cobertura
(stock/consumo mensual fijo) comparado contra meses de lead time. No dice
CUÁNTO riesgo real hay de quebrar antes de que llegue la reposición, ni
CUÁNTO duele si pasa. Esta vista combina 4 señales, todas ya existentes,
sin inventar ninguna nueva: Poisson (demanda real,
`analisisDemandaRepuestos`, sección "Demanda de Repuestos con
distribución de Poisson"), lead time real, criticidad del equipo que usa
el repuesto (`eq.criticidad`) y stock actual — en la MISMA matriz
Probabilidad×Impacto ya establecida (`probabilidadComponente`/
`umbralesImpacto`/`impactoDeValor`/`nivelRiesgoPxI`, sección 36), aplicada
acá a un dominio nuevo con una Probabilidad más rigurosa que las bandas
cualitativas de `probabilidadStockQuiebre`.

**`logic.js`**: cuatro funciones nuevas.
- `probabilidadQuiebreLeadTime(lambdaMensual, leadDias, stockDisponible)`
  — a diferencia de `stockEstado` (que solo compara MESES de cobertura
  contra MESES de lead time), usa directamente la PMF de Poisson ya usada
  para `stockSeguridad95`: P(demanda en la ventana de lead time > stock
  disponible) = 1 − Σ_{k=0}^{stock} PMF(k, λ_ventana), con
  λ_ventana=λ_mensual×(leadDias/30) — la demanda esperada en el tiempo
  REAL que tarda la reposición, no un mes fijo. Verificado con casos
  calculados a mano (script Python): más stock siempre reduce (o
  mantiene) la probabilidad, nunca la aumenta; un lead time más largo con
  la misma demanda mensual siempre la aumenta.
- `probabilidadQuiebreABanda(probQuiebre)` — mapea la probabilidad
  continua a bandas 1-5 (mismo espíritu que `probabilidadStockQuiebre`,
  que mapea la etiqueta cualitativa de `stockEstado`). 0 exacto no es un
  riesgo activo, no entra a la matriz.
- `criticidadEquipoABanda(criticidad)` — mapea los 3 valores reales de
  `eq.criticidad` confirmados contra la base (`'Crítico'`, `'Esencial'`,
  `'General'`) a la escala 1-5, mapeo disperso (5/3/1) como ya hace
  `probabilidadComponente`.
- `matrizCriticidadRepuestos(items)` — arma la matriz final: el Impacto
  toma el **PEOR CASO** entre "cuesta caro" (quintiles reales, mismo
  criterio de la Matriz de Riesgo estática) y "lo usa un equipo crítico"
  — nunca se minimiza una señal real con la otra.

11 tests nuevos en `tests/matrizCriticidadRepuestos.test.js`: casos
calculados a mano y verificados con script Python; más stock nunca
aumenta la probabilidad de quiebre; lead time más largo siempre la
aumenta; sin demanda real (λ=0) nunca hay riesgo; el Impacto toma el peor
caso entre costo y criticidad de equipo (caso de borde probado
explícitamente: repuesto barato en equipo Crítico sale con Impacto 5, no
el bajo de su costo); orden por PxI descendente; con menos de 5 valores
de costo el Impacto por costo queda neutral. Suite completa 825/825.

**`pred.js`**: nueva sub-vista "📦 Criticidad de Repuestos" en
Predictivo. Construye λ por `nParte` desde `analisisDemandaRepuestos(mov)`,
mapea criticidad por MODELO de equipo (peor caso entre los equipos reales
de ese modelo — un ítem de stock está asociado a un modelo, no a un
equipo específico), y arma los ítems para `matrizCriticidadRepuestos`
desde `stk` (stock_filtros) con `leadTime`/`stockBodega`/`pendiente`/
`precioUnit` reales. Tabla: Repuesto, Probabilidad de quiebre, Impacto
(marcado "(equipo)" cuando la criticidad del equipo pesa más que el
costo), PxI, Nivel, Detalle (λ, stock, lead time, precio).

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`movimientos_stock`/`stock_filtros`/`equipos` vía
`tests/e2e/helpers/mock-supabase.js`): "Filtro Aceite Motor" con 4 meses
de consumo real (λ=2/mes), lead time 34d, stock=1, equipo asociado
`Crítico`. La tabla renderiza P. quiebre 66% (coincide exacto con el caso
ya verificado en Python), Impacto 5 marcado "(equipo)" (el costo real de
$350.000 solo daría un impacto bajo por quintiles — la criticidad del
equipo es la que domina), PxI=20 (banda 4×impacto 5), Nivel "Extremo" —
consistente con el cálculo a mano de punta a punta. Sin errores de
JavaScript de la aplicación.

Sigue Índice de Efectividad del Mantenimiento.

### 47. Índice de Efectividad del Mantenimiento — antes/después de cada PM (2026-09-16)

Cuarto ítem del segundo lote "nivel siguiente" (reemplaza a "Actualización
Bayesiana de Weibull" en la propuesta original, descartada en la sección
44). Ninguna herramienta anterior contesta la pregunta de gestión real:
"¿el mantenimiento preventivo está funcionando, o solo generamos
trabajo?". Crow-AMSAA (sección 40) mide tendencia calendario, pero no
distingue si hubo un PM real de por medio. Esta herramienta sí: compara,
para cada equipo con PM realmente ejecutados (`registros_pm` con fecha
real — 448 registros reales confirmados contra la base de producción, 288
con `fechaEjec`), el intervalo hasta la falla siguiente ANTES de cada PM
contra el intervalo hasta la falla siguiente DESPUÉS de ese mismo PM.

**`logic.js`**: dos funciones nuevas.
- `indiceEfectividadMantenimiento(fallas, pmEjecutados)` — método de
  **comparación de medianas antes/después** (mismo principio ya
  establecido en el archivo por `edadVirtualEquipo`, que compara 2
  mitades de una serie con `medianaPositiva`), deliberadamente más simple
  que ajustar Crow-AMSAA por separado a cada segmento: la cantidad real
  de PM ejecutados por equipo no da muestra para dos ajustes de máxima
  verosimilitud separados con confianza suficiente; una comparación de
  medianas es más robusta con esa muestra. Para cada PM real, busca la
  última falla antes y la primera después, acumula esos intervalos
  pooled a nivel flota, y calcula `ratio = medianaDespués/medianaAntes`:
  &gt;1 el intervalo se alarga (el PM ayuda), &lt;1 se acorta (no está
  resolviendo la causa real, o llega tarde/mal). Mínimo 5 intervalos de
  cada lado.
- `interpretacionEfectividadMantenimiento(veredicto)` — texto fijo para
  los 3 veredictos: `efectivo` (ratio≥1.2), `no_efectivo` (ratio≤0.8),
  `sin_diferencia_clara` (entre medio — nunca se afirma una dirección sin
  que el número la respalde con margen real).

6 tests nuevos en `tests/efectividadMantenimiento.test.js`: caso "PM
efectivo" calculado a mano y verificado con script Python (mediana antes
9 días, después 76 días, ratio≈8,44); caso "PM no efectivo" también
verificado con Python (mediana antes 19 días, después 5 días,
ratio≈0,263); mínimo de 5 intervalos de cada lado; sin PM ejecutados o
sin fallas registradas devuelve `null`; eventos sin sigla/fecha válida se
ignoran. Suite completa 831/831.

**`pred.js`**: nueva sub-vista "🔧 Efectividad del Mantenimiento" en
Predictivo. Construye `fallas` con el mismo patrón ya usado en el resto
del archivo (`ot.filter(esFallaMTBF).concat(_otHistComoOt(...),
_informesFallaComoOt(...))`) y `pmEjecutados` desde `reg`
(`tipoPM!=='Correctivo'` y con `fechaEjec` o `fechaEntrada` real).
Tarjetas: Mediana antes, Mediana después, Ratio (con veredicto y color) +
la interpretación en texto plano. Respeta el filtro de equipo ya
existente.

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`correctivos`/`registros_pm`/`equipos` vía
`tests/e2e/helpers/mock-supabase.js`): mismo caso "PM efectivo" ya
verificado en Python, repetido en 2 equipos para pasar el mínimo de
muestra. Las tarjetas renderizan mediana antes=9d, después=76d,
ratio=8,44x, "✓ Efectivo", con el texto de interpretación correcto — el
pipeline completo coincide exactamente con el cálculo a mano. Sin errores
de JavaScript de la aplicación.

Sigue Detección de estacionalidad / patrones ocultos, el último ítem del
orden elegido por el usuario.

### 48. Detección de estacionalidad / patrones ocultos de falla (2026-09-16)

Quinto y último ítem del segundo lote "nivel siguiente" — completa el
orden de prioridad elegido por el usuario entre los 8 algoritmos
"avanzados" evaluados. `tasaFallaPorUbicacion` (2026-09-14) ya compara
ubicaciones (Pit/Rampa/Planta) entre sí, pero solo con una razón de
medianas — nunca dice si la diferencia observada es un patrón real o
ruido de muestra chica. Esta herramienta agrega un test estadístico
simple (chi-cuadrado de bondad de ajuste, el estándar para "¿la
distribución observada entre categorías se aleja de lo esperado más de
lo que explicaría el azar?") sobre 2 ejes nuevos que el sistema no había
comparado nunca: **mes calendario** (estacionalidad real, todos los años
juntos) y **turno** (`Día`/`Noche`, valores reales confirmados contra la
base: 435 Noche, 412 Día, 396 sin dato).

**`logic.js`**: tres piezas nuevas.
- Tabla `_CHI2_CRITICO_95` — valores críticos de chi-cuadrado (α=0,05,
  por grados de libertad) verificados antes de escribirlos con una
  implementación independiente de la función gamma incompleta
  regularizada (algoritmo de Numerical Recipes, serie+fracción continua)
  en Python — no copiados de memoria sin chequear, mismo estándar de
  rigor que la tabla de t-críticos de Weibull.
- `testChiCuadradoUniforme(observado, exposicion)` — genérico y
  reutilizable: χ²=Σ(O−E)²/E, con E=total_observado×(exposición_categoría
  /exposición_total). Si χ² supera el crítico de la tabla (gl=k−1
  categorías), la diferencia es más grande de lo que el azar explicaría
  — patrón real, no ruido. `exposicion` es un peso relativo que cada
  llamador debe justificar explícitamente (nunca inventado en silencio):
  para MES se usan los días reales de cada mes (28,25 en febrero, aproxima
  el año bisiesto sin inventar un calendario específico); para TURNO se
  asume exposición pareja entre los turnos presentes — asunción razonable
  y documentada en una operación 24/7 de 2 turnos de igual duración (el
  mismo equipo opera ambos por diseño), no un dato medido.
- `patronesOcultosFalla(ot)` — aplica el test a MES y a TURNO sobre las
  fallas reales (`esFallaMTBF`). UBICACIÓN queda fuera a propósito: ya la
  cubre `tasaFallaPorUbicacion` con un enfoque que no necesita asumir una
  exposición pareja — ahí sería mucho menos defendible (Pit/Rampa/Planta
  no tienen por qué repartirse el tiempo por igual).

9 tests nuevos en `tests/patronesOcultosFalla.test.js`: caso desbalanceado
calculado a mano y verificado con script Python (80/20, χ²=36,
significativo); caso balanceado (52/48, χ²=0,16, NO significativo — la
diferencia es ruido); el índice por categoría (observado/esperado) queda
ordenado de mayor a menor; exposición no pareja respetada (mismo número
de días reales por mes → sin patrón aunque los conteos absolutos
difieran); caso de estacionalidad real por mes verificado con Python
(χ²≈63,53, gl=11, significativo); desbalance de turno detectado
end-to-end vía el wrapper; solo cuenta fallas reales, ignora eventos sin
fecha/turno válidos; sin ningún dato ambos ejes devuelven `null`. Suite
completa 840/840.

**`pred.js`**: nueva sub-vista "📅 Patrones Ocultos de Falla" en
Predictivo. Dos bloques (Estacionalidad por mes, Por turno), cada uno con
el χ² calculado, el valor crítico, el veredicto ("patrón real" en rojo o
"sin patrón real — ruido de muestra" en verde), y una tabla por categoría
con fallas reales/esperadas/índice.

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`correctivos` vía `tests/e2e/helpers/mock-supabase.js`): mismo caso de
desbalance de turno ya verificado en Python (80 Día / 20 Noche). El
bloque "Por turno" renderiza χ²=36 (crítico 3,841, gl=1), "patrón real,
no es ruido (95% de confianza)", Día 80 fallas/50 esperadas=1,6x, Noche
20/50=0,4x — coincide exactamente con el cálculo a mano. El bloque de mes
correctamente muestra "sin patrón real" con la misma data (sin diseño
estacional intencional en ese eje) — comportamiento matemáticamente
correcto, no un error. Sin errores de JavaScript de la aplicación.

Con esto se completan los 5 ítems del segundo orden de prioridad elegido
por el usuario (RUL híbrido, Competing Risks, Matriz de Criticidad de
Repuestos, Índice de Efectividad del Mantenimiento, Patrones Ocultos de
Falla) — sumados a los 5 del primer lote (Kaplan-Meier, MCF, Crow-AMSAA,
Matriz de Criticidad Dinámica, CUSUM), 10 herramientas nuevas de
confiabilidad/mantenimiento predictivo implementadas, testeadas y
verificadas visualmente en esta sesión, todas con datos 100% reales, sin
ningún valor inventado.

### 49. Weibull con censura correcta — máxima verosimilitud (MLE) (2026-09-16)

Primer ítem del tercer lote, el más ambicioso, elegido por el usuario
("Weibull con censura correcta → Kijima Type I/II → Mantenimiento
Oportunista → Simulador What-If → GRP"). Los 4 ajustes Weibull existentes
(`ajusteWeibull`/`ajusteWeibullVidas`/`analisisVidaUtilPorGrupo`/
`analisisVidaUtilCorrectivosPorComponente`) usan regresión de rango
mediano sobre intervalos ya CERRADOS — el mismo límite que Kaplan-Meier
(sección de arriba) vino a resolver para la curva de supervivencia: un
equipo que sigue en servicio sin haber vuelto a fallar, o un
neumático/componente que sigue montado sin haberse dado de baja,
"sobrevivió al menos hasta acá" — información real que la regresión
descarta por completo.

**`logic.js`**: 4 funciones nuevas, todas un COMPLEMENTO de las 4
existentes (no un reemplazo — los 33+ tests de `weibull.test.js` y los 4
sitios de UI que ya usan la versión sin censura quedan intactos).

- `ajusteWeibullCensurado(observaciones)` — núcleo: MLE con
  Newton-Raphson. Con r fallas reales y c censuras, la log-verosimilitud
  es ln L = r·ln β − r·β·ln η + (β−1)·Σ_fallas ln(t_i) − Σ_TODOS
  (t_i/η)^β. De ∂lnL/∂η=0 sale η(β) en forma cerrada: η^β = (1/r)·Σ_TODOS
  t_i^β (la suma es sobre TODOS los datos —fallas y censuras—, dividida
  por r —solo fallas—, la asimetría real de trabajar con censura).
  Sustituyendo esa η(β) en ∂lnL/∂β=0 se cancela un término y queda una
  ecuación de una sola variable: g(β) = S2(β)/S1(β) −
  (1/r)·Σ_fallas ln(t_i) − 1/β = 0, con S1(β)=Σ_TODOS t_i^β,
  S2(β)=Σ_TODOS t_i^β·ln(t_i) — resuelta con Newton-Raphson (g'(β) =
  (S3·S1−S2²)/S1² + 1/β², S3=Σ_TODOS t_i^β·ln(t_i)²), sin ninguna
  librería externa. Mínimo 5 FALLAS reales (la censura suma precisión,
  no baja la exigencia de evidencia real de falla). `observaciones` usa
  la misma forma `{tiempo,censurado}` que ya usa `kaplanMeier`/
  `competingRisks` — no un formato nuevo.
- `ajusteWeibullEquipoCensurado(horomFallas, horomActual)` — versión
  equipo-a-equipo, agregando el tramo abierto desde la última falla hasta
  el horómetro actual como censura (mismo criterio que
  `kaplanMeierCorrectivosPorComponente`).
- `analisisVidaUtilPorGrupoCensurado(items)` — versión de población
  agrupada (neumáticos por posición, componentes mayores por tipo), cada
  ítem puede venir `censurado:true` (unidad todavía en uso).
- `ajusteWeibullCorrectivosPorComponenteCensurado(eventos, eq)` — versión
  "componente a nivel flota" con censura, mismo agrupamiento sigla+
  componente que la existente, sumando el tramo final abierto de cada
  equipo.

Derivación verificada con script Python independiente (Newton-Raphson de
mano, sin scipy/numpy): generando datos sintéticos con β/η conocidos (con
y sin censura) y confirmando que el punto hallado es máximo local real de
la log-verosimilitud (no solo raíz de la derivada, chequeado evaluando la
log-verosimilitud en el punto y en perturbaciones alrededor) y que el
residuo de la ecuación g(β̂) es ~0 (1.1e-16). Caso de referencia: fallas
[100,150,200,250,300], censuras [400,400] → β=1,8777, η=330,85 — las
mismas 5 fallas SIN censura dan β=3,1956, η=224,19 (ignorar la censura
sesga β hacia arriba y η hacia abajo: el modelo "no sabe" que 2 unidades
sobrevivieron más allá de 400h).

12 tests nuevos en `tests/weibullCensurado.test.js`: mínimo de 5 fallas
reales (las censuras no lo rebajan); caso calculado a mano y verificado
con Python (β≈1,88, η≈331, 5 fallas + 2 censuras); comparación directa
con/sin censura mostrando que η sube al reconocer la censura; observaciones
con tiempo≤0 ignoradas; `ajusteWeibullEquipoCensurado` sin/con tramo censurado
final; `analisisVidaUtilPorGrupoCensurado` agrupa y descarta ítems
inválidos; `ajusteWeibullCorrectivosPorComponenteCensurado` agrega censura
solo cuando hay dato real de equipo (nunca la inventa). Suite completa
851/851.

**`histcomp.js`** (Historial de Componentes) y **`neu.js`** (resumen de
flota de Neumáticos): en ambos, la instalación/neumático ACTUAL de cada
posición ya se mostraba como "en uso" pero quedaba totalmente afuera del
ajuste Weibull existente. Se agregó, junto a la tabla Weibull ya
existente (sin tocarla), una segunda tabla "Weibull con censura (MLE)"
que sí usa esa vida parcial como observación censurada real (horómetro
actual del equipo − horómetro de la última instalación), vía
`analisisVidaUtilPorGrupoCensurado`.

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`historial_componentes`/`historial_neumaticos`/`equipos`): mismo caso ya
verificado en Python (fallas=[100,150,200,250,300,1600] por ser los
intervalos reales entre 7 instalaciones a horómetro
0,100,250,450,700,1000,2600, más 1 censura de 400h por el equipo seguir a
3000h) — la tabla nueva en Historial de Componentes muestra "N° cambios:
6, En uso: 1, β=1,03, η=505h", exactamente igual en Resumen de Flota de
Neumáticos con los mismos datos — coincide con el resultado de Python
(β=1,0345, η=505,41) redondeado. Sin errores de JavaScript de la
aplicación.

### 50. Kijima Tipo I/II — factor de restauración q por máxima verosimilitud (2026-09-17)

Segundo ítem del tercer lote, elegido por el usuario. `edadVirtualEquipo`
(sección "EDAD VIRTUAL", más arriba) ya da un proxy simple de Kijima
comparando medianas de dos mitades de la muestra — honesto, pero no es el
factor q real de los modelos de renovación imperfecta de Kijima (1989),
que requieren resolver una verosimilitud no lineal. Esta sección sí lo
hace, con los dos modelos clásicos de la literatura (ambos con V₀=0):
**Tipo I** (ARA1): V_n = V_{n-1} + q·X_n — la reparación reduce solo el
daño acumulado en el ÚLTIMO intervalo. **Tipo II** (ARA∞): V_n =
q·(V_{n-1} + X_n) — la reparación reduce TODA la edad virtual acumulada.
Ambos coinciden exactamente en los extremos (q=0 ⇒ proceso de renovación,
"como nuevo" cada vez; q=1 ⇒ edad real sin ningún efecto de reparación) y
solo difieren en el rango intermedio.

**`logic.js`**: `kijimaEquipo(horomFallas, horomActual)`. Reusa
`_observacionesEquipoConCensura` (extraída de `ajusteWeibullEquipoCensurado`
de la sección anterior para no duplicar la construcción de intervalos +
censura) y `ajusteWeibullCensurado` para fijar β/η de ese equipo (no se
optimizan junto con q — evita sobreparametrizar con pocos datos). Cada
intervalo aporta ln f(V_{n-1}+X_n) − ln S(V_{n-1}) a la log-verosimilitud
(la misma idea de "vida remanente condicional" que ya usa `rulWeibull`); el
tramo final censurado aporta ln S(V_{n-1}+X_n) − ln S(V_{n-1}) en vez de la
densidad. q∈[0,1] se resuelve con **búsqueda de sección áurea**
(`_seccionAureaMax`, sin derivadas, sin librería externa — a diferencia del
β de Weibull, acá no hay una ecuación trascendente cerrada de una sola raíz
porque V_n es recursivo). Se ajustan AMBOS tipos y se elige el de mayor
verosimilitud. Mínimo 5 fallas reales (mismo umbral que Weibull censurado).

Derivación verificada con script Python independiente: simulando procesos
Kijima sintéticos con q y tipo conocidos (Tipo I y Tipo II, q=0/0,3/0,7/1),
la búsqueda de sección áurea recupera el tipo correcto por verosimilitud
en los 3 casos intermedios (en los extremos q=0/q=1 ambos tipos coinciden
exactamente, como predice la teoría) y coincide con una búsqueda
exhaustiva en grilla de 1000 puntos (mismo q̂, misma verosimilitud) — no es
un óptimo local espurio de la sección áurea.

6 tests nuevos en `tests/kijima.test.js` (857/857 en total): mínimo de 5
fallas; caso calculado y verificado con Python (12 intervalos, ajuste base
β=1,71/η=763, Tipo I q=0,00 vs Tipo II q=0,16 con mayor verosimilitud →
elegido Tipo II); mismo caso con censura real (equipo en servicio, cambia
el ajuste base y el q); verificación de que en el límite q=0 ambos tipos
coinciden con log-verosimilitud idéntica; interpretación según el rango de
q; q siempre en [0,1].

**`equiposConSaludFlota`** (misma función que ya agrega `weibull` y
`edadVirtual` por equipo): nuevo campo `kijima` — mismo horómetro de
fallas ya usado por Weibull/Edad Virtual, sin dato nuevo.

**`pred.js`**: nueva sub-vista "🔁 Kijima — Factor de Restauración" en
Predictivo, tabla por equipo con N° fallas (+censura si aplica), β/η,
modelo elegido, q e interpretación.

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`equipos`/`correctivos`): mismos 12 intervalos ya verificados en Python —
la vista renderiza "CN-1 · 12 · 1,71 / 763h · Tipo II · 0,16 ·
Restauración alta", coincidiendo exactamente. Nota de proceso: la
selección del `<select>` vía Playwright competía ocasionalmente con el
refresco asíncrono post-login de la app (`_refrescarDatosPostLogin`, que
puede re-renderizar la pestaña activa mientras corre `_sbLoadHeavy` en
paralelo) — se verificó fijando el valor del selector e invocando
`renders.pred()` directamente, el mismo código que su `onchange` ejecuta,
sin esa carrera de temporización. Sin errores de JavaScript de la
aplicación.

### 51. Mantenimiento Oportunista Multi-Componente (2026-09-17)

Tercer ítem del tercer lote. Idea real de mantenimiento oportunista
(estándar de la industria — "group maintenance under opportunities"): si un
equipo va a parar igual porque un componente está por fallar, conviene
aprovechar esa MISMA parada para adelantar el cambio de otros componentes
que ya están cerca de su propio fin de vida — evita una segunda parada
independiente para lo mismo dentro de poco. Reusa el RUL híbrido ya
construido (`rulHibridoPorComponente`) — ninguna medición nueva, solo se
cruza contra sí mismo por equipo.

El "ahorro" NO asume un costo de falla inventado (Cf sigue bloqueado por
falta de dato real — Edad de Reemplazo Óptima y Value of Information ya
quedaron declarados bloqueados por esta misma razón). Es más acotado y sí
100% real: el costo de MANO DE OBRA de una parada de mantenimiento
adicional que se evita — duración real mediana de una intervención
(`duracionesReparacionFlotaHoras`, ya existente, usada por el Monte Carlo
de disponibilidad) × tarifa HH real configurada (`tarifa_hh`, ya usada en
`kpi.js`/`metas.js`/`dash.js`/etc. para costos de mano de obra en todo el
resto de la app). Ninguno de los dos números se inventa para esta
función — ambos ya existían con otro propósito.

El horizonte de "cuán cerca es cerca" para agrupar NO es un umbral
arbitrario nuevo: se usa `frecPM` del propio equipo (cada cuánto se
planifica su mantenimiento real) — si a otro componente le queda más de un
ciclo de PM de vida remanente respecto al que dispara la parada, todavía
falta demasiado para que valga la pena adelantarlo.

**`logic.js`**: dos funciones nuevas.
- `oportunidadMantenimiento(componentesEquipo, horizonHoras, ahorroPorStop)`
  — evalúa UN equipo: ordena sus componentes por RUL efectivo (el mismo
  B10 ajustado por aceite que ya usa la vista RUL cuando hay aceleración
  detectada), el de menor RUL "dispara", cualquier otro dentro del
  horizonte se marca candidato. Requiere ≥2 componentes con RUL real —
  devuelve `null` si no hay nada que agrupar o ninguno cae dentro del
  horizonte.
- `oportunidadesMantenimientoFlota(rulLista, eq, ot, tarifaHH)` — agrupa
  por equipo y evalúa cada uno con su propio `frecPM` real. Sin duración
  mediana real o sin tarifa configurada (>0), devuelve `[]`; equipos sin
  `frecPM` real se omiten (sin ese dato no hay horizonte real de
  planificación).

10 tests nuevos en `tests/oportunidadMantenimiento.test.js` (867/867 en
total): mínimo de 2 componentes con RUL; sin horizonte real devuelve null;
caso calculado a mano (Motor dispara, Frenos dentro del horizonte entra,
Neumático fuera del horizonte no entra); varios candidatos suman el
ahorro; usa el RUL AJUSTADO por aceite cuando está disponible, no el
base; sin duración real o sin tarifa configurada devuelve `[]`; equipos
sin `frecPM` se omiten; caso end-to-end con duración mediana real
calculada a mano; orden por cantidad de candidatos.

**`pred.js`**: nueva sub-vista "🧰 Mantenimiento Oportunista" en
Predictivo — tabla por equipo con el componente que dispara la parada, los
candidatos a adelantar (con la diferencia de horas) y el ahorro estimado.

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`equipos`/`correctivos`): con 2 componentes reales por equipo (Motor y
Frenos, con horómetros e intervalos sintéticos), verificado
independientemente con Python (misma regresión de rango mediano ya
verificada en sesiones anteriores) — Motor: β=11,46/η=519,
edadActual=500 → B10=6,6h; Frenos: β=17,33/η=528, edadActual=400 →
B10=65,7h; diferencia=59,1h (dentro del frecPM=250 real) → Frenos
candidato; ahorro = mediana(11×6h,11×8h)=7h × tarifa 25.000 = $175.000. La
vista renderiza "CN-1 · Motor (7h) · Frenos (+59h) · $175.000",
coincidiendo exactamente. Sin errores de JavaScript de la aplicación.

### 52. Simulador What-If de políticas de mantenimiento (2026-09-17)

Cuarto ítem del tercer lote. `simulacionMonteCarloDisponibilidad` (sección
anterior) ya remuestrea (bootstrap) los intervalos y duraciones REALES de
toda la flota para proyectar un rango de disponibilidad futura — esta
herramienta agrega la posibilidad de probar un escenario hipotético
("¿y si...?") escalando esa MISMA distribución empírica por un factor que
elige quien pregunta, nunca un valor que el sistema inventa: análisis de
sensibilidad sobre datos reales (técnica estándar de simulación), no una
predicción nueva.

**`logic.js`**: dos funciones nuevas, ambas complemento de
`simulacionMonteCarloDisponibilidad` (sin tocarla).
- `simulacionWhatIf(intervalosDias, duracionesHoras, horizonteDias,
  horasFlotaDiarias, nSimulaciones, factorIntervalo, factorDuracion,
  rngOpcional)` — escala los intervalos por `factorIntervalo` (>1 =
  fallas más espaciadas, ej. "¿y si mejoramos la confiabilidad un 20%?" →
  1.2) y las duraciones por `factorDuracion` (<1 = reparaciones más
  rápidas, ej. "¿y si reparamos 30% más rápido?" → 0.7), y corre el mismo
  núcleo de Monte Carlo sobre esa muestra escalada. Con factores=1
  coincide EXACTO con la función base.
- `compararEscenariosMantenimiento(...)` — corre el escenario base (datos
  reales, sin escalar) y el what-if con la misma muestra/horizonte, y
  calcula el delta de disponibilidad P50 y de fallas esperadas.

9 tests nuevos en `tests/simulacionWhatIf.test.js` (876/876 en total),
reusando el mismo patrón de "muestra constante" que ya usa
`simulacionMonteCarloDisponibilidad.test.js` (intervalos/duraciones
constantes → resultado exacto y determinístico, calculable a mano sin
depender de RNG): factores=1 coincide con la base; factorIntervalo=2 con
intervalos de 10 días pasa de 2 a 1 falla esperada; factorDuracion=0,5
mantiene las mismas fallas pero reduce el downtime a la mitad; ambos
factores combinados; factores inválidos (≤0) caen a 1; sin muestra
suficiente devuelve `null` igual que el núcleo; el delta es exactamente 0
sin cambios.

**`disp.js`** (Disponibilidad Mecánica): nueva tarjeta "🧪 Simulador
What-If de políticas de mantenimiento", justo debajo de la proyección
Monte Carlo existente (misma muestra `_mcIv`/`_mcDu`/`_mcHorasFlota`, sin
medición nueva) — dos campos numéricos ("Mejora de confiabilidad", "Mejora
de velocidad de reparación", ambos en %, elegidos por quien mira la
pantalla) más un selector de horizonte (30/60/90 días), con una tabla
Base vs What-If (disponibilidad P50, rango P10-P90, fallas esperadas, con
el delta resaltado en verde/rojo). Botón "Resetear" cuando hay algún
porcentaje distinto de 0.

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`equipos`/`correctivos`): con 0%/0% el escenario coincide con la base
(96,3% a 90 días); aplicando 50% de mejora de confiabilidad y 40% de
mejora de velocidad de reparación, la disponibilidad sube a 98,6% (+2,3pp)
y las fallas esperadas bajan de 8 a 5 — la tabla y los controles
reaccionan correctamente a los cambios de input. Sin errores de
JavaScript de la aplicación.

### 53. GRP — Proceso de Renovación General: simulación de trayectorias (2026-09-17)

Quinto y último ítem del tercer lote, cierra la ronda de algoritmos "más
ambiciosos" elegida por el usuario. "GRP" (General Renewal Process, Kijima
1989) es el nombre formal del modelo del que Tipo I/II (sección anterior)
son los dos casos concretos ya implementados — acá se agrega la
SIMULACIÓN hacia adelante: en vez de solo estimar q a partir del
historial, proyecta miles de trayectorias futuras posibles de fallas para
UN equipo puntual, partiendo de su propia edad virtual actual y su propio
β/η/q/tipo — a diferencia de `simulacionMonteCarloDisponibilidad` (que
remuestrea intervalos reales de TODA la flota, un promedio sin memoria de
reparación imperfecta), acá cada equipo respeta su propio historial de qué
tan bien lo restauran sus reparaciones.

**`logic.js`**: tres piezas nuevas.
- `_edadVirtualActual(obs, q, tipoII)` — replica la recursión de Kijima
  sobre las mismas observaciones ya usadas para ajustar q, pero el tramo
  final CENSURADO (equipo sigue en servicio, sin reparación todavía) solo
  suma el tiempo transcurrido sin aplicar el factor q — no hubo reparación
  que restaure nada en ese tramo. Se agregó como campo nuevo
  `edadVirtualActual` al resultado de `kijimaEquipo` (aditivo, no rompe
  ningún test ni sitio existente que ya lo consume).
- `simulacionTrayectoriasGRP(beta, eta, q, tipoII, edadVirtualActual,
  horizonteHoras, nSimulaciones, rngOpcional)` — núcleo: dado que el
  equipo está a edad virtual v, el tiempo hasta la próxima falla se
  obtiene invirtiendo la supervivencia condicional S(v+x)/S(v)=1−u (mismo
  principio que `rulWeibull`, pero generando un valor aleatorio u en vez
  de un percentil fijo p): v_falla=η·(−ln(S(v)·(1−u)))^(1/β), x=v_falla−v.
  Tras cada falla simulada, la edad virtual se actualiza con la MISMA
  recursión de Kijima (Tipo I: v+q·x; Tipo II: q·v_falla).
- `simulacionTrayectoriasGRPDesdeKijima(ajusteKijima, horizonteHoras,
  nSimulaciones, rngOpcional)` — wrapper que toma directamente el
  resultado de `kijimaEquipo`.

Verificado con script Python independiente: con q=0 (cualquier tipo se
vuelven idénticos en ese extremo) la simulación GRP coincide EXACTO
(0,000% de diferencia en 20.000 corridas) con un proceso de renovación
clásico muestreado directo — confirma que la recursión colapsa
correctamente al caso simple. Con q creciente (peor restauración), el
número esperado de fallas en el mismo horizonte sube monótonamente
(3,0→4,6→6,4→9,0 fallas para q=0/0,3/0,6/1,0). Caso determinístico (rng
que siempre devuelve el mismo u=0,5) calculado paso a paso en Python:
Tipo I q=0,4 da exactamente 6 fallas en 6 pasos con longitudes decrecientes
(832,6h → 297,1h), usado como test exacto.

9 tests nuevos en `tests/simulacionTrayectoriasGRP.test.js` (885/885 en
total): sin beta/eta/horizonte válidos devuelve `null`; caso determinístico
q=0 (3 fallas siempre, ambos tipos idénticos); caso determinístico Tipo I
q=0,4 (6 fallas, trayectoria verificada paso a paso); monotonía respecto a
q; q fuera de [0,1] cae a 0; P10≤P50≤P90 con rng real; nSimulaciones
inválido cae al default; integración completa con `kijimaEquipo` real
(mismo caso ya verificado en `tests/kijima.test.js`).

**`pred.js`**: la sub-vista "Kijima" ahora agrega una segunda tabla "GRP —
Proyección de fallas por equipo (próximos 30 días)" con edad virtual
actual, fallas esperadas (P10–P50–P90) y probabilidad de al menos una
falla, para cada equipo con ajuste Kijima real (horizonte en horas =
hrsDia del equipo × 30 días).

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`equipos`/`correctivos`): mismo caso de Kijima ya verificado (β=1,71,
η=763h, Tipo II, q=0,16) — `edadVirtualActual` renderiza 201,3h,
coincidiendo exacto con una réplica manual de la recursión en Python sobre
los mismos 12 intervalos reales. La tabla GRP muestra fallas esperadas
0–0–1 y 37% de probabilidad de al menos una falla en los próximos 30 días
para ese equipo. Sin errores de JavaScript de la aplicación.

Con esto se completan los 5 ítems del tercer lote "más ambicioso" elegido
por el usuario (Weibull con censura correcta, Kijima Tipo I/II,
Mantenimiento Oportunista, Simulador What-If, GRP) — sumados a los 10 de
los dos lotes anteriores, 15 herramientas nuevas de confiabilidad/
mantenimiento predictivo implementadas, testeadas (885/885) y verificadas
visualmente en esta sesión, todas con datos 100% reales o análisis de
sensibilidad explícitamente etiquetado como tal, sin ningún valor
inventado. Quedan pendientes de decidir con el usuario: Frailty Model y
Copulas (deferred desde la propuesta original, marcados como alto riesgo
de sobre-ingeniería sin una librería estadística real) y Value of
Information (bloqueado por falta de dato real de costo de falla, igual
que Edad de Reemplazo Óptima).

### 54. Corrección de dato real + aviso de concentración de gasto en Costo Relativo de Mantenimiento (2026-09-17)

El usuario reportó que el Costo Relativo de Mantenimiento de CN-9502
(pestaña Stock & Insumos → Costos → 💰 Costo Relativo de Mantenimiento) no
podía ser real (83,6% anual). Investigación con SQL directo contra
`ordenes_compra_historico` (proyecto real `jyhpfwivhwzylkzxrsbt`) encontró
la causa exacta: una línea del 19-10-2023 ("Mts. Flexible 3/4 R2 9850",
`precioUnit`=$12.791.624) tenía un error de tipeo real — las otras 2 veces
que se compró el mismo ítem en toda la base costó $139.997 (91 veces
menos). Esa única línea era el 94% del gasto histórico total atribuido a
CN-9502. `ordenesSinOutliers` (el filtro de outliers ya existente, usado
en otras vistas) no lo detectaba porque exige ≥5 compras comparables del
mismo ítem para calcular una mediana confiable, y acá había solo 3.

**Corrección de dato real**: se corrigió la fila real en
`ordenes_compra_historico` (`precioUnit` 12.791.624→139.997, `costo`
recalculado a 19×139.997=2.659.943, mismo precio que las otras 2 compras
del mismo ítem — no un valor inventado, el mismo dato que ya existía 2
veces en la base). CN-9502 pasa de 83,6%/año (falso) a 4,7%/año (real,
verificado independientemente con SQL antes y después del cambio).

**`logic.js`**: `_concentracionMaximaOC(ocEquipo)` — chequeo
complementario e independiente de `ordenesSinOutliers`: sin comparar
contra el precio "normal" de un ítem (que puede no tener suficientes
comparables, como en este caso real), simplemente avisa cuando UNA sola
línea explica una fracción desproporcionada (≥50%) del gasto TOTAL
histórico de ESE equipo — la misma señal que hubiera hecho evidente el
error real con solo mirar la tabla. Umbral de 50% elegido con los datos
reales de TODA la flota (no arbitrario): varias reparaciones grandes
legítimas (motor/componente mayor, mismo precio compartido por varios
camiones del mismo modelo) llegan a ~35% de concentración con historiales
largos (hasta 750 líneas) sin ser un error — 50% separa esos casos
reales de los que sí resultaron errores de tipeo (91%, 94%, 98% en los
casos reales encontrados al revisar la flota completa). Mínimo 3 líneas
válidas. Integrado como campo `concentracionMaxima` en el resultado de
`costoRelativoMantenimiento` (ausente cuando no aplica — no forzado a
`null` explícito para no ensuciar el objeto en el caso normal).

10 tests nuevos en `tests/costoRelativoMantenimiento.test.js` (892/892 en
total): mínimo de 3 líneas; sin concentración cuando el gasto es parejo;
el caso real de CN-9502 replicado exacto (97,9% con los mismos 3 números
reales); una concentración real y legítima (~35%, historial largo) NO se
marca como sospechosa; líneas sin costo positivo se ignoran; integración
con `costoRelativoMantenimiento` (el campo aparece solo cuando aplica).

**`cos.js`**: ícono ⚠️ junto al % Anual cuando `concentracionMaxima` está
presente, con tooltip (detalle del ítem, fecha, % del total) al pasar el
mouse, más una nota explicativa debajo de la tabla que menciona el caso
real de CN-9502 ya corregido como referencia. No bloquea ni oculta el
dato — es una señal para revisar, nunca una decisión automática (mismo
principio que el resto de las señales de esta sesión).

Verificado visualmente en navegador (Playwright ad-hoc, mock de
`equipos`/`ordenes_compra_historico`) con un caso sintético de
concentración: el ⚠️ aparece junto al % Anual con el tooltip correcto y la
nota explicativa se muestra bajo la tabla. Sin errores de JavaScript de
la aplicación.

### 55. Tarjeta "Neumáticos Críticos" en el Dashboard (2026-09-17)

El usuario pasó una propuesta de "dashboard gerencial" con 4 tarjetas
nuevas. Verificación contra el código real: 3 de las 4 ya existen y ya se
muestran hoy (Disponibilidad Mecánica, Urgentes/Próximas/Cumplimiento PM,
Presupuesto vs Real) — agregarlas de nuevo hubiera sido pura duplicación.
La afirmación de que el OCR de neumáticos "tilda de forma inteligente si
hay daño severo" es falsa: el esquema real
(`supabase/functions/leer-chequeo-neumaticos/index.ts`) solo transcribe
valores literales (`posicion, serie, presion, temperatura, remExt, remInt,
comentarios, incierto`), y `incierto` marca únicamente letra manuscrita
ambigua, nunca un juicio de severidad. `S.g('categoria')` tampoco existe
como clave real del store.

Lo único real y no duplicado de la propuesta: `dash.js` ya calculaba
`neuCrit` (línea ~281, cantidad de neumáticos operativos que llegaron a su
límite real de cambio — remanente de goma u horas de uso, vía la función
ya existente `neuDebeCambiar()`, sin relación con el OCR) pero nunca lo
mostraba en ninguna tarjeta.

Se agregó una tarjeta "Neumáticos Críticos" junto a "Stock Crítico" (fila
de KPIs avanzados de Costos, mismo estilo visual: borde superior verde/
ámbar/rojo según 0 / ≤3 / >3, subtítulo con el total de neumáticos
operativos de referencia). Sin función pura nueva ni cambio de cálculo —
solo expone en la UI un valor que ya se calculaba en cada apertura del
Dashboard. Verificado visualmente en navegador (Playwright ad-hoc,
inyectando 2 neumáticos vía `S.s('neu', […])`, uno con remanente bajo el
piso de retiro y otro sano): la tarjeta muestra "1 · De 2 operativos",
igual al resto de las tarjetas de esa fila. 892/892 tests (sin tests
nuevos — no hay lógica pura nueva que cubrir) y build limpio.

### 56. Etiquetas de indicador de adelanto/retraso en el Dashboard (2026-09-19)

El usuario compartió un lote de capturas de posts genéricos (indicadores
de adelanto/retraso en mantenimiento, la cadena "mantenimiento hasta el
EVA", conceptos de bases de datos, cheat sheets de Machine Learning).
Fact-check honesto de cuáles aplican realmente a este sistema: los
conceptos de bases de datos y los cheat sheets de ML (CNN, PCA, Bayes,
regularización, ensemble learning) no aplican — el sistema usa modelos
estadísticos de confiabilidad (Weibull, Kaplan-Meier, Crow-AMSAA, Kijima,
GRP), no redes neuronales ni visión por computadora entrenada localmente,
y agregar eso sería sobre-ingeniería sin caso de uso real. La cadena
Mantenimiento→EVA es conceptualmente correcta pero no implementable: para
calcular EVA/EBIT de verdad haría falta Ingresos reales y costo de
capital de Besalco, datos que no están cargados en Supabase — mismo
criterio de "no inventar" de toda la sesión.

Lo único real e implementable: la clasificación de **indicadores de
adelanto (leading)** — predictivos, corregibles en el momento — vs.
**indicadores de retraso (lagging)** — resultado histórico ya cerrado,
sirven para explicar lo que pasó, no para corregirlo. Se agregó
`_dashBadgeTendencia(tipo)` en `dash.js`, una etiqueta visual pequeña
(📈 Adelanto / 📉 Retraso, con tooltip explicativo) sin tocar ningún
cálculo existente. Aplicada a 8 tarjetas donde la clasificación es
inequívoca:

- **De retraso**: Disponibilidad Mecánica, MTBF Real de Flota, Costo/RAV,
  Confiabilidad (R) — resultado del período ya cerrado.
- **De adelanto**: Cumplimiento PM, Backlog, Stock Crítico, Neumáticos
  Críticos — accionables ahora, antes de que se conviertan en una falla o
  un costo.

Deliberadamente NO se etiquetaron el resto de las tarjetas (Urgentes,
Próximas, Gasto del mes, OTs Pendientes, % Flota sin falla, Disp.
Inherente, Retrabajo, Criticidad, Dotación) — varias son ambiguas o no
encajan limpio en ninguno de los dos grupos (ej. Criticidad es una
clasificación estática de riesgo, no una tendencia), y forzar una
etiqueta ahí sería el mismo tipo de señal inventada que se evitó toda la
sesión.

Verificado visualmente en navegador (Playwright ad-hoc): exactamente 4
tarjetas con "📉 Retraso" y 4 con "📈 Adelanto", sin romper el layout de
ninguna. 892/892 tests (sin tests nuevos — es una etiqueta visual fija por
tarjeta, sin lógica pura que cubrir) y build limpio.

### 57. Intervalo de confianza del MTBF — método chi-cuadrado exacto (2026-09-19)

El usuario compartió un lote de cheat sheets sobre estadística inferencial
(p-value, intervalos de confianza, hipótesis, distribución, outliers).
Fact-check: la mayoría de esos conceptos ya viven dentro del sistema, solo
que no se ven como "cheat sheet" — hypothesis testing/chi-cuadrado ya
existe en `testChiCuadradoUniforme` (patrones ocultos de falla), la forma
de la distribución (skewness) ya existe como el parámetro β de Weibull, la
estimación de máxima verosimilitud ya existe en `ajusteWeibullCensurado`
(Newton-Raphson), y la detección de outliers ya existe (con otro método)
en `ordenesSinOutliers`/`_concentracionMaximaOC`.

Lo que sí faltaba de verdad: **intervalos de confianza**. El MTBF (y todo
lo que se deriva de él — Confiabilidad, Disp. Inherente) se mostraba como
un número suelto, con la misma "seguridad" visual para un equipo con 2
fallas que para uno con 50 — estadísticamente esos dos casos tienen
incertidumbre muy distinta. Verificado con datos reales de la flota
(Supabase `jyhpfwivhwzylkzxrsbt`): CN-10155 (2 fallas, horómetros
729/1159) da MTBF=430h pero IC95%=[77h,16.984h] — el punto casi no dice
nada por sí solo con 1 solo intervalo; CN-5133 (53 fallas) da MTBF=143h
con IC95%=[109h,191h] — mucho más confiable con una muestra grande.

**`logic.js`**: `intervaloConfianzaMTBF(horomFallas,confianza)` — mismo
input crudo y mismo mínimo de datos que `C.mtbfReal` (≥2 fallas válidas).
Método estándar de ingeniería de confiabilidad (NIST Engineering
Statistics Handbook 8.1.5.2, ensayo terminado por tiempo): con r =
intervalos entre fallas observados en un tiempo total T, bajo tasa de
falla constante (mismo supuesto que ya usa `confiabilidadReal`/
`mtbfReal`):
- límite inferior = 2T / χ²(1-α/2; 2r+2)
- límite superior = 2T / χ²(α/2; 2r)

Los grados de libertad acá SIEMPRE salen pares (2r o 2r+2), así que en vez
de una aproximación numérica (Wilson-Hilferty, la que usan la mayoría de
las calculadoras "a mano") se implementó la **CDF exacta** de
chi-cuadrado vía la relación cerrada con Poisson: con df=2k (k entero),
F(x)=1-Σ PoissonPMF(i,x/2) para i=0..k-1 — reutiliza `_poissonPMF` (ya
con log-factorial, sin desborde) en vez de necesitar una función gamma
aparte. El cuantil (inversa) se obtiene por búsqueda binaria sobre esa
CDF exacta y monótona. Verificado contra `scipy.stats.chi2.ppf` antes de
escribir los tests: coincide a más de 10 decimales en todos los casos
probados (r=1, 2, 5, 20) — no es una aproximación, es exacto.

7 tests en `tests/intervaloConfianzaMTBF.test.js` (899/899 en total): los
2 casos reales de arriba (CN-10155, CN-5133) con los números exactos;
insensibilidad al orden/ceros intercalados; nivel de confianza custom
(90% da un IC más angosto que 95%, el punto no cambia); confianza fuera
de (0,1) cae al 95% default.

**`cos.js`** (Stock & Insumos → Costos → MTBF/MTTR): bajo el MTBF de cada
equipo se muestra "IC95%: X–Yh (N intervalos)", con ⚠️ y color ámbar
cuando la muestra es chica (r&lt;5) — el mismo umbral que ya usa
`ajusteWeibull` para exigir un mínimo de intervalos antes de ajustar una
curva. No bloquea ni cambia el MTBF puntual — es una señal de cuánto
confiar en él, mismo principio que el resto de las señales de esta
sesión. Verificado visualmente en navegador (Playwright ad-hoc, datos
reales de CN-10155 inyectados directo al store): la tarjeta muestra
"430" con "⚠️ IC95%: 77–16.984h (1 intervalo)" debajo, tal como se
diseñó.

### 58. Error estándar / intervalo de confianza del MTTR (2026-09-19)

Continuación directa de la sección 57: el usuario compartió más cheat
sheets de estadística (scatter plot, error estándar). El scatter plot no
aporta nada nuevo (el gráfico de probabilidad Weibull ya es, en esencia,
un scatter plot con regresión). El **Error Estándar** sí es una pieza real
y análoga a lo que se hizo para el MTBF, pero para el **MTTR**: a
diferencia del MTBF (un conteo de fallas por unidad de tiempo — proceso
de Poisson/exponencial, por eso usó chi-cuadrado), el MTTR es un promedio
de duraciones individuales — el caso clásico de libro de Error Estándar
de la media: SE = s/√n, con IC = media ± z(1-α/2)·SE.

**`logic.js`**: `_normInv(p)` — aproximación racional de Acklam (2003)
para el cuantil de la normal estándar (error relativo &lt;1.15e-9). A
diferencia del chi-cuadrado del MTBF (que sí tiene forma cerrada vía
Poisson porque sus grados de libertad siempre salen pares), la inversa de
la normal NO tiene forma cerrada — cualquier implementación real usa una
aproximación numérica como esta, la misma familia de algoritmo que usan R
y SciPy como fallback. Verificado contra `scipy.stats.norm.ppf` antes de
escribir los tests: coincide a 7-9 cifras significativas.

`errorEstandarMTTR(duraciones,confianza)` — mismo input crudo y mínimo de
datos que `C.mttrReal` (≥2 reparaciones con duración registrada). Es una
aproximación NORMAL (cuantil z, no t de Student) — válida para muestras
razonablemente grandes; con muestras muy chicas (&lt;5, mismo umbral que ya
usa `ajusteWeibull`/el aviso del IC del MTBF) la cobertura real es algo
menor a la nominal, marcado visualmente en la UI en vez de mostrar una
falsa precisión. El límite inferior se acota a 0 (una duración de
reparación negativa no tiene sentido).

6 tests en `tests/errorEstandarMTTR.test.js` (905/905 en total, con
`intervaloConfianzaMTBF`): sin datos reales de Supabase disponibles en
esta sesión (el MCP de Supabase no respondió), se usaron casos sintéticos
—pero verificados independientemente contra scipy antes de escribir el
test, mismo estándar que los casos reales de las secciones anteriores—
con 2 reparaciones muy dispersas (SE grande, IC muy ancho, incluso
negativo antes de acotar a 0) y 20 reparaciones consistentes (SE chico,
IC angosto); insensibilidad a entradas sin duración; nivel de confianza
custom; confianza fuera de rango cae al 95% default.

**`cos.js`** (misma tabla MTBF/MTTR): bajo el MTTR de cada equipo se
muestra "IC95%: X–Yh (N reparaciones)", con ⚠️ y color ámbar cuando la
muestra es chica (n&lt;5) — mismo patrón visual que el IC del MTBF, mismo
umbral. Verificado visualmente en navegador (Playwright ad-hoc, 2
reparaciones sintéticas de 2h y 10h): la tarjeta muestra "6" con "⚠️
IC95%: 0–13,8h (2 reparaciones)" debajo, tal como se diseñó.

### 59. Pulido visual del Dashboard — solo look, sin tocar cálculos (2026-09-20)

El usuario compartió capturas de una conversación con Grok mostrando
mockups de una app ficticia ("FleetHealth"/"FleetShield", datos
inventados: sensores de vibración, equipos que no existen) con sugerencias
genéricas de UI: más aire en móvil, jerarquía tipográfica más clara,
tarjetas más pulidas, badges más refinados. Se tomó explícitamente solo el
*look* — nunca el contenido inventado de esos mockups — y se aplicó al
Dashboard real, sin tocar ningún cálculo ni agregar ningún dato nuevo.

**`dash.js`**: `badgeEnVivo` y `_dashBadgeTendencia()` (📈 Adelanto/📉
Retraso, sección 56) pasaron de texto plano a badges tipo *pill*
(fondo tenue, borde sutil, bordes redondeados) — mismo patrón visual que
los mockups de referencia. Más espaciado: el grid de Urgentes/Próximas/
Cumplimiento/MTBF/Gasto/OTs pasó de `gap:10px` a `12px` y el padding de
sus tarjetas de `14px` a `16px`; el grid de 8 KPIs avanzados de Costos
pasó de `gap:8px` a `10px` y `padding:10px` a `12px`.

**`index.html`**: en el breakpoint móvil (`max-width:768px`) ya existente,
se agregó `#s-dash .dg2{gap:16px!important}` — más aire todavía en
pantallas chicas, mismo mecanismo `!important` que ya usaba ese bloque
para las columnas de los grids (el gap base de cada tarjeta viene fijado
inline desde `dash.js` junto con sus colores condicionales por dato, así
que no se movió a una clase para no reescribir ~15 tarjetas por un
beneficio menor).

No se tocaron bordes/sombras/hover 3D (`#s-dash .card,#s-dash .chart-box`)
ni los estados "sin dato" (ya usan color atenuado + texto explicativo,
suficientemente elegantes para el tamaño de estas tarjetas — el estado
vacío ilustrado de los mockups de referencia es para paneles grandes, no
para tarjetas KPI chicas).

Verificado visualmente en navegador (Playwright ad-hoc, capturas a 1280px
y 390px de ancho): badges como pills, tarjetas con más aire, grid móvil
de 2 columnas con el espaciado ampliado. 905/905 tests (sin tests nuevos
— cambio puramente visual, sin lógica pura) y build limpio.

### 60. R² (bondad de ajuste) en la proyección de desgaste de neumáticos (2026-09-20)

Continuación de la revisión de cheat sheets de estadística (correlación
vs. causación, hipergeométrica, exponencial, Pearson, regresión simple/
múltiple, R², análisis de residuos, escalas de medición). La mayoría ya
está cubierta o no aplica: la exponencial ya es la base de
`confiabilidadReal` (R(t)=e^(-t/MTBF)); correlación-vs-causación es una
advertencia general, no una técnica; la hipergeométrica (muestreo sin
reemplazo de un lote finito) no tiene ningún caso de uso real en el
sistema (el stock usa Poisson, tasa de demanda, no un lote finito
muestreado); las escalas de medición son un marco conceptual, no algo
para implementar.

Lo real y faltante: el sistema YA hace regresión lineal (proyección de
desgaste de neumáticos, `neuProyeccion` en index.html) pero nunca
reportaba qué tan bueno es ese ajuste. Peor: el campo `confianza` que sí
existía solo contaba CUÁNTAS mediciones había (3+ = "Alta"), sin mirar si
la recta ajustaba bien — un neumático con 3-4 mediciones muy dispersas
pasaba como "Alta confianza" solo por el número, aunque la recta
explicara casi nada de los datos reales (el mismo error de "solo contar
en vez de interpretar" que motivó esta revisión).

**`logic.js`**: `r2RegresionLineal(pts)` — regresión lineal simple por
mínimos cuadrados + R²=1-SSE/SST (SSE=Σ(y-ŷ)², SST=Σ(y-ȳ)²), fórmula de
libro sin aproximación. Recibe los mismos puntos `{x,y}` que
`neuProyeccion` ya armaba para su propio ajuste — no duplica el cálculo,
solo lo evalúa. null con &lt;2 puntos válidos o si todos los x son iguales
(caso degenerado, sin pendiente que ajustar).

7 tests en `tests/r2RegresionLineal.test.js` (912/912 en total):
verificados independientemente contra numpy antes de escribirlos — ajuste
perfecto (R²=1), ajuste ruidoso sin relación clara (R²≈0.18), caso
realista de desgaste con 8 mediciones y algo de ruido (R²≈0.99); ignora
puntos sin `y`; caso degenerado (todos los y iguales) sin `NaN`.

**`index.html`** (`neuProyeccion`): el bloque de regresión que ya existía
ahí (armaba `nn/sx/sy/sxy/sx2/denom` a mano) ahora llama a
`r2RegresionLineal`, mismo resultado exacto para la pendiente — y de paso
obtiene R². Se agrega el campo `r2Desgaste` al resultado (solo cuando la
proyección ganadora vino de esta regresión, no cuando ganó por horas o
por vida útil objetivo genérica).

**`neu.js`**: la columna "Vida Restante" agrega ⚠️ cuando `r2Desgaste<0.5`
(umbral estándar de "ajuste débil" — coincide con los cheat sheets
compartidos: 0-0.25 débil, 0.25-0.5 moderado), con el valor de R² y una
nota explícita ("la fecha puede no ser confiable") en el tooltip y en el
panel de detalle del neumático. No bloquea ni cambia la proyección — es
una señal para leer el número con más o menos confianza, mismo principio
que el resto de las señales de esta sesión.

Verificado visualmente en navegador (Playwright ad-hoc, historial
sintético de 4 mediciones ruidosas, mismos números que el test de R²≈0.18
en logic.js): la columna Vida Restante muestra "≈0d (0h) ⚠️" y el
tooltip explica el ajuste débil.

### 61. ANOVA de un factor: MTTR por técnico (2026-09-20)

Las comparativas "por técnico" que ya existían (`tecnicosAltoReingreso`,
`tecnicosBajaDocumentacion`, la tabla Por Técnico de Estadística) solo
mostraban porcentajes/promedios crudos, sin ningún test de significancia
— dos técnicos con muestras de tamaño distinto podían verse "distintos"
en la tabla aunque la diferencia fuera puro ruido. `anovaUnFactor(grupos,
minPorGrupo)` parte la varianza total de los datos en varianza ENTRE
grupos (¿cuánto varían los promedios de cada técnico entre sí?) y
varianza DENTRO de cada grupo (¿cuánto varía cada técnico contra su
propio promedio?): si la de ENTRE domina (estadístico F alto), la
diferencia es real, no ruido de muestra.

El p-valor exacto de F requiere la función beta incompleta regularizada
(relación estándar entre las distribuciones F y Beta) — sin fórmula
cerrada simple, se usa el algoritmo estándar de fracción continua
(Numerical Recipes, método de Lentz: `_logGamma`/`_betaContinuaFraccion`/
`_betaIncompletaRegularizada`), el mismo tipo de método numérico ya usado
esta sesión para `_normInv` (cuantil normal). Verificado independientemente
contra `scipy.stats.f_oneway`/`scipy.stats.f.sf` con 5 casos (diferencia
real de 3 grupos, sin diferencia real, 2 grupos, grupo descartado por
muestra chica, valores null/NaN ignorados) — coincide a >9 dígitos
significativos.

Grupos con menos de `minPorGrupo` (default 5, mismo umbral ya usado esta
sesión para el IC del MTBF/MTTR) se descartan ANTES del test — nunca se
calcula significancia sobre una muestra insuficiente para siquiera estimar
bien su propio promedio. Necesita al menos 2 grupos válidos.

Integrado en Estadística → Por Técnico (`estadistica.js`), sobre el MTTR
(duración de reparación, horas, mismo parseo "Xh" que
`duracionesReparacionFlotaHoras`): nueva tarjeta "ANOVA: MTTR por técnico"
con F, p-valor, grados de libertad, un veredicto en texto plano
("diferencia significativa" / "puede ser ruido de muestra") y la tabla de
promedio ± desviación estándar por técnico, ordenada de mayor a menor
MTTR. 7 tests nuevos (`anovaUnFactor.test.js`). Verificado visualmente en
navegador (Playwright ad-hoc, mismos 3 técnicos del test "caso realista":
F=37.672, p≈1.13e-7, tabla ordenada Pedro Soto (8.29h) > Luis Diaz (5h) >
Juan Perez (4.5h), veredicto "significativo" en rojo).

### 62. Confiabilidad de sistema por equipo — RBD en serie (2026-09-20)

Hasta ahora la confiabilidad Weibull (`confiabilidadWeibull`,
`ajusteWeibullCensurado`) se calculaba por tipo de componente a nivel
flota, pero nunca se combinaba a nivel de un equipo concreto: un equipo
puede tener su motor, transmisión y frenos en edades muy distintas, y la
pregunta real del taller es "¿cuál es la probabilidad de que ESTE equipo
llegue sin ninguna falla mayor a las próximas 500h?", no la de un
componente aislado. `confiabilidadSistemaEquipo(componentes,
ajustesPorTipo, horomActualEquipo, horasPeriodo)` cierra ese hueco.

El equipo se modela como un **Diagrama de Bloques de Confiabilidad (RBD)
en serie**: `R_sistema(t) = R_1(t) × R_2(t) × ... × R_n(t)`, la fórmula
estándar para sistemas donde la falla de cualquier componente detiene
todo el equipo — la misma suposición que ya usan `esFallaMTBF` y
`dispDownMap` en el resto del sistema ("cualquier falla para la
máquina"), así que no es un supuesto nuevo, es el que ya regía. Fórmula
verificada contra Wikipedia, Accendo Reliability y ReliaSoft (buscadas
explícitamente para este gap, no una fórmula recordada de memoria).

El punto no trivial es que cada componente YA tiene uso acumulado (edad
distinta de 0) al momento de evaluar el período futuro — usar
`R(horasPeriodo)` directo desde 0 ignoraría el desgaste ya ocurrido y
sobreestimaría la confiabilidad de un componente viejo. Se usa
**confiabilidad condicional**: `R_condicional = R(edad+horasPeriodo) /
R(edad)` (probabilidad de sobrevivir el período adicional DADO que ya
sobrevivió hasta su edad actual), con `edad = horómetro actual del
equipo − horómetro al que se instaló el componente`, acotada a un piso de
0 (nunca negativa, por si hay un error de dato con la fecha de
instalación). `_rWeibullRaw`/`_confiabilidadCondicionalRaw` son los
helpers internos; el ajuste β/η de cada tipo de componente viene de
`ajusteWeibullCensurado` a nivel flota (mismo principio de "nunca
inventar una señal": un componente sin ajuste real para su tipo se
excluye del producto, no se aproxima).

Verificado independientemente con Python antes de escribir el test
(mismas fórmulas, sin depender del código): sistema de 3 componentes con
β/η/edad distintos por componente da R_sistema≈49.1%, con el componente
más débil (frenos, R_condicional≈58.2%) dominando el producto — 5 tests
nuevos (`confiabilidadSistemaEquipo.test.js`) cubren ese caso, exclusión
de componentes sin ajuste, edad negativa acotada a 0, y el caso trivial
de un componente sin uso previo (se reduce a `confiabilidadWeibull`
simple).

Integrado en Historial de Componentes (`histcomp.js`), horizonte fijo de
500h: nueva tarjeta "Confiabilidad de sistema por equipo — próximas 500h
(RBD en serie)" con una fila por equipo (confiabilidad %, color-coded
&lt;50% rojo / &lt;80% amarillo, componentes usados sobre total, y el
componente más débil como el que domina el riesgo), ordenada de menor a
mayor confiabilidad. Verificado en navegador (Playwright, evaluación
atómica de la misma función sobre datos inyectados de 3 componentes:
motor 40000h de edad→97.3%, transmisión 20000h→87.1%, frenos 47500h→98.2%,
R_sistema=83.2%, transmisión como componente más débil).

### 63. Carta de Control I-MR (Individuos y Rango Móvil) — Costo Total Mensual (2026-09-20)

El sistema ya detectaba desvíos de dos formas distintas: `ordenesSinOutliers`/
`aceiteOutliers` comparan cada registro individual contra la mediana de su
propio grupo (un outlier puntual), y CUSUM (`cusumAceite`) detecta una
**tendencia lenta y sostenida** en el aceite. Ninguna de las dos vigila una
serie de un valor por mes (costo total, por ejemplo) para señalar el mes
exacto en que algo cambió de verdad, distinto de la variación normal —
eso es justo lo que hace una **carta de control I-MR** (Individuos y Rango
Móvil), herramienta clásica de Control Estadístico de Procesos (SPC).
`cartaControlIMR(puntos)` cierra ese hueco.

Con la serie de valores individuales `X` (un dato por mes, sin subgrupos —
por eso "Individuos", a diferencia de una carta X-bar/R que necesita varias
muestras por período) y el rango móvil `MR` entre meses consecutivos:
`UCL = X̄ + 2.66·MR̄`, `LCL = X̄ − 2.66·MR̄` (carta Individuos);
`UCL_MR = 3.267·MR̄`, `LCL_MR = 0` (carta de Rango Móvil, un rango nunca es
negativo). Las constantes 2.66 y 3.267 no son arbitrarias — están tabuladas
(2.66 = 3/d2, con d2=1.128 para n=2) y son las mismas que usa cualquier
software de SPC estándar, verificadas contra Wikipedia, Quality Gurus y Six
Sigma DSI (no de memoria). Mínimo 6 puntos (mismo espíritu que el resto de
los umbrales mínimos de esta sesión): con menos, ni la media ni el rango
móvil promedio son una base confiable para fijar un límite.

Verificado independientemente con Python antes de escribir el test: serie
de 9 meses con un valor muy por encima de los demás (300 contra una media
del resto de ~100) da X̄≈122.89, MR̄=28.5, UCL≈198.70, LCL≈47.08,
UCL_MR≈93.11 — el único punto fuera de control es el correcto, y su rango
móvil de entrada también queda marcado. 5 tests nuevos
(`cartaControlIMR.test.js`): mínimo de puntos, filtrado de puntos inválidos,
el caso verificado con Python, una serie estable sin falsos positivos, y
que ordena los puntos por período aunque lleguen desordenados.

Integrado en Costos, HH y Confiabilidad (`cos.js`), vista "Costos por Mes",
sobre la serie ya existente `costoMes[mes].total` (HH + filtros +
lubricantes, ya calculada ahí para la tabla y las tarjetas): nueva tarjeta
"Carta de Control I-MR — Costo Total Mensual" con la línea central y los
límites en texto, un aviso si hay meses fuera de control, y una tabla
Mes/Total/Estado. Verificado en navegador (Playwright: 9 meses sintéticos,
$1.000.000–$1.050.000 la mayoría y un mes en $3.000.000 — único mes
marcado "⚠ Fuera de control" en rojo, los demás "Normal" en verde,
límites mostrados $468.583–$1.998.083).

### 64. Análisis ABC-XYZ de Repuestos (2026-09-20)

`matrizCriticidadRepuestos` (sección anterior) mide **riesgo**
(probabilidad de quiebre × impacto) — responde "¿qué tan grave sería
quedarme sin esto?". `analisisABCXYZRepuestos(movimientos, stk)` responde
una pregunta distinta y complementaria, clásica de gestión de inventario:
**"¿dónde conviene invertir esfuerzo de control?"**, cruzando dos ejes que
hasta ahora no se calculaban en ningún lado del sistema:

- **ABC**: Pareto sobre el valor de consumo anualizado (consumo mensual
  promedio × 12 × precio unitario) — el 20% de los ítems que concentran
  ~80% del gasto son clase A (control estricto), hasta C (bajo valor, no
  vale la pena over-invertir esfuerzo ahí). Umbrales estándar 80/15/5
  acumulado, no inventados (MRPeasy, Eazystock).
- **XYZ**: coeficiente de variación de la demanda mensual (σ/μ), calculado
  sobre TODOS los meses del ítem, incluyendo meses de consumo cero — mismo
  criterio ya establecido en `analisisDemandaRepuestos` (un mes sin
  consumo es un dato real, no un hueco a ignorar; por eso se enumeran los
  meses con `_mesesEntreLista` en vez de solo iterar los meses con
  movimiento real). Umbrales CV≤0.5 (X, estable), 0.5–1.0 (Y, moderada),
  >1.0 (Z, errática) — ajustados hacia arriba respecto al 0.25/0.5 típico
  de retail, apropiado para repuestos (demanda naturalmente más
  intermitente que en un comercio minorista).

Cruzando ambos ejes en una matriz 3×3 se distingue, por ejemplo, un
repuesto caro y predecible (AX: vale la pena un punto de pedido fijo) de
uno caro pero errático (AZ/BZ: vigilar de cerca, no confiar en el
promedio) — matiz que la Matriz de Criticidad (riesgo puro) no captura,
porque dos ítems con la misma probabilidad de quiebre pueden tener
patrones de demanda completamente distintos. Reusa `_DEMANDA_MIN_MESES`
(mínimo 3 meses de historial) y requiere `precioUnit` real — sin eso, el
ítem se excluye (nunca se inventa un precio ni una probabilidad).

Verificado independientemente con Python antes de escribir el test: 4
ítems sintéticos con el MISMO patrón de precio×volumen cruzado
deliberadamente con distinta variabilidad (dos ítems caros con igual
media de consumo pero uno estable y otro errático, quedando en clases ABC
y XYZ distintas) — resultado AX/BZ/CY/CX exacto. 5 tests nuevos
(`analisisABCXYZRepuestos.test.js`). Integrado en Predictivo → nueva
sub-vista "🗂 ABC-XYZ de Repuestos" (`pred.js`), junto a Criticidad de
Repuestos. Verificado en navegador (Playwright: mismos 4 ítems sintéticos,
tabla con clases AX/BZ/CY/CX coincidiendo exactamente con el cálculo
puro).

### 65. Cadena de Markov de Estados de Salud (2026-09-20)

Kijima, GRP y Weibull modelan la confiabilidad de forma **continua**, a
partir del tiempo entre fallas — responden "¿cuándo va a fallar?". Este
enfoque es distinto: el Dashboard ya guarda, día a día, un snapshot del
Score de Salud de cada equipo (`registrarSnapshotSalud`, `saludEquipoHist`
en el store, hasta `SALUD_HIST_DIAS_MAX`=120 días de historial real) — un
historial que hasta ahora solo se usaba para comparar un equipo contra sí
mismo hace 7 días (`tendenciaSaludSemanal`). `matrizTransicionSalud` +
`proyeccionSaludNSemanas` lo explotan de una forma nueva: contar
**transiciones reales observadas** entre estados discretos de salud y
armar una cadena de Markov empírica — útil justo donde Weibull no aplica
bien (salud que sube y baja por carga operacional variable, no un reloj
de desgaste monótono).

Los estados (Sano ≥70, Alerta 55-69, Crítico <55) son los mismos umbrales
que ya usa el Dashboard para avisar un "cruce" (70) y colorear (55) — no
se inventan umbrales nuevos. `matrizTransicionSalud(historicosPorEquipo,
minPorFila)` recorre el historial de CADA equipo buscando, por cada fecha
de inicio, la primera pareja de snapshots con separación real de 4-10 días
(misma ventana de tolerancia que `tendenciaSaludSemanal` para "una
semana"), cuenta las transiciones POOLED entre toda la flota (un equipo
solo no tiene suficientes transiciones; la flota completa sí) y arma la
matriz 3×3. `minPorFila` (default 5, mismo umbral que `minPorGrupo` de
`anovaUnFactor`): si algún estado de origen no junta al menos 5
transiciones reales, se descarta la matriz completa — nunca se inventa
una probabilidad de transición sobre una fila sin base.

`proyeccionSaludNSemanas(resultadoMatriz, estadoActual, nSemanas)`
implementa la ecuación de **Chapman-Kolmogorov** (`P(n) = Pⁿ`):
multiplica el vector de estado por la matriz de transición N veces, dando
la probabilidad de estar en cada estado dentro de N semanas partiendo del
estado actual — no una curva ajustada, la frecuencia real con que la
flota completa pasó de un estado a otro, proyectada hacia adelante.

Verificado independientemente con Python antes de escribir el test: 18
equipos sintéticos, cada uno con exactamente 1 transición semanal real (5×
Sano→Sano, 3× Sano→Alerta, 2× Alerta→Alerta, 3× Alerta→Crítico, 2×
Crítico→Crítico, 3× Crítico→Alerta) dan la matriz esperada (fila Sano:
62.5%/37.5%/0%, fila Alerta: 0%/40%/60%, fila Crítico: 0%/60%/40%) y las
proyecciones a 1, 2 y 3 semanas coinciden a 3+ decimales. 4 tests nuevos
(`matrizTransicionSalud.test.js`).

Integrado en Torre de Control (`torre.js`), panel de detalle de cada
equipo, junto a Weibull y Edad Virtual: "Proyección de salud — 4 semanas",
con el estado actual y la probabilidad de cada estado dentro de un mes,
más la cantidad de transiciones reales de flota que sustentan la matriz
(transparencia sobre cuán robusta es la estimación). Verificado en
navegador (Playwright: mismos 18 equipos sintéticos inyectados en
`saludEquipoHist`, panel muestra "18 transiciones reales de flota",
"Estado actual: Sano", "Sano 15% · Alerta 46% · Crítico 39%" — coincide
exactamente con el cálculo puro a 4 semanas).

### 66. Log-Rank Test — ¿dos curvas de supervivencia son realmente distintas? (2026-09-20)

Kaplan-Meier (sección 24/2026-09-16) calcula la curva de supervivencia real
de un componente, pero no dice si la diferencia ENTRE dos curvas (Motor
vs. Transmisión, dos modelos de equipo, dos ubicaciones) es real o ruido
de muestra chica — el mismo hueco que `anovaUnFactor` cerró para
promedios de MTTR, pero acá para curvas completas de supervivencia, con
censura (equipos que siguen en servicio sin haber fallado todavía), un
dato que un ANOVA o un t-test comunes no pueden usar correctamente.
**Log-Rank Test** es el test estándar no paramétrico para esto, el mismo
que reporta cualquier software/paquete de análisis de supervivencia
(Real Statistics, biostatsquid, cualquier libro de bioestadística).

En cada tiempo de falla real `t_i` (de cualquiera de los dos grupos):
`n_iA`/`n_iB` = observaciones en riesgo en cada grupo, `d_iA`/`d_iB` =
fallas reales ahí. `E_iA = d_i×n_iA/n_i` (fallas esperadas en A si ambos
grupos tuvieran el mismo riesgo). `V_i = d_i×(n_i−d_i)×n_iA×n_iB /
(n_i²×(n_i−1))` (varianza hipergeométrica). `χ² = (ΣO_A−ΣE_A)² / ΣV_i`,
con 1 grado de libertad — reusa el mismo valor crítico de tabla (3.841,
`_CHI2_CRITICO_95`) que ya usaba `testChiCuadradoUniforme`, sin reinventar
esa parte. Mínimo 5 observaciones por grupo (mismo umbral que
Kaplan-Meier).

Verificado independientemente con Python (algoritmo escrito desde cero a
partir de la fórmula estándar, antes de escribir el test, ya que no había
una librería de supervivencia disponible en el sandbox para contrastar):
dos casos, uno con diferencia chica entre 2 grupos de 6 con censura
(χ²≈1.00, no significativo) y uno con diferencia grande entre 2 grupos de
8 (χ²≈16.94, significativo) — 5 tests nuevos (`logRankTest.test.js`).
`kaplanMeierCorrectivosPorComponente` ahora también expone las
observaciones crudas (`obs`) de cada componente, para poder alimentar el
test directamente sin duplicar el agrupamiento sigla+componente.

Integrado en Estadística → Por Componente, debajo de la tabla
Kaplan-Meier: dos selectores para elegir cualquier par de componentes con
historial suficiente, con el resultado (χ², significativo sí/no, cuántas
fallas/observaciones sustentan cada lado) actualizándose al cambiar la
selección. Verificado en navegador (Playwright: Motor con fallas rápidas
vs. Transmisión con fallas lentas, χ²=16.94 idéntico al caso verificado
con Python, mostrando "diferencia real entre las dos curvas").

### 67. Mann-Whitney U — ¿el PM realmente alarga el intervalo, o es ruido? (2026-09-20)

`indiceEfectividadMantenimiento` (sección 30/2026-09-16) compara la
mediana de los intervalos ANTES vs. DESPUÉS de cada PM ejecutado, pero
decidía "efectivo"/"no efectivo" con un **ratio arbitrario** (≥1.2 o
≤0.8) — sin ningún test estadístico atrás. Mismo hueco que
`anovaUnFactor` cerró para promedios de MTTR y `logRankTest` para curvas
de supervivencia, ahora para esta comparación específica. **Mann-Whitney
U** es el test no paramétrico estándar para comparar dos muestras
INDEPENDIENTES sin asumir que los datos son normales (los intervalos de
mantenimiento casi nunca lo son, suelen tener cola larga) y sin censura
(a diferencia de Log-Rank, acá no hace falta: cada intervalo ya está
cerrado).

Se juntan y ordenan ambas muestras, se les asigna un rango (promediando
empates), `U = R_A − n_A(n_A+1)/2`, con varianza corregida por empates:
`σ_U² = (n_A×n_B/12) × [(n+1) − ΣΣ(t³−t)/(n(n−1))]`. `z = (U − n_A×n_B/2)
/ σ_U`, significativo si `|z| > 1.96` (95% de confianza, dos colas).

Verificación reforzada esta vez: además de la fórmula (cualquier libro de
estadística no paramétrica), se pudo instalar `scipy` en el sandbox y
comparar la implementación línea por línea contra
`scipy.stats.mannwhitneyu` (`method='asymptotic'`, `use_continuity=False`)
en 3 casos — incluido uno con empates — coincidiendo con el estadístico U
y el p-valor exacto de scipy a 6 decimales en los tres. Es la
verificación más sólida de toda esta tanda de algoritmos: no solo fórmula
de fuentes, sino contra una librería de referencia real. 6 tests nuevos
(`mannWhitneyU.test.js`).

`indiceEfectividadMantenimiento` ahora incluye `testEstadistico` (el
resultado de `mannWhitneyU` sobre sus propios `intervalosAntes`/
`intervalosDespues`) en su retorno, sin romper ningún consumidor
existente. Integrado en Predictivo → Efectividad del Mantenimiento: una
tarjeta nueva con el z y el veredicto de significancia, debajo de la
interpretación ya existente. Verificado en navegador (Playwright: 8
equipos con PM real, intervalos antes cortos vs. después largos, z=-3.36
idéntico al caso verificado contra scipy, mostrando "diferencia
estadísticamente real").

### 68. Regresión de Cox — Hazard Ratio entre dos grupos (2026-09-20)

`logRankTest` (sección 66) responde "¿la diferencia entre dos curvas es
real o ruido?" — un sí/no. **`coxPHBinario`** cuantifica **cuánto**: un
*hazard ratio* (ej. "Frenos falla 2.08 veces más rápido que Suspensión"),
el número que sirve para una decisión real (¿vale la pena pagar más por
el proveedor que dura más?), no solo confirmar que la diferencia existe.
Reusa exactamente los mismos datos `{tiempo,censurado}` de
`logRankTest`/`kaplanMeier` — mismo punto de integración, sin pedir
ningún dato nuevo.

Verosimilitud parcial de Cox con **aproximación de Breslow** para
empates (la más simple de las dos estándar — mismo criterio "método
práctico, no el más sofisticado" ya usado en el ajuste de Weibull por
rango mediano): `l(β) = Σ[β·s1_i − d_i·log(n0_i + n1_i·e^β)]`, con un
único β (grupoA=referencia, grupoB=comparado — HR>1 implica que grupoB
falla más rápido), optimizado con Newton-Raphson (mismo tipo de
algoritmo que Weibull censurado/Kijima). Error estándar desde la segunda
derivada en el β convergido; significativo si `|β/SE| > 1.96`.

**Verificación reforzada, igual que Mann-Whitney**: se instaló
`statsmodels` en el sandbox (`PHReg`, la implementación de referencia de
Cox en Python) y se comparó la implementación línea por línea — coincide
en β/SE/HR a 5+ decimales. **Hallazgo real durante la verificación**: con
separación perfecta entre grupos (uno falla siempre antes que el otro,
sin superposición de tiempos — el mismo dataset donde Log-Rank da
χ²≈16.94), la verosimilitud parcial no tiene máximo finito: β diverge a
infinito. Se confirmó que `statsmodels` **también diverge** en ese caso
exacto (no es un error de mi implementación, es la patología real del
método) — `coxPHBinario` detecta esto (no converge en 50 iteraciones, o
`|β|>15`) y devuelve `null` en vez de un hazard ratio sin sentido. 4
tests nuevos (`coxPHBinario.test.js`), incluido explícitamente el caso de
divergencia.

Integrado en Estadística → Por Componente, debajo del resultado de
Log-Rank (mismo selector de par de componentes): el hazard ratio con su
intervalo de confianza 95%, o un aviso de que la estimación no converge
para ese par. Verificado en navegador (Playwright: Frenos vs. Suspensión
con superposición real de tiempos, HR=0.48 idéntico al cálculo puro,
"Frenos falla 2.08 veces más rápido que Suspensión").

### 69. Modelo de Colas M/M/c (Erlang C) — Dotación de Taller (2026-09-20)

Dotación de Taller solo comparaba dotación real vs. carga de trabajo con
tendencia — sin ningún modelo matemático real detrás. Un taller es,
matemáticamente, un sistema de colas: correctivos que llegan (arribos
Poisson, tasa λ real), técnicos que los atienden (servidores en
paralelo, c = dotación real), cada uno con un tiempo de reparación real
(tasa de servicio μ=1/MTTR real). **M/M/c** (fórmula de Erlang C) es el
modelo estándar de investigación operativa para esto — un dominio
matemático nuevo en el sistema, distinto de todo lo de
confiabilidad/estadística construido hasta ahora. Responde algo que
nadie contestaba: con la dotación ACTUAL, ¿cuánto tiempo espera en
promedio una OT antes de que un técnico la tome, y qué tan saturado está
el taller?

`a = λ/μ` (carga ofrecida, en Erlangs), `ρ = a/c` (utilización) — el
sistema es inestable (cola crece sin límite) si `ρ≥1`, se devuelve
`null` (nunca un tiempo de espera infinito o negativo). Los términos
`a^k/k!` se acumulan por razón sucesiva (`term_k = term_{k-1}×a/k`) en
vez de factoriales crudos — mismo motivo que ya forzó corregir
`_poissonPMF` en una auditoría anterior de esta sesión (factoriales
grandes desbordan), acá se evita el problema de raíz.

**Verificación doble e independiente**: (1) analíticamente, el caso
`c=1` se reduce exactamente a la fórmula clásica de M/M/1
(`Wq=ρ/(μ−λ)`) — confirmado algebraicamente a mano antes de escribir una
sola línea de código; (2) numéricamente, contra la recursión de Erlang B
(`b(0)=1, b(n)=a·b(n-1)/(n+a·b(n-1))`, `C=c·b(c)/(c−a·(1−b(c)))`) — un
algoritmo completamente distinto, estándar en telecomunicaciones, que
coincide a 10+ decimales con el cálculo directo en varios casos. 6 tests
nuevos (`modeloColasMMC.test.js`).

λ se calcula sobre el span real de fechas de todo el historial de
correctivos disponible (`fechasCorrectDot`); μ desde el MTTR real (mismo
parseo "Xh" de `duracion` ya usado en Costos & Stock → MTBF/MTTR); `c` =
dotación Día+Noche actual — mismo criterio de combinar ambos turnos ya
usado en esta misma vista para "capacidadMesDot" (no hay forma real de
separar la tasa de llegada por turno). `ρ>0.85` (regla de bolsillo
estándar de teoría de colas, no inventada) marca saturación. Nunca
sugiere una dotación "ideal": solo reporta las métricas reales para el
`c` actual.

Integrado en Predictivo → Dotación de Taller, nueva tarjeta "⏳ Modelo de
Colas (M/M/c)" con utilización, probabilidad de espera, tiempo de espera
promedio y OT esperando en promedio. Verificado en navegador (Playwright:
λ=0.139/h, μ=0.125/h, c=5 → ρ=22%, coincidiendo exactamente con el
cálculo puro).

### 70. Bayes Empírico (shrinkage Gamma-Poisson) — MTBF con poco historial (2026-09-20)

Todo lo construido en esta sesión hasta acá es **frecuentista** (tests de
hipótesis, MLE, regresión, cartas de control, colas). Esto es un enfoque
distinto: un equipo con pocas fallas registradas hoy o se **excluye**
(mínimo de muestra) o muestra un número puntual con un intervalo de
confianza enorme — la frase "con pocas fallas... el número puntual puede
ser muy poco confiable" aparece literalmente varias veces en el sistema
(MTBF, Weibull). El **Bayes Empírico** es la técnica estándar diseñada
exactamente para esto — la misma que usan aseguradoras ("credibility
theory") y estadística deportiva (el promedio de bateo de un jugador con
pocos turnos al bate no se muestra crudo ni se descarta, se combina con
el promedio de la liga).

Modelo: cada tasa de falla real λ_i (fallas por hora de exposición) se
asume proveniente de una Gamma(α,β) común a toda la flota — los
hiperparámetros se estiman de los propios datos por **método de
momentos**, nunca inventados a mano: `μ̂ = Σn_i/Σt_i` (tasa pooled),
`σ²_entre = S² − μ̂×k/Σt_i` (la varianza observada de las tasas crudas,
menos el ruido de muestreo Poisson esperado — lo que queda es la
heterogeneidad REAL entre equipos). Si `σ²_entre≤0` (sin heterogeneidad
real detectable), se cae a **shrinkage total**: todos los equipos con la
tasa de flota, nunca se inventa una diferencia que no existe. Si no,
`α=μ̂²/σ²_entre`, `β=μ̂/σ²_entre`, y la estimación final por equipo es la
media posterior `λ̂_i=(α+n_i)/(β+t_i)` — con poca exposición propia pesa
más el promedio de flota, con mucha converge al dato propio.

**Verificación por simulación** (técnica distinta a las verificaciones
anteriores de esta sesión, pero igual de rigurosa): se generaron datos
sintéticos desde una Gamma conocida, se simularon conteos Poisson con
exposiciones muy heterogéneas (mismo problema real: equipos con mucho vs.
poco historial) — el método recupera los hiperparámetros reales
(α_real=4.0 → α̂≈4.75; β_real=2.0 → β̂≈2.27, con 200 grupos), y el
estimador con shrinkage reduce el error cuadrático medio **~26%**
respecto de la tasa cruda frente a los valores reales conocidos de la
simulación — el beneficio clásico y documentado de este tipo de
estimador (mismo fenómeno que la paradoja de Stein). También se verificó
la guardia de "sin heterogeneidad real" con un segundo caso simulado. 4
tests nuevos con un dataset determinístico (`bayesEmpiricoGammaPoisson.test.js`).

Integrado en Estadística → Por Equipo (tabla de Bad Actors): nueva
columna "MTBF estabilizado (Bayes)", exposición = horómetro actual del
equipo (mismo reloj de exposición que ya usan Weibull/RBD/Kijima).
Aparece incluso para equipos con **1 sola falla**, donde el MTBF crudo no
existe (necesita 2+ para tener un intervalo que medir) — antes esos
equipos quedaban con "—", sin ningún número. Verificado en navegador
(Playwright: mismo dataset de 6 equipos del test unitario, columna nueva
visible con valores coincidiendo exactamente con el cálculo puro).

### 71. Distancia de Mahalanobis — outliers multivariados de aceite (2026-09-20)

`aceiteOutliers` (sección anterior) revisa cada metal **por separado**
contra la mediana de su propio grupo (hierro alto, o cobre alto, cada
uno con su propio umbral). El hueco real: una muestra puede tener
hierro, cobre y cromo cada uno "normal" individualmente, pero la
**combinación** de los tres ser una señal de desgaste real que ningún
chequeo metal-por-metal detecta — la **Distancia de Mahalanobis** es la
técnica estándar para esto, muy usada en análisis de aceite/monitoreo de
condición real, no solo teoría. En vez de comparar cada metal contra su
propio umbral, mide qué tan lejos está la combinación completa de
metales de una muestra respecto del centro real de su grupo, usando la
matriz de covarianza real (cómo los metales suelen moverse juntos), no
un promedio ingenuo por separado.

`D² = (x−μ)ᵀ Σ⁻¹ (x−μ)` sigue una distribución chi-cuadrado con k grados
de libertad (k = cantidad de metales) — **reusa directamente la tabla
`_CHI2_CRITICO_95`** ya existente en el sistema (misma que usa
`logRankTest`/`testChiCuadradoUniforme`), sin inventar un umbral nuevo.
Solo usa muestras con TODOS los metales presentes (nunca completa un
dato faltante) y exige harto historial por grupo — estimar una matriz de
covarianza necesita bastante más muestra que una mediana simple:
`_MAHALANOBIS_MIN_MUESTRAS` (15, elegido a propósito conservador) y
siempre más muestras que dimensiones (`n>k`, condición matemática para
que la covarianza sea invertible — si no, `_invertirMatriz` devuelve
`null` y el grupo se omite, nunca se fuerza un resultado).

Verificado independientemente con Python/numpy/scipy: (1) la inversión
de matriz por Gauss-Jordan (`_invertirMatriz`) coincide con
`numpy.linalg.inv` a 6 decimales; (2) con un dataset determinístico de
24 muestras "normales" (con correlación real entre metales) + 1 outlier
combinado, el outlier inyectado da D²≈19.65 (muy por encima del umbral
χ²95%,gl=6≈12.592) y ninguna de las 24 muestras normales lo supera
(máximo real ≈9.85) — y se confirmó explícitamente que ningún metal de
esa muestra cruza el umbral fijo que ya usa `aceiteOutliers` (2× el
umbral de `_ACEITE_UMBRAL_METAL`), probando que es un hueco real, no
redundante. Durante la verificación, un primer dataset de prueba resultó
tener una matriz de covarianza exactamente singular (rango 5 de 6
dimensiones, por una dependencia lineal accidental entre columnas) —
`_invertirMatriz` lo detectó correctamente y devolvió `null`, confirmando
que la guardia funciona antes incluso de llegar al caso de verificación
final. 5 tests nuevos (`outliersMultivariadosAceite.test.js`).

Integrado en Análisis de Aceite (`ace.js`), junto al bloque existente de
outliers de un solo metal: nuevo aviso "🧪 combinación de metales
inusual", con equipo, fecha, D² y el umbral usado. Nunca cambia
`estado`, solo señala para confirmar con el laboratorio — mismo espíritu
que el bloque de outliers ya existente. Verificado en navegador
(Playwright: mismo dataset del test unitario, D²=19.651 idéntico al
cálculo puro).

### 72. Punto de Reorden con Stock de Seguridad — repuestos (2026-09-20)

`analisisABCXYZRepuestos` (sección anterior) ya calcula, por repuesto y
desde el historial real, la demanda mensual promedio y su coeficiente de
variación (CV) — pero esa variabilidad hoy no alimenta ninguna decisión:
`stockEstado` compara la cobertura actual contra el lead time con un
umbral FIJO, como si la demanda fuera perfectamente constante. Dos
repuestos con el mismo consumo promedio pero muy distinta variabilidad
(justo lo que separa clase X de clase Z) terminan con el mismo umbral de
"comprar ahora" — dejando sin margen real a los erráticos y con margen de
sobra a los predecibles.

**Punto de Reorden (ROP) con stock de seguridad** es la fórmula estándar de
teoría de inventario para esto (Silver/Pyke/Peterson, *Inventory Management
and Production Planning and Scheduling*; también Chopra & Meindl, *Supply
Chain Management*):

```
ROP = μ_L + z·σ_L
μ_L = μ_mensual × (leadDias/30)      — demanda esperada durante el lead time
σ_L = σ_mensual × √(leadDias/30)     — escalado raíz-del-tiempo (demanda i.i.d. entre meses)
z   = z-score del nivel de servicio elegido (95% → z=1.645, estándar)
```

`σ_mensual = cv × μ_mensual`, reusando directamente el CV que ya calcula
`analisisABCXYZRepuestos` — nunca se inventa una varianza nueva. `leadDias`
usa el mismo default de 34 días ya establecido en el sistema
(`predFromOrdenes`, `stockEstado`) cuando el ítem no tiene lead time propio.

**Verificado con Monte Carlo** (2M iteraciones, demanda diaria normal
agregada sobre el lead time): la probabilidad real de NO quebrar stock
usando el ROP coincidió con el nivel de servicio elegido a 4 decimales
(90%→0.9000, 95%→0.9500, 97.5%→0.9749). El redondeo final es hacia arriba
(`Math.ceil`): redondear hacia abajo reduciría el nivel de servicio real
por debajo del elegido. 9 tests nuevos (`puntoReordenSeguridad.test.js`),
incluido un caso que reproduce a mano los valores de referencia calculados
en Python.

Integrado en Predictivo → ABC-XYZ de Repuestos: nueva columna "Reorden" con
formato `stock actual / ROP`, marcada en rojo cuando el stock ya cayó por
debajo del punto de reorden. Verificado en navegador (Playwright: mismo
dataset del test — un repuesto clase Z con ROP=25 marcado en rojo con
stock=20, uno clase X con el mismo consumo promedio y ROP=13 sin marca,
idéntico al cálculo puro).

### 73. Test de independencia Chi-cuadrado — tabla de contingencia componente × ubicación (2026-09-20)

`testChiCuadradoUniforme` (usado por `patronesOcultosFalla`, sección
anterior) responde una pregunta de UNA sola dimensión: "¿las fallas se
reparten parejo entre estas categorías (mes, turno), o hay un patrón?".
`tasaFallaPorUbicacion` responde otra pregunta relacionada pero distinta:
"¿qué ubicación tiene, en general, más fallas?". Ninguna de las dos
contesta la pregunta real de causa raíz: **¿ESTE componente en particular
falla desproporcionadamente en ESTA ubicación, o es solo que esa ubicación
tiene más fallas de TODO por igual?** Eso es un test de independencia de
DOS variables categóricas — tabla de contingencia r×c —, matemática
distinta a la bondad de ajuste de una sola dimensión.

```
χ² = Σ (O_ij − E_ij)² / E_ij
E_ij = (total fila i × total columna j) / total general
gl = (filas−1) × (columnas−1)
```

Reusa directamente la misma tabla `_CHI2_CRITICO_95` ya existente en el
sistema (nunca se inventa un umbral nuevo); si los grados de libertad
exceden el rango verificado de la tabla (>12), devuelve `null` en vez de
comparar contra un umbral no verificado. Exige que TODAS las celdas
esperadas sean ≥5 (regla estándar de Cochran, versión conservadora — la
app siempre prefiere devolver `null` a una asociación con un p-value poco
confiable).

**Verificado** contra `scipy.stats.chi2_contingency` con una tabla
sintética 3×3 (3 componentes × 3 ubicaciones) con una asociación real
inyectada (neumáticos concentrados en Rampa): χ²=12.485, gl=4, coincide a
3 decimales; y se confirmó que `_CHI2_CRITICO_95[1..12]` coincide
exactamente con `scipy.stats.chi2.ppf(0.95, gl)` en todo el rango de la
tabla. 10 tests nuevos (`testIndependenciaChi2.test.js`).

Considerado y descartado explícitamente antes de esto: la política de
reemplazo por edad óptima de Barlow-Proschan (minimizar costo esperado por
unidad de tiempo dado el hazard de Weibull) — requiere el costo de mano de
obra de una falla, que hoy está en $0 en el 100% de los registros reales
(ver comentario en `costoRelativoMantenimiento`), así que habría sido una
señal fabricada.

Integrado en Predictivo → Patrones Ocultos de Falla, como tercer bloque
junto a mes y turno: tabla componente × ubicación con observado/esperado
por celda, resaltando en rojo la combinación que concentra la señal.
Nunca se filtra por equipo (necesita ver toda la flota para que la tabla
tenga sentido). Verificado en navegador (Playwright: mismo dataset del
test unitario, χ²=12.49 idéntico al cálculo puro).

### 74. Kruskal-Wallis H — chequeo no paramétrico del ANOVA de MTTR por técnico (2026-09-20)

`anovaUnFactor` (usado en Estadística → Por Técnico) compara el MTTR
(duración de reparación) entre técnicos partiendo la varianza en ENTRE vs
DENTRO de cada grupo — pero ese cálculo asume que los residuos son
normales. El propio sistema ya documentó lo contrario (sección de
`analisisMTTRLogNormal`, análisis de aceite/stock con Poisson): los
tiempos de reparación reales casi nunca son simétricos — la mayoría son
rápidos y unos pocos se alargan mucho, sesgando la distribución hacia la
derecha (log-normal). Kruskal-Wallis es el equivalente no paramétrico de
ANOVA de un factor — compara los mismos grupos por RANGOS, no por la media
directa, sin asumir normalidad — mismo principio que Mann-Whitney U (ya
usado en Efectividad del Mantenimiento) pero para más de 2 grupos.

```
H = (12/(N(N+1))) × Σ(R_i²/n_i) − 3(N+1)
H_corregido = H / (1 − Σ(t_j³−t_j)/(N³−N))     — corrección por empates
```

Bajo H0, H sigue aproximadamente una chi-cuadrado con k−1 grados de
libertad — reusa DIRECTAMENTE la misma tabla `_CHI2_CRITICO_95` ya
existente (nunca se inventa un umbral nuevo).

**Verificado** contra `scipy.stats.kruskal`, con y sin empates (valores
redondeados a enteros, como puede pasar con horas de reparación tipeadas a
mano): coincide a 3+ decimales en ambos casos — el caso con empates
confirma que la corrección está bien aplicada. 6 tests nuevos
(`kruskalWallis.test.js`).

Integrado en Estadística → Por Técnico, como chequeo de robustez
independiente inmediatamente debajo del ANOVA existente (nunca lo
reemplaza — ambos quedan visibles, uno paramétrico y uno no, sobre la
misma pregunta). Verificado en navegador (Playwright: H=35.346 idéntico al
cálculo puro, medianas por técnico coincidentes).

### 75. Carta de Control EWMA — Costo Total Mensual, deriva sostenida (2026-09-20)

`cartaControlIMR` (usado en Costos, HH y Confiabilidad) es una carta
Shewhart clásica: muy buena para detectar un salto grande en un solo mes,
pero estadísticamente poco sensible a una **deriva lenta y sostenida** (el
costo subiendo de a poco, mes tras mes, sin que ningún mes individual
cruce el límite fijo) — hueco bien documentado en control estadístico de
procesos (Montgomery, *Introduction to Statistical Quality Control*): las
cartas Shewhart y las cartas "con memoria" (EWMA/CUSUM) son
complementarias, no intercambiables — mismo motivo por el que ya existe
CUSUM para aceite, pero nunca para costos.

```
Z_i = λ·X_i + (1−λ)·Z_(i−1),  Z_0 = x̄
Límites en el punto i: x̄ ± L·σ̂·√[(λ/(2−λ))·(1−(1−λ)^(2i))]
```

λ=0.2 y L=3 son los valores estándar de la literatura (Lucas & Saccucci
1990), no elegidos a mano. σ̂=MR̄/1.128 reusa EXACTAMENTE la misma
estimación de sigma que ya usa `cartaControlIMR`, sobre la misma serie de
Costo Total Mensual — nunca se inventa una varianza nueva. Los límites son
la fórmula EXACTA por punto (no la versión asintótica simplificada, que es
demasiado angosta al principio de la serie y produce falsas alarmas
tempranas).

**Verificado** en Python: los límites calculados en cada punto i coinciden
con la fórmula exacta de Montgomery, incluida la convergencia a la forma
asintótica (`σ̂·√(λ/(2−λ))`) cuando i crece. 7 tests nuevos
(`cartaControlEWMA.test.js`).

Integrado en Costos, HH y Confiabilidad, junto a la Carta I-MR existente:
misma serie real de Costo Total Mensual, dos lentes distintos — uno para
sobresaltos puntuales, otro para tendencias que se acumulan
silenciosamente. Nunca reemplaza la I-MR, queda visible al lado. Verificado
en navegador (Playwright: ambas cartas muestran exactamente los mismos $
Total por mes, confirmando que EWMA reprocesa la misma fuente real, no una
propia).

### 76. Intervalo de Confianza de Wilson para proporciones (2026-09-21)

`intervaloConfianzaMTBF`/`errorEstandarMTTR` ya dejaron de mostrar tasas y
promedios sin margen de error — pero los **porcentajes** del sistema
("% documentado", "% reingreso" en `_estTablaTecnico`, estadistica.js)
seguían siendo un número puntual. Con muestra chica (n=15, el mínimo que
ya exige esa tabla), un 80% observado puede en realidad estar entre 55% y
93% — una diferencia enorme que no se veía.

Wilson (1927) es el intervalo de confianza estándar para una proporción —
mejor que la aproximación normal simple (Wald) para n chico o p cerca de
0%/100%, donde Wald puede dar límites fuera de [0,1] o ser demasiado
angosto (recomendado sobre Wald por Agresti & Coull 1998):

```
p̂ = x/n
centro = (p̂ + z²/(2n)) / (1 + z²/n)
margen = z·√(p̂(1−p̂)/n + z²/(4n²)) / (1 + z²/n)
IC95% = [centro − margen, centro + margen]     (z=1.96)
```

**Verificado** contra `statsmodels.stats.proportion.proportion_confint`
(method='wilson') en 6 casos, incluidos los extremos p=0% y p=100% con
n=15 (donde la aproximación normal simple se rompe): coincide a 4
decimales en todos. 4 tests nuevos (`wilsonIC95.test.js`).

Integrado en Estadística → Por Técnico, debajo de "% documentado" y "%
reingreso ≤7d": ej. "87% / IC95%: 62.1–96.3%". Mismo principio que ya
aplican MTBF/MTTR: nunca mostrar una precisión que la muestra no respalda
— con pocas OT, dos técnicos que parecen distintos pueden no serlo en
realidad. Verificado en navegador (Playwright: 13/15 → 87%,
IC95%=62.1–96.3%, idéntico al cálculo puro).

### 77. Test de Levene (Brown-Forsythe) — variabilidad del MTTR entre técnicos (2026-09-21)

`anovaUnFactor`/`kruskalWallis` (arriba) responden "¿el MTTR
promedio/mediana difiere entre técnicos?" — pero ninguno dice si un
técnico es **inconsistente** (a veces muy rápido, a veces muy lento)
frente a otro que simplemente es uniformemente más lento. Son problemas
operativos distintos: uno pide supervisión/estandarización, el otro
capacitación o reasignación de tareas. Levene prueba si la
**variabilidad** (no el centro) difiere entre grupos.

Variante Brown-Forsythe (centrada en la mediana, no en la media) — la
versión robusta recomendada cuando los datos no son normales, que es
justo el caso ya documentado del MTTR (`analisisMTTRLogNormal`):

```
Z_ij = |X_ij − mediana_i|
W = [(N−k)/(k−1)] × [Σnᵢ(Z̄ᵢ−Z̄)²] / [ΣΣ(Z_ij−Z̄ᵢ)²]
```

Bajo H0, W sigue una F(k−1, N−k) — reusa DIRECTAMENTE `_pValorF`, la misma
función que ya usa `anovaUnFactor`, sin inventar una distribución nueva.
`medianaPositiva` (ya existente) centra cada grupo.

**Verificado** contra `scipy.stats.levene(center='median')`: W=17.0832
idéntico, p coincide a 6 decimales. 5 tests nuevos
(`levenePruebaVarianzas.test.js`).

Integrado en Estadística → Por Técnico, tercer bloque junto al ANOVA y
Kruskal-Wallis (misma `porTecDuracion` ya computada ahí, pregunta
distinta). Verificado en navegador (Playwright, caso ilustrativo real: 3
técnicos con la misma mediana de MTTR —ANOVA p=0.91 y Kruskal-Wallis no
significativo, ninguno detecta diferencia— pero Levene sí detecta que uno
de ellos es mucho más inconsistente, W=16.964, p=3.98e-6, exactamente el
hueco que esta feature cierra).

### 78. Mann-Kendall + pendiente de Sen — tendencia de Disponibilidad (2026-09-21)

"Tendencia Disponibilidad — Últimos 6 Meses" (Dashboard) era solo un
gráfico de barras con el promedio mensual — sin ningún veredicto sobre si
esa tendencia es real o es ruido normal mes a mes. Con solo 6 puntos, una
barra más alta al final puede ser una mejora real o pura casualidad.

Mann-Kendall (Mann 1945/Kendall 1975) es el test no paramétrico estándar
para tendencia monotónica en series de tiempo cortas — no asume que la
tendencia sea lineal (a diferencia de una regresión) ni que los datos sean
normales, solo mira el signo de cada comparación par a par, por eso es
robusto con pocos puntos y ante un mes atípico:

```
S = Σᵢ<ⱼ sign(xⱼ−xᵢ)
Var(S) = [n(n−1)(2n+5) − Σt(t−1)(2t+5)] / 18     (corrección por empates, Gilbert 1987)
Z = (S∓1) / √Var(S)
```

La **pendiente de Sen** es la mediana de todas las pendientes par a par
`(xⱼ−xᵢ)/(j−i)` — estimador robusto de cuánto cambia por mes, no
distorsionado por un outlier (a diferencia de la pendiente de una
regresión de mínimos cuadrados).

**Verificado** contra la librería `pymannkendall` (`original_test`) en 3
series (creciente, ruido, con empates): S, Var(S), Z y pendiente de Sen
coinciden EXACTAMENTE en los tres casos. 6 tests nuevos
(`mannKendallTendencia.test.js`).

Integrado en Dashboard, debajo del gráfico de barras existente: "Tendencia
real: mejorando/empeorando/sin tendencia clara (95% confianza, Sen:
±X.Xpp/mes)". Requiere al menos 4 meses con dato real (de los 6 posibles).
Verificado en navegador (Playwright: serie de referencia inyectada vía
`dispCalc`, verdict "mejorando" con la pendiente de Sen correcta,
verificado con `toContainText` — la carrera contra el refresco de fondo ya
documentada en esta sesión revierte el estado poco después, mismo patrón
ya visto en otras features, no invalida la verificación).

## Lo que decidimos NO hacer (y por qué)

- **No backend propio**: agregar un servidor Node/Express entre el
  navegador y Supabase solo se justifica si aparece una razón concreta (una
  regla de negocio que RLS no pueda expresar, un secreto que ni RLS proteja,
  pasos que necesiten reintentos transaccionales reales). Hoy no existe esa
  razón — el patrón ya usado (`crear-operador`) alcanza para lo que hace
  falta.

**Ya hecho, no pendiente**: convertir `modules/renders/*.js` a módulos ES
(antes en esta lista como "no hacer" por el riesgo de cambiar reglas de
JavaScript en miles de líneas a la vez) se hizo igual, pero incremental — un
archivo a la vez, cada uno probado antes de fusionar (Fase 3, completada
2026-08-30). Ver sección 1.
