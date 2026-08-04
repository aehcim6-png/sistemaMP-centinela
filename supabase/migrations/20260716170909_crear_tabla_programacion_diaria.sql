create table public.programacion_diaria (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  turno text not null check (turno in ('dia','noche')),
  orden integer,
  nombre text not null,
  cargo text,
  responsable text,
  bloques jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_programacion_diaria_fecha_turno on public.programacion_diaria(fecha, turno);
alter table public.programacion_diaria enable row level security;
create policy "usuarios activos leen programacion_diaria" on public.programacion_diaria
  for select using (privado.es_usuario_activo());
create policy "usuarios activos escriben programacion_diaria" on public.programacion_diaria
  for insert with check (privado.es_usuario_activo());
create policy "usuarios activos actualizan programacion_diaria" on public.programacion_diaria
  for update using (privado.es_usuario_activo());
create policy "usuarios activos borran programacion_diaria" on public.programacion_diaria
  for delete using (privado.es_usuario_activo());
create trigger actualizar_updated_at before update on public.programacion_diaria
  for each row execute function public.actualizar_updated_at();
