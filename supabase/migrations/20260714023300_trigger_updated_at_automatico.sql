create or replace function public.actualizar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'equipos','programa','vencimientos','configuracion',
    'tarifa_hh','meta_disponibilidad','metas','disponibilidad_calculada','avance_data'
  ]
  loop
    execute format(
      'create trigger actualizar_updated_at before update on public.%I for each row execute function public.actualizar_updated_at()',
      t
    );
  end loop;
end $$;
