-- Horas hombre por orden de trabajo del histórico (18-nov-2026).
-- La columna «Horas (h/h)» del Excel ORDENES_DE_TRABAJO (3.612 órdenes, 9.856 horas hombre) no se había cargado: la tabla no tenía dónde guardarla.
-- Son horas de trabajo de la persona, no la duración de la orden (con varias personas la duración es menor). Nulo = no se sabe. La tabla ya tiene sus permisos.
alter table public.correctivos_historico add column if not exists "horasHH" numeric check ("horasHH" is null or "horasHH" >= 0);
