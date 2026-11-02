-- Detector de calidad de datos (2026-11-02): lista las tablas temporales o de
-- respaldo que quedaron olvidadas en `public` (tmp_*, respaldo_*, *_backup*).
-- La usa la Edge Function vigilar-salud-sistema (solo lectura, con la clave de
-- servicio) para incluirlas en el correo diario; no toca ningún dato.
create or replace function public.tablas_temporales_olvidadas()
returns text[]
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(table_name::text order by table_name), '{}'::text[])
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
    and (table_name ~ '^(tmp_|temp_|respaldo_)' or table_name ~ '(_backup|_bak|_copia)(_|$)');
$$;

revoke all on function public.tablas_temporales_olvidadas() from public, anon, authenticated;
grant execute on function public.tablas_temporales_olvidadas() to service_role;
