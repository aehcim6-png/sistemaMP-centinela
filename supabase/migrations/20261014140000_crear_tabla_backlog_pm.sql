-- Backlog de pautas (2026-10-14): tareas que quedan pendientes al hacer un PM (por ejemplo "cambio de filtro de combustible" por falta de insumo).
-- Una fila por tarea, con el horómetro del día en que quedó pendiente y su fecha de cierre (null = sigue abierta). Alimenta la sección V del informe de gestión
-- (cumplimiento de cierre de backlog). Tabla nueva, no toca las existentes.
create table if not exists public.backlog_pm (
  id uuid primary key default gen_random_uuid(),
  sigla text not null,
  fecha date not null,
  "horomBacklog" numeric,
  tarea text not null,
  sistema text,
  "conInsumo" boolean not null default false,
  "fechaCierre" date,
  observacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_backlog_pm_sigla on public.backlog_pm (sigla, fecha);
create index if not exists idx_backlog_pm_abiertos on public.backlog_pm ("fechaCierre") where "fechaCierre" is null;
alter table public.backlog_pm enable row level security;
create policy "operacional_select" on public.backlog_pm for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.backlog_pm for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.backlog_pm for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.backlog_pm for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.backlog_pm
  for each row execute function public.actualizar_updated_at();
