-- Marca de origen en correctivos y registros_pm (28-oct-2026): distingue lo cargado desde WhatsApp, el programa semanal u otros
-- Excel de lo que se digita en la app. Texto libre corto; null = digitado en la app. No es una tabla ni función nueva: no requiere GRANT.
alter table public.correctivos add column if not exists origen text;
alter table public.registros_pm add column if not exists origen text;
comment on column public.correctivos.origen is 'De dónde viene la fila si no se digitó en la app (ej. WhatsApp 2026-10-28). null = digitada en la app.';
comment on column public.registros_pm.origen is 'De dónde viene la fila si no se digitó en la app (ej. Programa semanal 2026-10-28). null = digitada en la app.';
