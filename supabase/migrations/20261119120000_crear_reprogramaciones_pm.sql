-- Reprogramaciones de PM (19-nov-2026). Cuando una mantención programada para una semana no se hace y pasa a otra, queda aquí: qué equipo y qué PM,
-- de qué semana salió, a cuál pasa y por qué. El plan semanal se calcula en vivo y no se guarda, así que sin este registro, al pasar la semana, se pierde qué se reprogramó.
-- `anio` + `semanaOrigen` + `semanaDestino` usan la numeración de Planificación semanal (la semana parte el jueves); `fechaOrigen` y `fechaDestino` son el jueves en que parte cada semana
-- (sirven para saber si el PM se repuso sin recalcular semanas). `hito` es el horómetro del PM (por ejemplo 500) cuando se conoce.
-- `estado`: Pendiente (se debe reponer) o Cancelada (ya no se hará); «Repuesta» no se guarda: se deduce de los PM registrados (ver estadoReprogramacionPM en logic.js).
-- `motivo` es una lista cerrada para poder contar por causa; el detalle libre va en `detalle`. Solo un editor escribe; todos los perfiles activos ven.
create table if not exists public.reprogramaciones_pm (
  id uuid primary key default gen_random_uuid(),
  sigla text not null check (length(btrim(sigla)) > 0),
  "tipoPM" text not null check (length(btrim("tipoPM")) > 0),
  hito numeric check (hito is null or hito > 0),
  anio integer not null check (anio between 2020 and 2100),
  "semanaOrigen" integer not null check ("semanaOrigen" between 1 and 53),
  "semanaDestino" integer not null check ("semanaDestino" between 1 and 53),
  "fechaOrigen" date not null,
  "fechaDestino" date not null check ("fechaDestino" > "fechaOrigen"),
  motivo text not null check (motivo in (
    'Falta de repuestos o insumos', 'Equipo en operación (no liberado)', 'Equipo fuera de servicio por falla',
    'Falta de personal', 'Seguridad o clima', 'Cambio de prioridad', 'Otro')),
  detalle text,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Cancelada')),
  usuario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_reprogramaciones_pm_sigla on public.reprogramaciones_pm (sigla, "fechaOrigen");
create index if not exists idx_reprogramaciones_pm_semanas on public.reprogramaciones_pm (anio, "semanaOrigen", "semanaDestino");

alter table public.reprogramaciones_pm enable row level security;
create policy "operacional_select" on public.reprogramaciones_pm for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.reprogramaciones_pm for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.reprogramaciones_pm for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.reprogramaciones_pm for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.reprogramaciones_pm
  for each row execute function public.actualizar_updated_at();

grant select, insert, update, delete on table public.reprogramaciones_pm to authenticated;
grant select, insert, update, delete on table public.reprogramaciones_pm to service_role;
