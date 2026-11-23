-- Consumo real de lubricantes por equipo y día (23-nov-2026). Viene de los informes mensuales «CONSUMO LUBRICANTES <mes> CENTINELA» de bodega (una hoja por lubricante, una fila por equipo y un número por día),
-- que ya incluyen los cambios de los PM y los rellenos por falla. Con esta tabla Buscar muestra el historial de un equipo y «Qué comprar» parte del consumo real y no de una estimación.
-- `lubricante` es el nombre del informe (p. ej. MOBILTRANS HD 10W); `unidad` es L, o kg para la grasa; `fuente` dice de qué informe salió la fila. Una fila por equipo, día, lubricante y fuente.
-- Todos los perfiles activos leen; solo un editor escribe.
create table if not exists public.consumo_lubricantes (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  sigla text not null check (length(btrim(sigla)) > 0),
  lubricante text not null check (length(btrim(lubricante)) > 0),
  cantidad numeric not null check (cantidad > 0),
  unidad text not null default 'L' check (unidad in ('L', 'kg')),
  fuente text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists consumo_lubricantes_fila on public.consumo_lubricantes (fecha, sigla, lubricante, coalesce(fuente, ''));
create index if not exists idx_consumo_lubricantes_sigla on public.consumo_lubricantes (sigla, fecha);
create index if not exists idx_consumo_lubricantes_fecha on public.consumo_lubricantes (fecha);

alter table public.consumo_lubricantes enable row level security;
create policy "operacional_select" on public.consumo_lubricantes for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.consumo_lubricantes for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.consumo_lubricantes for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.consumo_lubricantes for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.consumo_lubricantes
  for each row execute function public.actualizar_updated_at();

grant select, insert, update, delete on table public.consumo_lubricantes to authenticated;
grant select, insert, update, delete on table public.consumo_lubricantes to service_role;
