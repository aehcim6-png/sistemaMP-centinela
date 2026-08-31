-- Compromisos (loop de responsabilidad de Metas & KPIs — ver
-- modules/renders/metas.js, verCadenaCausas/abrirFormCompromiso). Cuando un
-- indicador sale rojo o con alerta de tendencia, se puede registrar acá QUÉ
-- se va a hacer, QUIÉN es responsable y PARA CUÁNDO. El sistema mismo evalúa
-- solo si se cumplió (comparando el valor actual del indicador contra la
-- línea base guardada al crear el compromiso) — nadie tiene que cerrarlo a
-- mano. Mismas columnas de responsabilidad que 'destrabe'
-- (accion/responsable/fecha/estado), tabla operacional nueva: cualquier
-- usuario activo (admin u operador) puede crear/editar, un lector solo
-- puede leer (mismo patrón que el resto de las tablas post
-- 20260805215000_agregar_rol_lector_solo_lectura).
create table public.compromisos (
  id uuid primary key default gen_random_uuid(),
  "indicadorId" text not null,
  "indicadorName" text,
  mes text,
  accion text not null,
  responsable text,
  "fechaCompromiso" date,
  "fechaCreacion" date,
  "valorBase" numeric,
  "higherEsMejor" boolean,
  estado text not null default 'Pendiente',
  "valorFinal" numeric,
  "fechaResolucion" date,
  created_at timestamptz not null default now()
);

create index idx_compromisos_estado on public.compromisos(estado);
create index idx_compromisos_indicador on public.compromisos("indicadorId");

alter table public.compromisos enable row level security;

create policy "operacional_select" on public.compromisos for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.compromisos for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.compromisos for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.compromisos for delete to authenticated using (privado.es_editor_activo());
