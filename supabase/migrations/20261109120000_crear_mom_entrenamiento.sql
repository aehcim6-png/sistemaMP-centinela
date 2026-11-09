-- Entrenamientos del MOM (9-nov-2026): «Planificar y ejecutar entrenamientos del Modelo Operacional de Mantenimiento para roles ejecutivos y operacionales».
-- mom_raci: la matriz RACI del proceso, una fila por actividad × rol (letra R responsable, A aprueba, C consultado, I informado; null = celda vacía). "actOrden" y "rolOrden" fijan el orden en pantalla.
-- mom_entrenamientos: el plan de entrenamientos (tema, audiencia, fechas, instructor, asistencia, estado).
-- Todos los perfiles activos pueden VER; solo un administrador puede crear, editar o borrar (lo hace cumplir la base, no solo la pantalla).
create table if not exists public.mom_raci (
  id uuid primary key default gen_random_uuid(),
  actividad text not null check (length(btrim(actividad)) > 0),
  "actOrden" integer not null default 0,
  rol text not null check (length(btrim(rol)) > 0),
  "rolOrden" integer not null default 0,
  "audienciaRol" text not null default 'Operacional' check ("audienciaRol" in ('Ejecutivo', 'Operacional')),
  letra text check (letra is null or letra in ('R', 'A', 'C', 'I')),
  usuario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_mom_raci_actividad_rol on public.mom_raci (actividad, rol);

create table if not exists public.mom_entrenamientos (
  id uuid primary key default gen_random_uuid(),
  tema text not null check (length(btrim(tema)) > 0),
  audiencia text not null check (audiencia in ('Ejecutivo', 'Operacional')),
  roles text,
  "fechaPlan" date not null,
  "fechaReal" date,
  instructor text,
  "duracionH" numeric check ("duracionH" is null or "duracionH" > 0),
  "asistentesPlan" integer check ("asistentesPlan" is null or "asistentesPlan" >= 0),
  "asistentesReal" integer check ("asistentesReal" is null or "asistentesReal" >= 0),
  estado text not null default 'Planificado' check (estado in ('Planificado', 'Ejecutado', 'Reprogramado', 'Cancelado')),
  observaciones text,
  usuario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mom_entrenamientos_fecha on public.mom_entrenamientos ("fechaPlan", estado);

alter table public.mom_raci enable row level security;
create policy "mom_select" on public.mom_raci for select to authenticated using (privado.es_usuario_activo());
create policy "mom_insert" on public.mom_raci for insert to authenticated with check (privado.es_admin_activo());
create policy "mom_update" on public.mom_raci for update to authenticated using (privado.es_admin_activo()) with check (privado.es_admin_activo());
create policy "mom_delete" on public.mom_raci for delete to authenticated using (privado.es_admin_activo());
create trigger actualizar_updated_at before update on public.mom_raci
  for each row execute function public.actualizar_updated_at();
grant select, insert, update, delete on table public.mom_raci to authenticated;
grant select, insert, update, delete on table public.mom_raci to service_role;

alter table public.mom_entrenamientos enable row level security;
create policy "mom_select" on public.mom_entrenamientos for select to authenticated using (privado.es_usuario_activo());
create policy "mom_insert" on public.mom_entrenamientos for insert to authenticated with check (privado.es_admin_activo());
create policy "mom_update" on public.mom_entrenamientos for update to authenticated using (privado.es_admin_activo()) with check (privado.es_admin_activo());
create policy "mom_delete" on public.mom_entrenamientos for delete to authenticated using (privado.es_admin_activo());
create trigger actualizar_updated_at before update on public.mom_entrenamientos
  for each row execute function public.actualizar_updated_at();
grant select, insert, update, delete on table public.mom_entrenamientos to authenticated;
grant select, insert, update, delete on table public.mom_entrenamientos to service_role;
