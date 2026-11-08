-- Análisis FODA (8-nov-2026): fortalezas, debilidades, oportunidades y amenazas con puntaje 1 a 5, y las estrategias cruzadas
-- (FO ofensivas, FA defensivas, DO de reorientación, DA de supervivencia) con su estado de plan de acción.
-- Todos los perfiles activos pueden VER; solo un administrador puede crear, editar o borrar (lo hace cumplir la base, no solo la pantalla).
-- "ref" es un identificador de texto estable que se genera en el navegador: las estrategias apuntan a las filas por ref, no por el
-- código F1/O2 (que cambia si se borra una fila). "origen" guarda de qué sugerencia del sistema vino la fila (null si se escribió a mano).
create table if not exists public.foda_items (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  tipo text not null check (tipo in ('F', 'D', 'O', 'A')),
  texto text not null check (length(btrim(texto)) > 0),
  puntaje integer not null default 3 check (puntaje between 1 and 5),
  origen text,
  usuario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_foda_items_tipo on public.foda_items (tipo, created_at);

create table if not exists public.foda_estrategias (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  "refA" text not null,
  "refB" text not null,
  cruce text not null check (cruce in ('FO', 'FA', 'DO', 'DA')),
  texto text not null check (length(btrim(texto)) > 0),
  responsable text,
  "fechaCompromiso" date,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'En proceso', 'Culminado')),
  observaciones text,
  usuario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_foda_estrategias_estado on public.foda_estrategias (estado, cruce);

alter table public.foda_items enable row level security;
create policy "foda_select" on public.foda_items for select to authenticated using (privado.es_usuario_activo());
create policy "foda_insert" on public.foda_items for insert to authenticated with check (privado.es_admin_activo());
create policy "foda_update" on public.foda_items for update to authenticated using (privado.es_admin_activo()) with check (privado.es_admin_activo());
create policy "foda_delete" on public.foda_items for delete to authenticated using (privado.es_admin_activo());
create trigger actualizar_updated_at before update on public.foda_items
  for each row execute function public.actualizar_updated_at();
grant select, insert, update, delete on table public.foda_items to authenticated;
grant select, insert, update, delete on table public.foda_items to service_role;

alter table public.foda_estrategias enable row level security;
create policy "foda_select" on public.foda_estrategias for select to authenticated using (privado.es_usuario_activo());
create policy "foda_insert" on public.foda_estrategias for insert to authenticated with check (privado.es_admin_activo());
create policy "foda_update" on public.foda_estrategias for update to authenticated using (privado.es_admin_activo()) with check (privado.es_admin_activo());
create policy "foda_delete" on public.foda_estrategias for delete to authenticated using (privado.es_admin_activo());
create trigger actualizar_updated_at before update on public.foda_estrategias
  for each row execute function public.actualizar_updated_at();
grant select, insert, update, delete on table public.foda_estrategias to authenticated;
grant select, insert, update, delete on table public.foda_estrategias to service_role;
