-- Purga automática de la papelera (2026-09-14) — el comentario original de
-- la tabla (20260805194000_crear_tabla_papelera.sql) ya decía "retención 30
-- días" y que una fila se va cuando "se restaura o se purga" — pero el purge
-- nunca se implementó: nadie corría un DELETE manual ni existía un cron.
-- Sin esto la papelera crece sin límite para siempre (auditoría externa
-- 2026-09-13, verificado contra la base real: no existía ninguna función ni
-- cron job de purga, solo el de uso_pestanas).
--
-- Mismo mecanismo ya probado que uso_pestanas
-- (20260817050000_crear_tabla_uso_pestanas.sql): DELETE de SQL puro vía
-- pg_cron, sin Edge Function ni secreto — no hace falta, es un borrado
-- interno de Postgres. 30 días, igual que documenta la tabla desde que se
-- creó.
select cron.schedule(
  'purgar-papelera',
  '0 6 * * *',
  $$ delete from public.papelera where "fechaEliminacion" < now() - interval '30 days'; $$
);
