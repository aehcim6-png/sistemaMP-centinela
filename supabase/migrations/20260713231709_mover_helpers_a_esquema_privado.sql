create schema if not exists privado;

create or replace function privado.es_usuario_activo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.activo = true
  );
$$;

create or replace function privado.es_admin_activo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.activo = true and ur.role = 'admin'
  );
$$;

create or replace function privado.proteger_columnas_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if privado.es_admin_activo() then
    return new;
  end if;

  if TG_TABLE_NAME = 'equipos' then
    if new.sigla is distinct from old.sigla
      or new.tipo is distinct from old.tipo
      or new.modelo is distinct from old.modelo
      or new."frecPM" is distinct from old."frecPM"
      or new."hrsDia" is distinct from old."hrsDia"
      or new."valorCompra" is distinct from old."valorCompra"
      or new.proveedor is distinct from old.proveedor
      or new.contrato is distinct from old.contrato
      or new."garantiaHasta" is distinct from old."garantiaHasta"
      or new."numSerie" is distinct from old."numSerie"
      or new.vin is distinct from old.vin
      or new."anioFab" is distinct from old."anioFab"
      or new."fechaCompra" is distinct from old."fechaCompra"
    then
      raise exception 'Solo un administrador puede modificar los datos maestros de este equipo (sigla/tipo/modelo/frecPM/hrsDia/valorCompra/proveedor/contrato/garantiaHasta/numSerie/vin/anioFab/fechaCompra)';
    end if;
  elsif TG_TABLE_NAME in ('stock_filtros','repuestos') then
    if new."precioUnit" is distinct from old."precioUnit" then
      raise exception 'Solo un administrador puede modificar el precio unitario';
    end if;
  elsif TG_TABLE_NAME = 'lubricantes' then
    if new.precio is distinct from old.precio then
      raise exception 'Solo un administrador puede modificar el precio';
    end if;
  end if;

  return new;
end;
$$;

-- Revocar todo acceso público a las funciones viejas expuestas y dejarlas como stubs inertes
revoke execute on function public.es_usuario_activo() from public, anon, authenticated;
revoke execute on function public.es_admin_activo() from public, anon, authenticated;
revoke execute on function public.proteger_columnas_admin() from public, anon, authenticated;

-- Re-crear cada política y trigger para que usen las funciones del esquema privado
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
    execute format('drop policy "operacional_rw" on public.%I', t);
    execute format(
      'create policy "operacional_rw" on public.%I for all to authenticated using (privado.es_usuario_activo()) with check (privado.es_usuario_activo())',
      t
    );
  end loop;

  foreach t in array array['pautas','tabla_precios_maestro','configuracion','tarifa_hh','meta_disponibilidad','metas','programa']
  loop
    execute format('drop policy "maestra_select" on public.%I', t);
    execute format('drop policy "maestra_insert" on public.%I', t);
    execute format('drop policy "maestra_update" on public.%I', t);
    execute format('drop policy "maestra_delete" on public.%I', t);
    execute format('create policy "maestra_select" on public.%I for select to authenticated using (privado.es_usuario_activo())', t);
    execute format('create policy "maestra_insert" on public.%I for insert to authenticated with check (privado.es_admin_activo())', t);
    execute format('create policy "maestra_update" on public.%I for update to authenticated using (privado.es_admin_activo()) with check (privado.es_admin_activo())', t);
    execute format('create policy "maestra_delete" on public.%I for delete to authenticated using (privado.es_admin_activo())', t);
  end loop;

  foreach t in array array['equipos','stock_filtros','lubricantes','repuestos']
  loop
    execute format('drop policy "mixta_rw" on public.%I', t);
    execute format(
      'create policy "mixta_rw" on public.%I for all to authenticated using (privado.es_usuario_activo()) with check (privado.es_usuario_activo())',
      t
    );
    execute format('drop trigger proteger_columnas_admin on public.%I', t);
    execute format(
      'create trigger proteger_columnas_admin before update on public.%I for each row execute function privado.proteger_columnas_admin()',
      t
    );
  end loop;
end $$;

drop policy "changelog_select" on public.changelog;
drop policy "changelog_insert" on public.changelog;
drop policy "changelog_update" on public.changelog;
drop policy "changelog_delete" on public.changelog;
create policy "changelog_select" on public.changelog for select to authenticated using (privado.es_usuario_activo());
create policy "changelog_insert" on public.changelog for insert to authenticated with check (privado.es_usuario_activo());
create policy "changelog_update" on public.changelog for update to authenticated using (privado.es_admin_activo()) with check (privado.es_admin_activo());
create policy "changelog_delete" on public.changelog for delete to authenticated using (privado.es_admin_activo());

drop function public.es_usuario_activo();
drop function public.es_admin_activo();
drop function public.proteger_columnas_admin();
