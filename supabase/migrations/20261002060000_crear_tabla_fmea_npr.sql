-- FMEA con NPR real (2026-10-02): extiende el checklist informativo
-- _CAUSAS_TIPICAS_FMEA (pred.js, solo lista "sospechosos habituales" por tipo
-- de componente) para que un técnico pueda calificar en terreno Severidad/
-- Ocurrencia/Detección (1-10 cada una) por cada causa real de un componente,
-- y priorizar cuál atacar primero por NPR = S×O×D. Ver calcularNPR (logic.js).
create table public.fmea_npr (
  id uuid primary key default gen_random_uuid(),
  componente text not null,
  causa text not null,
  severidad int,
  ocurrencia int,
  deteccion int,
  usuario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(componente, causa)
);
create index idx_fmea_npr_componente on public.fmea_npr(componente);

alter table public.fmea_npr enable row level security;

create policy operacional_select on public.fmea_npr
  for select using (privado.es_usuario_activo());
create policy operacional_insert on public.fmea_npr
  for insert with check (privado.es_editor_activo());
create policy operacional_update on public.fmea_npr
  for update using (privado.es_editor_activo()) with check (privado.es_editor_activo());
create policy operacional_delete on public.fmea_npr
  for delete using (privado.es_editor_activo());

create trigger actualizar_updated_at
  before update on public.fmea_npr
  for each row execute function public.actualizar_updated_at();
