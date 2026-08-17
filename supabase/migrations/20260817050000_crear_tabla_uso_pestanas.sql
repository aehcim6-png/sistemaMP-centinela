-- Telemetría de uso de pestañas (agosto 2026) — antes de seguir agregando
-- funciones nuevas (Estadística, Probabilidad de Falla, etc.), el usuario
-- pidió saber cuáles de las que ya existen realmente se usan. Registra un
-- evento liviano cada vez que alguien hace clic en una pestaña o
-- sub-pestaña (go()/comp2Sub()/mkpiSub()/planiSub()/stk2Sub(), ver
-- index.html y modules/renders/*.js) — no en cada carga de la página, solo
-- en la acción real de abrir algo.
--
-- A propósito NO pasa por S.g/S.s (TABLA_REAL): esa vía descarga la tabla
-- completa en cada login (_sbLoadHeavy) — bien para datos que hay que tener
-- offline, pésimo para un log que solo crece con cada clic y que nadie
-- necesita tener disponible sin internet. El cliente escribe acá con un
-- POST directo a PostgREST (_logUsoPestana en store.js), fire-and-forget.
--
-- Point de partida real (auditoría 2026-08-17): la base completa pesa 23 MB
-- de 500 MB (4.6%), así que hay margen — pero un log que crece con cada
-- clic, sin límite, es exactamente el tipo de cosa que sí puede llenar el
-- plan gratis con el tiempo si nadie lo poda. Por eso el cron de más abajo:
-- se purga solo a los 90 días, nunca hay que acordarse de limpiarlo a mano.
create table public.uso_pestanas (
  id uuid primary key default gen_random_uuid(),
  pestana text not null,
  usuario text,
  fecha timestamptz not null default now()
);

create index idx_uso_pestanas_fecha on public.uso_pestanas(fecha);
create index idx_uso_pestanas_pestana on public.uso_pestanas(pestana);

alter table public.uso_pestanas enable row level security;

-- INSERT: cualquier usuario activo (incluido 'lector') — es un registro de
-- actividad, no una escritura de datos de negocio; mismo criterio que
-- 'changelog'. SELECT/DELETE: solo admin — es una vista de gestión sobre
-- quién usa qué, no algo que un operador necesite ver de sus compañeros.
create policy "uso_pestanas_insert" on public.uso_pestanas
  for insert to authenticated
  with check (privado.es_usuario_activo());

create policy "uso_pestanas_select" on public.uso_pestanas
  for select to authenticated
  using (privado.es_admin_activo());

create policy "uso_pestanas_delete" on public.uso_pestanas
  for delete to authenticated
  using (privado.es_admin_activo());

-- Purga automática diaria (mismo mecanismo que ya usan backup-diario y
-- alerta-pm, ver 20260805213000/20260806040000) — acá no hace falta Edge
-- Function ni secreto: es un DELETE de SQL puro corriendo dentro de Postgres.
select cron.schedule(
  'purgar-uso-pestanas',
  '0 5 * * *',
  $$ delete from public.uso_pestanas where fecha < now() - interval '90 days'; $$
);
