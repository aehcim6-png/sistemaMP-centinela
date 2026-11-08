-- Reportabilidad diaria por turno (2026-11-08): la faena trabaja dos turnos (día y noche) y cada supervisor entrega su propio reporte de estatus, así que un equipo puede estar OP en un turno y FS en el otro.
-- "turno" vacío = reporte sin turno (los Excel diarios del cliente, que son uno por día). La clave natural pasa de (fecha, sigla) a (fecha, sigla, turno).
-- Para el cálculo, si un equipo tiene filas con turno en un día, se usan esas y se ignora la fila sin turno de ese día (ver reportabilidadFilasEfectivas en logic.js).
alter table public.reportabilidad_diaria add column if not exists turno text not null default '';
alter table public.reportabilidad_diaria drop constraint if exists reportabilidad_diaria_turno_check;
alter table public.reportabilidad_diaria add constraint reportabilidad_diaria_turno_check check (turno in ('', 'Día', 'Noche'));
drop index if exists public.uq_reportabilidad_diaria_fecha_sigla;
create unique index if not exists uq_reportabilidad_diaria_fecha_sigla_turno on public.reportabilidad_diaria (fecha, sigla, turno);
