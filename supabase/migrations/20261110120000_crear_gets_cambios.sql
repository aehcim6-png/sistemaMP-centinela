-- Registro de cambios de elementos de desgaste, GETS (10-nov-2026): cuchillas, puntas, entredientes, calzas, cantoneras, rodados…
-- Viene de la planilla «Control GETS» del taller (hoja «Cambio», dic-2021 a jun-2024, y las proyecciones de 2026). Una fila por pieza cambiada; varias filas el mismo día cuentan como un solo cambio al proyectar.
-- "sigla" es la sigla actual del equipo y "siglaOriginal" la que traía la planilla. "horometroDudoso" marca el horómetro que retrocede o no cuadra con las lecturas del sistema: el eje confiable es la fecha.
-- "pieza" es la clasificación (ver getsPiezaDe en logic.js). Todos los perfiles activos ven; editan los editores y administradores (los mismos que registran PM y OT).
create table if not exists public.gets_cambios (
  id uuid primary key default gen_random_uuid(),
  sigla text not null check (length(btrim(sigla)) > 0),
  "siglaOriginal" text,
  fecha date not null,
  horometro numeric check (horometro is null or horometro > 0),
  "horometroDudoso" boolean not null default false,
  responsable text,
  descripcion text not null check (length(btrim(descripcion)) > 0),
  pieza text not null default 'Otro',
  "nParte" text,
  cantidad integer check (cantidad is null or cantidad > 0),
  observaciones text,
  fuente text,
  usuario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_gets_cambios_sigla_fecha on public.gets_cambios (sigla, fecha);
create unique index if not exists uq_gets_cambios_fila on public.gets_cambios (sigla, fecha, descripcion, coalesce("nParte", ''), coalesce(horometro, 0));

alter table public.gets_cambios enable row level security;
create policy "operacional_select" on public.gets_cambios for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.gets_cambios for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.gets_cambios for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.gets_cambios for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.gets_cambios
  for each row execute function public.actualizar_updated_at();
grant select, insert, update, delete on table public.gets_cambios to authenticated;
grant select, insert, update, delete on table public.gets_cambios to service_role;
