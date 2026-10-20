-- Auditoría de cambios campo por campo (2026-10-17): quién cambió qué, en qué pestaña, de qué valor a cuál y cuándo.
-- A diferencia de 'changelog' (que guarda un texto resumido, con el nombre que escribe el propio navegador, y que un admin puede editar o borrar),
-- esta tabla es de SOLO AGREGAR: nadie puede modificar ni borrar filas, ni siquiera un admin ni la clave de servicio (lo impide un trigger),
-- y quién hizo el cambio (usuario_id, usuario_email, fecha) lo fija el servidor, no el navegador. Tabla nueva, no toca las existentes.
-- Solo un admin activo puede leerla; cualquier editor activo (admin u operador) puede agregar filas con su propia cuenta.
create table if not exists public.auditoria_cambios (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  usuario_id uuid,
  usuario_email text,
  usuario_nombre text,
  rol text,
  pestana text,
  subpestana text,
  tabla text not null,
  registro text,
  referencia text,
  accion text not null check (accion in ('crear','editar','eliminar')),
  campo text,
  valor_antes text check (valor_antes is null or char_length(valor_antes) <= 2000),
  valor_despues text check (valor_despues is null or char_length(valor_despues) <= 2000),
  lote uuid,
  dispositivo text
);
create index if not exists idx_auditoria_cambios_fecha on public.auditoria_cambios (fecha desc);
create index if not exists idx_auditoria_cambios_registro on public.auditoria_cambios (tabla, registro, fecha desc);
create index if not exists idx_auditoria_cambios_usuario on public.auditoria_cambios (usuario_id, fecha desc);
create index if not exists idx_auditoria_cambios_pestana on public.auditoria_cambios (pestana, fecha desc);

alter table public.auditoria_cambios enable row level security;
create policy "auditoria_select" on public.auditoria_cambios for select to authenticated using (privado.es_admin_activo());
create policy "auditoria_insert" on public.auditoria_cambios for insert to authenticated with check (privado.es_editor_activo());
-- Sin políticas de UPDATE ni DELETE: con RLS activo quedan denegados. Además se quitan los permisos de tabla.
revoke update, delete, truncate on public.auditoria_cambios from anon, authenticated;

-- El servidor fija la fecha y la identidad: lo que mande el navegador en esos campos se ignora.
create or replace function privado.auditoria_cambios_fijar_identidad() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.fecha := now();
  if auth.uid() is not null then
    new.usuario_id := auth.uid();
    new.usuario_email := auth.jwt() ->> 'email';
  end if;
  return new;
end $$;
create trigger auditoria_cambios_fijar_identidad before insert on public.auditoria_cambios
  for each row execute function privado.auditoria_cambios_fijar_identidad();

-- De solo agregar: ninguna modificación ni borrado, por nadie.
create or replace function privado.auditoria_cambios_inmutable() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'auditoria_cambios es de solo agregar: no se puede modificar ni borrar';
end $$;
create trigger auditoria_cambios_sin_update_delete before update or delete on public.auditoria_cambios
  for each row execute function privado.auditoria_cambios_inmutable();
create trigger auditoria_cambios_sin_truncate before truncate on public.auditoria_cambios
  for each statement execute function privado.auditoria_cambios_inmutable();
