-- Stock de insumos (2026-10-26): inventario de bodega con kardex, como las planillas «Inventario de bodega» (EPP, librería, limpieza) que se usaban a mano.
-- Dos tablas nuevas, no tocan las existentes (filtros y lubricantes siguen en stock_filtros y lubricantes):
--   · insumos: el catálogo (descripción, categoría, unidad, stock crítico, ubicación, precio de referencia).
--   · insumos_movimientos: el kardex, una fila por entrada, salida, saldo inicial o ajuste de conteo. El saldo NO se guarda: se calcula sumando los movimientos,
--     así nunca queda descuadrado de su propio historial. Una salida lleva documento (vale/guía), quién retira y destino (equipo, trabajador o área).
-- Un insumo con movimientos no se borra (se desactiva): por eso insumoId no es llave foránea (un borrado accidental no debe trabar la sincronización).
create table if not exists public.insumos (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  descripcion text not null,
  categoria text not null default 'Otros',
  unidad text not null default 'UN',
  "stockCritico" numeric not null default 0 check ("stockCritico" >= 0),
  ubicacion text,
  "precioUnit" numeric not null default 0 check ("precioUnit" >= 0),
  observacion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_insumos_categoria on public.insumos (categoria);
create unique index if not exists uq_insumos_categoria_descripcion on public.insumos (categoria, upper(descripcion));

create table if not exists public.insumos_movimientos (
  id uuid primary key default gen_random_uuid(),
  "insumoId" uuid not null,
  fecha date not null,
  tipo text not null check (tipo in ('inicial','entrada','salida','ajuste')),
  cantidad numeric not null,
  documento text,
  referencia text,
  destino text,
  "precioUnit" numeric,
  observacion text,
  usuario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- entradas, salidas y saldo inicial son positivos; solo el ajuste de conteo puede ser negativo
  constraint insumos_movimientos_cantidad_signo check (tipo = 'ajuste' and cantidad <> 0 or tipo <> 'ajuste' and cantidad > 0)
);
create index if not exists idx_insumos_movimientos_insumo on public.insumos_movimientos ("insumoId", fecha);
create index if not exists idx_insumos_movimientos_fecha on public.insumos_movimientos (fecha);

alter table public.insumos enable row level security;
create policy "operacional_select" on public.insumos for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.insumos for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.insumos for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.insumos for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.insumos
  for each row execute function public.actualizar_updated_at();

alter table public.insumos_movimientos enable row level security;
create policy "operacional_select" on public.insumos_movimientos for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.insumos_movimientos for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.insumos_movimientos for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.insumos_movimientos for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.insumos_movimientos
  for each row execute function public.actualizar_updated_at();

grant select, insert, update, delete on table public.insumos to authenticated;
grant select, insert, update, delete on table public.insumos to service_role;
grant select, insert, update, delete on table public.insumos_movimientos to authenticated;
grant select, insert, update, delete on table public.insumos_movimientos to service_role;
