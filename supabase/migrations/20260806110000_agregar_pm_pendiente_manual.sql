-- Caso real CF-8769: el hito PM1 de 15.500 nunca se registró, y la grilla
-- automática (proxPM en logic.js) saltó derecho a 15.750 sin avisar — porque no
-- puede distinguir "se saltó de verdad" de "se hizo pero no se anotó" (ese es el
-- comportamiento intencional para MN-5926/GE-10019, con huecos grandes de
-- registro histórico). No hay forma de resolver esto solo con los números; el
-- usuario que SÍ sabe qué pasó en terreno necesita poder marcarlo a mano.
alter table public.equipos
  add column if not exists "pmPendienteManual" numeric;
