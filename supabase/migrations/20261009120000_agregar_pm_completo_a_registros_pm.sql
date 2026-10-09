-- ¿PM completo según pauta? (2026-10-09). La pauta dice lo que DEBERÍA hacerse en un PM,
-- pero nunca se guardó si se hizo todo ni qué faltó (ej. un filtro secundario sin cambiar
-- por quiebre de stock). Aditivo y nullable: null = registro anterior a este campo.
alter table public.registros_pm add column if not exists "pmCompleto" boolean;
alter table public.registros_pm add column if not exists "queFalto" text;
