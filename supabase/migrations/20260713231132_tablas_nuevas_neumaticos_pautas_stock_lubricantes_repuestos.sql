-- Mapeo: neu->neumaticos, neuMed->neumaticos_mediciones, pau->pautas,
-- stk->stock_filtros, lub->lubricantes, repuestos->repuestos

create table public.neumaticos (
  id text primary key,
  sigla text, tipo text, marca text, serie text, medida text, posicion text,
  "numPos" integer, estado text, "tipoEquipo" text, "vidaUtil" numeric,
  "remNuevo" numeric, remanente numeric, "pctRemanente" numeric, alerta numeric,
  "fechaInst" date, "ultimaMedicion" date, "horasAcum" numeric, "horomActual" numeric,
  "horomInstalacion" numeric, "horasBase" numeric, "numSensor" text, obs text,
  created_at timestamptz not null default now()
);

create table public.neumaticos_mediciones (
  id uuid primary key default gen_random_uuid(),
  "neuId" text, sigla text, serie text, posicion text, fecha date, horom numeric,
  motivo text, "remExt" numeric, "remInt" numeric, "remProm" numeric, sensor text,
  created_at timestamptz not null default now()
);

create table public.pautas (
  id uuid primary key default gen_random_uuid(),
  sigla text, hoja text, pm text, cat text, act text, hrs numeric, rep text, can numeric,
  created_at timestamptz not null default now()
);

create table public.stock_filtros (
  id uuid primary key default gen_random_uuid(),
  "nParte" text, descripcion text, "equipoModelo" text, "stockBodega" numeric,
  "consumoMes" numeric, "proyMes" numeric, "mesesCubierto" numeric, pendiente numeric,
  comprar numeric, "precioUnit" numeric, "codAlt" text, estado text,
  created_at timestamptz not null default now()
);

create table public.lubricantes (
  id uuid primary key default gen_random_uuid(),
  nombre text, unidad text, stock numeric, "consumoMes" numeric, "proyMes" numeric, precio numeric,
  created_at timestamptz not null default now()
);

create table public.repuestos (
  id uuid primary key default gen_random_uuid(),
  componente text, "nParte" text, equipo text, "stockActual" numeric,
  "stockMinimo" numeric, "leadTime" numeric, "precioUnit" numeric, proveedor text,
  created_at timestamptz not null default now()
);
