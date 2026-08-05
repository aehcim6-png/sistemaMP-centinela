-- Papelera: soft-delete con recuperación (retención 30 días). Tabla nueva,
-- no toca el esquema de las 31 tablas existentes — cada eliminación real
-- copia la fila completa acá (categoria + fila jsonb) ANTES de borrarla de
-- su tabla de origen. Reusa el mismo S.g/S.s que cualquier otra categoría
-- vía TABLA_REAL.papelera (modules/store.js), sin código especial.
create table public.papelera (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  fila jsonb not null,
  "fechaEliminacion" timestamptz not null default now(),
  "eliminadoPor" text,
  created_at timestamptz not null default now()
);
create index idx_papelera_categoria on public.papelera(categoria);
create index idx_papelera_fecha_eliminacion on public.papelera("fechaEliminacion");

alter table public.papelera enable row level security;
-- Igual que las tablas operacionales: cualquier usuario activo (operador o
-- admin) puede leer/insertar/borrar — insertar pasa al eliminar de origen,
-- borrar pasa al restaurar (ya volvió a su tabla) o al purgar filas viejas.
create policy "papelera_select" on public.papelera for select to authenticated using (privado.es_usuario_activo());
create policy "papelera_insert" on public.papelera for insert to authenticated with check (privado.es_usuario_activo());
create policy "papelera_delete" on public.papelera for delete to authenticated using (privado.es_usuario_activo());
