-- Adelanta el cambio de Supabase del 30-oct-2026 (2026-10-21): lo que se cree de ahora en adelante en `public` ya NO recibe permisos
-- automáticos para anon, authenticated ni service_role. Cada tabla, función o secuencia nueva necesita su GRANT explícito en la misma
-- migración (plantilla en docs/manual-admin.md; tests/migracionesGrants.test.js lo comprueba).
--
-- No afecta a nada de lo que ya existe: solo cambia los permisos por defecto de los objetos que se creen después (y solo los que
-- crea el rol postgres, que es el que usan las migraciones). Aplicado a mano con la misma sentencia que documenta Supabase
-- («Securing your API → Default privileges for new tables and functions»), pero con `all` en tablas y secuencias para que tampoco
-- queden REFERENCES/TRIGGER/TRUNCATE automáticos.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;
