-- Carga más liviana al entrar a la app (11-nov-2026). La prueba de carga mostró que cada ingreso baja ~460 peticiones y que cada página de 500 filas
-- obliga a la base a ordenar la tabla completa por (created_at, id), porque no había índice: 23 a 300 ms por página, contra 8,5 ms con índice.
-- 1) Índice (created_at, id) en las tablas que la app lee por páginas con ese orden (las de más de 500 filas): la página sale del índice, sin ordenar.
-- 2) Columna updated_at (con su trigger) en las tablas grandes que no la tenían, e índice sobre ella: la app puede pedir solo lo que cambió desde su última visita
--    (carga incremental, ver _refetchTablaIncremental en modules/store.js) en vez de bajar la tabla entera. Las filas existentes quedan con updated_at = created_at.
-- Aditivo: no cambia ni borra datos, y la app sigue funcionando igual si esta migración no está aplicada (cae a la carga completa de siempre).
do $$
declare t text;
begin
  foreach t in array array['historial_horometros','ordenes_compra_historico','correctivos_historico','neumaticos_mediciones','movimientos_stock','correctivos','registros_pm','pautas','componentes_mayores'] loop
    -- las filas existentes quedan con updated_at = created_at (no todas con la hora de esta migración): así la carga incremental no vuelve a bajar filas viejas.
    -- Se llena ANTES de crear el trigger, que si no lo pisaría con now().
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'updated_at') then
      execute format('alter table public.%I add column updated_at timestamptz', t);
      execute format('update public.%I set updated_at = created_at', t);
      execute format('alter table public.%I alter column updated_at set default now()', t);
      execute format('update public.%I set updated_at = now() where updated_at is null', t);
      execute format('alter table public.%I alter column updated_at set not null', t);
    end if;
    execute format('drop trigger if exists actualizar_updated_at on public.%I', t);
    execute format('create trigger actualizar_updated_at before update on public.%I for each row execute function public.actualizar_updated_at()', t);
  end loop;
  foreach t in array array['historial_horometros','reportabilidad_diaria','compras_detalle','ordenes_compra_historico','correctivos_historico','neumaticos_mediciones','movimientos_stock','correctivos','registros_pm','pautas','componentes_mayores'] loop
    execute format('create index if not exists %I on public.%I (created_at, id)', 'idx_' || t || '_created_at_id', t);
    execute format('create index if not exists %I on public.%I (updated_at)', 'idx_' || t || '_updated_at', t);
  end loop;
end $$;
