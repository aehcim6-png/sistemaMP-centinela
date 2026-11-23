-- Alias de equipos (23-nov-2026). El chat de WhatsApp llama a los camiones «CE-85», «CAEX 85»; el sistema los llama CN-9503. Hasta hoy esa equivalencia estaba escrita dentro del código
-- (REPORTAB_MAPA_SIGLAS) y cada nombre nuevo del chat («CF 511») quedaba sin cargar. Con esta tabla un editor asigna el nombre una vez, desde el importador del chat, y vale para siempre.
-- `alias` se compara sin espacios, guiones ni mayúsculas (CE-85 = CE 85 = ce85). La tabla manda sobre las reglas del código. `sigla` es la del sistema (equipos.sigla).
-- Todos los perfiles activos leen; solo un editor escribe.
create table if not exists public.equipos_alias (
  id uuid primary key default gen_random_uuid(),
  alias text not null check (length(btrim(alias)) > 0),
  sigla text not null check (length(btrim(sigla)) > 0),
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists equipos_alias_alias_norm on public.equipos_alias ((upper(regexp_replace(alias, '[^A-Za-z0-9]', '', 'g'))));
create index if not exists idx_equipos_alias_sigla on public.equipos_alias (sigla);

alter table public.equipos_alias enable row level security;
create policy "operacional_select" on public.equipos_alias for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.equipos_alias for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.equipos_alias for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.equipos_alias for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.equipos_alias
  for each row execute function public.actualizar_updated_at();

grant select, insert, update, delete on table public.equipos_alias to authenticated;
grant select, insert, update, delete on table public.equipos_alias to service_role;

-- Nombres del chat confirmados con el horómetro (el horómetro del chat coincide con el del sistema el mismo día).
insert into public.equipos_alias (alias, sigla, nota) values
  ('CF-511', 'CF-9511', 'Horómetro del chat 14.555 (27-jul-2026) = 14.554 del sistema')
on conflict do nothing;
