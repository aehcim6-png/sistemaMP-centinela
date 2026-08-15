-- Historial de correctivos 2022-2025 (previo a este sistema), cargado desde
-- 3 Excel que el usuario compartió (ORDENES_DE_TRABAJO, CAMBIOS_DE_COMPONENTES,
-- CAMBIO_DE_DIFERENCIALES). Tabla de SOLO LECTURA: nada en la app escribe acá,
-- se carga una sola vez por SQL directo (ver conversación 2026-08-15). Separada
-- de 'correctivos' (que arranca en 2025-01) para no arriesgar nada de lo que ya
-- funciona — esta es la fuente extra que alimenta el cálculo de probabilidad de
-- falla por componente (más muestra histórica = número más confiable).
--
-- Los Excel usan códigos de equipo viejos de Besalco (ej. 'CE-84', 'MN-12'),
-- que ya NO coinciden con el 'sigla' actual de la tabla 'equipos' de este
-- sistema (ej. 'CN-9506', 'MN-6112') — la flota fue re-numerada al migrar a
-- Centinela. 'sigla' acá es el código YA TRADUCIDO al actual (mismo que usa
-- el resto de la app); 'siglaOriginal' guarda el código viejo tal cual venía
-- en el Excel, solo para trazabilidad/auditoría del mapeo.
create table public.correctivos_historico (
  id uuid primary key default gen_random_uuid(),
  "sigla" text not null,
  "siglaOriginal" text,
  fecha date,
  horometro numeric,
  sistema text,
  descripcion text,
  "tipoInt" text,
  fuente text not null,
  created_at timestamptz not null default now()
);

create index idx_correctivos_historico_sigla on public.correctivos_historico(sigla);
create index idx_correctivos_historico_sistema on public.correctivos_historico(sistema);

alter table public.correctivos_historico enable row level security;

create policy operacional_rw on public.correctivos_historico
  for all
  using (privado.es_usuario_activo())
  with check (privado.es_usuario_activo());
