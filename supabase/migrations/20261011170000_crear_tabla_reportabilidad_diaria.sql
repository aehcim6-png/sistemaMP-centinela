-- Reportabilidad diaria del cliente (2026-10-11): una fila por equipo y día con su estatus OP/FS, detalle de la falla, fecha de detención,
-- fecha de proyección de la reparación, OC y observación. Es la fuente contractual de la disponibilidad. Clave natural (fecha, sigla): cargar de nuevo
-- un día lo actualiza (upsert), así se pueden cargar fechas antiguas más adelante y en cualquier orden. Tabla nueva, no toca las existentes.
create table if not exists public.reportabilidad_diaria (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  sigla text not null,
  "siglaCliente" text,
  estatus text not null check (estatus in ('OP','FS')),
  ubicacion text,
  detalle text,
  "fechaDetencion" date,
  proyeccion date,
  "ordenCompra" text,
  observacion text,
  mantenedor text,
  fuente text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_reportabilidad_diaria_fecha_sigla on public.reportabilidad_diaria (fecha, sigla);
create index if not exists idx_reportabilidad_diaria_sigla on public.reportabilidad_diaria (sigla, fecha);
alter table public.reportabilidad_diaria enable row level security;
create policy "operacional_select" on public.reportabilidad_diaria for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.reportabilidad_diaria for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.reportabilidad_diaria for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.reportabilidad_diaria for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.reportabilidad_diaria
  for each row execute function public.actualizar_updated_at();
