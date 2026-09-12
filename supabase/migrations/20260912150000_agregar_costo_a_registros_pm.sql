-- Costo de PM (2026-09-12, pedido del usuario tras descartar "vida
-- económica óptima" por falta de datos reales de costo preventivo vs.
-- correctivo — ver sección "Correlación Aceite ↔ Fallas reales" de
-- arquitectura.md). Hoy `correctivos.costo` existe (opcional) pero
-- `registros_pm` no tiene NINGÚN campo de costo — sin este campo, nunca se
-- podrá comparar costo preventivo real contra costo correctivo real, sin
-- importar cuánto tiempo pase. Aditivo y nullable: no rompe ninguna fila
-- existente ni ningún llamador que todavía no lo use.
alter table public.registros_pm add column if not exists costo numeric;
