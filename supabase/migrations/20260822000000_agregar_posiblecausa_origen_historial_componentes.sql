-- Agosto 2026: causa raíz y proveedor por evento de componente.
-- Sale del análisis de Turbo en Komatsu HD785-7 (falla recurrente en varios
-- equipos del mismo modelo): el Excel dedicado CAMBIO_DE_TURBOS.xlsx trae
-- columnas "Posible Causa" (ej. "Se encuentran cuerpos extraños (partículas
-- metálicas)") y "Origen" (proveedor/taller: Komatsu, Turbodal, NIITSU Turbo
-- Industries...) que historial_componentes no tenía forma de guardar. Con
-- esto se puede comparar duración real por proveedor (ver conversación:
-- turbos Komatsu ~1.521h promedio vs. Turbodal ~1.032h promedio).
ALTER TABLE historial_componentes
  ADD COLUMN IF NOT EXISTS "posibleCausa" text,
  ADD COLUMN IF NOT EXISTS origen text;
