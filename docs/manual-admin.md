# Manual de Administrador — SistemaMP Centinela

Para quien administra el sistema hoy, o para quien lo reciba mañana. Cubre lo
que un operador normal no necesita saber: gestión de usuarios, seguridad,
base de datos, despliegue, y qué hacer si algo se rompe.

Para cómo se conecta todo por dentro, ver [`arquitectura.md`](./arquitectura.md)
el diagrama [`plano-sistema.html`](./plano-sistema.html) y el [plano de fallas](./plano-fallas.html) (dónde buscar si algo falla).

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

Cada cuenta tiene un rol en `user_roles`: `admin`, `operador` o `lector`
(este último, solo lectura — pensado para alguien que necesita VER el
sistema sin poder editarlo). El rol se usa para dos cosas:
- Ocultar/mostrar botones en pantalla (cosmético; `_aplicarRolUI()` en
  `index.html` oculta los de crear/editar/guardar/borrar para `lector`).
- **Row Level Security (RLS) real en Postgres** — el candado que de verdad
  importa, y el único del que depende la seguridad (`lector` puede leer
  todo pero cualquier escritura la rechaza Postgres, aunque alguien
  manipule el navegador directamente). Cada una de las ~42 tablas tiene su
  propia política; 4 tablas
  (`equipos`, `stock_filtros`, `lubricantes`, `repuestos`) tienen además un
  *trigger* (`proteger_columnas_admin`) que bloquea a un operador que
  intente cambiar columnas reservadas (precio, datos estructurales del
  equipo), aunque manipule el navegador directamente.

**Bloqueo del campo "Tipo" de un equipo puntual** (2026-09-10): `equipos`
tiene una columna `tipo_bloqueado` — cualquier fila con `tipo_bloqueado=true`
no puede cambiar su `tipo` (un UPDATE que lo intente se revierte solo, en
silencio, sin importar el rol). Reemplaza a un trigger viejo
(`blindar_tipo_torres_iluminacion`) que protegía 6 torres de iluminación
puntuales con sus siglas escritas a mano en el SQL — se generalizó a
cualquier equipo, sin siglas hardcodeadas, migrando esos 6 al campo nuevo
(mismo comportamiento de antes para ellos). Hoy no hay ninguna casilla en
Configuración → Equipos para tocar esta bandera; para bloquear/desbloquear
el tipo de otro equipo hace falta un `UPDATE equipos SET
tipo_bloqueado=... WHERE sigla='...'` directo en Supabase.

**Fix real (2026-09-07) — un admin se veía degradado a operador solo**:
buscar el rol justo después del login/al restaurar sesión hacía un solo
intento contra `user_roles`; cualquier blip de red transitorio bastaba para
que fallara y el sistema cayera a `'operador'` por defecto sin avisar —
escondiendo el panel de administrador de una cuenta admin real, sin ningún
error visible. Ahora reintenta hasta 3 veces con espera creciente y, si aun
así falla, usa el último rol confirmado con éxito en ese dispositivo en vez
de asumir `'operador'` a ciegas (ver
[`arquitectura.md`](./arquitectura.md), sección 5, para el detalle técnico).

### Verificación en dos pasos (MFA)

Cualquier usuario puede activarla desde Configuración → Verificación en dos
pasos. No es obligatoria por ahora, pero conviene activarla al menos en las
cuentas admin.

### Contraseñas

Política mínima configurada en Supabase Auth: 14 caracteres, con
mayúscula/minúscula/dígito/símbolo. Las cuentas nuevas se crean con una
contraseña temporal que fuerza el cambio al primer ingreso.

**Recuperación self-service (2026-09-01):** el login tiene un link
"¿Olvidaste tu contraseña?" que dispara `POST /auth/v1/recover` (GoTrue) —
sin depender de un admin para desbloquear a nadie. GoTrue redirige el correo
de vuelta al mismo origin con el token en el hash de la URL
(`#access_token=...&type=recovery`), que el arranque del sistema captura y
lleva directo a la pantalla de "define tu nueva contraseña" (la misma que
ya existía para el primer ingreso). **Requiere que la URL de producción
esté en la lista de Redirect URLs permitidas** — Supabase → Authentication
→ URL Configuration → Redirect URLs (agregar `https://sistema-mp-
centinela.vercel.app/**`, o el dominio que corresponda) — si no está
autorizada, GoTrue rechaza el `redirect_to` y el link del correo no vuelve
bien a la app.

### Vencimiento de contraseña (rotación periódica, 2026-09-02)

Además de la política mínima de Supabase Auth, el propio sistema fuerza una
rotación: la fecha del último cambio real de contraseña se guarda en
`user_metadata.passwordChangedAt` (se estampa en cada cambio exitoso —
primer ingreso, recuperación, o voluntario). En cada login se compara
contra hoy:

- **80-89 días**: aviso blando (toast al entrar + estado visible en
  Configuración → Mi contraseña), no bloquea.
- **90+ días**: pantalla de cambio OBLIGATORIA al iniciar sesión, sin forma
  de saltarla — mismo mecanismo que "primer ingreso".

Cuentas que cambiaron su clave antes de que existiera este campo no tienen
`passwordChangedAt` — se usa la fecha de creación de la cuenta como
respaldo, sabiendo que puede ser más vieja que la clave real (un falso
positivo acá solo significa pedir el cambio un poco antes de lo
estrictamente necesario, nunca más tarde).

Desde **Configuración → Mi contraseña** cualquier usuario puede cambiarla
voluntariamente en cualquier momento, sin esperar a que el sistema lo pida
— antes esto no existía: solo se podía cambiar la clave si el sistema
obligaba (primer ingreso/vencida) o vía recuperación por correo.

### Alerta de dispositivo nuevo y señales de anomalía (2026-09-01/02)

Tras cada login exitoso, la Edge Function `avisar-dispositivo-nuevo` trae
el historial de accesos de esa cuenta (tabla `changelog`, últimos 60 días,
una sola consulta) y manda un correo/WhatsApp si detecta cualquiera de
estas señales — si dispara más de una a la vez, un solo aviso las lista
todas:

1. **Dispositivo nuevo** — la cuenta nunca había entrado desde ese
   navegador/equipo (etiqueta guardada en `localStorage`, ver
   `_getDeviceLabel()` en `index.html`).
2. **Horario inusual** — el login ocurre fuera del rango de horas en que
   esa cuenta históricamente entra (mínimo 5 logins previos para tener una
   base real, margen de ±1 hora).
3. **Varios dispositivos nuevos en poco tiempo** — 3 o más dispositivos
   distintos, nunca vistos antes, en los últimos 7 días — indicio de que la
   clave se compartió o se filtró.

Por separado, `registrar-intento-acceso` (ver "Auditoría" más abajo) avisa
si una cuenta acumula **5 intentos de acceso fallidos en 15 minutos**
—posible fuerza bruta—, solo la vez que se cruza el umbral, no en cada
intento posterior (para no saturar si el ataque sigue).

Ambas reutilizan los mismos destinatarios y secrets ya configurados para
`alerta-pm`/`resumen-semanal` (sección 7) — sin `TWILIO_*`, el correo sigue
funcionando igual, solo el WhatsApp queda inactivo.

En pantalla, **Configuración → Accesos recientes** marca con 🆕 la primera
vez que aparece un dispositivo en el historial completo de la cuenta —
mismo criterio que usa la Edge Function, calculado en el navegador sobre el
mismo dato (no es una llamada nueva a Supabase).

### Accesos del servidor y alerta de accesos sospechosos (2026-10-22)

**Qué cubre.** Los avisos de dispositivo nuevo y de intentos fallidos (arriba) los dispara el navegador de la app, y el registro de
"Accesos recientes" vive en `changelog`, que tiene un tope de 500 filas, un botón "Limpiar" y se puede editar o borrar siendo admin. Alguien
que entrara directo a la API con una clave robada no dejaba rastro ahí, y Supabase solo deja consultar sus propios registros de autenticación
24 h hacia atrás. Por eso el servidor copia cada sesión nueva de Supabase Auth (`auth.sessions`) a una tabla propia de **solo agregar**:
`public.accesos_servidor` (cuenta, IP, navegador, si completó el MFA, motivos y nivel). Nadie la edita ni la borra (lo impide un trigger,
igual que `auditoria_cambios`) y solo un admin con MFA completo la lee.

**Cómo funciona.** Dos tareas de `pg_cron`, sin Edge Function ni secreto nuevo:

| Tarea | Cada | Qué hace |
|---|---|---|
| `capturar-accesos` | 1 minuto | Copia las sesiones nuevas y les pone nivel. La primera vez deja las sesiones que ya existían como **base** (no alertan). |
| `avisar-accesos-sospechosos` | 5 minutos | Manda UN correo (Resend, clave `resend_api_key` del Vault) con lo que esté en rojo y no se haya avisado. |

**Niveles.**
- 🔴 **Rojo** (tarjeta y correo): cuenta bloqueada, cuenta sin rol activo, IP **y** navegador nunca vistos juntos en esa cuenta, o **MFA incompleto**
  (la cuenta tiene verificación en dos pasos y la sesión no la completó en 5 minutos: alguien sabe la clave pero no tiene el segundo factor).
- 🟠 **Ámbar** (solo tarjeta): IP nueva sola, navegador nuevo solo, o primer acceso de una cuenta. Una IP nueva sola no alerta a propósito: con datos
  móviles cambia seguido y llenaría el correo de falsas alarmas.

**Dónde se ve.** **Configuración → Usuarios y accesos → Accesos del servidor**: un resumen de las últimas 72 h (en rojo si hay algo sospechoso) y el
detalle de las últimas 200 sesiones. Solo lo ven los admin. Si la migración aún no se aplicó en ese proyecto, la tarjeta dice "Aún no está activado".

**Qué hacer con un acceso en rojo.** Si lo reconoces (por ejemplo, tu propio celular con otra red), no hay nada más que hacer. Si no: bloquea la
cuenta en Supabase → Authentication → Users y cambia la clave. El registro queda como evidencia.

**Límites conocidos.**
- Una sesión que entre y salga en menos de un minuto puede no alcanzar a copiarse (la hora del último ingreso de cada cuenta sigue en `auth.users`).
- El correo sale por `net.http_post` (asíncrono): la fila se marca "avisado" al encolarlo, no al confirmarse la entrega. Si falta `resend_api_key`
  en el Vault, la función falla, los rojos quedan sin avisar y se reintenta a los 5 minutos (se ve en `cron.job_run_details`).
- Lo detectado en `mfa_incompleto` se evalúa a los 5 minutos: alguien que esté a media verificación más de 5 minutos también se marca. Es un falso
  positivo conocido y barato (un correo).
- Solo un admin con MFA completo lee la tabla; un operador con la clave filtrada pero sin MFA no puede verla ni alterarla.
- Mientras la cuenta tenga MFA, una sesión con clave pero sin segundo factor (nivel aal1) igual puede leer los datos de un operador por la API:
  hoy el MFA obligatorio lo exige la app (y la base para el rol admin), no todas las tablas. Esta alerta es justamente lo que lo detecta.
- Las IP y navegadores que ya usaste antes de instalarlo pueden alertar una vez como nuevos (la foto inicial solo conoce las sesiones activas ese día).

**Prueba.** La lógica (reglas, correo escapado, solo-agregar, permisos, falta de clave) se probó contra un Postgres 16 real con las tablas de
Supabase simuladas; `tests/migracionAccesosServidor.test.js` vigila que el archivo no pierda esas protecciones y
`tests/e2e/accesos-servidor.spec.js` prueba la tarjeta (rojo, verde, tabla no activada, operador sin tarjeta, navegador escapado).

### Datos desactualizados: qué muestra el sistema cuando se deja de cargar (2026-10-23)

**Regla.** Si el último horómetro de un equipo tiene **más de 30 días** (o no tiene fecha, o es 0), el sistema **no calcula** su próximo PM: lo muestra como **⚪ SIN LECTURA** (o **⚪ SIN DATO** si nunca se cargó un horómetro) y no lo cuenta como urgente, próximo ni al día. De 8 a 30 días se sigue calculando pero con el rótulo «lectura de hace N d». Hasta 7 días es vigente. Los 7 y 30 días son una convención (`C.DIAS_LECTURA_VIGENTE` y `C.DIAS_LECTURA_MAX` en `logic.js`; la copia de `alerta-pm` debe cambiarse igual, un test avisa si difieren).

**Dónde se ve.** Contador «N Sin lectura» en la cabecera (abre la lista con la última lectura de cada equipo), aviso en el Dashboard, fila gris punteada en Equipos (filtro «SIN LECTURA / SIN DATO»), Buscador Maestro y Registro PM. El correo diario suma la sección «Equipos sin lectura reciente de horómetro» y deja de contar a esos equipos como «PM urgente».

**Si pasan uno o dos meses sin cargar datos** (corte de electricidad, el técnico con licencia): la flota completa pasa a «sin lectura», el Dashboard lo avisa con la fecha de la lectura más nueva y el correo diario llega todos los días hasta que se carguen horómetros. No hay números inventados ni «todo al día». Al cargar un horómetro, el equipo vuelve a calcularse solo.

**Disponibilidad y MTBF (cobertura de registro).** Un día solo cuenta como disponible si el equipo tiene algún registro (lectura de horómetro, OT o PM) a menos de 7 días, o una detención cargada. Los días sin registro no entran al promedio. Con una semana sin datos todo sigue igual; con un mes o dos, el mes queda con poca cobertura o «Sin datos» en vez de 100 %. Dashboard, Disponibilidad, KPI, Metas y Predictivo muestran «Cobertura de datos: N % de los días del mes» y avisan si baja de 50 %. El MTBF mensual de KPI aparece como «sin dato» en un mes con menos de 50 % de cobertura. Un valor de disponibilidad cargado a mano no se modifica. Límite: la cobertura mide que hubo registro, no que el dato sea bueno.

### «Falla» para MTBF y MTTR: parada de 24 h o más (2026-10-23)

**Regla.** MTBF y MTTR se miden sobre las **paradas de 24 horas o más** (decisión del usuario; `PARADA_LARGA_H` en `logic.js`). Un correctivo más corto es una *intervención*, no una falla: se sigue contando y mostrando como «Intervenciones», pero no entra al MTBF ni al MTTR. El tiempo detenido sale del campo duración de la OT (o de las fechas y horas de entrada y salida; en una salida de servicio abierta, de las horas desde la entrada). Una OT sin duración y el histórico de WhatsApp/correo (que no trae duración) no se pueden clasificar y quedan fuera.

**Dónde se ve.** Dashboard (MTBF real de flota y Disp. Inherente), Informes KPI, Costos → MTBF/MTTR (incluida la Matriz Jack-Knife; «Mantenibilidad» se compara con la mediana de la flota), Metas y el Buscador Maestro. Cada una dice «paradas de ≥24 h» y cuántas intervenciones hay en total.

**Qué no cambió.** Weibull, Kijima, probabilidad de intervención (antes «de falla»), RUL, Pareto, Estadística y el score de salud siguen sobre intervenciones (miden frecuencia). La Disponibilidad Operacional no cambia.

**MTBF de flota.** Se calcula como horas de operación de toda la flota ÷ número de paradas de 24 h o más, con su intervalo de confianza 95 %, en la ventana en que hay duraciones registradas (Dashboard, Informes KPI y Costos muestran el mismo número). Incluye a los equipos con 0 o 1 parada. El MTBF *de un equipo* con menos de 3 paradas largas se ve en gris como «muestra chica». Las franjas de color (verde sobre 2000 h, ámbar sobre 500 h) se revisaron con datos reales y se dejaron como están; la flota está lejos de la meta de 2000 h (que no se ha contrastado con datos reales). El número no se actualiza mientras no se carguen correctivos con duración.

### Traslado de neumáticos entre equipos y número de fuego (2026-10-30)

**Qué cambia.** En **Neumáticos**, cada neumático montado tiene un botón ⇄ para **pasarlo a otro equipo** (canibalización): equipo receptor, posición, causal (*Retraso en pedido*, *Proveedor sin stock*, *Siniestro* u *Otro* con detalle) y quién autorizó. El neumático se mueve con sus horas, queda una «Reasignación de Neumático» en Correctivos y el sensor se desmonta (si viajó con el neumático, se vuelve a instalar). El botón **⇄ Traslados** muestra los traslados del año por causal y las **posiciones del equipo donante que siguen sin neumático**, con los días que llevan así. Sigue el procedimiento PRO-MAN-004.

**Número de fuego.** El campo de serie se llama ahora «Serie / N° de fuego»: en los equipos grandes es la serie, y en camionetas y aljibes se anota el número de fuego marcado.

**Antes de desplegar.** Aplicar `20261030180000_crear_neumaticos_traslados.sql` en los dos proyectos y desplegar de nuevo `backup-diario` (63 tablas).

### Siniestros y plazo de denuncia (2026-10-30)

**Qué cambia.** En **Vencimientos**, arriba, está la sección **Siniestros** (instructivo corporativo IT-AD-003). Se registra el siniestro (equipo, fecha, tipo, relato, lesionados, tercero, constancia) y la app cuenta el **plazo de 5 días** para denunciarlo: se cuentan días corridos, el último día es la fecha del siniestro + 5. Desde 2 días antes del límite, y si ya venció, aparece un aviso en el encabezado («Siniestros por denunciar»). El estado avanza *Por informar → Informado* (pide la fecha en que se informó a Finanzas) *→ En liquidación → Cerrado* (pide el resultado: indemnizado, rechazado, sin cobertura o desistido).

**Documentos.** El botón «docs» abre la lista que pide el liquidador según el caso (con tercero, con lesionados, robo), separada en «de entrada» y «si lo pide el liquidador»; cada uno se marca listo o «no aplica». Muestra el nombre que debe llevar el archivo del informe y si la revisión técnica, el permiso de circulación y el seguro del equipo estaban vigentes a la fecha, según esta misma pestaña. «Bitácora» descarga en CSV los correctivos y PM del equipo de los 12 meses previos.

**Datos personales.** Conductor y datos del tercero son texto libre (el procedimiento los pide): quedan con los mismos permisos que el resto de la base.

**Antes de desplegar.** Aplicar `20261030160000_crear_siniestros.sql` en los dos proyectos y desplegar de nuevo `backup-diario` (62 tablas).

### Recauchaje de neumáticos (2026-10-30)

**Qué cambia.** En **Neumáticos** hay un botón **♻ Recauchajes** y, en cada neumático que está en Stock o de baja, un botón ♻ para **enviarlo a recauchar** (fecha, guía de despacho, proveedor y huella al salir). Mientras está en el proveedor el neumático queda «En recauchaje». Cuando vuelve se marca **Recibido** (fecha, huella nueva y costo: pasa a Stock con esa huella como remanente) o **Rechazado** con el código del proveedor (B01, F06, T01…: queda De baja). El listado muestra lo que está en el proveedor, los últimos retornos, el % aprobado del año, los días de vuelta, el costo y los rechazos por código. Sigue el procedimiento corporativo PRO-MAN-004.

**Antes de desplegar.** Aplicar la migración `20261030140000_crear_neumaticos_recauchajes.sql` en Supabase (los dos proyectos) y desplegar de nuevo la función `backup-diario` (ahora respalda 61 tablas). Sin la tabla, la app avisa que no pudo refrescar esa categoría y lo que se registre no llega a la base.

### Modalidad y plazo comprometido de la reparación (2026-10-30)

**Qué cambia.** Cada correctivo puede llevar dos datos nuevos, del procedimiento corporativo PRO-MAN-002: la **modalidad de reparación** (*Taller faena*, *Terreno*, *Tercero por contrato*, *Tercero por cotización* o *Garantía*) y el **plazo comprometido** (la fecha en que se comprometió terminarla). Se cargan en «Nueva OT» o en las columnas «Modalidad» y «Plazo» de la tabla de correctivos. Son opcionales: las OT antiguas quedan vacías.

**Cumplimiento de plazos.** Sobre la tabla de correctivos aparece «Cumplimiento de plazos de reparación» del mes: de las OT cuyo plazo vence en el mes, cuántas terminaron a tiempo, cuántas tarde y cuántas siguen abiertas con el plazo vencido; también por modalidad y con la lista de las incumplidas. La fecha de término es la de salida del equipo o, si no hay, la fecha en que se cerró la OT (la app la anota sola).

**Garantía.** Al crear una OT, si el horómetro del equipo todavía no llega a las horas de «Garantía Hasta (hrs)» de su ficha, aparece un aviso para elegir la modalidad «Garantía» y avisar al proveedor. Solo avisa.

**Antes de desplegar.** Hay que aplicar la migración `20261030120000_correctivos_modalidad_plazo.sql` en Supabase (los dos proyectos) **antes** de publicar el código: la app pide estas columnas al leer los correctivos y, si no existen, la lectura de OT falla.

### Cierre de OT con motivo de demora y tipo de reparación (2026-10-27)

**Qué cambia.** Al cerrar un correctivo, la ventana «Cierre con datos» ahora pide dos datos más: el **motivo de demora** y el **tipo de reparación**. Sirven para contestar «por qué tardó» y «se arregló de verdad o se parchó».

**Motivo de demora.** Una lista corta: *Sin demora*; *Repuesto sin stock en bodega (no se anticipó)*; *Compra o aprobación interna lenta*; *Proveedor sin stock o con demora*; *Falta de personal o de especialista*; *Falta de herramienta, grúa o taller*; *Equipo no entregado por operación o sin acceso*; *Diagnóstico difícil*; *Otro*. Es **obligatorio si la parada duró 8 horas o más** (o no se sabe cuánto duró); con menos de 8 horas es opcional y, si no se elige, queda «Sin demora».

**Tipo de reparación.** *Definitiva* o *Provisoria*, siempre obligatorio. Si es **provisoria**, el sistema agrega sola una tarea al backlog («Reparación definitiva pendiente: …», una por OT, marcada con insumo si el motivo habla de un repuesto), para que lo parchado no se pierda; se cierra desde Gestión → Backlog cuando se hace la reparación definitiva.

**«Cerrar sin completar».** Sigue disponible, pero el motivo y el tipo de reparación quedan escritos como **«Sin informar»** (no en blanco): así se puede contar cuánto se deja sin anotar. Las OT antiguas se pueden completar desde las columnas «Motivo de demora» y «Reparación» de la tabla de correctivos.

**Dotación.** En **Planificación → Programación Diaria → Resumen** hay una tarjeta «Dotación programada»: promedio de mecánicos (con líderes) y electromecánicos por turno, según los días cargados. Es lo programado, no la plantilla contratada; si un cargo no se reconoce se lista aparte.

### Reparar vs comprar y estado de lo instalado (2026-10-29)

**Qué es.** En **Componentes → Reparar vs comprar** se compara, para asiento, turbo, alternador, motor de partida, cilindro, compresor de aire acondicionado, diferencial, bomba de combustible y una pieza que se escriba, el costo por 1.000 horas de uso de **reparar** contra **comprar**. Precio y plazo salen de las compras (se busca en español y en inglés, en el detalle de compras y en el histórico de órdenes de compra); cuánto dura cada opción sale del Historial de Componentes; las horas detenidas, de los correctivos que mencionan la pieza, por el costo de hora detenida de Configuración. El selector «¿Hay pieza de reserva?» parte en «Sí» (solo cuenta el tiempo del cambio); con «No» cuenta la espera del plazo completo.

**Qué hay que hacer para que mejore.** Al **agregar un evento** en Componentes → Historial hay que elegir el **estado de lo instalado: nuevo, reparado o usado** (obligatorio). Sin saber cuánto dura lo reparado, la pantalla no recomienda: muestra el punto de equilibrio. Asiento y alternador se toman como reparados cuando un cambio antiguo no dice nada (se repara siempre), y la pantalla lo avisa.

**Límites.** El detalle de cada compra viene cortado a 25 letras en el origen; «Generador» no se toma como alternador; un precio con menos de 3 líneas es una referencia.

### Asistente de IA (2026-10-29)

**Qué es.** La pestaña **Asistente** (grupo Herramientas) deja preguntar en palabras normales y responde con los datos del sistema usando Claude, de Anthropic. La función `asistente-ia` solo conversa con Claude y valida quién pregunta; los datos los consulta el navegador con lo que la persona ya tiene cargado, y **nunca escribe nada**.

**Quién lo ve.** Administradores y cuentas Operador o Lector **sin perfil restringido**. Las cuentas con perfil (Horómetro, Comprador, Planificador) no lo ven ni pueden llamarlo (la función lo rechaza con 403).

**Para activarlo (una sola vez, por proyecto).**
1. Crear una clave en la cuenta de Anthropic (console.anthropic.com → API keys) y fijar ahí un tope de gasto mensual.
2. En Supabase → Edge Functions → Secrets, cargar `ANTHROPIC_API_KEY` con esa clave (si ya está cargada por WhatsApp, sirve la misma).
3. Aplicar la migración `20261029160000_crear_asistente_ia_uso.sql` y desplegar la función `asistente-ia` (verificación de sesión activada).
Mientras falte la clave, el asistente responde «todavía no está configurado».

**Límites y modelo (secretos opcionales de la función).** `ASISTENTE_IA_LLAMADAS_HORA` (por defecto 40 consultas por persona por hora), `ASISTENTE_IA_TOPE_TOKENS_DIA` (por defecto 2.000.000 de tokens por día para todo el equipo) y `ASISTENTE_IA_MODELO` (por defecto `claude-sonnet-5-5`). Cada vuelta del asistente cuenta como una consulta (una pregunta puede usar 2 o 3).

**Cuánto se usa.** Cada llamada queda en la tabla `asistente_ia_uso` (quién, cuándo, modelo, tokens, la pregunta). Para ver el día: `select count(*), sum(tokens_entrada + tokens_salida) from public.asistente_ia_uso where creado > now() - interval '24 hours';`. El gasto real está en console.anthropic.com → Usage.

**Privacidad.** Lo que el asistente consulta (por ejemplo la lista de equipos urgentes o los costos de un equipo) y la pregunta se envían a Anthropic para poder responder. No se envían contraseñas ni las tablas completas: solo lo que devuelve cada herramienta (hasta 25 filas, con los textos recortados).

**Límites del asistente.** Puede equivocarse o leer mal un dato incompleto; solo conoce lo que está cargado en el navegador de quien pregunta; no puede escribir ni modificar nada.

### Tareas y reglas que fuerzan y escalan (2026-10-29)

**Qué es.** En **la pestaña Tareas** están las tareas que el sistema obliga a hacer, cada una con responsable y fecha límite. Nacen de tres reglas: (1) **todo «pedir ya»** del plan de compras de TBO Komatsu se vuelve una tarea para el Comprador, con 3 días de plazo (si el pedido se hace, queda «Resuelta sola»); (2) **todo hallazgo de un PM incompleto** pasa al backlog de pautas (al guardar y también al editar el PM); (3) **una falla repetida** —el mismo equipo y componente en 90 días— no se puede cerrar sin causa raíz y sin una acción con responsable y fecha: al cerrar la OT aparece el diálogo y no existe «Cerrar sin completar». También se pueden agregar tareas a mano.

**Cómo se lee.** Una tarea está **abierta** hasta su fecha límite; **vencida** desde el día siguiente; **escalada** con 3 días o más de atraso, a la jefatura (el jefe de taller de la cuadrilla del responsable). Cuando hay tareas vencidas aparece un aviso arriba del Dashboard. Se cierran con «Hecha» o «Descartar»; no se borran.

**Qué no hace.** No manda correos: el escalamiento se ve en el sistema. La primera vez que un usuario con permiso de edición abre Tareas se crean las de «pedir ya» que haya en ese momento.

**Quién la ve (cambio del 29 de octubre).** Tareas es una pestaña del menú, grupo Planificación, y los perfiles **Comprador** y **Planificador** la tienen (el Comprador además ve **Componentes**, donde está Reparar vs comprar). Quien puede abrirla ve un número «Tareas vencidas» en el encabezado cuando hay alguna vencida; en Metas & KPIs ya no está (quedó Metas, Avance del Mes, Preguntas del gerente y, al final, los tres informes).

### Preguntas del gerente (2026-10-27)

**Qué es.** En **Metas & KPIs → Preguntas del gerente** están las ocho preguntas que suele hacer una gerencia, contestadas con los datos del sistema: (1) cuánto demora una reparación (bajo, medio, alto, crítico), (2) por qué demoran (nuestro, compra o proveedor), (3) si alcanzan los filtros y lubricantes para el programa de PM de los próximos 30 días, (4) si alcanzan los elementos de desgaste, (5) reactivo contra preventivo y contra el mismo mes del año anterior, (6) si se planifica de verdad, (7) dónde se atasca la cadena administrativa y (8) si hay suficientes mecánicos y electromecánicos.

**Cuadrillas de taller (29-oct-2026).** Al final de la pantalla hay un bloque que pone lado a lado las dos cuadrillas (Yáñez y Cárdenas): correctivos cerrados, mediana de reparación, percentil 90, porcentaje de 8 horas o más y duración mediana de los PM. En Correctivos/OT y en Registro PM, un rótulo bajo el técnico dice a qué cuadrilla pertenece. Una diferencia entre cuadrillas **no prueba que una trabaje mejor**: atienden turnos y equipos distintos, y el técnico de muchos registros viene de quién escribió en WhatsApp. Con menos de 10 casos en una cuadrilla el bloque dice que no hay casos suficientes. Si cambia el personal, la lista está en `logic.js` (`CUADRILLAS_TALLER`).

**Cómo se lee.** Arriba aparece un aviso con las fuentes de datos que están desactualizadas (por ejemplo, las OT correctivas llegan hasta marzo de 2026: mientras no se carguen, las respuestas describen el pasado). Cada pregunta trae su **respuesta corta**, la tabla que la sostiene, **con qué datos** se calculó (cuántos casos) y **qué falta**. Cuando no hay datos suficientes lo dice, no rellena.

**Qué conviene saber.** Las bandas de duración (menos de 8 h, hasta 2 días, hasta 30 días, más de 30) se pueden cambiar en el código (`GER_CORTES`). La pregunta 2 solo se podrá responder cuando haya OT cerradas con **motivo de demora** (se pide desde el 27 de octubre). En la 3, los PM se reparten el stock en orden de fecha: lo que lleva uno ya no está para el siguiente; solo cuenta lo que hay en bodega, y lo ya pedido se muestra aparte. La 7 mide solo los tramos que tienen fechas (pedido → bodega, pedido → OC firmada, reparación): faltan las fechas de cada aprobación. La 8 no puede decir «faltan mecánicos» mientras no se registren horas-hombre al cerrar cada OT. Los indicadores de la 6 son del **proceso**, no evalúan a una persona.

### Plano de fallas: dónde buscar si algo falla (2026-10-26)

**Qué es.** En **Configuración → Documentación → «Ver plano de fallas»** está el mapa de todas las piezas del sistema, con un **código** cada una (como el rotulado de un tablero eléctrico). Sirve para los dos proyectos (Centinela y sistema-mp2): arriba eliges el proyecto y las direcciones de los paneles cambian solas.

**Cómo usarlo cuando algo falla.** (1) Mira el esquema por capas: tu equipo, publicación del sitio, Supabase, servicios externos, vigilancia. (2) Busca lo que ves en la tabla **«Si ves esto, mira primero…»**: te da los códigos, en orden de probabilidad (por ejemplo, «No llegó el correo del respaldo» → `CRN-01`, `EF-05`, `EXT-01`, `DB-03`). (3) Abre la ficha del código: dice dónde está la pieza (el panel y la dirección), cómo se ve cuando falla, **cómo confirmarlo en este orden**, qué hacer y cuándo avisar. (4) Si es una tarea programada (respaldo, alertas, resumen), mira primero la tabla `salud_crons` (`MON-01`): dice cuál corrió, cuándo y si salió bien.

**Para quién avisar.** Cada ficha dice qué se arregla desde el panel y qué requiere un cambio de código; el plano no incluye nombres de personas ni teléfonos (completar según tu organización). Al avisar, da el **código**, el texto exacto del mensaje y la hora.

**Qué hay que saber.** El plano no muestra el estado en vivo de cada pieza: para eso están el correo del vigilante de salud y la tabla `salud_crons`. Las rutinas diarias de diagnóstico (`MON-02`) revisan esa tabla y mandan un correo solo si hay un problema. Cuando se agregue una función, una tarea programada o un servicio nuevo, hay que sumar su ficha; una prueba automática avisa si falta.

### Kardex de filtros, lubricantes y repuestos (2026-10-26)

**Qué es.** Las mismas reglas del kardex de insumos ahora cubren **Stock Filtros, Lubricantes y Repuestos críticos**. Todo queda en **Stock & Insumos → Insumos**, con su categoría (Filtros, Lubricantes, Repuestos) y una etiqueta que dice de qué pantalla viene.

**Activarlo (una sola vez).** En Insumos aparece un aviso «N ítems de Stock Filtros, Lubricantes y Repuestos aún no tienen kardex» con el botón **Activar kardex**. Al activarlo, el **stock de hoy** de cada ítem queda como saldo inicial y no se borra ni se cambia nada de esas pantallas. Conviene hacerlo con el stock al día (por ejemplo, justo después de un conteo físico).

**Cómo funciona después.** (1) Los **PM que descuentan stock** siguen igual y dejan además su salida en el kardex, con el equipo y el PM. (2) Al **marcar una orden de compra como recibida**, si coincide con un solo ítem (por N° de parte o por nombre exacto), la **entrada** se suma sola; si no coincide con uno solo, no se suma y hay que registrarla a mano con **+ Entrada**. (3) Las entradas, salidas y conteos que hagas en el kardex **actualizan el stock de la pantalla de origen**. (4) Para cambiar el stock, usa el kardex (entrada, salida o conteo físico): no edites el número a mano en la pantalla de origen.

**Si alguien edita el stock a mano.** En Insumos aparece «N ítems tienen un stock distinto en su pantalla»: **Revisar y cuadrar** muestra la diferencia y, al aceptar, deja un **ajuste** en el kardex con fecha y motivo. Si una fila fue borrada de su pantalla, el ítem del kardex puede **desactivarse** y conserva su historial.

**Qué hay que saber.** El nombre de un ítem se cambia en su pantalla de origen (en el kardex aparece bloqueado). Editar o borrar un consumo en **Consumos** cambia el stock sin pasar por el kardex: aparecerá como diferencia para cuadrar. El historial de consumos anterior a la activación no se carga al kardex, así que el consumo mensual del kardex empieza de cero y se marca «poca historia» durante 60 días.

### Stock de insumos (2026-10-26)

**Qué es.** En **Stock & Insumos → Insumos** está el inventario de bodega de todo lo que no es filtro ni lubricante: EPP, librería, limpieza, elementos de desgaste, baterías, herramientas y otros. Funciona como las planillas «Inventario de bodega»: cada ítem tiene un **kardex** con sus entradas, salidas y ajustes, y el **saldo** sale de sumar esos movimientos (no se escribe a mano).

**Cómo usarlo.** (1) **Carga inicial:** con **Cargar lista** pegas desde Excel las columnas descripción, unidad, stock, stock crítico, precio y categoría; el stock queda como saldo inicial de hoy. También puedes agregar de a uno con **+ Nuevo ítem**. (2) **Cada vez que llega algo:** **+ Entrada** (guía u OC, proveedor, precio). (3) **Cada vez que sale algo:** **− Salida** (N° de vale, quién retira, destino: equipo, trabajador o área). El sistema no deja sacar más que el saldo. (4) **Kardex** muestra todos los movimientos del ítem con el saldo corrido. (5) **Conteo físico:** anotas lo que hay en la bodega y, donde difiere del saldo, queda un ajuste en el kardex con la fecha y el usuario. Un ítem con movimientos no se borra: se **desactiva** (✎ → Desactivar) y conserva su historial.

**Estados.** 🔴 Sin stock (saldo cero), 🟡 Crítico (saldo en el stock crítico del ítem o por debajo), ✅ OK. Un ítem sin stock crítico cargado no avisa cuando se acaba: conviene cargarlo. **Consumo/mes** es lo que salió en los últimos 90 días; con menos de 60 días de historia queda marcado ⚠ porque todavía no es confiable.

**Qué comprar.** El botón **🛒 Qué comprar** incluye la sección «Insumos generales»: consumo proyectado al mes, semestre y año, más el stock crítico, menos el saldo, con la fecha para pedir. Es tan bueno como el kardex: si no se registran las salidas, el saldo y la compra sugerida no reflejan la bodega (el sistema avisa cuando el último movimiento es viejo).

**Qué hay que saber.** Las entradas y salidas se registran a mano por ahora; no se descuentan solas al cerrar una OT ni se cargan desde las compras recibidas. El saldo de filtros y lubricantes sigue en sus propias pestañas.

### Qué comprar: próximo mes, semestre y año (2026-10-24)

**Qué es.** En **Stock & Insumos** hay un botón **🛒 Qué comprar**. Muestra, para el próximo mes, semestre y año, cuánto hay que comprar de **filtros, lubricantes, neumáticos y elementos de desgaste**, ya descontando lo que hay en bodega (y lo pendiente de llegar).

**De dónde sale cada número.** Filtros y lubricantes: lo mayor entre lo que consumen los PM programados de la flota y el consumo histórico del ítem (la columna «Según» dice cuál mandó). Neumáticos: los que la proyección de desgaste da por cambiados en cada plazo, por medida, menos los que hay en Existencias; los vencidos cuentan en los tres plazos. Elementos de desgaste: cuántos cambios se registraron por período en los correctivos; son cambios, no unidades de bodega.

**Antes de comprar, lee los avisos** (cuadro amarillo): si el horómetro de los equipos está sin actualizar, las fechas de los PM se corren; si las mediciones de neumáticos son viejas, la cantidad de neumáticos a cambiar puede estar sobreestimada hasta volver a medir; si hay repuestos de las pautas sin vincular a Stock, esos no entran. El costo suma solo lo que tiene precio cargado (neumáticos: precio de lista, no cotización). **Pedir antes de**: es la fecha límite para pedir = primer quiebre de stock menos el plazo de entrega **real** de las compras ya recibidas (según el monto de la compra: hasta $1 millón, hasta $3 millones o más). Debajo sale el «peor caso» (9 de cada 10 compras llegan antes de ese plazo). Si dice «supuesto», no hay historial y se usaron 34 días. El plazo es el total del pedido interno a la bodega; el sistema no registra cuánto se demora cada aprobación.

### Reportabilidad desde una captura (2026-10-24)

**Qué es.** En **Disponibilidad → Reportabilidad diaria del cliente** hay un botón **📷 Importar desde captura**. Sube la captura de pantalla del estatus de equipos que mandan los supervisores (la hoja «Estatus equipos faena Centinela» o la planilla «Reportabilidad diaria faena»); la IA lee la tabla y se abre la misma vista previa del Excel.

**Cómo usarlo.** Compara lo leído con la imagen (aparece al lado y hay una tabla con lo leído; las filas dudosas van marcadas con ⚠), **confirma el día** de cada captura (si la hoja trae una fecha en el futuro, el sistema propone la del mes anterior) y aprieta **Cargar**. Cada fila cargada queda con su origen («captura leída por IA»). Cargar de nuevo el mismo día lo actualiza, no lo duplica.

**Qué hay que saber.** Si la captura está cortada abajo, los equipos que no salen quedan sin dato ese día (el aviso los lista). Un equipo que no es de la flota no se carga. Si dos capturas traen el mismo día, gana la que tiene más equipos y se avisa. Se envía la imagen a Gemini, con un costo pequeño por captura. **Aún no se midió la precisión de lectura con capturas reales:** revisa siempre antes de cargar.

### Paradas largas que el horómetro contradice (2026-10-24)

**Qué es.** En **Auditoría de Datos → Paradas largas que el horómetro contradice** (solo administradores). Lista las OT de 24 h o más durante las cuales el horómetro del equipo avanzó: un equipo detenido no suma horas, así que la duración o la fecha de salida parecen un error de digitación (por ejemplo, una OT de ampolletas con 696 h). También lista las salidas de servicio **abiertas** cuyo equipo ya está sumando horas (volvió a operar y nadie cerró la OT).

**Cómo usarlo.** Pulsa **Corregir…** en la fila: te pide el día real de salida (te sugiere el primer día en que el horómetro se movió) y, si la OT estaba cerrada, las horas reales que estuvo detenido (vacío si no se saben: la OT queda sin duración y deja de contar como parada larga). Nada se cambia solo. El Dashboard, Informes KPI y Costos avisan cuántas paradas del MTBF son dudosas.

**Qué hay que saber.** Es una pista, no una prueba: un equipo puede operar parcialmente durante una reparación larga, y la decisión es tuya. Necesita al menos dos lecturas de horómetro dentro de la parada (del historial o anotadas en otras OT del mismo equipo); sin ellas no se marca.

### Limpieza asistida de horómetros (2026-10-24)

**Qué es.** En **Auditoría de Datos → Limpieza asistida de horómetros** (solo administradores). **Revisar lecturas de horómetro** busca la serie más larga de lecturas que encajan entre sí y propone qué hacer con las demás: **corregir** (un error de digitación con una sola solución posible, por ejemplo 1492 en vez de 14092), **corregir dos equipos juntos** (lecturas intercambiadas el mismo día), **eliminar**, o **revisar a mano** (varias lecturas seguidas que parecen un horómetro nuevo). Son reglas, no una IA externa.

**Cómo usarlo.** Marca lo que quieras (hay un botón para las correcciones de confianza alta) y pulsa **Aplicar las marcadas**; el sistema pide confirmación. Corregir deja anotado el valor original en el origen de la lectura; eliminar manda la lectura a la Papelera (30 días). Los ceros de relleno (0 en las dos columnas) tienen su propio botón; una fila con la columna Fin en 0 pero el valor en la columna horom es una lectura real y no se toca. El horómetro actual de los equipos no cambia.

**Qué hay que saber.** Un 0 en el historial no es una lectura (un horómetro no vuelve a 0): el sistema ya no lo cuenta, y antes un 0 al inicio hacía descartar todas las lecturas reales posteriores. Una corrección «alta» es la única que encaja entre las lecturas vecinas, no una certeza: revisa la lista antes de aplicar. Solo se revisan las lecturas cargadas en pantalla.

### Clasificación asistida del componente con IA (2026-10-24)

**Qué es.** En **Auditoría de Datos → Clasificación asistida del componente (IA)** (solo administradores). Para los textos que el diccionario no resuelve (correctivos formales sin `componente` y filas del historial sin `sistema`), la IA propone **una** categoría de la lista cerrada de 48, con confianza alta, media o baja. Tú confirmas; nada se guarda solo.

**Cómo usarlo.** (1) Antes de confirmar nada, pulsa **Medir acuerdo con lo ya clasificado**: la IA clasifica 40 filas del historial que ya tienen `sistema` y ves cuántas coinciden. (2) Pide las sugerencias (lotes de 40). (3) Las de confianza **alta** puedes marcarlas todas de una vez; las **media y baja** revísalas una por una. (4) **Aplicar** guarda solo lo marcado. En el historial, la fila queda con la marca «componente por IA (confirmado por admin)» en su fuente y nunca se pisa un `sistema` que ya tenía valor.

**Qué hay que saber.** No clasifica `tipoCausa` ni `categoriaMTTR`: son juicios humanos. El acuerdo mide **consistencia**, no exactitud, porque lo ya clasificado también salió de reglas sobre el texto: si el acuerdo es bajo, no confirmes en bloque; si es alto, igual revisa una muestra. Se envía a Gemini solo el texto (sin teléfonos ni correos). **Aún no se ha corrido la medición con tus datos reales.**

### Foto del horómetro (2026-10-24)

**Qué es.** En la pestaña Horómetro, **+ Registrar** tiene un bloque «Leer el horómetro desde una foto» con **Tomar foto** (abre la cámara del celular) y **Subir foto**. La IA lee el número y lo pone en «Horómetro Final»; la persona lo confirma con Guardar. Nada se guarda solo, y si el número es menor que la última lectura o un salto imposible, el sistema lo avisa en rojo y pide confirmar. La fila queda con origen «Foto (IA)» (o «corregida a mano»).

**Qué hay que saber.** La foto se guarda como evidencia en un bucket privado (reducida a ~100 KB): al guardar la lectura se sube en segundo plano, y si falla la lectura igual queda guardada, sin foto. En la tabla de horómetros, las filas con foto tienen un botón de cámara para verla (solo administradores, con un enlace de 5 minutos). No hay retención automática: cada foto suma ~100 KB, así que conviene vigilar el almacenamiento del plan de Supabase. Se envía a Gemini para leerla (el mismo proveedor de las fotos de papeles), con un costo pequeño por foto. Las funciones de lectura de fotos (`leer-horometro`, `leer-pauta-pm`, `leer-informe-correctivo`, `leer-chequeo-neumaticos`, `leer-reporte-produccion`) exigen sesión iniciada. **Aún no se ha medido con fotos reales de los horómetros de la faena**: conviene probar con unos 20 o 30 equipos y revisar siempre el número antes de guardar. Si no se lee bien, el sistema lo dice en vez de adivinar.

### Protección contra bots (CAPTCHA, activado 2026-09-08)

El login y la recuperación de contraseña tienen un widget de **Cloudflare
Turnstile** (gratis, sin límite de uso) validado en dos capas:
- **Cliente**: `_TURNSTILE_SITE_KEY` en `modules/store.js` — mientras esté
  vacía, el widget no se dibuja y el login funciona exactamente igual que
  sin CAPTCHA (nunca es un requisito por accidente).
- **Servidor**: Supabase → Authentication → Attack Protection → "Enable
  Captcha protection", proveedor **Turnstile**, con la Secret Key
  correspondiente — sin este paso, el cliente exige completar el widget
  pero Supabase Auth no lo estaría validando de verdad.

Ambas claves se generan juntas al crear un "widget" en el dashboard de
Cloudflare Turnstile (Site Key pública + Secret Key privada) — **cada
dominio necesita su propio widget**: la Site Key está atada al hostname
que se declaró al crearlo, así que no sirve copiar la de otra instancia
sin volver a crear uno nuevo apuntando al dominio real de esta.

Estado actual: activado y probado en vivo (widget se resuelve solo, login
funciona) el 2026-09-08.

**Extensión a `registrar-intento-acceso` (auditoría de seguridad,
2026-09-08):** ese endpoint (el que cuenta la ráfaga de intentos fallidos y
dispara el bloqueo temporal de 15 minutos) es público y hasta ese día
confiaba ciegamente en el email que mandaba el cliente — cualquiera podía
golpearlo directo con curl usando el correo de un admin conocido y dejarlo
bloqueado repetidamente, sin necesitar su clave ni pasar por el navegador.
Se agregó una segunda llave en Vault, `turnstile_secret_key` (la misma
Secret Key de Cloudflare, guardada una vez más ahí), para que ese endpoint
también exija un CAPTCHA válido antes de contar un intento hacia el
umbral. Si en algún momento hay que rotar la Secret Key de Cloudflare,
actualízala en los dos lugares: Attack Protection (arriba) y este segundo
secreto de Vault — con `select vault.update_secret((select id from
vault.secrets where name = 'turnstile_secret_key'), 'LA_NUEVA_LLAVE');` en
el SQL Editor.

### Cierre de sesión por inactividad

Desde agosto 2026, a los 55 min sin actividad (mouse/teclado/touch/scroll)
aparece un aviso en pantalla ("¿Sigues ahí?") con cuenta regresiva; si nadie
hace nada, a la hora completa la sesión se cierra sola (`_logout()`). Corre
en cualquier pestaña abierta, no solo la que está en primer plano. Pensado
para el caso de un computador compartido (taller) con una sesión olvidada
abierta.

**Fix real (2026-09-07) — un equipo que se DORMÍA no cerraba sesión al
despertar**: el gesto físico de despertarlo (mover el mouse, tocar una
tecla) reseteaba el reloj de inactividad antes de que el sistema alcanzara
a notar que en realidad había pasado más de una hora dormido. Ahora se mide
también, de forma independiente de cualquier evento del usuario, cuánto
tiempo real pasó entre dos chequeos — si el equipo estuvo dormido ese
tiempo, la sesión se cierra igual (ver [`arquitectura.md`](./arquitectura.md),
sección 13, para el detalle técnico).

### Auditoría (trazabilidad — quién cambió qué)

**Configuración → Accesos recientes** — quién entró, cuándo, desde qué
computador, y también los **intentos que NO prosperaron** (clave incorrecta,
cuenta desactivada, o sesión que no logró renovarse), marcados en rojo con
🚫. Antes (hasta agosto 2026) solo se registraban los logins exitosos — un
usuario desactivado que insistía en entrar no dejaba ningún rastro. Los
intentos fallidos se registran vía la Edge Function
`registrar-intento-acceso` (clave de servicio, porque en ese momento no hay
sesión de usuario con la que insertar directo en `changelog`).

**Auditoría de Datos → Quién cambió qué** (octubre 2026) — el historial
campo por campo, y la fuente de verdad de "quién cambió qué": cada guardado
confirmado en la nube deja una fila en `auditoria_cambios` con la persona
(`usuario_id` y `usuario_email`, fijados por el servidor desde la sesión, no
por el navegador), el nombre y rol que muestra la app, la pestaña y
sub-pestaña, la tabla y el registro, el campo, el valor de antes y de después,
un `lote` (un guardado = un lote) y el dispositivo. Solo un admin activo puede
leerla. **Es de solo agregar**: no hay políticas de UPDATE ni DELETE, se
quitaron esos permisos a `anon` y `authenticated`, y un trigger rechaza
cualquier UPDATE, DELETE o TRUNCATE, incluso con la clave de servicio; si
alguna vez hubiera que purgarla por volumen, hay que hacerlo desde el panel de
Supabase deshabilitando el trigger a propósito. No registra los campos que
calcula el sistema ni las tablas que no son datos de trabajo (ver ficha L6 del
inventario). Un envío que falla por falta de red queda en cola en ese
navegador y se reintenta.

**Configuración → Log de cambios** — el log anterior (cada edición, creación
o eliminación, con fecha, usuario y un resumen corto). Se mantiene, pero ya no
es la fuente para saber quién cambió qué: guarda el nombre que escribe el
propio navegador, no tiene la pestaña ni el valor campo por campo, y un admin
puede editarlo o borrarlo.

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

- **42 tablas reales** (una por categoría: `equipos`, `correctivos`,
  `registros_pm`, etc. — incluye `historial_componentes` e
  `historial_neumaticos`, agregadas en agosto 2026, `correctivos_historico`
  (agosto 2026, planillas Excel 2022-2025 previas a este sistema, alimenta
  Probabilidad de Falla en Predictivo), y `compromisos` (2026-08-31, loop de
  responsabilidad de Metas & KPIs) y `reportabilidad_diaria` (2026-10-11, reporte diario del cliente: una fila por equipo y día; lee cualquier usuario activo, escribe admin u operador; incluida en el respaldo diario)) + 7 tablas "singleton" de
  configuración (49 tablas en total). El mapeo completo vive en
  `TABLA_REAL`/`TABLA_SINGLETON` dentro de `modules/store.js`.
- **El schema está versionado como código** en `supabase/migrations/*.sql`.
  Cualquier cambio de estructura (agregar una columna, una tabla, una
  política RLS) debe hacerse como un archivo de migración nuevo — con la
  CLI de Supabase o con `mcp__Supabase__apply_migration` si se está
  trabajando con Claude — nunca como una edición manual sin rastro en el
  panel.
- **Permisos de la API de datos en cada tabla, función y secuencia nueva (desde el 30-oct-2026)**: Supabase dejó de dar
  permisos automáticos a lo que se crea en `public`. Sin un `GRANT` explícito la app recibe «permission denied» (error 42501). Toda
  migración nueva que cree algo en `public` debe incluir sus permisos **en el mismo archivo**. Plantilla (`anon` no recibe nada: la
  app exige sesión y todas las políticas piden un usuario activo):

  ```sql
  create table public.mi_tabla ( ... );
  alter table public.mi_tabla enable row level security;
  -- políticas RLS ...
  grant select, insert, update, delete on table public.mi_tabla to authenticated;
  grant select, insert, update, delete on table public.mi_tabla to service_role;
  -- función (salvo las que devuelven trigger): grant execute on function public.mi_funcion(int) to authenticated;
  -- columna serial/identity: grant usage, select on sequence public.mi_tabla_id_seq to service_role;
  ```

  `tests/migracionesGrants.test.js` falla si una migración posterior a `20261021120000_grants_explicitos_data_api.sql` crea una
  tabla, función o secuencia sin sus `GRANT`. Esa migración da, a las tablas anteriores, los mismos permisos que ya tienen en vivo (para
  que un proyecto nuevo, una rama de prueba o un `supabase db reset` no queden con la API rota).
- **Verificar que el schema versionado coincide con la realidad**:
  `supabase db diff` (con la CLI conectada al proyecto) debería salir
  vacío. Si no, alguien hizo un cambio fuera de una migración y hay que
  traerlo a `supabase/migrations/` para no perder el rastro.

### Supuestos editables que se guardan en la tabla `configuracion` (2026-10-13)

La tabla `configuracion` guarda una sola fila con los valores que el sistema no puede medir y que una persona define: costo de hora detenida (general y por modelo), tasa USD→CLP, duración estándar de cada PM y, desde el 13 de octubre, los **supuestos de Arriendo vs compra** (UF, diésel, sueldos, dotación, litros por carga, disponibilidades, valor residual y tarifas de arriendo seco y húmedo por modelo) en la columna `arriendoVsCompra`. Solo un administrador puede editarlos; los demás roles los ven pero no los cambian. Cada columna nueva se agrega con una migración aditiva (nunca borra datos) que hay que aplicar **a los dos proyectos Supabase antes de subir el código** que la usa; si no, el guardado falla. Otras tablas operativas nuevas: `backlog_pm` (tareas pendientes de pauta, informe de gestión) y la columna `registros_pm.desvioDias` (desvío de cada PM). Todas se crean con migraciones aditivas que se aplican a los dos proyectos antes de subir el código.

**Novedades de octubre 2026 que el administrador debe conocer** (ambas bases Supabase, antes de subir el código que las usa):
- **`auditoria_cambios`** (17-oct): historial campo por campo, de solo agregar (ver "Auditoría" más arriba). No está en `TABLA_REAL`: el navegador la escribe directo por REST con la sesión del usuario y solo un admin la lee. Migración `20261017120000`.
- **`configuracion."tcoCapitalFuente"`** (17-oct): cómo se calcula el capital por hora del Costo Total de Propiedad en Costos: `'compra'` (valor de compra ÷ vida en horas, por defecto) o `'contable'` (amortización de «Horas a Amortizar»). Lo cambia solo un administrador desde Costos → Costo Total de Propiedad y vale para todos. Migración `20261017130000`. **Carga de «Horas a Amortizar»:** `valorHoraAmort` y `vidaContableH` en `equipos` solo los puede modificar una sesión de administrador (candado `privado.proteger_columnas_admin`), así que el archivo se importa desde la app (Equipos → Importar Horas a Amortizar), no por SQL.
- **Backtest con Brier y log loss** (19-oct, solo cálculo y presentación): Predictivo → Laboratorio → Backtest. No hay migraciones ni cambios de permisos; no cambia la regla de probabilidad que usa el programa.
- **Pestañas ordenadas por prioridad** (21-oct, solo presentación): Disponibilidad, Configuración, Auditoría, Correctivos, TBO Komatsu (análisis de vida útil plegado al final), Planificador de Materiales y Resumen Ejecutivo (sin la tabla de Metas repetida). No hay migraciones ni cambios de permisos.
- **Cuarta ronda de diseño** (20-oct, solo presentación): Configuración en dos columnas, Aceite sin desborde en celular, buscador e índice en la Ayuda y manuales con índice lateral. Los manuales de edición manual (`manual-admin.html`, `arquitectura.html`) se decoran con `python3 scripts/manual_md_a_html.py --decorar …` tras editarlos. No hay migraciones ni cambios de permisos.\n- **Tercera ronda de diseño** (19-oct, solo presentación): cabecera de una fila en pantallas anchas, menú lateral con pestaña activa marcada y flechas. No hay migraciones ni cambios de permisos.
- **Segunda ronda de diseño** (19-oct, solo presentación): modal de cierre de correctivos, botones de vista del Predictivo y áreas táctiles de la navegación. No hay migraciones ni cambios de permisos.
- **Retoque de diseño** (19-oct, solo presentación): Dashboard y Auditoría (nombres de las tarjetas, leyenda en palabras simples, ajuste a celular). No hay migraciones ni cambios de permisos.
- **Dashboard** (19-oct, solo presentación): sin tarjetas repetidas de la barra de arriba; «% Flota sin falla» muestra «Sin datos» si no hay correctivos cargados en el mes, y avisa si el último correctivo cargado tiene más de 30 días. No hay migraciones ni cambios de permisos.
- **Simulación de la carga del taller** (19-oct, solo cálculo y presentación): Predictivo → Laboratorio → «Carga del taller». No hay migraciones ni cambios de permisos. Para poder simular esperas por técnico en el futuro habría que registrar la hora de primera atención (hoy `primeraAtencionEn` está vacío).
- **Curva P-F completa** (18-oct, solo cálculo y presentación): lado izquierdo (horas del componente al detectar P) y grupo de comparación en Predictivo → Laboratorio → Intervalo de Inspección (P-F). No hay migraciones ni cambios de permisos.
- **Validación fuera de muestra** (18-oct, solo cálculo y presentación): el backtest suma Weibull y Kijima, y Auditoría de Datos prueba el diccionario de componentes con el historial. No hay migraciones ni cambios de permisos.
- **Salud del programa** (18-oct, solo presentación y cálculo): cierre de correctivos con ventana de datos, modo laboratorio (por persona, `localStorage`), backtest en Predictivo y detectores de aceite por componente. No hay migraciones ni cambios de permisos.
- **MTTR, margen de error** (18-oct, solo cálculo): el intervalo de confianza del MTTR usa t de Student; con pocas reparaciones es más ancho que antes. No cambia datos.
- **Correlaciones** (18-oct, solo presentación): Estadística → Mapa de equipos, Análisis de Aceite y Predictivo → Señal Unificada muestran correlaciones (Spearman). No guardan datos ni cambian permisos. En Aceite se agrupa por «descriptor» o, si está vacío, por «componente» (hoy el descriptor está vacío en todas las muestras reales).
- **Carta Gantt** (17-oct, solo presentación): el tipo de PM por equipo se toma del Programa Anual (tabla `programa`, mes elegido); un correctivo (`ot`) se pinta aparte y no marca el PM como ejecutado. No se modifican ni se guardan datos nuevos.
- **Análisis de Aceite sin muestras** (17-oct, solo presentación): con la tabla `aceite` vacía, el panel de gráficos muestra un aviso en vez de gráficos vacíos. No cambia datos ni permisos.
- **Cambios de pantalla** (16-oct, solo presentación; ningún dato ni permiso cambió): el menú pasó a una barra lateral con 5 grupos (contraída a solo íconos bajo 1.500 px, se abre al pasar el mouse; en celular, barra inferior con «Más»); **Costos** es una pestaña propia (antes sub-pestaña de Stock & Insumos; el perfil Comprador ve Stock & Insumos y Costos); sub-pestañas como solapas; botones de herramientas agrupados en «Más acciones ▾»; botón «Densidad» en la cabecera para tablas cómodas o compactas.

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

### Si el proyecto Supabase se pierde por completo — cómo restaurar (2026-09-11)

Este es el procedimiento real para el peor caso: el proyecto Supabase ya no
existe (borrado, cuenta suspendida, etc.), no solo datos corruptos. Requiere
a alguien con acceso técnico (terminal, Deno instalado) — no es un flujo
para hacer desde la app.

1. **Crear el proyecto Supabase nuevo** (mismo plan gratis) y aplicar todas
   las migraciones de `supabase/migrations/` en orden, con la CLI de
   Supabase o el MCP correspondiente. Esto reconstruye el esquema completo,
   incluidas las 8 tablas que antes solo existían "a mano" en el dashboard
   (ver `arquitectura.md`, sección 9b).
2. **Conseguir el respaldo más reciente**: el `.json.gz` que `backup-diario`
   manda todos los días por correo a `aehcim6@gmail.com`.
3. **Correr el script de restauración** desde una terminal con Deno
   instalado, apuntando al proyecto **nuevo** (nunca al perdido):
   ```
   SUPABASE_URL=https://xxxx.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=xxxx \
   deno run --allow-net --allow-env --allow-read scripts/restaurar-backup.ts \
     sistemamp-backup-2026-09-11.json.gz
   ```
   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son los del proyecto nuevo
   (Configuración del proyecto → API, en el dashboard de Supabase) — la
   clave de `service_role`, no la pública/anon.
4. **Al terminar, el script imprime dos cosas importantes**:
   - Un resumen de cuántas filas se restauraron por tabla.
   - La lista de **cuentas que tuvo que recrear** (las que no coincidían
     con ningún email ya presente en el proyecto nuevo), cada una con una
     **contraseña temporal**. Esto no queda guardado en ningún lado más que
     esa salida de terminal.
5. **Avisar a cada persona de la lista, directamente** (WhatsApp/llamada,
   no un canal grupal): su contraseña temporal (deben cambiarla al entrar,
   queda forzado) y, si aparece marcada con "tenía 2FA activo", que debe
   volver a activar la verificación en dos pasos desde Configuración — el
   script **no puede** recuperar ni contraseñas ni secretos de MFA (la
   Admin API de Supabase no los expone a nadie, es una limitación de la
   plataforma, no de este proceso).
6. **Reconfigurar los secretos de Supabase Vault** en el proyecto nuevo
   (`resend_api_key`, `backup_diario_cron_secret`, y los equivalentes para
   `alerta-pm`/`resumen-semanal`) y volver a programar los `pg_cron` — no
   viajan en el respaldo de datos, hay que cargarlos de nuevo a mano (ver
   `arquitectura.md`, sección 9).

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

### Segunda pasada con IA (2026-09-02)

Cuando el parser por reglas no reconoce el mensaje de WhatsApp o queda con
confianza "baja" (lenguaje informal que no matchea ninguna palabra clave ni
sigla), se le pasa el texto a Claude (`claude-haiku-4-5-20251001`, elegido
por costo — es una clasificación acotada) como último intento antes de
marcarlo "revisar" o descartarlo. La IA **nunca inventa** una sigla ni una
categoría: solo puede elegir de las listas reales que se le entregan como
contexto (equipos existentes, categorías de componente válidas) — si
devuelve algo fuera de esas listas, se descarta igual que si no hubiera
reconocido nada.

**Requiere el secret `ANTHROPIC_API_KEY`** (console.anthropic.com → API
Keys), cargado igual que los de Twilio (Project Settings → Edge Functions →
Secrets). Sin él, el comportamiento queda idéntico al de solo-reglas — la
IA solo puede mejorar el resultado, nunca empeorarlo. Los reportes
clasificados por la IA quedan con `fuente = '... (auto, IA)'`, distinguibles
en Auditoría de Datos de los que resolvió la regla determinística. Por
ahora solo corre en `whatsapp-webhook`, no en `email-webhook`.

> **Bug real corregido (2026-09-02)**: la versión de `whatsapp-webhook`
> REALMENTE desplegada traía el parser de reglas copiado a mano y
> desactualizado — 19 categorías de componente en vez de las 46 que ya
> tenía `_shared/parseCorrectivo.ts` (usado correctamente por
> `email-webhook`). Cualquier reporte de WhatsApp que mencionara una de las
> 27 categorías faltantes (Inyectores, Correas, GET/Cuchillas, etc.) caía
> siempre en "componente no identificado" aunque el texto fuera claro. Se
> corrigió sincronizando el parser completo y dejando `whatsapp-webhook`
> autocontenido (sin import cruzado a `_shared/`), igual que el resto de
> las Edge Functions del proyecto — Deno Deploy no resolvía ese import de
> forma confiable entre carpetas de funciones distintas, la razón real por
> la que la versión en producción se había desincronizado del repositorio
> sin que nadie lo notara.

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
  ejecutados, % documentado), el ranking de equipos con más fallas, los
  componentes en riesgo alto de falla (ver más abajo), y un snapshot de solo
  4 contadores de lo pendiente hace tiempo (sin repetir el detalle diario).
  A diferencia de `alerta-pm`, SIEMPRE se manda, incluso en una semana
  tranquila.

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

**Componentes en riesgo alto (2026-09-01):** `resumen-semanal` no recalcula
el Índice de Riesgo de Componentes Mayores (Componentes → Riesgo) — esa
fórmula necesita estimar horómetros pasados, lógica que solo debe vivir en
`logic.js`. En vez de eso, el navegador GUARDA el veredicto ya resuelto en
`componentes_mayores.riesgoNivel`/`riesgoTip` cada vez que alguien abre
Componentes (mismo patrón que `equipos.estado`/`diasParaPM`), y el correo
semanal solo lee esas dos columnas. Si nadie ha abierto Componentes
recientemente, esos campos pueden estar desactualizados — el correo dice
literalmente lo mismo que la última vez que alguien vio esa pestaña, nunca
un número inventado aparte.

## 7b. Detector de salud del sistema (2026-09-14, ampliado 2026-09-16)

Vigila que el sistema MISMO siga funcionando — que el respaldo diario y los
2 correos automáticos a gerencia efectivamente corran, y que el canal de
reportes por WhatsApp/correo (sección 6) no esté tirando error en silencio.
Nadie tiene que mirar los logs de Supabase a mano para enterarse.

- **Capa 1 (detección + aviso automático)**: `backup-diario`,
  `alerta-pm`, `resumen-semanal`, `whatsapp-webhook` y `email-webhook`
  registran su propio resultado (éxito o fallo, con detalle) en la tabla
  `salud_crons`. La Edge Function `vigilar-salud-sistema` corre todos los
  días a las 13:00 UTC (una hora después de `backup-diario`) y revisa esos
  registros: si el respaldo diario o `alerta-pm` fallaron o no corrieron en
  más de 26h, si `resumen-semanal` falló o no corrió en más de 8 días, o si
  alguno de los webhooks tuvo un fallo real en las últimas 24h, manda un
  correo de alerta a `aehcim6@gmail.com`. Si no encuentra nada raro, **no
  manda nada** — a propósito, para no generar un correo de "todo bien"
  todos los días. Importante: que no llegue ningún WhatsApp/correo en un
  día dado NUNCA cuenta como una falla — eso solo significa que nadie
  reportó nada. `alerta-pm` con "nada urgente hoy" (no mandó correo porque
  no había nada que avisar) tampoco cuenta como falla — sí se ejecutó y
  registró éxito, simplemente no tenía nada que reportar. (2026-09-16,
  hallazgo de auditoría: `alerta-pm`/`resumen-semanal` ya existían pero no
  registraban ni se chequeaban — un fallo real de esos 2 correos a
  gerencia podía pasar inadvertido indefinidamente.)
- **Capa 2 (diagnóstico automático)**: si Capa 1 encuentra un problema,
  además se despierta una sesión de Claude (Rutina programada, ~20 min
  después) que investiga la causa real (logs de Supabase, advisors) y
  manda un correo aparte con el diagnóstico. Esta capa **solo
  diagnostica, nunca aplica un fix por su cuenta** — si el problema es
  de código dice cuál sería la corrección, pero la aplica un humano; si
  es algo externo (saldo de Twilio, configuración de Resend, etc.) dice
  qué acción hace falta.

Mismo patrón de seguridad que el resto de los cron jobs: secreto propio
(`vigilar_salud_cron_secret`) en Supabase Vault. Ver
[`arquitectura.md`](./arquitectura.md), sección 35, para el detalle
técnico completo.

### Si el detector avisa «No se pudo verificar el secreto del cron» (2026-10-22)

Quiere decir que ese día el cron (`alerta-pm`, `resumen-semanal` o `backup-diario`) **sí se lanzó pero no corrió**: la llamada interna a la base para verificar su secreto falló (401 o error del servidor) incluso después de un reintento. No significa que el secreto esté mal. Qué hacer: (1) mira en Supabase → Logs → Edge Functions si ese día hubo una caída o un cambio de claves de API; (2) si fue un hecho aislado, no hace falta nada hasta la próxima corrida; para no esperar, el cron se puede relanzar a mano con `select cron.run_job(<jobid>)`, pero ojo: `alerta-pm` y `resumen-semanal` mandan el correo de verdad; (3) si se repite en dos corridas seguidas, revisa las claves de la API (service_role) del proyecto. Un llamador con un secreto incorrecto sigue recibiendo 401 y **no** deja registro. El detector de salud (`vigilar-salud-sistema`) revisa además `alerta-pm` (26 h) y `resumen-semanal` (8 días) desde la versión 2, ya publicada en los dos proyectos.

## 8. Despliegue (Vercel)

- Cada push a la rama `main` del repositorio dispara un build (`vite build`)
  y un despliegue automático a `sistema-mp-centinela.vercel.app`.
- `modules/renders/*.js` (47 archivos, módulos ES reales desde la migración
  de Fase 3, 2026-08-30): Vite bundlea y minifica de verdad solo el par
  que `index.html` importa de forma estática (`dash.js`/`ace.js`, eager);
  los otros 43 (carga perezosa, `dynamic import()`) no entran a ese grafo
  estático — se copian tal cual, sin bundlear, a `dist/modules/renders/`.
  `logic.js`, `vendor/*.js` y `modules/store.js` siguen siendo scripts
  planos a propósito — Vite tampoco los toca (ver `vite.config.js`).
- **Si un despliegue sale mal**: en el panel de Vercel se puede volver
  ("Promote to Production") a cualquier despliegue anterior con un clic —
  no hace falta revertir código a mano bajo presión.
- **Antes de fusionar algo grande a `main`**: siempre se prueba primero en
  el preview automático que Vercel genera para cada rama, y solo se fusiona
  a producción con aprobación explícita.

Esto describe cómo se despliega ESTE sistema (el de Besalco). Para levantar
una instancia separada para un cliente nuevo — proyecto Supabase propio,
sin compartir datos ni backend con Besalco — ver
[`nuevo-cliente.md`](./nuevo-cliente.md): ni "Configurar Nueva Empresa" ni
"Descargar Plantilla Limpia" (Configuración) alcanzan solos para eso, esa
guía explica por qué y el proceso real completo.

## 9. Estructura del código

```
index.html              — esqueleto: nav, login, bootstrap, infraestructura compartida
logic.js                — funciones de cálculo puras (con tests)
modules/store.js         — motor de sincronización (S.g/S.s, TABLA_REAL, RLS-aware)
modules/renders/*.js     — un archivo por pestaña/sub-pestaña (49, módulos ES reales)
supabase/migrations/     — schema versionado como código
supabase/functions/      — 14 Edge Functions (crear-operador, alerta-pm, resumen-semanal,
                            backup-diario, whatsapp-webhook, email-webhook,
                            vigilar-salud-sistema, registrar-intento-acceso,
                            avisar-salud-equipo, avisar-dispositivo-nuevo, leer-pauta-pm,
                            leer-informe-correctivo, leer-chequeo-neumaticos,
                            _shared/ parser común + interpretación con IA)
tests/                   — pruebas de logic.js y store.js (Vitest, 1.724 casos)
docs/                    — esta carpeta
```

Cada módulo de `modules/renders/` es autocontenido: exporta su
`render<Tab>` (y también lo deja en `window.render<Tab>`, porque el HTML
generado usa `onclick="..."` que no ve bindings de un módulo) más los
botones/formularios exclusivos de esa pestaña.
Las funciones realmente compartidas entre pestañas (helpers de fecha,
`escapeHtml`, el motor de voz genérico, etc.) quedan en `index.html` a
propósito.

### Fotos de los equipos en la Torre de Control (2026-10-22)

La Torre de Control muestra, por defecto, un dibujo según el tipo de equipo. Si hay una foto para el **modelo**, muestra la foto (con un aro y un punto del color de salud: verde, ámbar o rojo). Una foto sirve para todas las unidades del mismo modelo. Si no hay foto, o la imagen no carga, se ve el dibujo de siempre.

**Cómo agregar una foto:** guarda el archivo en `public/modelos/` (JPG o WebP, unos 600 px de ancho y menos de 120 KB, de costado o en diagonal, sin logos ni textos de otras empresas), y en `modules/renders/torre.js` agrega una línea al mapa `_TORRE_FOTOS` con la clave del modelo (su nombre en minúscula, sin tildes, espacios ni guiones) y la ruta, por ejemplo `'komatsuwa9008r':'modelos/komatsu-wa900-8r.jpg'`. «Komatsu HD785-7» y «Komatsu HD-785-7» dan la misma clave, así que comparten foto. Hay un `LEEME.txt` con los mismos pasos dentro de `public/modelos/`. Usa solo fotos propias o imágenes oficiales con permiso de uso; no las bajes de buscadores.


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
