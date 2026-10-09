-- Reparar texto mal codificado en correctivos (2026-10-09, paso 3 de Calidad de Ejecución).
-- UTF-8 leído como Latin-1 en una carga antigua: "DÃ­a" en vez de "Día", "ElÃ©ctrico" en vez de
-- "Eléctrico". En centinela afectaba turno (412 filas), sistema (223) y tipo (25); el resto de las
-- columnas de texto estaba limpio. Solo toca filas que contienen "Ã" y cuyo resultado queda sin
-- "Ã" (si la conversión falla o no limpia, la fila queda como estaba). Idempotente: en una base ya
-- reparada, o vacía, no hace nada. Reversible con el respaldo diario (backup-diario).
create or replace function pg_temp.fixmoji(t text) returns text language plpgsql as $$
begin return convert_from(convert_to(t,'LATIN1'),'UTF8'); exception when others then return t; end $$;
update public.correctivos set sistema = pg_temp.fixmoji(sistema) where sistema ~ 'Ã' and pg_temp.fixmoji(sistema) !~ 'Ã';
update public.correctivos set turno = pg_temp.fixmoji(turno) where turno ~ 'Ã' and pg_temp.fixmoji(turno) !~ 'Ã';
update public.correctivos set tipo = pg_temp.fixmoji(tipo) where tipo ~ 'Ã' and pg_temp.fixmoji(tipo) !~ 'Ã';
