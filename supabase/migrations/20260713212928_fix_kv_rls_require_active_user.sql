drop policy if exists "smp_acceso_autenticado" on public.kv;

create policy "smp_acceso_operador_activo"
on public.kv
for all
to authenticated
using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.activo = true)
)
with check (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.activo = true)
);
