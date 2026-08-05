-- Papelera: registro de filas eliminadas de cualquier tabla real, con retención
-- de 30 días (la purga de filas vencidas la hace el propio frontend al abrir la
-- Papelera, no un cron — no se justifica más infraestructura para un panel de
-- uso ocasional). 'fila' guarda el objeto JS completo tal cual estaba antes de
-- borrarse, incluida su clave real, para poder reinsertarlo sin lógica especial
-- al restaurar (mismo camino de S.s() que cualquier alta nueva).
create table public.papelera (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  fila jsonb not null,
  "fechaEliminacion" timestamptz not null default now(),
  "eliminadoPor" text,
  created_at timestamptz not null default now()
);

alter table public.papelera enable row level security;
create policy "papelera_select" on public.papelera for select to authenticated using (es_usuario_activo());
create policy "papelera_insert" on public.papelera for insert to authenticated with check (es_usuario_activo());
create policy "papelera_update" on public.papelera for update to authenticated using (es_admin_activo()) with check (es_admin_activo());
create policy "papelera_delete" on public.papelera for delete to authenticated using (es_admin_activo());
