-- Reporte de producción completo (30-oct-2026): la lectura por foto ahora guarda también carguío, apoyo, pérdida por petróleo,
-- los totales de carguío, la lista de disponibilidad y la bitácora de eventos del turno. Las filas de equipos usan las categorías que
-- la tabla ya tenía ('Carguio','Apoyo','PerdidaPetroleo'); aquí solo se agregan las columnas que faltaban. Solo columnas nuevas y
-- opcionales: nada de lo cargado antes cambia. Las tablas ya tienen sus GRANT y políticas (20260930210000).
alter table public.produccion_turno
  add column if not exists "grupoTurno" text,
  add column if not exists "tiempoMedioCicloMin" numeric,
  add column if not exists "totalHorasCaex" numeric,
  add column if not exists "rendimientoCaexVueltasHr" numeric,
  add column if not exists "vueltasCF" numeric,
  add column if not exists "totalTonCF" numeric,
  add column if not exists "totalHorasCF" numeric,
  add column if not exists "rendimientoCFTonHr" numeric,
  add column if not exists "rendimientoCFCargasHr" numeric,
  add column if not exists "vueltasAljibe" numeric,
  add column if not exists "primerCargado" text,
  add column if not exists "ultimoCargado" text,
  add column if not exists "disponibilidadEquipos" text,
  add column if not exists bitacora text;

-- La pérdida por petróleo trae horas del reloj («10:25 – 12:20»), no horómetros: van como texto.
alter table public.produccion_turno_equipos
  add column if not exists "horaInicio" text,
  add column if not exists "horaFin" text;
