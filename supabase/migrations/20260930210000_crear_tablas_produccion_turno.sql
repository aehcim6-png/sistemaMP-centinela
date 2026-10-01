create table public.produccion_turno (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  turno text not null check (turno in ('dia','noche')),
  supervisor text,
  contrato text,
  "franjaDescarga" text,
  "moduloDescarga" text,
  "distanciaModulos" numeric,
  "observacionesDistancia" text,
  "totalToneladas" numeric,
  "rendimientoTransporteTonHr" numeric,
  "totalVueltas" numeric,
  observaciones text,
  "registradoPor" text,
  fuente text not null default 'foto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_produccion_turno_fecha_turno on public.produccion_turno(fecha, turno);

create table public.produccion_turno_equipos (
  id uuid primary key default gen_random_uuid(),
  "turnoId" uuid not null references public.produccion_turno(id) on delete cascade,
  sigla text,
  "siglaOCR" text,
  categoria text not null check (categoria in ('CAEX','Carguio','Apoyo','PerdidaPetroleo','PerdidaIndisponibilidad')),
  "equipoNombreOCR" text,
  "horometroInicial" numeric,
  "horometroFinal" numeric,
  "totalHoras" numeric,
  "estadoTexto" text,
  vueltas numeric,
  "rendimientoVueltasHr" numeric,
  "tiempoCicloMin" numeric,
  operador text,
  "tonVuelta" numeric,
  "tonHr" numeric,
  "totalTon" numeric,
  postura text,
  "areaTrabajo" text,
  "tonAsociadoPerdida" numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_produccion_turno_equipos_turno on public.produccion_turno_equipos("turnoId");
create index idx_produccion_turno_equipos_sigla on public.produccion_turno_equipos(sigla);

alter table public.produccion_turno enable row level security;

create policy operacional_select on public.produccion_turno
  for select using (privado.es_usuario_activo());
create policy operacional_insert on public.produccion_turno
  for insert with check (privado.es_editor_activo());
create policy operacional_update on public.produccion_turno
  for update using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy operacional_delete on public.produccion_turno
  for delete using (privado.es_editor_activo());

alter table public.produccion_turno_equipos enable row level security;

create policy operacional_select on public.produccion_turno_equipos
  for select using (privado.es_usuario_activo());
create policy operacional_insert on public.produccion_turno_equipos
  for insert with check (privado.es_editor_activo());
create policy operacional_update on public.produccion_turno_equipos
  for update using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy operacional_delete on public.produccion_turno_equipos
  for delete using (privado.es_editor_activo());

create trigger actualizar_updated_at
  before update on public.produccion_turno
  for each row execute function public.actualizar_updated_at();
create trigger actualizar_updated_at
  before update on public.produccion_turno_equipos
  for each row execute function public.actualizar_updated_at();
