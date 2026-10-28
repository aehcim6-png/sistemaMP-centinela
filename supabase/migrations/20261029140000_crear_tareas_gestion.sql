-- Tareas de gestión (29-oct-2026, paso 3 «reglas que fuerzan y escalan»): lo que el sistema obliga a hacer y no se puede dejar pasar.
-- Una tarea nace de una regla (origen): un «pedir ya» del plan de compras, una falla repetida que exige acción, un hallazgo de PM, o se agrega a mano.
-- Tiene responsable y fecha límite; si vence sin cerrarse, la pantalla la marca «Vencida» y, con unos días de atraso, «Escalada» a la jefatura.
-- `clave` evita duplicados (la misma regla no crea dos veces la misma tarea). Una tarea cerrada no se borra: queda «Hecha», «Descartada» o «Resuelta sola».
create table if not exists public.tareas_gestion (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  origen text not null default 'manual' check (origen in ('pedir_ya', 'falla_repetida', 'pm_backlog', 'manual')),
  sigla text,
  titulo text not null,
  detalle text,
  responsable text,
  "fechaLimite" date,
  estado text not null default 'Abierta' check (estado in ('Abierta', 'Hecha', 'Descartada', 'Resuelta sola')),
  "fechaCierre" date,
  referencia text,
  observacion text,
  usuario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_tareas_gestion_clave on public.tareas_gestion (clave);
create index if not exists idx_tareas_gestion_estado on public.tareas_gestion (estado, "fechaLimite");

alter table public.tareas_gestion enable row level security;
create policy "operacional_select" on public.tareas_gestion for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.tareas_gestion for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.tareas_gestion for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.tareas_gestion for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.tareas_gestion
  for each row execute function public.actualizar_updated_at();

grant select, insert, update, delete on table public.tareas_gestion to authenticated;
grant select, insert, update, delete on table public.tareas_gestion to service_role;
