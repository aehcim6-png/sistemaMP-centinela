-- Nivel 1 de la propuesta "alerta predictiva de fallas" (2026-09-01): el
-- Índice de Riesgo de componentes_mayores (🔴 Alto/🟡 Medio/🟢 Bajo/⚪ Sin
-- datos, ver modules/renders/comp.js) hoy solo se calcula en el navegador y
-- nunca queda guardado — solo se ve si alguien entra a Componentes. Para
-- poder mostrarlo también en el resumen-semanal (Edge Function, corre en
-- Deno sin acceso a la lógica del cliente) sin duplicar la fórmula del lado
-- del servidor — la misma señal de vida útil requiere estimar el horómetro
-- de instalación con horomEnFecha/tasaDiariaReal, lógica compleja que ya
-- vive una sola vez en logic.js — se sigue el mismo patrón que
-- equipos.estado/diasParaPM/horomProxPM: el cliente calcula una vez y
-- guarda el resultado ya resuelto; el servidor solo lo lee.
alter table public.componentes_mayores
  add column if not exists "riesgoNivel" text,
  add column if not exists "riesgoTip" text;
