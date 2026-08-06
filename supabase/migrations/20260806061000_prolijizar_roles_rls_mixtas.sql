-- Endurecimiento menor (auditoría 2026-08-06): las políticas SELECT y DELETE
-- de las 4 tablas "mixtas" (equipos, lubricantes, repuestos, stock_filtros)
-- quedaron con el rol 'public' en vez de 'authenticated' — inconsistente con
-- INSERT/UPDATE de esas mismas tablas y con el resto del proyecto. No era
-- explotable (qual sigue exigiendo auth.uid() contra user_roles, así que una
-- request anónima queda igual filtrada), pero no hay razón para que sea
-- distinto. Alinea el alcance de rol sin tocar la lógica de las políticas.
alter policy "mixta_rw_select" on public.equipos to authenticated;
alter policy "mixta_rw_delete" on public.equipos to authenticated;
alter policy "mixta_rw_select" on public.lubricantes to authenticated;
alter policy "mixta_rw_delete" on public.lubricantes to authenticated;
alter policy "mixta_rw_select" on public.repuestos to authenticated;
alter policy "mixta_rw_delete" on public.repuestos to authenticated;
alter policy "mixta_rw_select" on public.stock_filtros to authenticated;
alter policy "mixta_rw_delete" on public.stock_filtros to authenticated;
