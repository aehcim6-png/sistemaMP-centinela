-- Permisos explícitos para la API de datos (2026-10-21).
--
-- Por qué: desde el 30-oct-2026 Supabase deja de otorgar automáticamente SELECT/INSERT/UPDATE/DELETE (ni EXECUTE en funciones,
-- ni USAGE en secuencias) a anon, authenticated y service_role sobre lo que se cree en `public`. Las tablas que ya existen en
-- los proyectos vivos conservan sus permisos; pero un proyecto nuevo, una rama de prueba o un `supabase db reset` que recree el
-- esquema desde estas migraciones quedaría con la API en «permission denied» (error 42501), porque ninguna migración anterior
-- escribe un GRANT (dependían de los permisos automáticos).
--
-- Qué hace: da a las tablas que existen en este punto de la cadena de migraciones los mismos permisos que ya tienen en vivo,
-- salvo `anon`: la app exige iniciar sesión (todas las políticas RLS piden un usuario activo), así que anon no necesita nada.
--   · authenticated: SELECT, INSERT, UPDATE, DELETE (lo que cada fila permite lo sigue decidiendo RLS)
--   · service_role: igual (las Edge Functions con la clave de servicio saltan RLS pero NO los permisos de tabla)
--   · excepción: auditoria_cambios es de solo agregar, authenticated solo SELECT e INSERT
--   · la única secuencia (user_roles_id_seq) la usa solo el servicio
-- Es idempotente y no cambia nada en los proyectos vivos (ya tienen estos permisos). No toca los de anon.
--
-- REGLA DESDE AHORA: toda migración posterior a esta que cree una tabla, función o secuencia en `public` debe incluir sus
-- GRANT en el mismo archivo (ver la plantilla en docs/manual-admin.md). tests/migracionesGrants.test.js lo comprueba.

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t.relname);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t.relname);
  end loop;

  -- bitácora de cambios: solo se agrega (nadie edita ni borra su propio rastro)
  if to_regclass('public.auditoria_cambios') is not null then
    revoke update, delete, truncate on public.auditoria_cambios from authenticated;
  end if;

  -- id autoincremental de user_roles: lo escribe solo la Edge Function crear-operador (service_role)
  if to_regclass('public.user_roles_id_seq') is not null then
    grant usage, select on sequence public.user_roles_id_seq to service_role;
  end if;
end
$$;
