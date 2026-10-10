-- Contexto de ejecución del PM (2026-10-10). El formulario de Registro PM ya captura turno, operador,
-- ubicación, AST, LOTO y repuestos usados, pero la tabla no tenía dónde guardarlos y se perdían al
-- recargar. Aditivo y nullable: null = registro anterior a estos campos.
alter table public.registros_pm add column if not exists "turno" text;
alter table public.registros_pm add column if not exists "operador" text;
alter table public.registros_pm add column if not exists "ubicacion" text;
alter table public.registros_pm add column if not exists "ast" text;
alter table public.registros_pm add column if not exists "loto" text;
alter table public.registros_pm add column if not exists "repuestos" text;
