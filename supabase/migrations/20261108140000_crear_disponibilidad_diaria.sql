-- Disponibilidad diaria oficial del histórico (2026-11-08): una fila por equipo y día con las horas de detención del día y la disponibilidad que resulta.
-- Salió de la hoja «Mec mant» de DISPONIBILIDAD_MECÁNICA (21-dic-2021 al 20-ago-2024; el día se calcula sobre 24 h) y de Disponibilidad_3 (21-ago al 30-sep-2024;
-- turnos de 10 h, día = 20 h). Sirve para dos cosas: (1) contrastar el cálculo del programa con lo que el cliente registró día a día; (2) saber en qué fechas
-- cada equipo tenía fila en el registro, o sea, cuándo contaba para la disponibilidad de la flota (los que salieron dejan de tener filas).
-- Una fila que existe sin detención vale disponibilidad 1: la ausencia de fila significa «ese día el equipo no figuraba en el registro», no «disponible».
-- "dudoso" marca las horas imposibles (más de la base del día), que se guardan tal como vinieron y se cuentan como día perdido completo.
-- Es dato de consulta: la carga se hace por SQL; la app no escribe aquí.
create table if not exists public.disponibilidad_diaria (
  id uuid primary key default gen_random_uuid(),
  sigla text not null,
  "siglaOriginal" text,
  fecha date not null,
  "horasDetenido" numeric not null default 0 check ("horasDetenido" >= 0),
  "horasProg" numeric not null default 0,
  "horasNoProg" numeric not null default 0,
  "horasIntervenidas" numeric not null default 0,
  "baseHoras" numeric not null default 24 check ("baseHoras" > 0),
  disponibilidad numeric not null check (disponibilidad between 0 and 1),
  dudoso boolean not null default false,
  fuente text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_disponibilidad_diaria_sigla_fecha on public.disponibilidad_diaria (sigla, fecha);
create index if not exists idx_disponibilidad_diaria_fecha on public.disponibilidad_diaria (fecha);

alter table public.disponibilidad_diaria enable row level security;
create policy "operacional_select" on public.disponibilidad_diaria for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.disponibilidad_diaria for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.disponibilidad_diaria for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.disponibilidad_diaria for delete to authenticated using (privado.es_editor_activo());
grant select, insert, update, delete on table public.disponibilidad_diaria to authenticated;
grant select, insert, update, delete on table public.disponibilidad_diaria to service_role;
