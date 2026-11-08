-- Detenciones de equipos leídas del chat de WhatsApp «BSM_CEN - EQUIPOS» (2026-11-08).
-- Motivo: las OT no traen todas las detenciones (p. ej. CN-9503 tenía 0 a 4 días fuera de servicio por mes en 2025 en las OT, y el chat da 10 a 20), así que la
-- disponibilidad calculada solo con OT sale inflada. Cada fila es un episodio: desde el primer mensaje «fuera de servicio / F/S» de un equipo hasta el siguiente
-- mensaje «operativo» del mismo equipo. Es una ESTIMACIÓN sobre texto libre: la hora real de la detención puede diferir unas horas.
-- "abierta" = el chat nunca dijo «operativo» después; se cortó a los 10 días (o a la fecha de carga) y hay que revisarla.
-- Es dato de consulta: la carga se hace por SQL; la app no escribe aquí.
create table if not exists public.detenciones_whatsapp (
  id uuid primary key default gen_random_uuid(),
  sigla text not null,
  inicio timestamp not null,
  fin timestamp not null check (fin >= inicio),
  abierta boolean not null default false,
  fuente text not null default 'Chat WhatsApp BSM_CEN - EQUIPOS (carga 2026-11-08)',
  created_at timestamptz not null default now()
);
create unique index if not exists uq_detenciones_whatsapp_sigla_inicio on public.detenciones_whatsapp (sigla, inicio);
create index if not exists idx_detenciones_whatsapp_inicio on public.detenciones_whatsapp (inicio);

alter table public.detenciones_whatsapp enable row level security;
create policy "operacional_select" on public.detenciones_whatsapp for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.detenciones_whatsapp for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.detenciones_whatsapp for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.detenciones_whatsapp for delete to authenticated using (privado.es_editor_activo());
grant select, insert, update, delete on table public.detenciones_whatsapp to authenticated;
grant select, insert, update, delete on table public.detenciones_whatsapp to service_role;
