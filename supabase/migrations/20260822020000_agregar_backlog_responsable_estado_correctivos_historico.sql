-- Agosto 2026: recuperar datos reales que el Excel original (ORDENES_DE_TRABAJO.xlsx,
-- hoja "OT") traía pero nunca se cargaron a correctivos_historico — el import
-- inicial (ver 20260815120000_crear_tabla_correctivos_historico.sql) solo tomó
-- Equipo/Fecha/Horómetro/Sistema/Descripción, dejando afuera 3 columnas reales:
-- "Observación y/o backlog" (135 filas con dato real, ej. "Turbos instalados
-- provienen de CE-88 (usados)" — evidencia de canibalización de piezas entre
-- equipos), "Responsable" (2.499 filas) y "Realizado" (2.337 filas, Abierto/
-- Cerrado).
--
-- El backfill (SQL directo, ver conversación 2026-08-22) cruzó por
-- (siglaOriginal, fecha, horometro) contra la hoja "OT" completa — match no es
-- 100%: de 1.605 filas en correctivos_historico, 886 quedaron con estadoOT,
-- 851 con responsable, 79 con observación. El resto no tenía una combinación
-- fecha+horómetro única para cruzar con confianza (o el evento del Excel
-- simplemente no había entrado al import original).
ALTER TABLE correctivos_historico
  ADD COLUMN IF NOT EXISTS observacion text,
  ADD COLUMN IF NOT EXISTS "estadoOT" text,
  ADD COLUMN IF NOT EXISTS responsable text;
