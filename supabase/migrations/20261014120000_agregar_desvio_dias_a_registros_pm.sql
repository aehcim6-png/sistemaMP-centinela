-- Desvío de cada PM contra su fecha esperada, en días (negativo o cero = a tiempo o anticipado, positivo = atrasado).
-- Antes se calculaba al registrar pero no se guardaba (la columna no existía ni estaba en la lista de columnas de store.js),
-- así que el % de Cumplimiento PM quedaba vacío al recargar desde la nube. Aditiva: no toca los registros ya guardados.
alter table public.registros_pm add column if not exists "desvioDias" numeric;
