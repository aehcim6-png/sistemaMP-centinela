-- Detector de salud del sistema — Capa 1 (2026-09-14, pedido real del
-- usuario: "no existe un detector de situaciones... que nos avise que algo
-- no funciona"). Hasta ahora, si backup-diario fallaba silenciosamente, o
-- whatsapp-webhook/email-webhook empezaban a tirar error en cada mensaje,
-- nadie se enteraba salvo que alguien mirara los logs de Supabase a mano.
--
-- Tabla mínima: cada cron/webhook crítico registra su propio resultado acá
-- (best-effort, ver _shared/registrarSaludCron.ts) — nunca se infiere
-- "algo está mal" de la AUSENCIA de actividad (ej. "no llegó ningún
-- WhatsApp hoy" no es lo mismo que "el webhook está roto"; podría ser,
-- simplemente, que nadie reportó nada hoy). Solo cuenta como problema un
-- FALLO real y registrado por el propio proceso.
create table public.salud_crons (
  nombre text primary key,
  "ultimaEjecucion" timestamptz not null default now(),
  exito boolean not null,
  detalle text,
  updated_at timestamptz not null default now()
);

alter table public.salud_crons enable row level security;

-- Solo lectura para admin (pensado para una futura tarjeta en "Estado del
-- Sistema", Configuración) — la escritura la hacen las Edge Functions con
-- service_role, que ya se salta RLS por diseño, así que no hace falta una
-- política de INSERT/UPDATE.
create policy "salud_crons_select" on public.salud_crons
  for select to authenticated
  using (privado.es_admin_activo());

create trigger actualizar_updated_at
  before update on public.salud_crons
  for each row execute function actualizar_updated_at();
