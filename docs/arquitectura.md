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
  automatizadas (`tests/*.test.js`, 536 casos, corren con Vitest).
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
verdad los ~45 módulos ES de `modules/renders/*.js` en un único archivo
(`dist/assets/index-*.js`), siguiendo el grafo de imports desde
`index.html`. `logic.js` y `modules/store.js` siguen siendo scripts planos
(sin `type="module"`) a propósito, así que Vite no los toca por diseño —
`vite.config.js` tiene un plugin chico que los copia tal cual al resultado
del build (junto con `vendor/*.js` y `docs/`).

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
(49, incluye `kv` y `user_roles` para poder reconstruir accesos ante un
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
contraseñas hasheadas, factores MFA). Restaurar las 49 tablas de `public`
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
4. Inserta el resto de las 49 tablas en lotes de 500, en un orden que
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
