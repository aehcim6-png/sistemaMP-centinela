-- Kardex unificado (2026-10-26): el kardex de insumos también cubre filtros, lubricantes y repuestos críticos.
-- Cada ítem de esas tres tablas puede tener un insumo «vinculado»: `origen` dice de qué tabla viene ('filtro' = stock_filtros, 'lubricante' = lubricantes, 'repuesto' = repuestos)
-- y `origenId` es el id de su fila. Un ítem sin origen es un insumo común (EPP, librería, limpieza…). El saldo sigue saliendo de los movimientos; las columnas de stock de las
-- tablas antiguas (stockBodega, stock, stockActual) quedan como copia del saldo para no romper las pantallas que ya las leen.
-- Antes la descripción era única por categoría; en stock_filtros hay descripciones repetidas (el mismo filtro para distintos modelos), así que esa regla pasa a valer solo
-- para los insumos sin origen, y los vinculados se identifican por (origen, origenId).
alter table public.insumos add column if not exists origen text check (origen in ('filtro', 'lubricante', 'repuesto'));
alter table public.insumos add column if not exists "origenId" uuid;
alter table public.insumos add constraint insumos_origen_completo check ((origen is null) = ("origenId" is null));
drop index if exists public.uq_insumos_categoria_descripcion;
create unique index if not exists uq_insumos_categoria_descripcion on public.insumos (categoria, upper(descripcion)) where origen is null;
create unique index if not exists uq_insumos_origen on public.insumos (origen, "origenId") where origen is not null;
