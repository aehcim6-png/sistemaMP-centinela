
-- Las 4 tablas "mixtas" (equipos, stock_filtros, lubricantes, repuestos) tenían una
-- sola política ALL abierta a cualquier usuario activo. El trigger de columnas
-- protegidas solo actúa en UPDATE, así que un operador podía saltarse la protección
-- de precio/datos maestros borrando la fila y creándola de nuevo con los valores que
-- quisiera. Se separa DELETE a admin-only; INSERT/UPDATE/SELECT siguen abiertos
-- (son parte del flujo real de "+ Nuevo Equipo"/"+ Nuevo Stock" para operador).

drop policy if exists "mixta_rw" on public.equipos;
create policy "mixta_rw_select" on public.equipos for select using (privado.es_usuario_activo());
create policy "mixta_rw_insert" on public.equipos for insert with check (privado.es_usuario_activo());
create policy "mixta_rw_update" on public.equipos for update using (privado.es_usuario_activo()) with check (privado.es_usuario_activo());
create policy "mixta_rw_delete" on public.equipos for delete using (privado.es_admin_activo());

drop policy if exists "mixta_rw" on public.stock_filtros;
create policy "mixta_rw_select" on public.stock_filtros for select using (privado.es_usuario_activo());
create policy "mixta_rw_insert" on public.stock_filtros for insert with check (privado.es_usuario_activo());
create policy "mixta_rw_update" on public.stock_filtros for update using (privado.es_usuario_activo()) with check (privado.es_usuario_activo());
create policy "mixta_rw_delete" on public.stock_filtros for delete using (privado.es_admin_activo());

drop policy if exists "mixta_rw" on public.lubricantes;
create policy "mixta_rw_select" on public.lubricantes for select using (privado.es_usuario_activo());
create policy "mixta_rw_insert" on public.lubricantes for insert with check (privado.es_usuario_activo());
create policy "mixta_rw_update" on public.lubricantes for update using (privado.es_usuario_activo()) with check (privado.es_usuario_activo());
create policy "mixta_rw_delete" on public.lubricantes for delete using (privado.es_admin_activo());

drop policy if exists "mixta_rw" on public.repuestos;
create policy "mixta_rw_select" on public.repuestos for select using (privado.es_usuario_activo());
create policy "mixta_rw_insert" on public.repuestos for insert with check (privado.es_usuario_activo());
create policy "mixta_rw_update" on public.repuestos for update using (privado.es_usuario_activo()) with check (privado.es_usuario_activo());
create policy "mixta_rw_delete" on public.repuestos for delete using (privado.es_admin_activo());
