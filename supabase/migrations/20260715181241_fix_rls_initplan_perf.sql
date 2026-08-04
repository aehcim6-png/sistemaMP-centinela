
drop policy if exists "smp_acceso_operador_activo" on public.kv;
create policy "smp_acceso_operador_activo" on public.kv
  for all
  to authenticated
  using (exists (select 1 from user_roles ur where ur.user_id = (select auth.uid()) and ur.activo = true))
  with check (exists (select 1 from user_roles ur where ur.user_id = (select auth.uid()) and ur.activo = true));

drop policy if exists "usuarios ven su propio rol" on public.user_roles;
create policy "usuarios ven su propio rol" on public.user_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
