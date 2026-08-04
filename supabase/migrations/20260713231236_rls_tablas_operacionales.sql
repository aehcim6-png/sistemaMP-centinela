-- Operacionales: cualquier usuario activo (operador o admin) lee y escribe la fila completa.
do $$
declare t text;
begin
  foreach t in array array[
    'registros_pm','correctivos','movimientos_stock','historial_horometros',
    'neumaticos','neumaticos_mediciones','informes_falla','alertas','vencimientos',
    'componentes_mayores','inspecciones','analisis_aceite','ordenes_compra',
    'plan_semanal','plan_semanal_historico','gantt','destrabe',
    'disponibilidad_calculada','avance_data'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "operacional_rw" on public.%I for all to authenticated using (es_usuario_activo()) with check (es_usuario_activo())',
      t
    );
  end loop;
end $$;
