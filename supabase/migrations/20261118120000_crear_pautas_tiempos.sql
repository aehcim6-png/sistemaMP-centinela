-- Tiempo por tarea de las pautas de mantención (18-nov-2026).
-- Viene de los PDF «Pauta Mantencion» del sistema de Besalco Minería (columnas Tope Horas, Minutos e Insumos). La tabla `pautas`
-- guarda la FRECUENCIA de cada tarea (`hrs`: 250, 500…), no cuánto demora; esta guarda los minutos de trabajo por tarea, para saber
-- cuánto debería durar cada PM (ver minutosPautaPM y cumplimientoTiempoPM en logic.js).
-- "sigla" es la sigla de referencia del grupo (la misma convención de GRUPO_PAUTAS: BD-9533 para los D375, CN-9507 para los HD785-7…).
-- "minutos" es tiempo de trabajo por persona (hombre-minutos), no duración del PM: con varios técnicos el PM dura menos.
-- "topeHoras" es la frecuencia de la tarea en la unidad de "unidad": 'h' (horas de horómetro) o 'km' (el bus se mide en kilómetros).
-- "orden" conserva el orden del PDF. Todos los perfiles activos ven; solo un administrador escribe (son datos de referencia).
create table if not exists public.pautas_tiempos (
  id uuid primary key default gen_random_uuid(),
  sigla text not null check (length(btrim(sigla)) > 0),
  modelo text,
  hoja text,
  orden integer not null,
  seccion text,
  act text not null check (length(btrim(act)) > 0),
  "topeHoras" numeric not null check ("topeHoras" > 0),
  unidad text not null default 'h' check (unidad in ('h', 'km')),
  minutos numeric not null check (minutos >= 0),
  insumos text,
  fuente text,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_pautas_tiempos_orden on public.pautas_tiempos (sigla, orden);

alter table public.pautas_tiempos enable row level security;
create policy "pautas_tiempos_select" on public.pautas_tiempos for select to authenticated using (privado.es_usuario_activo());
create policy "pautas_tiempos_insert" on public.pautas_tiempos for insert to authenticated with check (privado.es_admin_activo());
create policy "pautas_tiempos_update" on public.pautas_tiempos for update to authenticated using (privado.es_admin_activo()) with check (privado.es_admin_activo());
create policy "pautas_tiempos_delete" on public.pautas_tiempos for delete to authenticated using (privado.es_admin_activo());
grant select, insert, update, delete on table public.pautas_tiempos to authenticated;
grant select, insert, update, delete on table public.pautas_tiempos to service_role;
