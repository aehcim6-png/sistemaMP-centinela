// Genera la función SQL public.componente_de_texto a partir de _CATEGORIAS_COMPONENTE (logic.js),
// para que la base y la app usen el MISMO diccionario de componentes. Uso:
//   node scripts/generar_componente_sql.js            → imprime la función
// tests/claseOTHist.test.js comprueba que la migración 20261107150000 contiene exactamente esto.
const L = require('../logic.js');
const q = (s) => "'" + s.replace(/'/g, "''") + "'";
function whensDe(lista) {
  return lista.map(([nombre, claves]) => {
    const conds = claves.map((k) => k instanceof RegExp ? 't ~* ' + q(k.source.replace(/\\b/g, '\\y')) : 'position(' + q(k) + ' in t)>0');
    return '    when ' + conds.join(' or ') + ' then ' + q(nombre);
  });
}
function funcionSQL() {
  const whens = whensDe(L._CATEGORIAS_COMPONENTE);
  return [
    'create or replace function public.componente_de_texto(txt text)',
    'returns text language sql immutable set search_path = pg_catalog, public as $$',
    "  with x as (select lower(coalesce(txt,'')) t)",
    '  select case',
    whens.join('\n'),
    '    else null end from x;',
    '$$;',
  ].join('\n');
}
// sistema_de_texto_hist = componente, y si no hay, el tipo de evento (código activo, empantanado, PM…).
function funcionSistemaSQL() {
  return [
    'create or replace function public.sistema_de_texto_hist(txt text)',
    'returns text language sql immutable set search_path = pg_catalog, public as $$',
    "  with x as (select lower(coalesce(txt,'')) t)",
    '  select coalesce(',
    '    case',
    whensDe(L._CATEGORIAS_OPERACIONAL).join('\n'),
    '    else null end,',
    '    public.componente_de_texto(txt),',
    '    case',
    whensDe(L._CATEGORIAS_COMPONENTE_HIST).join('\n'),
    '    else null end,',
    '    case',
    whensDe(L._CATEGORIAS_EVENTO).join('\n'),
    '    else null end',
    '  ) from x;',
    '$$;',
  ].join('\n');
}
// clasificar_ot sale de los mismos patrones de logic.js (_CLASE_OT_PATRONES): el SQL no se escribe a mano.
function funcionClasificarSQL() {
  const P = L._CLASE_OT_PATRONES;
  const r = (k) => q(P[k].source.replace(/\\b/g, '\\y'));
  const d = "coalesce(descripcion, '')";
  return [
    'create or replace function public.clasificar_ot(descripcion text, tipo_int text)',
    'returns text',
    'language sql',
    'immutable',
    'set search_path = pg_catalog, public',
    'as $$',
    '  select case',
    "    when tipo_int in ('Programada', 'Predictiva') then 'preventiva'",
    '    when ' + d + ' ~* ' + r('operacional') + " then 'operacional'",
    '    when ' + d + ' ~* ' + r('pmParada') + " then 'preventiva'",
    '    when ' + d + ' ~* ' + r('instalaVerbo'),
    '     and ' + d + ' ~* ' + r('instalaObjeto'),
    '     and ' + d + ' !~* ' + r('instalaFalla'),
    "      then 'instalacion'",
    '    when ' + d + ' ~* ' + r('desgaste') + " then 'desgaste'",
    '    when ' + d + ' ~* ' + r('rutina'),
    '     and ' + d + ' !~* ' + r('fallaFuerte'),
    "      then 'preventiva'",
    "    else 'correctiva'",
    '  end;',
    '$$;',
  ].join('\n');
}
if (require.main === module) console.log(funcionSQL() + '\n' + funcionSistemaSQL() + '\n' + funcionClasificarSQL());
module.exports = { funcionSQL, funcionSistemaSQL, funcionClasificarSQL };
