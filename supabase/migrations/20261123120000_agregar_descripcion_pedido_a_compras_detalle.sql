-- Descripción del pedido (23-nov-2026). El detalle de cada línea de compra viene recortado a 25 caracteres en el Excel de compras;
-- la planilla «PI y Orden de Compra» trae una descripción por pedido sin recorte («Servicio de montaje y desmontaje de neumaticos»).
-- Se guarda aparte, en una columna nueva, para no mezclar el resumen del pedido con el nombre de cada línea. Es el mismo texto para todas
-- las líneas del pedido; si el pedido tiene más de una descripción se unen con « / ». Solo se llena cuando agrega información
-- (más de 25 caracteres y distinta del detalle de la línea). Las políticas y permisos de la tabla no cambian.
alter table public.compras_detalle add column if not exists "descripcionPedido" text;
comment on column public.compras_detalle."descripcionPedido" is 'Descripción completa del pedido (PI) según la planilla de control de OC; el detalle de la línea viene recortado a 25 caracteres.';
