-- Supuestos de la pantalla "Arriendo vs compra" (Costos): UF, precio del diésel, costo de operador y de mecánico, disponibilidades, y por modelo la dotación, los litros por carga y las tarifas de arriendo.
-- Un solo jsonb { ...generales, modelos: { clave_modelo_normalizado: {...} } }; null = valores sugeridos del programa. Aditivo y nullable.
alter table public.configuracion add column if not exists "arriendoVsCompra" jsonb;
