-- Reparar texto mal codificado en correctivos: ubicación, criticidad y duración (18-nov-2026).
-- Quedó de la carga masiva de julio (947 de las 1.075 órdenes de ese mes); lo cargado en octubre y noviembre viene limpio, así que no hay una carga activa que lo siga produciendo.
-- UTF-8 leído como Latin-1 o Windows-1252: «Taller Besalco MinerÃ­a» (903 filas), «ReparaciÃ³n Inmediata» (431) y «â€”» en lugar de «—» (23, duración).
-- La reparación anterior (20261009130000) solo cubrió sistema, turno y tipo. Con «ReparaciÃ³n Inmediata» una orden de Fuera de Servicio crítica no calza con «Reparación Inmediata» en esFallaMTBF,
-- y cualquier filtro por ubicación o criticidad fallaba con esos textos.
-- Solo toca filas con «Ã», «Â» o «â€» y cuyo resultado queda sin esas marcas (si la conversión falla o no limpia, la fila queda como estaba). Prueba Latin-1 y, si no calza (el «€» no existe en Latin-1), Windows-1252.
-- Idempotente: en una base ya reparada, o vacía, no hace nada. Se revierte con el respaldo diario (backup-diario), o con tres UPDATE por valor exacto (los tres textos de arriba son los únicos dañados).
create or replace function pg_temp.fixmoji(t text) returns text language plpgsql as $$
declare r text;
begin
  begin r := convert_from(convert_to(t,'LATIN1'),'UTF8'); exception when others then r := null; end;
  if r is null then
    begin r := convert_from(convert_to(t,'WIN1252'),'UTF8'); exception when others then return t; end;
  end if;
  return r;
end $$;
update public.correctivos set ubicacion = pg_temp.fixmoji(ubicacion) where ubicacion ~ '(Ã|Â|â€)' and pg_temp.fixmoji(ubicacion) !~ '(Ã|Â|â€)';
update public.correctivos set criticidad = pg_temp.fixmoji(criticidad) where criticidad ~ '(Ã|Â|â€)' and pg_temp.fixmoji(criticidad) !~ '(Ã|Â|â€)';
update public.correctivos set duracion = pg_temp.fixmoji(duracion) where duracion ~ '(Ã|Â|â€)' and pg_temp.fixmoji(duracion) !~ '(Ã|Â|â€)';
