-- Gate legacy (cfg.adminPass/cfg.adminOk) eliminado del frontend: era redundante
-- (go('cfg') ya bloquea la pestaña completa a cualquiera que no sea admin real vía
-- Supabase Auth/user_roles antes de que este código corriera) y ni siquiera
-- funcionaba bien (adminPass nunca estuvo en esta lista de columnas, así que la
-- "contraseña" nunca viajaba a Supabase, solo vivía en el localStorage de cada
-- navegador y volvía a '1234' por defecto en cualquier otro equipo).
alter table public.configuracion drop column if exists "adminOk";
