-- changelog: bitácora de auditoría — todos pueden insertar y leer, nadie (salvo admin) edita/borra.
alter table public.changelog enable row level security;
create policy "changelog_select" on public.changelog for select to authenticated using (es_usuario_activo());
create policy "changelog_insert" on public.changelog for insert to authenticated with check (es_usuario_activo());
create policy "changelog_update" on public.changelog for update to authenticated using (es_admin_activo()) with check (es_admin_activo());
create policy "changelog_delete" on public.changelog for delete to authenticated using (es_admin_activo());

-- Mixtas: a nivel de fila, igual que operacionales (operador+admin activos pueden tocarla).
-- La restricción por columna la hace el trigger de más abajo, no RLS.
do $$
declare t text;
begin
  foreach t in array array['equipos','stock_filtros','lubricantes','repuestos']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "mixta_rw" on public.%I for all to authenticated using (es_usuario_activo()) with check (es_usuario_activo())',
      t
    );
  end loop;
end $$;

-- Trigger: bloquea a un no-admin si intenta cambiar columnas "maestras" dentro de una fila mixta.
create or replace function public.proteger_columnas_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if es_admin_activo() then
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

do $$
declare t text;
begin
  foreach t in array array['equipos','stock_filtros','lubricantes','repuestos']
  loop
    execute format(
      'create trigger proteger_columnas_admin before update on public.%I for each row execute function public.proteger_columnas_admin()',
      t
    );
  end loop;
end $$;
