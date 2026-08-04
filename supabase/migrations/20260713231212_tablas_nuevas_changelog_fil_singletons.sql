-- changelog: bitácora, insertable por todos, solo admin edita/borra
create table public.changelog (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  usuario text, accion text, detalle jsonb
);

-- fil: tabla de precios maestro, legacy (superada por stock_filtros.codAlt), admin-only
create table public.tabla_precios_maestro (
  id uuid primary key default gen_random_uuid(),
  "nParte" text, precio text,
  created_at timestamptz not null default now()
);

-- Singletons de configuración (una sola fila garantizada por "id boolean primary key default true")
create table public.configuracion (
  id boolean primary key default true check (id),
  empresa text, faena text, meta numeric, pass text,
  "sbUrl" text, "sbKey" text, "sbAuto" boolean,
  "neuTargetHrs" numeric, "neuProyMes" numeric, "adminOk" boolean,
  updated_at timestamptz not null default now()
);

create table public.tarifa_hh (
  id boolean primary key default true check (id),
  valor numeric,
  updated_at timestamptz not null default now()
);

create table public.meta_disponibilidad (
  id boolean primary key default true check (id),
  valor numeric,
  updated_at timestamptz not null default now()
);

create table public.metas (
  id boolean primary key default true check (id),
  datos jsonb,
  updated_at timestamptz not null default now()
);

create table public.disponibilidad_calculada (
  id boolean primary key default true check (id),
  datos jsonb,
  updated_at timestamptz not null default now()
);

create table public.avance_data (
  id boolean primary key default true check (id),
  datos jsonb,
  updated_at timestamptz not null default now()
);
