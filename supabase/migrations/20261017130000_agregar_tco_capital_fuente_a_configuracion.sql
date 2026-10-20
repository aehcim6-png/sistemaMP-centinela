-- Fuente del capital por hora del Costo Total de Propiedad (Costos): 'compra' = valor de compra ÷ vida en horas, 'contable' = amortización por hora del listado "Horas a Amortizar".
-- null = el valor por defecto del programa ('compra'). Aditivo y nullable; no toca los datos existentes.
alter table public.configuracion add column if not exists "tcoCapitalFuente" text;
