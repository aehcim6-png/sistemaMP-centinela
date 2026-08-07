-- Histórico del Índice de Salud de Flota (composite score de Dashboard: Cumplimiento
-- PM + Disponibilidad + Stock sano + Confiabilidad), un snapshot diario para poder
-- mostrar tendencia semana a semana. Singleton "modo:datos" (una fila, jsonb
-- {fecha: valor}) — mismo patrón que disponibilidad_calculada/avance_data/metas.
create table public.salud_flota_historico (
  id boolean primary key default true check (id),
  datos jsonb,
  updated_at timestamptz not null default now()
);

alter table public.salud_flota_historico enable row level security;
create policy "operacional_select" on public.salud_flota_historico for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.salud_flota_historico for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.salud_flota_historico for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.salud_flota_historico for delete to authenticated using (privado.es_editor_activo());

create trigger actualizar_updated_at before update on public.salud_flota_historico for each row execute function public.actualizar_updated_at();
