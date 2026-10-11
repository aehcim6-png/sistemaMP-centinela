-- Costo de una hora detenida (US$/h) editable por el usuario en Configuración > Tarifas y Metas (2026-10-11).
-- Lo usan el Buscador (ficha de componente), TBO (reemplazo óptimo, presupuesto) y el Score de Salud de los equipos.
-- Aditivo y nullable: null = se usa el valor predeterminado del programa (US$135/h). Aplicada en ambas bases.
alter table public.configuracion add column if not exists "costoHoraDetUSD" numeric;
