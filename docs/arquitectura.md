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
- **`modules/renders/*.js`** (44 archivos) — un archivo por pestaña o
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
- **`modules/store.js`** — el motor de sincronización (ver sección 3).
- **`logic.js`** — funciones de cálculo puras (sin acceso a pantalla ni a la
  base de datos): fechas de próxima mantención, disponibilidad, similitud de
  materiales, etc. Junto con `store.js`, son los archivos con pruebas
  automatizadas (`tests/*.test.js`, 536 casos, corren con Vitest).

### 2. Dónde vive — Vercel

[Vercel](https://vercel.com) sirve los archivos estáticos (no hay servidor
propio corriendo en ningún lado). Cada push a la rama `main` dispara un build
(`vite build`) y un despliegue nuevo automático. Vite bundlea y minifica de
verdad los ~44 módulos ES de `modules/renders/*.js` en un único archivo
(`dist/assets/index-*.js`), siguiendo el grafo de imports desde
`index.html`. `logic.js` y `modules/store.js` siguen siendo scripts planos
(sin `type="module"`) a propósito, así que Vite no los toca por diseño —
`vite.config.js` tiene un plugin chico que los copia tal cual al resultado
del build (junto con `vendor/*.js` y `docs/`).

### 3. El motor de sincronización — `modules/store.js`

Todo el sistema lee y escribe datos a través de dos únicas funciones:
`S.g(categoria)` (leer) y `S.s(categoria, valor)` (guardar). Ninguna pantalla
llama directo a Supabase — todas pasan por acá, lo que permite que el resto
del sistema (más de 550 llamadas repartidas en las 44 pestañas) nunca
necesite saber cómo ni dónde se guardan realmente los datos.

Al llamar `S.s(categoria, valor)` ocurren, en este orden:

1. **`localStorage`** — se escribe de inmediato, siempre, funcione o no
   internet. El sistema sigue siendo usable sin conexión.
2. **Supabase** — si la categoría es una de las 35 tablas reales
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

35 tablas, una por categoría (equipos, correctivos, registros_pm, etc. —
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

Mismo patrón (secreto propio de 32 bytes en Vault, verificado vía
`verificar_secreto_cron`) protege las otras dos funciones que corren solas
por `pg_cron`: `alerta-pm` (diaria) y `resumen-semanal` (lunes, agregada
2026-09-01) — ver [`manual-admin.md`](./manual-admin.md), sección 7, para
qué manda cada una y cómo se configuran los destinatarios.

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
fuerza bruta). Avisa solo al CRUZAR el umbral, no en cada intento
posterior, para no saturar si el ataque sigue. Este endpoint es público a
propósito (sin sesión, ver sección 13) — alguien podría en teoría spamear
el umbral con requests directos, pero el costo es como mucho alertas de más
al administrador, nunca al que llama, y una ráfaga real produce la misma
señal — no hay forma de distinguir "ataque simulado contra el endpoint" de
"ataque real" sin CAPTCHA, fuera de alcance por ahora.

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
