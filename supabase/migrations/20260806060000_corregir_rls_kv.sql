-- Corrige un hallazgo real de la auditoría propia (2026-08-06): la tabla 'kv'
-- (banderas legacy + antiguo mirror de datos previo a la migración a tablas
-- reales) tenía una sola política ALL con el chequeo de "activo=true" escrito
-- a mano, en vez de pasar por privado.es_usuario_activo()/es_editor_activo()
-- como el resto de las tablas. Dos consecuencias reales:
--   1. No pasaba por el fix de aal2/MFA agregado hoy más temprano (esas dos
--      funciones son las únicas que lo aplican) — un usuario con MFA activado
--      pero sin haber completado el segundo paso podía igual leer/escribir kv.
--   2. No distinguía rol: el rol 'lector' (solo lectura, agregado esta sesión)
--      podía INSERTAR/ACTUALIZAR/BORRAR en kv, contradiciendo su propósito.
--
-- Verificado antes de corregir: _sbLoadHeavy() SÍ sigue leyendo 'kv' al
-- arrancar (es el respaldo si falla el refresco de alguna tabla real — ver
-- comentario en modules/store.js), así que SELECT debe seguir permitido para
-- cualquier usuario activo. Pero NINGUNA categoría usada hoy por S.g()/S.s()
-- en toda la app cae ya en el camino genérico que escribe en kv (_sbWrite) —
-- todas están mapeadas a TABLA_REAL/TABLA_SINGLETON/venc — así que escribir
-- ahí ya no lo necesita nadie del código actual. Se separa en el mismo patrón
-- de 4 políticas ya usado por las ~21 tablas "operacionales" del proyecto.
drop policy if exists "smp_acceso_operador_activo" on public.kv;

create policy "operacional_select" on public.kv for select
to authenticated
using (privado.es_usuario_activo());

create policy "operacional_insert" on public.kv for insert
to authenticated
with check (privado.es_editor_activo());

create policy "operacional_update" on public.kv for update
to authenticated
using (privado.es_editor_activo())
with check (privado.es_editor_activo());

create policy "operacional_delete" on public.kv for delete
to authenticated
using (privado.es_editor_activo());
