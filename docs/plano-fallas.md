# Plano de fallas — dónde buscar cuando algo falla

> Archivo generado desde `docs/plano-fallas.json` con `scripts/generar_plano_fallas.py`. **No se edita a mano.** Es el mapa que se lee primero ante cualquier falla (también está en `docs/plano-fallas.html` con esquema visual).

## Proyectos

| Proyecto | Supabase (ref) | Vercel | Sitio | Repositorio |
|---|---|---|---|---|
| SistemaMP Centinela | `jyhpfwivhwzylkzxrsbt` | `sistema-mp-centinela` | https://sistema-mp-centinela.vercel.app | `aehcim6-png/sistemamp-centinela` |
| sistema-mp2 | `mzboxosxbaqtysuqdohj` | `sistema-mp2` | https://sistema-mp2.vercel.app | `aehcim6-png/sistema-mp2` |

Las marcas `{sb}`, `{url}`, `{vercel}`, `{repo}`, `{ref}` de las fichas se reemplazan con los valores del proyecto en cuestión (`{sb}` = `https://supabase.com/dashboard/project/<ref>`).

## Si ves esto, mira primero…

| Lo que se ve | Códigos (orden de probabilidad) |
|---|---|
| La página no abre, o muestra un error de Vercel | HOS-01, HOS-02 |
| Abre una pantalla de Vercel pidiendo iniciar sesión | HOS-01 |
| Hice un cambio y no aparece en el sitio | GIT-01, HOS-01, NAV-01 |
| Funciona en un equipo y en otro no | NAV-01, LOC-01 |
| Nadie puede iniciar sesión | AUT-01, EXT-04, DB-01 |
| Una persona no puede iniciar sesión | AUT-01, DB-02 |
| El login se queda en «verificando» o pide captcha una y otra vez | EXT-04, EF-02 |
| Aviso «No se pudo refrescar… datos posiblemente desactualizados» | DB-01, AUT-01, NAV-01 |
| Aviso «No se pudo guardar en la nube (tabla)» | DB-02, AUT-01, DB-01 |
| «Ese cambio requiere permisos de administrador» o «Tu cuenta es de solo lectura» | DB-02 |
| Una pantalla o tabla nueva no guarda después de una actualización | DB-02, DB-01 |
| Dos equipos muestran datos distintos | LOC-01, DB-01 |
| No se pudo crear un usuario | EF-01, AUT-01 |
| La foto o captura no se lee | EF-11, EXT-02, AUT-01 |
| No llegó el correo del respaldo diario | CRN-01, EF-05, EXT-01, DB-03 |
| No llegan las alertas de PM o el resumen semanal | CRN-02, CRN-03, EXT-01, DB-03 |
| Llegó un correo de alerta de salud o de diagnóstico | MON-01, MON-02 |
| No llegan avisos de dispositivo nuevo o de accesos sospechosos | EF-03, CRN-06, EXT-01 |
| Los reportes por WhatsApp no entran | EXT-03, EF-09 |
| Los reportes por correo no entran | EF-10, EXT-01 |
| Una tarea programada no corrió hoy | DB-04, MON-01 |
| Se llenó el almacenamiento local del navegador | LOC-01 |
| La carpeta de respaldo no se actualiza | BKP-01 |
| Un servicio nuevo no conecta aunque lo demás funciona | HOS-02 |
| El asistente de la pestaña Asistente no responde, dice que no está configurado o que llegaste al límite | EF-18, EXT-05 |
| «Otra persona modificó estos datos mientras trabajabas…» | _No es una falla: dos personas editaron lo mismo casi a la vez. El sistema conservó lo más reciente y pide repetir el cambio._ |
| No me deja cerrar una OT: pide causa raíz y una acción con responsable y fecha (y no aparece «Cerrar sin completar») | _No es una falla: es la regla de las fallas repetidas (mismo equipo y componente en los últimos 90 días). Hay que anotar la causa raíz y una acción con responsable y fecha límite; la acción queda como tarea en la pestaña Tareas. Se ve en el diálogo «Cierre con datos»._ |
| Al agregar un evento en Componentes → Historial pide «Estado de lo instalado» y no guarda sin elegirlo | _No es una falla: el estado (nuevo, reparado o usado) es obligatorio desde el 29-oct-2026; sirve para decidir si conviene reparar o comprar._ |
| Aviso rojo o amarillo arriba del Dashboard: «N tareas vencidas» | _No es una falla: hay tareas con la fecha límite pasada (con 3 días o más de atraso van «escaladas» a la jefatura). Se ven y se cierran en la pestaña Tareas._ |
| «Reparar vs comprar» dice «Solo se repara», «Solo se compra» o «Sin datos» para una pieza | _No es una falla: no hay en las compras (en español ni en inglés) la otra opción para comparar. Se completa anotando el estado de cada cambio en el Historial de Componentes._ |
| «No se pudo guardar en la nube (tareas)» al abrir la pantalla Tareas | _Puede pasar si dos personas la abren a la vez: las dos intentan crear la misma tarea de «pedir ya» y la base rechaza el duplicado (clave única). No se pierde nada: se recarga y la tarea ya está. Si ocurre siempre, mirar DB-01 y DB-02._ |
| El asistente dice «llegaste al límite de consultas por hora» o «el equipo llegó al tope diario» | _No es una falla: es el límite de uso que protege el gasto en Anthropic (40 consultas por persona por hora y 2.000.000 de tokens por día para todo el equipo; se pueden cambiar con los secretos de EF-18). Se reinicia solo._ |

**Regla de oro:** ante una tarea programada (respaldo, alertas, resumen) lo primero es `select nombre, "ultimaEjecucion", exito, detalle from public.salud_crons;` (MON-01).

## 1. Tu equipo

### NAV-01 — Navegador del usuario (la aplicación)

Lo que corre en el computador o celular de cada persona: la página y todas sus pestañas. Si falla solo en un equipo, el problema es de ese equipo, no del sistema.

- **Dónde está:** El navegador de cada persona (Chrome, Edge…). El código viene de HOS-01.
- **Código:** `index.html`, `modules/renders/*.js`, `modules/store.js`, `logic.js`

**Cómo se ve:** Pantalla en blanco o se queda cargando; Un botón no responde; Muestra datos viejos o una versión antigua; Funciona en un equipo y en otro no

**Confirmar:**
1. Recargar con Ctrl+F5 (borra la copia en caché de la página).
2. Abrir el sistema en una ventana privada: si ahí funciona, la causa es la caché o una extensión del navegador.
3. Probar en otro equipo u otro navegador: si funciona, el problema es local (NAV-01 o LOC-01); si falla en todos, mira HOS-01, AUT-01 y DB-01.

**Qué hacer:** Cerrar sesión, borrar los datos del sitio y volver a entrar. Antes, confirma que no haya cambios sin sincronizar (ver LOC-01).

**Cuándo avisar:** Si falla en todos los equipos y HOS-01 está bien, avisar con el texto exacto del error y la hora.

**Depende de:** HOS-01
**Si falla, afecta a:** BKP-01, LOC-01

**Soporte técnico (Claude):**
- Revisar la consola del navegador (errores en rojo) y `window._turnstileToken`.
- Las versiones de los archivos van con `?v=` en `index.html`: un archivo con versión vieja = caché.
- Pruebas e2e: `npx playwright test` (ver `playwright.config.js`).

### LOC-01 — Copia local (localStorage)

Cada navegador guarda una copia de los datos para seguir trabajando sin internet. La nube (DB-01) es la fuente oficial; esta copia es solo de trabajo.

- **Dónde está:** Dentro del navegador de cada persona (almacenamiento local).
- **Código:** `modules/store.js` (S.g / S.s, `_recorteParaLocal`)

**Cómo se ve:** Dos equipos muestran datos distintos; Aviso de que el almacenamiento local está lleno; Cambios hechos sin internet que no aparecen en la nube

**Confirmar:**
1. Con internet, recargar la página: el sistema vuelve a traer todo desde la nube.
2. Si el cambio no aparece en otro equipo, mirar si salió el aviso «No se pudo guardar en la nube» (ver DB-01 y DB-02).

**Qué hacer:** No borrar los datos del sitio mientras haya cambios hechos sin conexión: se pierden. Primero conéctate y espera a que sincronice.

**Depende de:** NAV-01

**Soporte técnico (Claude):**
- El recorte de la copia local solo aplica a las tablas que crecen sin límite; Supabase siempre recibe el arreglo completo.

### BKP-01 — Carpeta de respaldo paralelo

Un tercer respaldo opcional, fuera de Supabase: una carpeta del computador (OneDrive o Google Drive) donde el sistema guarda copias. Se conecta por computador, no para todo el sistema.

- **Dónde está:** Configuración → «Conectar carpeta» (en cada computador).

**Cómo se ve:** La carpeta no se actualiza; Pide permiso de nuevo cada vez

**Confirmar:**
1. Configuración → ver si la carpeta sigue conectada en ese computador.
2. El navegador puede pedir permiso otra vez al abrir: aceptar.

**Qué hacer:** Volver a conectar la carpeta en ese computador.

**Depende de:** NAV-01

**Soporte técnico (Claude):**
- Solo funciona en navegadores con acceso a carpetas (Chrome y Edge).

## 2. Publicación del sitio

### GIT-01 — Repositorio de código (GitHub)

Donde vive todo el código y su historial. Lo que se sube a la rama `main` se publica solo en Vercel.

- **Repositorio:** `{repo}` → https://github.com/{repo}
- **Cambios:** `/commits/main`
- **Pruebas:** `/actions`

**Cómo se ve:** Hice un cambio y no aparece en el sitio; Un cambio se subió pero no está en `main`

**Confirmar:**
1. Mirar los commits de la rama `main`: ¿está el cambio? Si está en otra rama (por ejemplo `claude/...`), todavía no se publica.
2. Si está en `main`, seguir con HOS-01 (¿se desplegó?).

**Qué hacer:** Pedir que el cambio se lleve a `main` (solo se hace cuando lo apruebas).

**Si falla, afecta a:** CI-01, HOS-01

**Soporte técnico (Claude):**
- `git log origin/main -3` y comparar con el último despliegue de Vercel (get_project → latestDeployment).

### CI-01 — Pruebas automáticas (GitHub Actions)

Cada vez que se sube código, GitHub corre las pruebas. Un ✗ rojo significa que alguna prueba falló; el sitio que ya está publicado sigue funcionando igual.

- **Dónde está:** `/actions` del repositorio; configuración en `.github/workflows/tests.yml`

**Cómo se ve:** Un commit aparece con ✗ rojo

**Confirmar:**
1. Abrir el commit en GitHub → Actions → ver qué prueba falló.

**Qué hacer:** No hay nada que arreglar en el panel: se corrige en el código.

**Cuándo avisar:** Avisar el nombre de la prueba que falla.

**Depende de:** GIT-01

**Soporte técnico (Claude):**
- `tests.yml` y el log del job; reproducir con `npx vitest run` o `npx playwright test`.

### HOS-01 — Sitio publicado (Vercel)

Vercel entrega los archivos del sistema cuando alguien abre la dirección. No guarda datos: solo sirve la página. Cada cliente tiene su propio proyecto de Vercel.

- **Sitio:** {url}
- **Panel:** https://vercel.com/sistema-mp/{vercel}
- **Despliegues:** https://vercel.com/sistema-mp/{vercel}/deployments
- **Configuración:** `/settings` → Deployment Protection
- **Código:** `vercel.json`, `vite.config.*`

**Cómo se ve:** La página no abre (error 404, 500 o «deployment not found»); Abre una pantalla de Vercel pidiendo iniciar sesión; Muestra una versión vieja; Después de subir un cambio, el sitio quedó roto

**Confirmar:**
1. Panel de Vercel → Deployments: el de arriba (Production) debe estar en «Ready». Si dice «Error», abrirlo y leer el Build Log.
2. Si pide iniciar sesión en Vercel: Settings → Deployment Protection (la protección de despliegues está activada).
3. Si el último despliegue es de antes de tu cambio: ver GIT-01 (¿llegó a `main`?).

**Qué hacer:** Despliegue en Error: en Deployments, abrir el último «Ready» anterior → «Promote to Production» (vuelve al sitio que funcionaba mientras se corrige el código). Despliegue correcto pero la página vieja: «Redeploy».

**Cuándo avisar:** Un Build Log con error de código: avisar el commit y el texto del error.

**Depende de:** GIT-01
**Si falla, afecta a:** HOS-02, NAV-01

**Soporte técnico (Claude):**
- Vercel MCP: `list_deployments`, `get_deployment` y `get_deployment_build_logs` del proyecto `{vercel}`.
- Estado: `get_project` → `latestDeployment.readyState`.

### HOS-02 — Reglas de seguridad del sitio (cabeceras CSP)

Lista de las direcciones externas a las que la página tiene permitido conectarse. Cada proyecto tiene la suya y permite solo SU Supabase. Es una protección: bloquea todo lo que no está en la lista.

- **Dónde está:** `vercel.json` (sección `headers` → `Content-Security-Policy`)

**Cómo se ve:** Se agregó un servicio nuevo y no conecta aunque todo lo demás esté bien; En la consola del navegador: «Refused to connect… violates Content Security Policy»

**Confirmar:**
1. Abrir la consola del navegador (F12) y buscar el mensaje en rojo: dice qué dirección bloqueó.

**Qué hacer:** Se corrige agregando esa dirección en `vercel.json` y volviendo a publicar.

**Cuándo avisar:** Cualquier servicio nuevo (otro proveedor, otro Supabase) requiere cambiar `vercel.json`: pedirlo.

**Depende de:** HOS-01
**Si falla, afecta a:** EXT-04, EXT-06

**Soporte técnico (Claude):**
- `connect-src` solo incluye `https://<ref>.supabase.co`, Sentry y Cloudflare Turnstile.

## 3. Supabase (datos, login, funciones, tareas)

### AUT-01 — Autenticación (inicio de sesión, roles, doble verificación)

Supabase valida el correo y la clave, mantiene la sesión abierta y pide el segundo paso (código). Qué puede hacer cada persona lo decide su rol en la tabla `user_roles` (DB-02).

- **Panel:** {sb}/auth/users
- **Roles:** tabla `user_roles` ({sb}/editor)
- **Código:** `index.html` (`_doLogin`, `_sbAuthLogin`), `modules/renders/cfg.js`

**Cómo se ve:** Nadie puede entrar; Una persona no puede entrar aunque la clave es correcta; La sesión se cierra sola; El código de doble verificación no sirve; Un usuario nuevo no puede entrar (queda bloqueado hasta que un admin lo activa: es normal)

**Confirmar:**
1. ¿Entran las demás personas? Si nadie entra: mirar EXT-04 (captcha) y DB-01 (¿el proyecto está activo?).
2. Si es una sola persona: Panel → Authentication → Users: ¿existe, está confirmada, no está bloqueada?
3. Luego, tabla `user_roles`: ¿tiene su rol y está activa?
4. Si es un usuario nuevo: Configuración → «Pendientes de activar».

**Qué hacer:** Activar al usuario desde Configuración, o restablecer su clave desde el panel (Authentication → Users).

**Cuándo avisar:** Si nadie entra y el panel está bien: avisar la hora y el mensaje exacto de la pantalla.

**Depende de:** EXT-04, DB-01
**Si falla, afecta a:** DB-01, DB-02, EF-01, EF-02, EF-11, EF-12, EF-13, EF-14, EF-15, EF-16, EF-17, EF-18

**Soporte técnico (Claude):**
- `get_advisors`; logs del servicio `auth` (`query_logs`).
- `select * from public.user_roles;` y `select * from public.accesos_servidor order by 1 desc limit 20;` (si existe).
- Redirect URLs de Auth deben incluir `{url}/**`.

### DB-01 — Base de datos y conexión a las tablas

Donde quedan guardados todos los datos reales (equipos, OT, stock, horómetros…). Es la fuente oficial: lo que no llega aquí no existe para los demás.

- **Panel:** {sb}
- **Tablas:** {sb}/editor
- **Consultas:** {sb}/sql/new
- **Código:** `modules/store.js` (TABLA_REAL: una entrada por tabla)

**Cómo se ve:** Aviso «No se pudo refrescar: … datos posiblemente desactualizados»; Aviso «No se pudo guardar en la nube (nombre de tabla)»; Datos que desaparecen o no coinciden entre personas; Aviso «No se pudo guardar en la nube (tareas)» justo después de abrir la pestaña Tareas (ver «No son fallas»)

**Confirmar:**
1. Panel de Supabase: ¿el proyecto dice «Healthy» o «Paused»? Un proyecto pausado no responde.
2. Table Editor: abrir la tabla del aviso: ¿existe, tiene filas?
3. Si solo falla al guardar una tabla: ver DB-02 (permisos).
4. Si falla todo para todos: ver también HOS-02 y AUT-01.

**Qué hacer:** Proyecto pausado: botón «Restore project» en el panel. Tabla con problema: no editar a mano; avisar el nombre de la tabla.

**Cuándo avisar:** Datos faltantes o corruptos: avisar de inmediato (hay respaldo diario, ver CRN-01).

**Depende de:** AUT-01
**Si falla, afecta a:** AUT-01, DB-02, DB-03, DB-04

**Soporte técnico (Claude):**
- `select 1;` (¿responde?), `list_tables`, `get_advisors`, `query_logs` servicios `api` y `postgres`.
- Respaldos: correo diario de CRN-01; restauración con `scripts/restaurar-backup.ts`.

### DB-02 — Permisos por fila y por rol (RLS) y GRANT

Cada tabla decide quién puede leer, escribir o borrar según el rol (admin, editor, lector). Se aplica en la base de datos, no solo en la pantalla.

- **Dónde está:** Panel → Authentication → Policies; migraciones en `supabase/migrations/`
- **Roles:** tabla `user_roles`

**Cómo se ve:** «Ese cambio requiere permisos de administrador»; «Tu cuenta es de solo lectura»; Guardar falla en una tabla nueva (error 42501 «permission denied» en la consola); Un lector ve botones que no puede usar

**Confirmar:**
1. ¿Qué rol tiene la persona? (Configuración o tabla `user_roles`).
2. Si falla una tabla creada recientemente: probablemente falta el permiso (GRANT) en su migración; avisar el nombre.

**Qué hacer:** Cambiar el rol de la persona desde Configuración. Tabla nueva sin permisos: se corrige con una migración (la regla y su plantilla están en el manual del administrador).

**Cuándo avisar:** Cualquier cambio de políticas o permisos: pedirlo.

**Depende de:** DB-01, AUT-01
**Si falla, afecta a:** EF-18

**Soporte técnico (Claude):**
- `select tablename, policyname, cmd from pg_policies where schemaname='public';`
- `select has_table_privilege('authenticated','public.<tabla>','insert');`
- `tests/migracionesGrants.test.js` exige GRANT en toda migración nueva.

### DB-03 — Secretos guardados (Vault)

Claves que las tareas programadas necesitan para identificarse sin que viajen en el código: `resend_api_key`, `backup_diario_cron_secret`, `alerta_pm_cron_secret`, `resumen_semanal_cron_secret`, `vigilar_salud_cron_secret`, `turnstile_secret_key`.

- **Dónde está:** Panel → Integrations → Vault
- **Funciones:** Panel → Edge Functions → Secrets (claves de las funciones: Gemini, Twilio, Resend…)

**Cómo se ve:** Una tarea programada responde «No autorizado» o «No se pudo verificar el secreto»; En salud_crons aparece el detalle «No se pudo verificar el secreto del cron»

**Confirmar:**
1. Panel → Vault: ¿existe el secreto con ese nombre?
2. Panel → Edge Functions → Secrets: ¿están las claves que usa la función (ver su ficha EF)?

**Qué hacer:** Rotar un secreto cambia también la tarea que lo usa: no se hace a mano.

**Cuándo avisar:** Cambiar o rotar secretos: pedirlo (se hace en los dos lados a la vez).

**Depende de:** DB-01
**Si falla, afecta a:** EF-05, EF-06, EF-07, EXT-01

**Soporte técnico (Claude):**
- `select name, created_at from vault.secrets order by name;` (nunca imprimir `decrypted_secret`).
- `supabase/functions/_shared/verificarSecretoCron.ts` distingue válido / inválido / error.

### DB-04 — Programador de tareas (pg_cron y pg_net)

El «reloj» que dispara cada tarea programada a su hora (CRN-01 a CRN-08). Funciona dentro de Supabase y no depende de que la página esté abierta.

- **Panel:** Panel → Integrations → Cron (lista y historial)
- **Código:** `supabase/migrations/*_programar_*.sql`

**Cómo se ve:** Una tarea no corrió hoy y no hay ningún error registrado; Varias tareas dejaron de correr a la vez

**Confirmar:**
1. Panel → Integrations → Cron: ¿el trabajo está activo y cuándo corrió por última vez?
2. Si todas dejaron de correr a la vez: ver DB-01 (proyecto pausado o con problemas).

**Qué hacer:** Si un trabajo está desactivado, se reactiva desde el panel o con una migración.

**Cuándo avisar:** Un horario nuevo o cambiado: pedirlo.

**Depende de:** DB-01
**Si falla, afecta a:** CRN-01, CRN-02, CRN-03, CRN-04, CRN-05, CRN-06, CRN-07, CRN-08

**Soporte técnico (Claude):**
- `select jobname, schedule, active from cron.job order by jobid;`
- `select * from cron.job_run_details order by start_time desc limit 20;`
- `select * from net._http_response order by id desc limit 20;` (respuesta real de cada llamada).

### CRN-01 — Tarea programada: backup-diario-centinela

Respaldo diario por correo de todas las tablas. Corre a las 12:00 UTC (en Chile son 3 o 4 horas menos según la época del año).

- **Trabajo:** `backup-diario-centinela` (0 12 * * *, hora UTC)
- **Llama a:** EF-05 (`backup-diario`)
- **Registro de resultado:** tabla `salud_crons`, fila `backup-diario`

**Cómo se ve:** No llegó el correo de hoy; En `salud_crons` la fecha es de hace más de un día o dice error

**Confirmar:**
1. Panel → Integrations → Cron: ¿corrió hoy? (DB-04)
2. Panel → Edge Functions → backup-diario → Logs: ¿qué respondió?
3. Si corrió y respondió bien pero no llegó el correo: ver EXT-01 (Resend).
4. Si responde «No autorizado»: ver DB-03.

**Qué hacer:** Según la causa: ver la ficha de EF-05, DB-03 o EXT-01.

**Cuándo avisar:** Si ninguna revisión explica la falla: avisar la hora esperada y lo que muestra el log.

**Depende de:** DB-04, EF-05
**Si falla, afecta a:** EF-05

**Soporte técnico (Claude):**
- `select * from public.salud_crons;` (criterio del detector: backup-diario con más de 26 horas o exito=false = problema).
- `get_edge_function` y `query_logs` de `backup-diario`.

### CRN-02 — Tarea programada: alerta-pm-diaria

Aviso diario de PM próximos y vencidos. Corre a las 11:00 UTC (en Chile son 3 o 4 horas menos según la época del año).

- **Trabajo:** `alerta-pm-diaria` (0 11 * * *, hora UTC)
- **Llama a:** EF-06 (`alerta-pm`)
- **Registro de resultado:** tabla `salud_crons`, fila `alerta-pm`

**Cómo se ve:** No llegó el correo de hoy; En `salud_crons` la fecha es de hace más de un día o dice error

**Confirmar:**
1. Panel → Integrations → Cron: ¿corrió hoy? (DB-04)
2. Panel → Edge Functions → alerta-pm → Logs: ¿qué respondió?
3. Si corrió y respondió bien pero no llegó el correo: ver EXT-01 (Resend).
4. Si responde «No autorizado»: ver DB-03.

**Qué hacer:** Según la causa: ver la ficha de EF-06, DB-03 o EXT-01.

**Cuándo avisar:** Si ninguna revisión explica la falla: avisar la hora esperada y lo que muestra el log.

**Depende de:** DB-04, EF-06
**Si falla, afecta a:** EF-06

**Soporte técnico (Claude):**
- `select * from public.salud_crons;` (criterio del detector: backup-diario con más de 26 horas o exito=false = problema).
- `get_edge_function` y `query_logs` de `alerta-pm`.

### CRN-03 — Tarea programada: resumen-semanal-lunes

Resumen semanal de la flota por correo. Corre a las lunes 11:00 UTC (en Chile son 3 o 4 horas menos según la época del año).

- **Trabajo:** `resumen-semanal-lunes` (0 11 * * 1, hora UTC)
- **Llama a:** EF-07 (`resumen-semanal`)
- **Registro de resultado:** tabla `salud_crons`, fila `resumen-semanal`

**Cómo se ve:** No llegó el correo de hoy; En `salud_crons` la fecha es de hace más de un día o dice error

**Confirmar:**
1. Panel → Integrations → Cron: ¿corrió hoy? (DB-04)
2. Panel → Edge Functions → resumen-semanal → Logs: ¿qué respondió?
3. Si corrió y respondió bien pero no llegó el correo: ver EXT-01 (Resend).
4. Si responde «No autorizado»: ver DB-03.

**Qué hacer:** Según la causa: ver la ficha de EF-07, DB-03 o EXT-01.

**Cuándo avisar:** Si ninguna revisión explica la falla: avisar la hora esperada y lo que muestra el log.

**Depende de:** DB-04, EF-07
**Si falla, afecta a:** EF-07

**Soporte técnico (Claude):**
- `select * from public.salud_crons;` (criterio del detector: backup-diario con más de 26 horas o exito=false = problema).
- `get_edge_function` y `query_logs` de `resumen-semanal`.

### CRN-04 — Tarea programada: vigilar-salud-sistema-diario

Revisa que las demás tareas hayan corrido y avisa si algo falló. Corre a las 13:00 UTC (en Chile son 3 o 4 horas menos según la época del año).

- **Trabajo:** `vigilar-salud-sistema-diario` (0 13 * * *, hora UTC)
- **Llama a:** EF-08 (`vigilar-salud-sistema`)
- **Registro de resultado:** tabla `salud_crons`, fila `vigilar-salud-sistema`

**Cómo se ve:** No llegó el correo de hoy; En `salud_crons` la fecha es de hace más de un día o dice error

**Confirmar:**
1. Panel → Integrations → Cron: ¿corrió hoy? (DB-04)
2. Panel → Edge Functions → vigilar-salud-sistema → Logs: ¿qué respondió?
3. Si corrió y respondió bien pero no llegó el correo: ver EXT-01 (Resend).
4. Si responde «No autorizado»: ver DB-03.

**Qué hacer:** Según la causa: ver la ficha de EF-08, DB-03 o EXT-01.

**Cuándo avisar:** Si ninguna revisión explica la falla: avisar la hora esperada y lo que muestra el log.

**Depende de:** DB-04, EF-08
**Si falla, afecta a:** EF-08

**Soporte técnico (Claude):**
- `select * from public.salud_crons;` (criterio del detector: backup-diario con más de 26 horas o exito=false = problema).
- `get_edge_function` y `query_logs` de `vigilar-salud-sistema`.

### CRN-05 — Tarea programada: capturar-accesos

Copia las sesiones de inicio de sesión a la tabla `accesos_servidor` para detectar accesos sospechosos (se ve en la tarjeta de accesos de Configuración). Corre cada minuto (hora UTC).

- **Trabajo:** `capturar-accesos` (* * * * *)
- **Corre dentro de la base:** no llama a ninguna función externa

**Cómo se ve:** Las sesiones nuevas no aparecen en la tarjeta de accesos de Configuración

**Confirmar:**
1. Panel → Integrations → Cron: ¿está activo y cuándo corrió? (DB-04)
2. Tabla `accesos_servidor` ({sb}/editor): ¿entran filas nuevas?

**Qué hacer:** Si está desactivado, reactivarlo desde el panel.

**Cuándo avisar:** Si corre y falla: avisar el mensaje de error del historial.

**Depende de:** DB-04

**Soporte técnico (Claude):**
- `select * from cron.job_run_details where jobid=(select jobid from cron.job where jobname='capturar-accesos') order by start_time desc limit 10;`

### CRN-06 — Tarea programada: avisar-accesos-sospechosos

Manda un correo (Resend, clave del Vault) con los accesos en rojo que aún no se hayan avisado. Corre cada 5 minutos (hora UTC).

- **Trabajo:** `avisar-accesos-sospechosos` (*/5 * * * *)
- **Corre dentro de la base:** no llama a ninguna función externa

**Cómo se ve:** No hay avisos de accesos sospechosos

**Confirmar:**
1. Panel → Integrations → Cron: ¿está activo y cuándo corrió? (DB-04)
2. Tabla `accesos_servidor` ({sb}/editor): ¿entran filas nuevas?

**Qué hacer:** Si está desactivado, reactivarlo desde el panel.

**Cuándo avisar:** Si corre y falla: avisar el mensaje de error del historial.

**Depende de:** DB-04

**Soporte técnico (Claude):**
- `select * from cron.job_run_details where jobid=(select jobid from cron.job where jobname='avisar-accesos-sospechosos') order by start_time desc limit 10;`

### CRN-07 — Tarea programada: purgar-uso-pestanas

Borra el registro de uso de pestañas de más de 90 días. Corre 05:00 UTC (hora UTC).

- **Trabajo:** `purgar-uso-pestanas` (0 5 * * *)
- **Corre dentro de la base:** no llama a ninguna función externa

**Cómo se ve:** La tabla crece sin límite o no se limpia

**Confirmar:**
1. Panel → Integrations → Cron: ¿está activo y cuándo corrió? (DB-04)

**Qué hacer:** Si está desactivado, reactivarlo desde el panel.

**Cuándo avisar:** Si corre y falla: avisar el mensaje de error del historial.

**Depende de:** DB-04

**Soporte técnico (Claude):**
- `select * from cron.job_run_details where jobid=(select jobid from cron.job where jobname='purgar-uso-pestanas') order by start_time desc limit 10;`

### CRN-08 — Tarea programada: purgar-papelera

Borra de la papelera lo eliminado hace más de 30 días. Corre 06:00 UTC (hora UTC).

- **Trabajo:** `purgar-papelera` (0 6 * * *)
- **Corre dentro de la base:** no llama a ninguna función externa

**Cómo se ve:** La tabla crece sin límite o no se limpia

**Confirmar:**
1. Panel → Integrations → Cron: ¿está activo y cuándo corrió? (DB-04)

**Qué hacer:** Si está desactivado, reactivarlo desde el panel.

**Cuándo avisar:** Si corre y falla: avisar el mensaje de error del historial.

**Depende de:** DB-04

**Soporte técnico (Claude):**
- `select * from cron.job_run_details where jobid=(select jobid from cron.job where jobname='purgar-papelera') order by start_time desc limit 10;`

### EF-01 — Función: crear-operador

Crea usuarios nuevos. Es el único punto donde la página puede pedir algo que un usuario común no podría hacer solo.

- **Panel:** {sb}/functions/crear-operador (Logs en esa misma pestaña)
- **Código:** `supabase/functions/crear-operador/index.ts`
- **Quién la llama:** Configuración → Crear Usuario del Sistema (solo admin).
- **Claves que usa:** `SUPABASE_SERVICE_ROLE_KEY` (la pone Supabase sola)

**Cómo se ve:** Error al crear un usuario; El usuario se crea pero no puede entrar

**Confirmar:**
1. Panel → Edge Functions → crear-operador → Logs: ¿qué error devolvió?
2. Authentication → Users: ¿el usuario quedó creado?

**Qué hacer:** Si quedó creado sin rol: activarlo desde «Pendientes de activar».

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** AUT-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `crear-operador`.

### EF-02 — Función: registrar-intento-acceso

Registra cada intento de inicio de sesión y valida el captcha en el servidor. No exige sesión (tiene verify_jwt desactivado: se llama antes de iniciar sesión).

- **Panel:** {sb}/functions/registrar-intento-acceso (Logs en esa misma pestaña)
- **Código:** `supabase/functions/registrar-intento-acceso/index.ts`
- **Quién la llama:** La pantalla de login.

**Cómo se ve:** El login se queda esperando; No quedan registrados los intentos de acceso

**Confirmar:**
1. Logs de la función.
2. Ver EXT-04 (captcha).

**Qué hacer:** Se corrige en el código o en la llave del captcha (EXT-04).

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-04, AUT-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `registrar-intento-acceso`.

### EF-03 — Función: avisar-dispositivo-nuevo

Avisa por correo cuando alguien entra desde un dispositivo nuevo.

- **Panel:** {sb}/functions/avisar-dispositivo-nuevo (Logs en esa misma pestaña)
- **Código:** `supabase/functions/avisar-dispositivo-nuevo/index.ts`
- **Quién la llama:** Se llama sola al iniciar sesión.

**Cómo se ve:** No llega el aviso de dispositivo nuevo

**Confirmar:**
1. Logs de la función.
2. Ver EXT-01 (correo).

**Qué hacer:** Ver EXT-01.

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `avisar-dispositivo-nuevo`.

### EF-04 — Función: avisar-salud-equipo

Avisa por correo cuando la salud de un equipo cae a nivel crítico.

- **Panel:** {sb}/functions/avisar-salud-equipo (Logs en esa misma pestaña)
- **Código:** `supabase/functions/avisar-salud-equipo/index.ts`
- **Quién la llama:** El Dashboard (al calcular la salud de la flota).

**Cómo se ve:** No llega el aviso de salud de un equipo

**Confirmar:**
1. Logs de la función.
2. Ver EXT-01 (correo).

**Qué hacer:** Ver EXT-01.

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `avisar-salud-equipo`.

### EF-05 — Función: backup-diario

Junta todas las tablas de la lista `TABLAS` más las cuentas de acceso, las comprime y las manda por correo.

- **Panel:** {sb}/functions/backup-diario (Logs en esa misma pestaña)
- **Código:** `supabase/functions/backup-diario/index.ts`
- **Quién la llama:** CRN-01.

**Cómo se ve:** No llegó el correo del respaldo; En `salud_crons` dice error o tiene más de 26 horas

**Confirmar:**
1. Logs de la función: ¿qué tabla falló?
2. Si el correo no llegó pero la función respondió bien: EXT-01.
3. El adjunto tiene un límite de tamaño de Resend (≈40 MB); la función comprime antes de enviar.

**Qué hacer:** Si una tabla nueva no está en el respaldo: se agrega a la lista `TABLAS` del código (hay una prueba que cuida el tamaño de esa lista).

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** CRN-01, DB-03, EXT-01
**Si falla, afecta a:** CRN-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `backup-diario`.
- La lista `TABLAS` (`index.ts`) debe tener todas las tablas reales; `index.test.ts` fija el tamaño (63).

### EF-06 — Función: alerta-pm

Envía el aviso diario de PM próximos y vencidos por correo (y por WhatsApp si estuviera operativo).

- **Panel:** {sb}/functions/alerta-pm (Logs en esa misma pestaña)
- **Código:** `supabase/functions/alerta-pm/index.ts`
- **Quién la llama:** CRN-02.
- **Claves que usa:** `RESEND_API_KEY`, `ALERTA_PM_DESTINATARIOS`, `ALERTA_PM_REMITENTE` (y Twilio, hoy no operativo)

**Cómo se ve:** No llega el aviso diario de PM

**Confirmar:**
1. `salud_crons` fila `alerta-pm`.
2. Logs de la función.
3. Ver EXT-01 y DB-03.

**Qué hacer:** Según la causa (EXT-01, DB-03).

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** CRN-02, DB-03, EXT-01
**Si falla, afecta a:** CRN-02

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `alerta-pm`.

### EF-07 — Función: resumen-semanal

Envía el resumen semanal de la flota por correo.

- **Panel:** {sb}/functions/resumen-semanal (Logs en esa misma pestaña)
- **Código:** `supabase/functions/resumen-semanal/index.ts`
- **Quién la llama:** CRN-03.
- **Claves que usa:** `RESEND_API_KEY`, `ALERTA_PM_DESTINATARIOS`, `ALERTA_PM_REMITENTE`

**Cómo se ve:** No llegó el resumen del lunes

**Confirmar:**
1. `salud_crons` fila `resumen-semanal`.
2. Logs de la función.
3. Ver EXT-01 y DB-03.

**Qué hacer:** Según la causa (EXT-01, DB-03).

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** CRN-03, DB-03, EXT-01
**Si falla, afecta a:** CRN-03

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `resumen-semanal`.

### EF-08 — Función: vigilar-salud-sistema

El vigilante: revisa `salud_crons` y avisa por correo si el respaldo falló o tiene más de 26 horas, o si un webhook falló.

- **Panel:** {sb}/functions/vigilar-salud-sistema (Logs en esa misma pestaña)
- **Código:** `supabase/functions/vigilar-salud-sistema/index.ts`
- **Quién la llama:** CRN-04.

**Cómo se ve:** Llega un correo de alerta de salud; No llegó la revisión diaria

**Confirmar:**
1. Leer el correo: dice qué tarea falló; ir a su CRN.
2. `salud_crons`.

**Qué hacer:** Se atiende la pieza que dice el correo.

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** CRN-04, EXT-01
**Si falla, afecta a:** CRN-04, MON-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `vigilar-salud-sistema`.
- El criterio vive en `evaluarSaludCrons()` (`index.ts`).

### EF-09 — Función: whatsapp-webhook _(Sin uso: Twilio no operativo)_

Recibe mensajes de WhatsApp (Twilio), los interpreta con IA y los guarda como reportes de falla.

- **Panel:** {sb}/functions/whatsapp-webhook (Logs en esa misma pestaña)
- **Código:** `supabase/functions/whatsapp-webhook/index.ts`
- **Quién la llama:** Twilio, cuando llega un mensaje.
- **Claves que usa:** `TWILIO_AUTH_TOKEN`, `ANTHROPIC_API_KEY`

**Cómo se ve:** Los reportes por WhatsApp no entran

**Confirmar:**
1. Twilio no está operativo (cuenta vencida): es la causa esperada.

**Qué hacer:** Reactivar Twilio y volver a apuntar el webhook a esta función.

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-03, EXT-05

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `whatsapp-webhook`.

### EF-10 — Función: email-webhook

Recibe reportes de falla enviados por correo (Resend los reenvía a esta función) y los guarda.

- **Panel:** {sb}/functions/email-webhook (Logs en esa misma pestaña)
- **Código:** `supabase/functions/email-webhook/index.ts`
- **Quién la llama:** Resend, cuando llega un correo a la casilla de reportes.
- **Claves que usa:** `RESEND_WEBHOOK_SECRET`, `RESEND_API_KEY`

**Cómo se ve:** Los reportes por correo no entran

**Confirmar:**
1. Panel de Resend → Webhooks: ¿entregó la llamada?
2. Logs de la función.

**Qué hacer:** Ver EXT-01.

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `email-webhook`.

### EF-11 — Función: leer-pauta-pm

Usa IA (Google Gemini) para que el sistema lee la foto de una pauta de PM. Solo lee y devuelve datos para revisar: nunca guarda nada por su cuenta.

- **Panel:** {sb}/functions/leer-pauta-pm (Logs en esa misma pestaña)
- **Código:** `supabase/functions/leer-pauta-pm/index.ts`
- **Quién la llama:** Pautas de PM, importar desde foto (se llama desde `index.html`).
- **Claves que usa:** `GEMINI_API_KEY`

**Cómo se ve:** «No se pudo leer» o se queda cargando; Lee mal los datos (siempre se revisa antes de guardar); Error 401 (sesión vencida)

**Confirmar:**
1. Probar con otra foto, más nítida y de menos peso.
2. Si falla siempre: ver EXT-02 (clave o cuota de Gemini).
3. Si dice sesión vencida: cerrar sesión y volver a entrar (AUT-01).

**Qué hacer:** Ver EXT-02.

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-02, AUT-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `leer-pauta-pm`.

### EF-12 — Función: leer-informe-correctivo

Usa IA (Google Gemini) para que el sistema lee la foto de un informe de falla. Solo lee y devuelve datos para revisar: nunca guarda nada por su cuenta.

- **Panel:** {sb}/functions/leer-informe-correctivo (Logs en esa misma pestaña)
- **Código:** `supabase/functions/leer-informe-correctivo/index.ts`
- **Quién la llama:** Correctivos (`modules/renders/ot.js`): leer informe por foto.
- **Claves que usa:** `GEMINI_API_KEY`

**Cómo se ve:** «No se pudo leer» o se queda cargando; Lee mal los datos (siempre se revisa antes de guardar); Error 401 (sesión vencida)

**Confirmar:**
1. Probar con otra foto, más nítida y de menos peso.
2. Si falla siempre: ver EXT-02 (clave o cuota de Gemini).
3. Si dice sesión vencida: cerrar sesión y volver a entrar (AUT-01).

**Qué hacer:** Ver EXT-02.

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-02, AUT-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `leer-informe-correctivo`.

### EF-13 — Función: leer-chequeo-neumaticos

Usa IA (Google Gemini) para que el sistema lee la foto de un chequeo de neumáticos. Solo lee y devuelve datos para revisar: nunca guarda nada por su cuenta.

- **Panel:** {sb}/functions/leer-chequeo-neumaticos (Logs en esa misma pestaña)
- **Código:** `supabase/functions/leer-chequeo-neumaticos/index.ts`
- **Quién la llama:** Neumáticos (`neu.js`): «Leer chequeo (foto)».
- **Claves que usa:** `GEMINI_API_KEY`

**Cómo se ve:** «No se pudo leer» o se queda cargando; Lee mal los datos (siempre se revisa antes de guardar); Error 401 (sesión vencida)

**Confirmar:**
1. Probar con otra foto, más nítida y de menos peso.
2. Si falla siempre: ver EXT-02 (clave o cuota de Gemini).
3. Si dice sesión vencida: cerrar sesión y volver a entrar (AUT-01).

**Qué hacer:** Ver EXT-02.

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-02, AUT-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `leer-chequeo-neumaticos`.

### EF-14 — Función: leer-reporte-produccion

Usa IA (Google Gemini) para que el sistema lee la foto del reporte de producción. Solo lee y devuelve datos para revisar: nunca guarda nada por su cuenta.

- **Panel:** {sb}/functions/leer-reporte-produccion (Logs en esa misma pestaña)
- **Código:** `supabase/functions/leer-reporte-produccion/index.ts`
- **Quién la llama:** Producción (`prod.js`): importar reporte por foto.
- **Claves que usa:** `GEMINI_API_KEY`

**Cómo se ve:** «No se pudo leer» o se queda cargando; Lee mal los datos (siempre se revisa antes de guardar); Error 401 (sesión vencida)

**Confirmar:**
1. Probar con otra foto, más nítida y de menos peso.
2. Si falla siempre: ver EXT-02 (clave o cuota de Gemini).
3. Si dice sesión vencida: cerrar sesión y volver a entrar (AUT-01).

**Qué hacer:** Ver EXT-02.

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-02, AUT-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `leer-reporte-produccion`.

### EF-15 — Función: leer-horometro

Usa IA (Google Gemini) para que el sistema lee el horómetro desde una foto. Solo lee y devuelve datos para revisar: nunca guarda nada por su cuenta.

- **Panel:** {sb}/functions/leer-horometro (Logs en esa misma pestaña)
- **Código:** `supabase/functions/leer-horometro/index.ts`
- **Quién la llama:** Historial de horómetros (`hist.js`): leer horómetro desde una foto.
- **Claves que usa:** `GEMINI_API_KEY`

**Cómo se ve:** «No se pudo leer» o se queda cargando; Lee mal los datos (siempre se revisa antes de guardar); Error 401 (sesión vencida)

**Confirmar:**
1. Probar con otra foto, más nítida y de menos peso.
2. Si falla siempre: ver EXT-02 (clave o cuota de Gemini).
3. Si dice sesión vencida: cerrar sesión y volver a entrar (AUT-01).

**Qué hacer:** Ver EXT-02.

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-02, AUT-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `leer-horometro`.

### EF-16 — Función: clasificar-correctivos

Usa IA (Google Gemini) para que el sistema clasifica el componente de las OT con IA. Solo lee y devuelve datos para revisar: nunca guarda nada por su cuenta.

- **Panel:** {sb}/functions/clasificar-correctivos (Logs en esa misma pestaña)
- **Código:** `supabase/functions/clasificar-correctivos/index.ts`
- **Quién la llama:** Auditoría → clasificación asistida.
- **Claves que usa:** `GEMINI_API_KEY`

**Cómo se ve:** «No se pudo leer» o se queda cargando; Lee mal los datos (siempre se revisa antes de guardar); Error 401 (sesión vencida)

**Confirmar:**
1. Probar con otra foto, más nítida y de menos peso.
2. Si falla siempre: ver EXT-02 (clave o cuota de Gemini).
3. Si dice sesión vencida: cerrar sesión y volver a entrar (AUT-01).

**Qué hacer:** Ver EXT-02.

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-02, AUT-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `clasificar-correctivos`.

### EF-17 — Función: leer-estatus-equipos

Usa IA (Google Gemini) para que el sistema lee la captura del estatus diario de equipos. Solo lee y devuelve datos para revisar: nunca guarda nada por su cuenta.

- **Panel:** {sb}/functions/leer-estatus-equipos (Logs en esa misma pestaña)
- **Código:** `supabase/functions/leer-estatus-equipos/index.ts`
- **Quién la llama:** Disponibilidad → Reportabilidad → Importar desde captura.
- **Claves que usa:** `GEMINI_API_KEY`

**Cómo se ve:** «No se pudo leer» o se queda cargando; Lee mal los datos (siempre se revisa antes de guardar); Error 401 (sesión vencida)

**Confirmar:**
1. Probar con otra foto, más nítida y de menos peso.
2. Si falla siempre: ver EXT-02 (clave o cuota de Gemini).
3. Si dice sesión vencida: cerrar sesión y volver a entrar (AUT-01).

**Qué hacer:** Ver EXT-02.

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-02, AUT-01

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `leer-estatus-equipos`.

### EF-18 — Función: asistente-ia

El asistente de preguntas de la app (pestaña Asistente): conversa con Claude (Anthropic). Valida quién pregunta, aplica los límites de uso y devuelve la respuesta o el pedido de una herramienta; las herramientas las ejecuta el navegador con los datos que la persona ya tiene cargados. Nunca escribe nada.

- **Panel:** {sb}/functions/asistente-ia (Logs en esa misma pestaña)
- **Código:** `supabase/functions/asistente-ia/index.ts` (la lista de herramientas debe coincidir con `asistenteEjecutar` en `logic.js`)
- **Quién la llama:** Pestaña Asistente (`modules/renders/asistente.js`).
- **Claves que usa:** `ANTHROPIC_API_KEY` (obligatoria); opcionales `ASISTENTE_IA_MODELO`, `ASISTENTE_IA_LLAMADAS_HORA` (40), `ASISTENTE_IA_TOPE_TOKENS_DIA` (2.000.000)
- **Tabla:** `asistente_ia_uso` (cada llamada: quién, cuándo, modelo, tokens, pregunta); solo la lee un administrador

**Cómo se ve:** «El asistente todavía no está configurado» (error 503); «Llegaste al límite de consultas por hora» o «El equipo llegó al tope diario» (429); «Tu perfil no incluye el asistente» (403): la cuenta tiene un perfil restringido; «Anthropic rechazó la consulta» o «La clave de Anthropic no es válida» (502); El asistente tarda mucho o responde que necesitó demasiadas consultas

**Confirmar:**
1. Panel → Edge Functions → Secrets: ¿existe `ANTHROPIC_API_KEY`?
2. Logs de la función: el texto exacto del error de Anthropic.
3. `select count(*), sum(tokens_entrada+tokens_salida) from public.asistente_ia_uso where creado > now() - interval '24 hours';` para ver el uso del día.
4. Si dice 403 de perfil: Configuración → usuarios → perfil de esa cuenta.

**Qué hacer:** Cargar o renovar `ANTHROPIC_API_KEY` como secreto de la función (ver EXT-05). Subir los límites con los secretos opcionales si el equipo de verdad los necesita. Un límite alcanzado no es una falla: se reinicia solo (por hora o a las 24 horas).

**Cuándo avisar:** Si el log muestra un error de código, avisar el texto y la hora.

**Depende de:** EXT-05, AUT-01, DB-02

**Soporte técnico (Claude):**
- `get_edge_function` (código desplegado) y `query_logs` servicio `edge-function` filtrando `asistente-ia`.
- `select creado, user_id, modelo, tokens_entrada, tokens_salida, herramientas, pregunta from public.asistente_ia_uso order by id desc limit 20;`

## 4. Servicios externos

### EXT-04 — Captcha del login (Cloudflare Turnstile)

Un control anti-robots en la pantalla de login. Hay una llave pública en la página y una privada en Supabase.

- **Panel:** Cloudflare → Turnstile
- **Llave privada:** Vault de Supabase: `turnstile_secret_key` (y en Auth → Captcha protection)
- **Código:** `index.html` (`window._turnstileToken`), `supabase/functions/registrar-intento-acceso/`

**Cómo se ve:** El login se queda en «verificando»; Mensaje de captcha inválido; No aparece el recuadro del captcha

**Confirmar:**
1. Probar desde otra red o navegador (algunos bloqueadores de anuncios lo impiden).
2. Panel de Cloudflare: ¿el sitio (dominio `.vercel.app`) está en la lista de dominios permitidos del widget?

**Qué hacer:** Si la llave privada cambió en Cloudflare: actualizarla en Vault (`turnstile_secret_key`) y en Authentication → Captcha.

**Cuándo avisar:** Cambios de llaves: pedirlos.

**Depende de:** HOS-02
**Si falla, afecta a:** AUT-01, EF-02

**Soporte técnico (Claude):**
- La CSP debe permitir `challenges.cloudflare.com` (HOS-02).

### EXT-01 — Correo (Resend)

Servicio que envía todos los correos del sistema: respaldo, alertas de PM, resumen semanal, avisos de seguridad y alertas de salud.

- **Panel:** https://resend.com (Logs, Webhooks, API Keys)
- **Clave:** Vault `resend_api_key` y secreto de función `RESEND_API_KEY`
- **Remitente:** `onboarding@resend.dev` (remitente de prueba)

**Cómo se ve:** No llega ningún correo (respaldo, alertas, resumen); Llegan unos sí y otros no

**Confirmar:**
1. Panel de Resend → Logs: ¿figura el envío? ¿con qué estado (entregado, rebotado, error)?
2. Si no figura: la función no llegó a enviar (ver su EF y DB-03).
3. Si dice error de autenticación: la clave cambió o fue revocada.
4. Revisar la carpeta de spam.

**Qué hacer:** Clave revocada: crear otra en Resend y actualizarla en Vault y en los secretos de las funciones.

**Cuándo avisar:** El remitente de prueba normalmente solo entrega al correo dueño de la cuenta de Resend; para otros destinatarios hace falta un dominio verificado. Pedirlo.

**Depende de:** DB-03
**Si falla, afecta a:** EF-03, EF-04, EF-05, EF-06, EF-07, EF-08, EF-10

**Soporte técnico (Claude):**
- `select decrypted_secret from vault.decrypted_secrets where name='resend_api_key'` solo para enviar un correo de diagnóstico; nunca mostrar la clave.

### EXT-02 — Lectura por IA (Google Gemini)

El servicio que «lee» las fotos y capturas (pautas, informes, neumáticos, horómetros, estatus). Modelo usado: `gemini-3.6-flash`.

- **Clave:** secreto de función `GEMINI_API_KEY` ({sb}/functions → Secrets)
- **Panel:** Google AI Studio → API keys y cuotas

**Cómo se ve:** Todas las lecturas por foto fallan a la vez; Error de cuota o de clave

**Confirmar:**
1. ¿Falla solo una función o todas? Si todas, es la clave o la cuota.
2. Google AI Studio: ¿la clave está activa y con cupo?

**Qué hacer:** Clave vencida o sin cuota: crear otra y cargarla como secreto `GEMINI_API_KEY` en el proyecto.

**Cuándo avisar:** Cambiar de modelo o proveedor: pedirlo.

**Si falla, afecta a:** EF-11, EF-12, EF-13, EF-14, EF-15, EF-16, EF-17

**Soporte técnico (Claude):**
- Las funciones EF-11 a EF-17 usan el mismo secreto; el modelo está en `const MODELO` de cada una.

### EXT-03 — WhatsApp y SMS (Twilio) _(No operativo)_

Habilitaría avisos y reportes por WhatsApp. Hoy no está operativo (cuenta vencida y WhatsApp no aprobado): los avisos salen solo por correo.

- **Panel:** https://console.twilio.com
- **Claves:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`

**Cómo se ve:** No llegan avisos ni reportes por WhatsApp (esperado mientras Twilio esté inactivo)

**Confirmar:**
1. Nada que revisar: es el estado actual.

**Qué hacer:** Reactivar la cuenta de Twilio y volver a apuntar el webhook (EF-09).

**Si falla, afecta a:** EF-09, EXT-05

**Soporte técnico (Claude):**
- Las funciones que lo usan ignoran WhatsApp si faltan sus claves y siguen con el correo.

### EXT-05 — Interpretación de reportes y asistente (Anthropic)

IA de Anthropic (Claude): convierte el texto libre de un reporte (WhatsApp o correo) en una OT estructurada y responde las preguntas de la pestaña Asistente.

- **Clave:** secreto de función `ANTHROPIC_API_KEY`
- **Código:** `supabase/functions/_shared/interpretarConIA.ts`, `supabase/functions/whatsapp-webhook/index.ts` y `supabase/functions/asistente-ia/index.ts`
- **Panel externo:** console.anthropic.com → Usage y Limits (gasto y tope mensual)

**Cómo se ve:** Los reportes por WhatsApp o correo llegan pero no se interpretan; El asistente dice que no está configurado o que la clave no es válida

**Confirmar:**
1. Logs de EF-09 y EF-10: ¿error de clave?
2. Logs de EF-18: ¿«Anthropic rechazó la consulta» o error de clave?
3. console.anthropic.com: ¿saldo o tope de gasto agotado?

**Qué hacer:** Cargar una clave vigente como secreto de las funciones. Revisar el saldo y el tope de gasto en la cuenta de Anthropic.

**Depende de:** EXT-03
**Si falla, afecta a:** EF-09, EF-18

### EXT-06 — Monitoreo de errores del navegador (Sentry)

Recibe los errores que ocurren en el navegador de cada persona. No es necesario para operar: si cae, el sistema funciona igual.

- **Panel:** https://sentry.io
- **Código:** `vendor/sentry.min.js`, `index.html`

**Cómo se ve:** No aparecen errores en Sentry (sin impacto operativo)

**Confirmar:**
1. Revisar la CSP (HOS-02): debe permitir `*.ingest.us.sentry.io`.

**Qué hacer:** Se corrige en el código.

**Depende de:** HOS-02

## 5. Vigilancia

### MON-01 — Detector de salud (salud_crons)

Cada tarea importante deja en la tabla `salud_crons` cuándo corrió y si salió bien. El vigilante (EF-08) la revisa todos los días y manda un correo si algo falló. Es el primer lugar donde mirar.

- **Tabla:** `salud_crons` ({sb}/editor)
- **Vigilante:** EF-08 (`vigilar-salud-sistema`, 13:00 UTC)

**Cómo se ve:** Llegó un correo de alerta de salud; Una tarea figura con error o con fecha vieja

**Confirmar:**
1. Abrir la tabla `salud_crons`: ¿qué fila tiene `exito=false` o una `ultimaEjecucion` vieja?
2. Esa fila indica la pieza: `backup-diario` → CRN-01; `alerta-pm` → CRN-02; `resumen-semanal` → CRN-03.

**Qué hacer:** Se atiende la pieza indicada.

**Depende de:** EF-08
**Si falla, afecta a:** MON-02

**Soporte técnico (Claude):**
- `select nombre, "ultimaEjecucion", exito, detalle from public.salud_crons order by nombre;` — es el PRIMER paso ante cualquier falla de tareas.

### MON-02 — Rutina diaria de diagnóstico (Claude)

Un rato después del vigilante, una rutina programada en la cuenta de Claude vuelve a revisar `salud_crons`. Si hay un problema real, investiga la causa y manda un correo de diagnóstico más detallado. Si todo está bien, no manda nada.

- **Dónde está:** Rutinas programadas de la cuenta de Claude (una por proyecto, ~13:20 UTC); no está en el repositorio.

**Cómo se ve:** Llegó un correo «Diagnóstico — Detector de salud»

**Confirmar:**
1. Leer el correo: dice qué se rompió, con evidencia, y si es de código o externo.

**Qué hacer:** Seguir lo que indique el correo (no aplica arreglos por su cuenta).

**Depende de:** MON-01

**Soporte técnico (Claude):**
- Solo lectura de Supabase y un posible correo; no edita archivos ni hace commit.

