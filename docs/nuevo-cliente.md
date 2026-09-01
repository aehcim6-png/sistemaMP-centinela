# Guía real: desplegar SistemaMP Centinela para un cliente nuevo

> Nivel 1 de la propuesta "¿se puede vender esto a otra minera?" (2026-09-01).
> Esta guía existe porque se comprobó, revisando el código, que **ni
> "Configurar Nueva Empresa" ni "Descargar Plantilla Limpia" (Configuración)
> arrancan por sí solos una instancia nueva** — ver el porqué en cada paso
> abajo. No se automatizó nada todavía: esto es el proceso manual real,
> ordenado, para que sea reproducible.

## Antes de empezar — qué NO hacen las herramientas que ya existen

- **"Configurar Nueva Empresa"** resetea el **mismo backend de Besalco, en
  el lugar** — borra los datos operacionales actuales y carga los que
  subas. Sirve para reconvertir ESTE despliegue en otra cosa, no para sumar
  un cliente nuevo al lado del actual (usarlo así borraría los datos reales
  de Besalco).
- **"Descargar Plantilla Limpia"** solo reemplaza el objeto `INIT` dentro de
  `index.html` (la semilla local de equipos/pautas). No puede tocar
  `modules/store.js` — un archivo aparte, cargado por su cuenta — donde
  viven `_SB_DEFAULT_URL`/`_SB_DEFAULT_KEY`, el proyecto Supabase real de
  Besalco codificado a mano. El archivo descargado, si se despliega tal
  cual, sigue apuntando el login, el storage y las Edge Functions al
  backend real de Besalco.

Ambas siguen existiendo (son útiles para lo que sí hacen), pero ninguna
reemplaza este proceso.

## 1. Proyecto Supabase nuevo

Crear un proyecto nuevo en Supabase (dashboard o `mcp__Supabase__create_project`).
Guardar: URL del proyecto, `anon`/`publishable` key, `service_role` key.

## 2. Aplicar el esquema

Aplicar las 51 migraciones de `supabase/migrations/` **en orden** (por
nombre de archivo, ya vienen con timestamp). Traen: las ~35 tablas reales,
RLS por tabla, el trigger `proteger_columnas_admin`, las funciones
`verificar_secreto_cron`/`obtener_secreto_para_cron`, y la creación del
bucket `informes-fotos`.

**⚠️ Trampa real encontrada:** 4 de esas migraciones traen la URL del
proyecto de Besalco **escrita a mano** dentro del SQL del cron
(`20260805213000_programar_backup_diario.sql`,
`20260806014500_asegurar_backup_diario.sql`,
`20260806040000_asegurar_alerta_pm_diaria.sql`,
`20260901010000_programar_resumen_semanal.sql`). Aplicarlas tal cual en el
proyecto nuevo programaría los cron jobs para llamar a las Edge Functions
**del proyecto de Besalco**, no las del cliente nuevo. Más fácil que editar
esas migraciones históricas: dejar que se apliquen igual (el `cron.schedule`
fallará silenciosamente contra un proyecto que no existe para este backend,
o programará algo que nunca se dispara porque las credenciales no calzan) y
**reprogramar los 3 cron jobs a mano al final** (paso 6), con la URL y el
`apikey` (anon key) correctos del proyecto nuevo.

## 3. Configurar Supabase Auth (dashboard — no versionado)

- **Password policy**: 14+ caracteres, mayúscula/minúscula/dígito/símbolo
  (Authentication → Policies). No vive en ninguna migración, es puramente
  configuración de dashboard.
- **Site URL / Redirect URLs** (Authentication → URL Configuration):
  agregar la URL real de este cliente (ej.
  `https://sistema-mp-<cliente>.vercel.app/**`) — sin esto, el link de
  "¿Olvidaste tu contraseña?" no vuelve bien a la app.
- **SMTP de correo** (Authentication → Emails): por defecto Supabase manda
  los correos de Auth (confirmación, recuperación de clave) con su propio
  servidor, con un límite bajo de envíos por hora — para un cliente real
  conviene configurar un SMTP propio (ej. Resend, mismo proveedor que ya
  usan las alertas) para no toparse con ese límite.

## 4. Secrets de las Edge Functions

Cargar en Project Settings → Edge Functions → Secrets (o `supabase secrets
set`):
- `RESEND_API_KEY`, `ALERTA_PM_REMITENTE` (correo de alertas/resumen semanal)
- `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_WHATSAPP_FROM` (opcional,
  solo si el cliente quiere alertas por WhatsApp)
- La clave de Gemini que usan `leer-pauta-pm`/`leer-informe-correctivo`/
  `leer-chequeo-neumaticos` (OCR de fotos)
- `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` los provee Supabase solo a cada
  función, no hace falta cargarlos a mano.

## 5. Vault — secretos de cron

Insertar (vía SQL, `vault.create_secret(valor, nombre, descripción)`) un
secreto aleatorio de 32 bytes para cada uno:
`backup_diario_cron_secret`, `alerta_pm_cron_secret`,
`resumen_semanal_cron_secret`. Las funciones que los verifican
(`verificar_secreto_cron`) ya quedaron creadas en el paso 2.

## 6. Desplegar las Edge Functions y programar los cron jobs

Desplegar las 11 funciones de `supabase/functions/`. Después, programar (o
reprogramar, por la trampa del paso 2) los 3 cron jobs con
`cron.schedule(...)`, apuntando a `https://<proyecto-nuevo>.supabase.co/functions/v1/<función>`
y el `apikey` anon del proyecto nuevo — copiar la forma exacta de
`supabase/migrations/20260901010000_programar_resumen_semanal.sql`, solo
con los valores del proyecto nuevo.

## 7. Fork del código + branding

Clonar el repositorio. Editar a mano:
- `modules/store.js` líneas 53-54: `_SB_DEFAULT_URL`/`_SB_DEFAULT_KEY` →
  los del proyecto nuevo. **Este es el paso que de verdad "cambia de
  backend"** — sin esto, todo lo demás (login, storage, Edge Functions)
  sigue hablando con Besalco sin importar qué se haya hecho en Configuración.
- Nombre del sistema/empresa donde aparece escrito a mano: `<title>` de
  `index.html`, el encabezado de impresión (`SistemaMP CENTINELA` +
  "Besalco Minería S.A. — Faena..."), el pie de página, y el subtítulo del
  login ("Besalco Minería", bajo el candado).
- **Revisar datos de referencia específicos de Besalco embebidos en el
  código**, no solo texto de marca — encontrados en esta pasada:
  - `EXCLUIDOS` en `alerta-pm/index.ts` y `resumen-semanal/index.ts`
    (siglas de equipos decomisionados de Besalco — para otro cliente, esta
    lista debería empezar vacía).
  - `SEN_PRECIO` en `index.html` (cotización real de Michelin a Besalco
    para sensores TPMS, usada en cálculos de costo de neumáticos).
  - Revisar también `REPUESTOS_CRITICOS_KOMATSU` y cualquier otra lista de
    "referencia de industria" que haya quedado ajustada a la flota real de
    Besalco en vez de ser un valor genérico.

## 8. Desplegar y arrancar

- Nuevo proyecto Vercel, apuntado a este fork.
- Crear el primer usuario admin (Edge Function `crear-operador`, o insertar
  directo en `user_roles`).
- Entrar y usar **"Configurar Nueva Empresa"** (Configuración) — ahora sí,
  contra el backend correcto — para cargar los equipos y pautas reales del
  cliente nuevo.

---

Nada de este proceso toca el sistema que usa Besalco hoy — es enteramente
sobre cómo levantar una instancia SEPARADA. Los Niveles 2+ de la propuesta
comercial (sacar el branding a una configuración real en vez de texto fijo,
y más adelante multi-tenencia compartida) reducirían varios de estos pasos
manuales, pero no son requisito para que esta guía funcione tal cual está.
