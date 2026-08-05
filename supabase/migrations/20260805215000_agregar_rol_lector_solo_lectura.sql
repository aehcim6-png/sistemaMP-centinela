-- Modo "solo lectura" (rol nuevo 'lector' en user_roles.role, texto libre,
-- sin CHECK que tocar). Fase de BACKEND únicamente — la UI todavía no
-- oculta botones de editar/eliminar para este rol, queda para un paso
-- aparte; lo que importa acá es que la base de datos rechace la escritura
-- de verdad, sin depender de que el frontend se porte bien.
--
-- privado.es_usuario_activo() sigue significando "cualquier rol activo,
-- incluido lector" — se usa tal cual para SELECT en todos lados (un lector
-- tiene que poder VER todo). La pieza nueva es privado.es_editor_activo():
-- activo Y (admin U operador) — reemplaza a es_usuario_activo() en los
-- INSERT/UPDATE/DELETE de las tablas operacionales. admin/operador quedan
-- exactamente igual que hoy (es_editor_activo() es true para ambos); el
-- único cambio de comportamiento real es para 'lector'.
create or replace function privado.es_editor_activo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.activo = true and ur.role in ('admin','operador')
  );
$$;

-- Tablas con una sola política ALL (creada por rls_tablas_operacionales /
-- rls_changelog_y_mixtas / migraciones posteriores de tablas nuevas) — se
-- reemplaza por 4 políticas separadas: SELECT sigue abierto a cualquier
-- usuario activo, INSERT/UPDATE/DELETE pasan a exigir es_editor_activo().
do $$
declare t text;
begin
  foreach t in array array[
    'alertas','analisis_aceite','avance_data','componentes_mayores','correctivos',
    'destrabe','disponibilidad_calculada','gantt','historial_horometros','informes_falla',
    'inspecciones','mapeo_repuestos','movimientos_stock','neumaticos','neumaticos_mediciones',
    'ordenes_compra','ordenes_compra_historico','plan_semanal','plan_semanal_historico',
    'registros_pm','sensores_neumaticos','tren_rodaje','tren_rodaje_mediciones','vencimientos'
  ]
  loop
    execute format('drop policy if exists "operacional_rw" on public.%I', t);
    execute format('create policy "operacional_select" on public.%I for select to authenticated using (privado.es_usuario_activo())', t);
    execute format('create policy "operacional_insert" on public.%I for insert to authenticated with check (privado.es_editor_activo())', t);
    execute format('create policy "operacional_update" on public.%I for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo())', t);
    execute format('create policy "operacional_delete" on public.%I for delete to authenticated using (privado.es_editor_activo())', t);
  end loop;
end $$;

-- Tablas "mixtas" (equipos/lubricantes/repuestos/stock_filtros): ya tenían
-- SELECT/INSERT/UPDATE/DELETE separados (DELETE ya era admin-only desde
-- 20260714155411). Se sube el piso de INSERT/UPDATE de es_usuario_activo()
-- a es_editor_activo() — sin cambio para admin/operador, bloquea a lector.
do $$
declare t text;
begin
  foreach t in array array['equipos','lubricantes','repuestos','stock_filtros']
  loop
    execute format('drop policy if exists "mixta_rw_insert" on public.%I', t);
    execute format('create policy "mixta_rw_insert" on public.%I for insert to authenticated with check (privado.es_editor_activo())', t);
    execute format('drop policy if exists "mixta_rw_update" on public.%I', t);
    execute format('create policy "mixta_rw_update" on public.%I for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo())', t);
  end loop;
end $$;

-- Papelera: SELECT se queda abierto (un lector puede ver qué se borró),
-- INSERT/DELETE (mover a la papelera / restaurar-purgar) pasan a exigir
-- es_editor_activo() — moverla o vaciarla es una acción de escritura.
drop policy if exists "papelera_insert" on public.papelera;
create policy "papelera_insert" on public.papelera for insert to authenticated with check (privado.es_editor_activo());
drop policy if exists "papelera_delete" on public.papelera;
create policy "papelera_delete" on public.papelera for delete to authenticated using (privado.es_editor_activo());

-- programacion_diaria: mismo criterio, políticas con nombre en español de
-- su propia migración (20260716170909).
drop policy if exists "usuarios activos escriben programacion_diaria" on public.programacion_diaria;
create policy "editores escriben programacion_diaria" on public.programacion_diaria for insert to authenticated with check (privado.es_editor_activo());
drop policy if exists "usuarios activos actualizan programacion_diaria" on public.programacion_diaria;
create policy "editores actualizan programacion_diaria" on public.programacion_diaria for update to authenticated using (privado.es_editor_activo());
drop policy if exists "usuarios activos borran programacion_diaria" on public.programacion_diaria;
create policy "editores borran programacion_diaria" on public.programacion_diaria for delete to authenticated using (privado.es_editor_activo());

-- Fuera de alcance a propósito en esta migración (documentado, no
-- olvidado): 'kv' (banderas de migración legacy, sin datos de negocio) y
-- el INSERT de 'changelog' (ya es best-effort/optimista desde el cliente,
-- no depende de que la escritura real haya tenido éxito — tocarlo es un
-- cambio de comportamiento más grande que "agregar un rol de solo
-- lectura"). Las tablas "maestra_*" (configuracion, pautas, programa,
-- tarifa_hh, metas, meta_disponibilidad, tabla_precios_maestro) ya exigían
-- admin para escribir — un lector ya estaba bloqueado ahí, igual que un
-- operador.
