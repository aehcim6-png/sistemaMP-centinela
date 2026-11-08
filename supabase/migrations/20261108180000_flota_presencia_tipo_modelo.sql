-- Tipo y modelo de cada equipo en flota_presencia (2026-11-08): los equipos desmovilizados ya no están en "equipos", y para mostrarlos en las pestañas mientras estuvieron en faena la app necesita
-- saber qué son. Se llenan por SQL (tipo según el prefijo de la sigla; modelo cuando consta en las planillas del cliente). La app no escribe aquí.
alter table public.flota_presencia add column if not exists tipo text;
alter table public.flota_presencia add column if not exists modelo text;
