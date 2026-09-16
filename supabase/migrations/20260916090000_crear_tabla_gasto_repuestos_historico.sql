-- Gasto histórico REAL en repuestos por equipo (2026-09-16, pedido del
-- usuario: primer dato de costo de mantenimiento con respaldo real que tiene
-- el sistema — hasta ahora 'correctivos.costo' está en $0 en 1.243 de 1.243
-- registros, el campo existe en el formulario de OT pero nadie lo completa).
--
-- Cargado UNA VEZ desde un archivo real de Órdenes de Compra (Iconstruye/
-- Komatsu, "OC.xlsx", 1.335 líneas, 2020-12-30 a 2026-09-07). De esas 1.335,
-- solo 479 corresponden a un 'sigla' de nuestra flota real — el resto son
-- centros de costo genéricos (códigos "UR-xxxxx": arriendo de maquinaria,
-- hoteles, traslados de personal, no son repuestos de ningún equipo) y se
-- descartaron. Dos líneas más se corrigieron a mano tras detectar un error
-- de datos en el archivo fuente (Precio Unit con 3-4 órdenes de magnitud de
-- más — "manguera hidráulica a $12,8 millones el metro" — el usuario
-- confirmó el Costo real de esas 2 líneas: CN-9503 $503.989, CN-9507
-- $268.331, no los $5.039.889.612 / $2.683.309.882 que traía el Excel).
--
-- Tabla de SOLO LECTURA por ahora: nada en la app escribe acá, se carga por
-- SQL directo una sola vez — mismo patrón que 'correctivos_historico'
-- (20260815120000). Es 'gasto en repuestos', NO el mismo dato que
-- 'correctivos.costo' — no incluye mano de obra, y no está atado a una OT
-- puntual, solo a equipo+fecha. Sirve como proxy real (parcial) de costo de
-- mantenimiento mientras 'correctivos.costo' siga sin completarse.
create table public.gasto_repuestos_historico (
  id uuid primary key default gen_random_uuid(),
  sigla text not null,
  fecha date,
  detalle text,
  "numOC" text,
  cantidad numeric,
  "precioUnit" numeric,
  costo numeric,
  proveedor text,
  "rutProveedor" text,
  fuente text not null default 'OC Iconstruye/Komatsu (OC.xlsx, cargado 2026-09-16)',
  created_at timestamptz not null default now()
);

create index idx_gasto_repuestos_historico_sigla on public.gasto_repuestos_historico(sigla);
create index idx_gasto_repuestos_historico_fecha on public.gasto_repuestos_historico(fecha);

alter table public.gasto_repuestos_historico enable row level security;

create policy operacional_rw on public.gasto_repuestos_historico
  for all
  using (privado.es_usuario_activo())
  with check (privado.es_usuario_activo());
