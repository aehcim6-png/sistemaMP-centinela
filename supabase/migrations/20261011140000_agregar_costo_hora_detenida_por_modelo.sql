-- Costo de hora detenida por modelo (US$/h), editable en Configuración.
-- Mapa jsonb { clave_modelo_normalizado: US$/hora }; null = usa el costo general.
alter table public.configuracion add column if not exists "costoHoraDetModelos" jsonb;
