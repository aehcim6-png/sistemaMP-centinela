-- Amortización por hora y vida contable del equipo (2026-10-11): son datos financieros maestros, igual que valorCompra, así que solo un administrador puede modificarlos.
-- Lección de la auditoría 2026-08-06 (criticidad/inicioOper quedaron fuera del trigger al agregarse): las columnas nuevas se suman a la lista de inmediato.
-- Idéntica a la definición vigente (20260806062000) más "valorHoraAmort" y "vidaContableH".
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
      or new."valorHoraAmort" is distinct from old."valorHoraAmort"
      or new."vidaContableH" is distinct from old."vidaContableH"
    then
      raise exception 'Solo un administrador puede modificar los datos maestros de este equipo (sigla/tipo/modelo/frecPM/hrsDia/valorCompra/proveedor/contrato/garantiaHasta/numSerie/vin/anioFab/fechaCompra/criticidad/inicioOper/valorHoraAmort/vidaContableH)';
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
