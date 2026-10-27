-- Cierre de OT con motivo de demora y tipo de reparación (2026-10-27).
-- Para poder responder «por qué demoró» y «se arregló de verdad o se parchó» hacen falta dos datos que hoy nadie anota (categoriaMTTR es otra cosa: accesibilidad,
-- diseño, información e intervención del análisis de mantenibilidad). Dos columnas de texto nuevas, sin valor por defecto: las OT antiguas quedan vacías y no se inventa nada.
--   · motivoDemora: por qué la reparación tardó lo que tardó (ver OT_MOTIVOS_DEMORA en logic.js). «Sin informar» si se cerró sin completar.
--   · reparacion: 'Definitiva', 'Provisoria' o 'Sin informar'. Una reparación provisoria crea sola una tarea pendiente en el backlog.
alter table public.correctivos add column if not exists "motivoDemora" text;
alter table public.correctivos add column if not exists reparacion text;
