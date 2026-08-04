create or replace function public.es_usuario_activo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.activo = true
  );
$$;

create or replace function public.es_admin_activo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.activo = true and ur.role = 'admin'
  );
$$;
