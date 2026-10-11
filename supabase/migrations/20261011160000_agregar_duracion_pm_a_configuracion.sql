-- Duración estándar de cada PM en horas ({"PM1":3,"PM2":5,"PM3":8,"PM4":12}), editable en Configuración.
-- La usan la Curva S de PM (Avance) y las horas de PM del pronóstico de disponibilidad. Aditivo y nullable: null = estándar del programa.
alter table public.configuracion add column if not exists "duracionPMHoras" jsonb;
