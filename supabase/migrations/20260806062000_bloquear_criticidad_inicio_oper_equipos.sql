-- Corrige un hallazgo real de la auditoría propia (2026-08-06): el trigger que
-- bloquea los "datos maestros" de equipos para no-admin (sigla/tipo/modelo/
-- frecPM/hrsDia/valorCompra/proveedor/contrato/garantiaHasta/numSerie/vin/
-- anioFab/fechaCompra) quedó desactualizado cuando se agregaron las columnas
-- 'criticidad' e 'inicioOper' — nunca se sumaron a la lista, aunque viven en
-- el mismo formulario de Ficha Técnica que el resto de los campos ya
-- protegidos (modules/renders/eq.js, editFicha/saveFicha). Confirmado con el
-- usuario: ambos campos deben quedar solo-admin, igual que el resto.
create or replace function privado.proteger_columnas_admin()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      or new.criticidad is distinct from old.criticidad
      or new."inicioOper" is distinct from old."inicioOper"
    then
      raise exception 'Solo un administrador puede modificar los datos maestros de este equipo (sigla/tipo/modelo/frecPM/hrsDia/valorCompra/proveedor/contrato/garantiaHasta/numSerie/vin/anioFab/fechaCompra/criticidad/inicioOper)';
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
$function$;
