-- La tabla destrabe se creó con un schema genérico (sigla/motivo/datos) de una
-- versión anterior del feature, que nunca se actualizó cuando el formulario real
-- de Gestión de Destrabe (modules/renders/destrabe.js) terminó usando otros campos
-- (equipo, trabajo, tipo, fechaSol, motivo, accion, responsable, fechaComp, estado).
-- Resultado: TABLA_REAL.destrabe.cols en el frontend solo mapeaba 'motivo'
-- correctamente; el resto de los campos nunca llegaban a la nube (se guardaban
-- como null), aunque sí quedaban bien en el navegador local. Tabla confirmada
-- vacía en producción (0 filas) antes de este cambio, así que no hay datos que
-- migrar — solo se agregan las columnas que faltan. 'sigla' y 'datos' quedan
-- como columnas legacy sin uso (no se borran, por si algo externo las referencia).
alter table public.destrabe
  add column if not exists equipo text,
  add column if not exists trabajo text,
  add column if not exists tipo text,
  add column if not exists "fechaSol" date,
  add column if not exists accion text,
  add column if not exists responsable text,
  add column if not exists "fechaComp" date,
  add column if not exists estado text;
