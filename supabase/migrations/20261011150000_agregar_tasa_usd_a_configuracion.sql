-- Tasa USD→CLP del programa (referencial, no oficial), editable en Configuración y compartida por todos los usuarios.
-- Antes vivía en el localStorage de cada navegador (tboTasaUSD). Aditivo y nullable: null = 910 (o el valor local anterior).
alter table public.configuracion add column if not exists "tasaUSD" numeric;
