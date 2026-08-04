create table public.mapeo_repuestos (
  id uuid primary key default gen_random_uuid(),
  "pautaId" uuid not null unique,
  tipo text not null check (tipo in ('filtro','lubricante')),
  "refId" uuid not null,
  created_at timestamptz not null default now()
);

alter table public.mapeo_repuestos enable row level security;

create policy operacional_rw on public.mapeo_repuestos
  for all
  using (privado.es_usuario_activo())
  with check (privado.es_usuario_activo());
