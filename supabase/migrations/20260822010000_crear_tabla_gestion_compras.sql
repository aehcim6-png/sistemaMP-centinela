-- Gestión de compras/reparaciones de componentes (agosto 2026) — cargada
-- desde CONTROL_CAMBIO_DE_ASIENTOS.xlsx, hoja "GESTION DE COMPRA". Primera
-- vez que el sistema guarda este tipo de dato: proveedor, costo y tiempo de
-- entrega real de una compra u orden de reparación (hasta ahora solo vivía
-- en la planilla del proveedor EMESER LTDA.). Tabla de SOLO LECTURA como
-- correctivos_historico: se carga una vez por SQL directo, nada en la app
-- escribe acá todavía — no hay pestaña que la muestre aún.
create table public.gestion_compras (
  id uuid primary key default gen_random_uuid(),
  sigla text,
  "numeroPI" text,
  fecha date,
  faena text,
  cantidad numeric,
  detalle text,
  estado text,
  tiempo text,
  "fechaEstado" date,
  cuenta text,
  solicitante text,
  comprador text,
  oc text,
  "precioUnit" numeric,
  costo numeric,
  "fechaRegistro" date,
  "rutProveedor" text,
  proveedor text,
  fuente text not null,
  created_at timestamptz not null default now()
);

create index idx_gestion_compras_sigla on public.gestion_compras(sigla);
create index idx_gestion_compras_proveedor on public.gestion_compras(proveedor);

alter table public.gestion_compras enable row level security;

create policy operacional_rw on public.gestion_compras
  for all
  using (privado.es_usuario_activo())
  with check (privado.es_usuario_activo());
