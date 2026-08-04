-- Mapeo: insp->inspecciones, aceite->analisis_aceite, ordenes->ordenes_compra,
-- planSem->plan_semanal, planSemHist->plan_semanal_historico, gantt->gantt, destrabe->destrabe

create table public.inspecciones (
  id uuid primary key default gen_random_uuid(),
  equipo text, fecha date, horometro numeric, visual text, niveles text, fugas text,
  luces text, frenos text, neumaticos text, obs text, inspector text,
  created_at timestamptz not null default now()
);

create table public.analisis_aceite (
  id uuid primary key default gen_random_uuid(),
  sigla text, equipo text, fecha date, "nMuestra" text, "hrsComp" numeric, "hrsLub" numeric,
  lubricante text, componente text, descriptor text,
  hierro numeric, cobre numeric, plomo numeric, aluminio numeric, silicio numeric,
  cromo numeric, sodio numeric, visc40 numeric, visc100 numeric, pq numeric, tbn numeric, tan numeric,
  "isoCode" text, "espEst1" numeric, "espEst2" numeric, "espEst3" numeric, demulsibilidad numeric,
  estado text, comentario text,
  created_at timestamptz not null default now()
);

create table public.ordenes_compra (
  id uuid primary key default gen_random_uuid(),
  componente text, "nParte" text, cantidad numeric, "costoEstimado" numeric,
  proveedor text, fecha date, estado text,
  created_at timestamptz not null default now()
);

create table public.plan_semanal (
  id uuid primary key default gen_random_uuid(),
  sigla text, semana text, datos jsonb,
  created_at timestamptz not null default now()
);

create table public.plan_semanal_historico (
  id uuid primary key default gen_random_uuid(),
  sigla text, semana text, datos jsonb,
  created_at timestamptz not null default now()
);

create table public.gantt (
  id uuid primary key default gen_random_uuid(),
  sigla text, actividad text, inicio text, fin text, datos jsonb,
  created_at timestamptz not null default now()
);

create table public.destrabe (
  id uuid primary key default gen_random_uuid(),
  sigla text, motivo text, datos jsonb,
  created_at timestamptz not null default now()
);
