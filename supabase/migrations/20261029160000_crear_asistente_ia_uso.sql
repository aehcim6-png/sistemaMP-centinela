-- Asistente de IA (29-oct-2026): registro de cada llamada a Claude que hace la Edge Function asistente-ia.
-- Sirve para tres cosas: (1) poner un límite por persona y por día (la función cuenta aquí antes de llamar a Claude), (2) ver cuánto se usa y cuánto cuesta, (3) saber quién preguntó qué.
-- Solo la función (service_role) escribe; un administrador puede leerla desde la app. Una persona común no ve nada de esta tabla.
create table if not exists public.asistente_ia_uso (
  id bigint generated always as identity primary key,
  creado timestamptz not null default now(),
  user_id uuid not null,
  modelo text not null,
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  herramientas integer not null default 0,
  pregunta text
);
create index if not exists idx_asistente_ia_uso_usuario_fecha on public.asistente_ia_uso (user_id, creado desc);
create index if not exists idx_asistente_ia_uso_fecha on public.asistente_ia_uso (creado desc);

alter table public.asistente_ia_uso enable row level security;
create policy "solo_admin_select" on public.asistente_ia_uso for select to authenticated using (privado.es_admin_activo());

grant select on table public.asistente_ia_uso to authenticated;
grant select, insert, update, delete on table public.asistente_ia_uso to service_role;
grant usage, select on sequence public.asistente_ia_uso_id_seq to service_role;
