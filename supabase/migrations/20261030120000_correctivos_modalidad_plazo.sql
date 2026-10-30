-- Modalidad y plazo comprometido de la reparación (2026-10-30), del procedimiento corporativo PRO-MAN-002 (mantención y reparación correctiva): dónde se repara y para cuándo
-- se comprometió, para medir el % de cumplimiento de plazos. Tres columnas nuevas, sin valor por defecto: las OT antiguas quedan vacías y no se inventa nada.
--   · modalidadReparacion: 'Taller faena', 'Terreno', 'Tercero por contrato', 'Tercero por cotización' o 'Garantía' (OT_MODALIDADES en logic.js).
--   · plazoComprometido: fecha en que se comprometió terminar la reparación.
--   · fechaCierre: la pone sola la app cuando la OT pasa a Cerrada (y la borra si se reabre); sirve de fecha de término cuando no hay fecha de salida.
-- IMPORTANTE: aplicar ANTES de desplegar el código que la usa. La app pide estas columnas al leer correctivos; si no existen, la lectura de OT falla.
alter table public.correctivos add column if not exists "modalidadReparacion" text;
alter table public.correctivos add column if not exists "plazoComprometido" date;
alter table public.correctivos add column if not exists "fechaCierre" date;
