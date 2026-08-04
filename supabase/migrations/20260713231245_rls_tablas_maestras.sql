-- Maestras: cualquier usuario activo lee; solo admin activo inserta/actualiza/borra.
do $$
declare t text;
begin
  foreach t in array array[
    'pautas','tabla_precios_maestro','configuracion','tarifa_hh','meta_disponibilidad','metas','programa'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "maestra_select" on public.%I for select to authenticated using (es_usuario_activo())', t);
    execute format('create policy "maestra_insert" on public.%I for insert to authenticated with check (es_admin_activo())', t);
    execute format('create policy "maestra_update" on public.%I for update to authenticated using (es_admin_activo()) with check (es_admin_activo())', t);
    execute format('create policy "maestra_delete" on public.%I for delete to authenticated using (es_admin_activo())', t);
  end loop;
end $$;
