-- Recauchaje de neumáticos (30-oct-2026), del procedimiento corporativo PRO-MAN-004 (neumáticos) y su registro «Orden de trabajo de recauchaje»: cada envío de un casco al
-- proveedor queda como una fila, con la profundidad de huella al salir y al volver, el número de recauchaje (1.º al 4.º) y, si el proveedor lo rechaza, el código de rechazo.
-- Mientras está en el proveedor, el neumático queda con estado «En recauchaje»; al volver pasa a Stock (con su nueva huella) o, si se rechazó, a De baja.
-- Ver NEU_CODIGOS_RECHAZO y resumenRecauchajes en logic.js.
create table if not exists public.neumaticos_recauchajes (
  id uuid primary key default gen_random_uuid(),
  "neuId" text,
  serie text not null,
  sigla text,
  marca text,
  medida text,
  "numRecauchaje" integer check ("numRecauchaje" is null or "numRecauchaje" between 1 and 10),
  "fechaEnvio" date not null,
  "guiaDespacho" text,
  proveedor text,
  "huellaSalida" numeric,
  "huellaEntrada" numeric,
  estado text not null default 'Enviado' check (estado in ('Enviado', 'Recibido', 'Rechazado')),
  "codigoRechazo" text,
  "fechaRetorno" date,
  costo numeric,
  observaciones text,
  usuario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_neumaticos_recauchajes_serie on public.neumaticos_recauchajes (serie, "fechaEnvio");
create index if not exists idx_neumaticos_recauchajes_estado on public.neumaticos_recauchajes (estado);

alter table public.neumaticos_recauchajes enable row level security;
create policy "operacional_select" on public.neumaticos_recauchajes for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.neumaticos_recauchajes for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.neumaticos_recauchajes for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.neumaticos_recauchajes for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.neumaticos_recauchajes
  for each row execute function public.actualizar_updated_at();

grant select, insert, update, delete on table public.neumaticos_recauchajes to authenticated;
grant select, insert, update, delete on table public.neumaticos_recauchajes to service_role;
