-- Mapeo: informesFalla->informes_falla, prg->programa, al->alertas,
-- venc->vencimientos (aplanada sigla+vencTipo), compMayores->componentes_mayores

create table public.informes_falla (
  id text primary key,
  sigla text, tipo text, modelo text, componente text, "tipoEvento" text,
  descripcion text, "causaProbable" text, "costoEstimado" numeric, "horometroActual" numeric,
  "generadoPor" text, fecha date, "fechaCreacion" timestamptz, fotos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.programa (
  id uuid primary key default gen_random_uuid(),
  sigla text, tipo text, modelo text, "hrsDia" numeric, "horomActual" numeric, meses jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alertas (
  id uuid primary key default gen_random_uuid(),
  sigla text, repuestos text,
  created_at timestamptz not null default now()
);

create table public.vencimientos (
  sigla text not null,
  "vencTipo" text not null,
  obs text, ultima date, proxima date, "periodicidadMeses" numeric,
  updated_at timestamptz not null default now(),
  primary key (sigla, "vencTipo")
);

create table public.componentes_mayores (
  id uuid primary key default gen_random_uuid(),
  sigla text, tipo text, modelo text, comp text, "horomComp" numeric,
  "vidaUtil" numeric, "costoRef" numeric, "fechaInst" date, estado text, obs text,
  created_at timestamptz not null default now()
);
