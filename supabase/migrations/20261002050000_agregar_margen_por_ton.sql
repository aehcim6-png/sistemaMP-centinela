-- Margen por tonelada ($/ton), campo opcional en Configuración > Tarifas y
-- Metas (ninguna empresa lo trae cargado por defecto). Sin este dato, Costo
-- de Downtime (logic.js costoDowntimeMes) no se calcula — nunca se inventa
-- un valor de tonelada supuesto, mismo criterio que presupuestoMensual.
alter table public.configuracion add column if not exists "margenPorTon" numeric;
