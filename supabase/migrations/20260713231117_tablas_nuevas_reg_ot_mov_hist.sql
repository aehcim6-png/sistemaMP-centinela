-- Mapeo: eq->equipos, reg->registros_pm, ot->correctivos, mov->movimientos_stock, hist->historial_horometros

create table public.equipos (
  sigla text primary key,
  tipo text, modelo text, "frecPM" numeric, "hrsDia" numeric,
  "horomActual" numeric, "fechaHorom" date, estado text, "tipoPM" text,
  "horomProxPM" numeric, "hrsRestantes" numeric, "diasParaPM" integer, "fechaProxPM" date,
  "numSerie" text, "anioFab" text, vin text, proveedor text,
  "valorCompra" numeric, "fechaCompra" date, "garantiaHasta" numeric, contrato text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.registros_pm (
  id uuid primary key default gen_random_uuid(),
  equipo text, "tipoPM" text, "fechaEntrada" date, "horaEntrada" text,
  "fechaSalida" date, "horaSalida" text, duracion text, "duracionH" numeric,
  "horomReal" numeric, estado text, tecnico text, obs text, "estatusEq" text,
  lugar text, sintoma text, "nReg" integer, "fechaEjec" date,
  created_at timestamptz not null default now()
);

create table public.correctivos (
  id uuid primary key default gen_random_uuid(),
  sigla text, tipo text, fecha date, horom numeric, turno text,
  sintoma text, sistema text, tecnico text, "codFalla" text, duracion text,
  "estadoOT" text, operador text, solucion text, "causaRaiz" text, "estatusEq" text,
  ubicacion text, componente text, criticidad text, "folioExcel" integer,
  "horaEntrada" text, "fechaEntrada" date, "horaSalida" text, "fechaSalida" date,
  "fechaIngreso" text, "autorizadoPor" text, costo numeric, ast text, loto text,
  created_at timestamptz not null default now()
);

create table public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  equipo text, tipo text, item text, "nParte" text, cant numeric,
  ant numeric, nuevo numeric, fecha date, mes text, pm text,
  created_at timestamptz not null default now()
);

create table public.historial_horometros (
  id uuid primary key default gen_random_uuid(),
  sigla text, fecha date, "horomIni" numeric, "horomFin" numeric, horom numeric, origen text,
  created_at timestamptz not null default now()
);
