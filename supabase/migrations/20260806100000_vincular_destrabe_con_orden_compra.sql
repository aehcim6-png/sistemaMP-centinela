-- Vínculo entre "Gestión de Destrabe" (trabajo bloqueado, ej. por falta de repuesto)
-- y "ordenes_compra" (la OC generada desde Control de Repuestos) — hoy son dos
-- tablas que nunca se hablan: el destrabe se resuelve a mano y la OC se crea y
-- queda "Pendiente" para siempre, sin pantalla para marcarla recibida ni nada que
-- avise cuando llega. Inspirado en el manual OTR de Besalco Maquinarias (la OT
-- ligada a un PI/OC se cierra sola cuando la compra llega) — acá el equivalente es
-- que la fila de destrabe se resuelva sola cuando la OC vinculada se marca
-- recibida (ver resolverDestrabePorOC() en logic.js). No se liga directo el
-- correctivo (OT): que llegue el repuesto no confirma que el trabajo ya se hizo.
alter table public.destrabe
  add column if not exists "idOrdenCompra" uuid references public.ordenes_compra(id) on delete set null;
