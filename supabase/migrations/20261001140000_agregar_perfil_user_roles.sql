-- 'perfil' restringe qué PESTAÑAS ve un usuario (UI), independiente de 'role'
-- (que sigue controlando si PUEDE escribir: admin/operador/lector). Nulo =
-- sin restricción, ve todo (comportamiento de siempre). Sin CHECK a propósito
-- — mismo criterio que 'role': el único gate de valores válidos vive en la
-- Edge Function crear-operador (perfilValido()).
alter table public.user_roles add column if not exists perfil text;
