-- Siniestros de vehículos y maquinaria (30-oct-2026), del instructivo corporativo IT-AD-003 «Denuncio de siniestros»: todo siniestro se informa, y la denuncia
-- a la aseguradora debe hacerse dentro de los 5 días de ocurrido (si no, se pierde el derecho a indemnización). Una fila por siniestro, con su estado, la fecha en que
-- se informó a Finanzas y la lista de documentos que pide el liquidador (jsonb: clave del documento → true si ya está). Ver SINIESTRO_* y siniestro* en logic.js.
-- conductor y terceroDatos son texto libre (nombre, RUT, teléfono, seguro del tercero): los pide el procedimiento; quedan bajo las mismas políticas que el resto.
create table if not exists public.siniestros (
  id uuid primary key default gen_random_uuid(),
  sigla text not null,
  fecha date not null,
  hora text,
  lugar text,
  faena text,
  tipo text not null check (tipo in ('Vehículo liviano', 'Vehículo pesado o maquinaria', 'Robo')),
  relato text,
  lesionados boolean not null default false,
  conductor text,
  "terceroInvolucrado" boolean not null default false,
  "terceroDatos" text,
  constancia text check (constancia is null or constancia in ('Parte policial', 'Declaración jurada notarial')),
  "responsableAviso" text,
  estado text not null default 'Por informar' check (estado in ('Por informar', 'Informado', 'En liquidación', 'Cerrado')),
  "fechaInformado" date,
  "fechaCierre" date,
  resultado text check (resultado is null or resultado in ('Indemnizado', 'Rechazado', 'Sin cobertura', 'Desistido')),
  "montoIndemnizado" numeric,
  documentos jsonb not null default '{}'::jsonb,
  observaciones text,
  usuario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_siniestros_estado on public.siniestros (estado, fecha);
create index if not exists idx_siniestros_sigla on public.siniestros (sigla, fecha);

alter table public.siniestros enable row level security;
create policy "operacional_select" on public.siniestros for select to authenticated using (privado.es_usuario_activo());
create policy "operacional_insert" on public.siniestros for insert to authenticated with check (privado.es_editor_activo());
create policy "operacional_update" on public.siniestros for update to authenticated using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy "operacional_delete" on public.siniestros for delete to authenticated using (privado.es_editor_activo());
create trigger actualizar_updated_at before update on public.siniestros
  for each row execute function public.actualizar_updated_at();

grant select, insert, update, delete on table public.siniestros to authenticated;
grant select, insert, update, delete on table public.siniestros to service_role;
