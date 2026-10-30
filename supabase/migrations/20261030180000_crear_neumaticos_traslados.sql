-- Traslado de neumáticos entre equipos / canibalización (30-oct-2026), del procedimiento corporativo PRO-MAN-004 y su registro «Montaje y desmontaje de neumático»:
-- cuando se saca un neumático montado de un equipo (donante) para ponerlo en otro (receptor), se deja constancia de ambos equipos, posiciones y horómetros, y de la
-- causal (retraso en pedido, proveedor sin stock, siniestro u otro). Una fila por traslado. Ver NEU_CAUSALES_TRASLADO y neuTrasladosPendientesReposicion en logic.js.
create table if not exists public.neumaticos_traslados (
  id uuid primary key default gen_random_uuid(),
  "neuId" text,
  serie text not null,
  fecha date not null,
  donante text not null,
  "posicionDonante" text,
  "horomDonante" numeric,
  receptor text not null,
  "posicionReceptor" text,
  "horomReceptor" numeric,
  causal text not null check (causal in ('Retraso en pedido', 'Proveedor sin stock', 'Siniestro', 'Otro')),
  detalle text,
  "autorizadoPor" text,
  usuario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_neumaticos_traslados_fecha on public.neumaticos_traslados (fecha);
create index if not exists idx_neumaticos_traslados_donante on public.neumaticos_traslados (donante, "posicionDonante");

alter table public.neumaticos_traslados enable row level security;
create policy "operacional_select" on public.neumaticos_traslados for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.neumaticos_traslados for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.neumaticos_traslados for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.neumaticos_traslados for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.neumaticos_traslados
  for each row execute function public.actualizar_updated_at();

grant select, insert, update, delete on table public.neumaticos_traslados to authenticated;
grant select, insert, update, delete on table public.neumaticos_traslados to service_role;
