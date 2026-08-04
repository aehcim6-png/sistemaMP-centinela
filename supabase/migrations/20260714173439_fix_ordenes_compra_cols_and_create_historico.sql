-- Fix real: confirmarOC() ya escribía equipo/obs/fechaEntrega, pero la tabla nunca
-- tuvo esas columnas -- _syncTablaGenerica las descartaba en silencio (mismo patrón
-- de bug de antes en esta sesión).
alter table public.ordenes_compra
  add column if not exists equipo text,
  add column if not exists obs text,
  add column if not exists "fechaEntrega" date;

-- Tabla nueva: historial real de compras (6.748 filas reales, jun-2022 a jun-2026),
-- hoy solo vive como const congelada (PRED) + un botón de importación que nunca se
-- usó y que además apunta al esquema equivocado (ordenes_compra es para
-- sugerencias de recompra, no para este ledger histórico plano).
create table public.ordenes_compra_historico (
  id uuid primary key default gen_random_uuid(),
  pedido text,
  fecha date,
  sigla text,
  detalle text,
  oc text,
  cant numeric,
  "precioUnit" numeric,
  costo numeric,
  rut text,
  proveedor text,
  tipo text,
  created_at timestamptz not null default now()
);
alter table public.ordenes_compra_historico enable row level security;
create policy operacional_rw on public.ordenes_compra_historico
  for all
  using (privado.es_usuario_activo())
  with check (privado.es_usuario_activo());
