-- Vínculo entre los tipos de Tarea y la matriz RACI del MOM (9-nov-2026): {"pedir_ya": "<actividad de la matriz>", "falla_repetida": "...", "pm_backlog": "..."}.
-- La pestaña Tareas lo usa para mostrar quién hace cada tarea (R), a quién se escala (A) y a quién se informa (I). Aditivo y nullable: null = sin vínculos, rige la regla de siempre (jefe de taller de la cuadrilla).
alter table public.configuracion add column if not exists "momTareas" jsonb;
