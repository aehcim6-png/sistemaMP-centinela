-- Presencia de cada equipo en la flota (2026-11-08): desde cuándo y hasta cuándo contó para la disponibilidad.
-- Motivo: los equipos que después se desmovilizaron sí estuvieron en la flota y afectaron la disponibilidad de esos años; desde su salida ya no deben contar.
-- "desde" vacío = estuvo desde que hay datos (o no se conoce la entrada). "hasta" vacío = sigue en faena. "confirmado" = la fecha la dijo el cliente
-- (false = es la última fecha que aparece en los datos y falta confirmarla). No reemplaza a "equipos": los desmovilizados no se agregan a las listas de operación.
-- Es dato de consulta: la carga se hace por SQL; la app no escribe aquí.
create table if not exists public.flota_presencia (
  sigla text primary key,
  "siglaOriginal" text,
  desde date,
  hasta date,
  motivo text,
  confirmado boolean not null default false,
  fuente text not null,
  created_at timestamptz not null default now()
);

alter table public.flota_presencia enable row level security;
create policy "operacional_select" on public.flota_presencia for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.flota_presencia for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.flota_presencia for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.flota_presencia for delete to authenticated using (privado.es_editor_activo());
grant select, insert, update, delete on table public.flota_presencia to authenticated;
grant select, insert, update, delete on table public.flota_presencia to service_role;
