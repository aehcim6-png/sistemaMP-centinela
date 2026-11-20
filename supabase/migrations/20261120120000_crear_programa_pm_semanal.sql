-- Programa semanal oficial del taller (20-nov-2026). Cada fila es un PM que el programa de la semana (hojas «Sem N» del libro PROGRAMA_SEMANA_xx del taller) tenía para un equipo en un día.
-- El plan de Planificación semanal se calcula en vivo y no se guardaba, así que al pasar la semana se perdía qué tocaba; esta tabla guarda el programa tal como lo emitió el taller.
-- `semana` usa la numeración de Planificación semanal (la semana parte el jueves; la 1 de 2026 parte el 1-ene); `fechaSemana` es ese jueves y `fechaProgramada` el día de la celda en la hoja.
-- `sigla` es la del sistema (CN-9503); `siglaPrograma` la que escribe el programa (CE-85). `horomHito` es el horómetro nominal del PM que anota el programa (puede faltar).
-- `nota` guarda lo que el programa dice cuando no es un PM simple (por ejemplo «Programar mantención PM1 cuando quede operativo»). `fuente` dice de qué archivo salió.
-- Solo un editor escribe; todos los perfiles activos ven.
create table if not exists public.programa_pm_semanal (
  id uuid primary key default gen_random_uuid(),
  anio integer not null check (anio between 2020 and 2100),
  semana integer not null check (semana between 1 and 53),
  "fechaSemana" date not null,
  sigla text not null check (length(btrim(sigla)) > 0),
  "siglaPrograma" text,
  "tipoPM" text not null check (length(btrim("tipoPM")) > 0),
  "horomHito" numeric check ("horomHito" is null or "horomHito" > 0),
  "fechaProgramada" date not null,
  nota text,
  fuente text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_programa_pm_semanal on public.programa_pm_semanal (anio, semana, sigla, "tipoPM", "fechaProgramada");
create index if not exists idx_programa_pm_semanal_sigla on public.programa_pm_semanal (sigla, "fechaProgramada");

alter table public.programa_pm_semanal enable row level security;
create policy "operacional_select" on public.programa_pm_semanal for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.programa_pm_semanal for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.programa_pm_semanal for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.programa_pm_semanal for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.programa_pm_semanal
  for each row execute function public.actualizar_updated_at();

grant select, insert, update, delete on table public.programa_pm_semanal to authenticated;
grant select, insert, update, delete on table public.programa_pm_semanal to service_role;
