-- Formaliza columnas que existen en la base real pero nunca tuvieron una
-- migración propia en el repo — mismo espíritu que
-- 20260911120000_formaliza_tablas_creadas_a_mano.sql (que hizo lo mismo con
-- tablas completas), esta vez con columnas puntuales agregadas a mano en
-- algún momento entre agosto y septiembre de 2026.
--
-- Encontrado en auditoría (2026-09-14): comparando
-- mcp__Supabase__list_migrations (71 migraciones aplicadas en la base real)
-- contra los archivos locales de supabase/migrations/ (57), 14 nombres de
-- migración no tenían ningún archivo correspondiente en el repo. De esas,
-- 2 (crear_historial_componentes/crear_historial_neumaticos) ya quedaban
-- cubiertas por la migración de tablas de arriba, 1
-- (agregar_historial_neumaticos) resultó ser un duplicado sin columnas
-- nuevas reales, y 5 (cargar_whatsapp_equipos_batch_00..04) fueron cargas
-- de DATOS históricos reales, no de esquema — no se reconstruyen acá
-- porque no hay forma de saber su contenido exacto sin inventarlo, y ya
-- están cubiertas por el respaldo diario + script de restauración (ver
-- sección 9b de arquitectura.md), que si es fiel al esquema real.
-- Quedan estas 6 columnas + 1 índice, verificados contra el esquema real
-- (information_schema.columns / pg_indexes) antes de escribir esto, no
-- inventados:
alter table public.configuracion add column if not exists "alertaEmails" text;
alter table public.configuracion add column if not exists "presupuestoMensual" numeric;
alter table public.correctivos add column if not exists fotos jsonb;
alter table public.correctivos add column if not exists "primeraAtencionEn" timestamptz;
alter table public.sensores_neumaticos add column if not exists "horomInstalacion" numeric;
alter table public.sensores_neumaticos add column if not exists "horasAcum" numeric;
create index if not exists idx_destrabe_id_orden_compra on public.destrabe("idOrdenCompra");
