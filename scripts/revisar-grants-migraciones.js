// Revisa que las migraciones nuevas escriban los GRANT de lo que crean en `public` (desde el 30-oct-2026 Supabase ya no los da solo).
// Se usa desde tests/migracionesGrants.test.js. Solo se exigen en migraciones POSTERIORES a la que fija los permisos de todo lo
// anterior (supabase/migrations/20261021120000_grants_explicitos_data_api.sql).
const fs = require('fs');
const path = require('path');

const GRANTS_DESDE = '20261021120000';   // prefijo de la migración que cubre todas las tablas creadas antes

const sinComentarios = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
const unico = (a) => [...new Set(a)];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Devuelve la lista de problemas de UNA migración (vacía = bien). 'sql' es el texto completo del archivo.
function revisarMigracion(sql) {
  const t = sinComentarios(sql);
  const problemas = [];
  // «grant … on [table] a, public.b, … to rol»: el nombre debe terminar ahí (pedido ≠ pedido_detalle) y el rol aparecer después del «to»
  const grantRe = (nombre, rol) => new RegExp('grant\\s+[^;]*?\\bon\\s+(?:table\\s+)?(?:[^;]*?[,\\s])?(?:public\\.)?"?' + esc(nombre) + '"?(?![a-z0-9_])[^;]*?\\bto\\b[^;]*\\b' + rol + '\\b', 'i').test(t);

  // tablas: public.x o x sin esquema (en Supabase el esquema por defecto es public)
  const tablas = unico([...t.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi)]
    .filter((m) => !/\bprivado\.|\bauth\.|\bextensions\./i.test(m[0]))
    .map((m) => m[1]));
  tablas.forEach((nombre) => {
    ['authenticated', 'service_role'].forEach((rol) => {
      if (!grantRe(nombre, rol)) problemas.push(`la tabla public.${nombre} no tiene GRANT para ${rol}`);
    });
  });

  // funciones de public (las de trigger no necesitan EXECUTE para dispararse)
  [...t.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_][a-z0-9_]*)\s*\(([^)]*)\)\s*returns\s+([a-z_ ]+)/gi)].forEach((m) => {
    if (/^trigger\b/i.test(m[3].trim())) return;
    if (!new RegExp('grant\\s+execute\\s+on\\s+function\\s+public\\.' + esc(m[1]) + '\\b[^;]*\\bto\\b', 'i').test(t)) problemas.push(`la función public.${m[1]} no tiene GRANT EXECUTE`);
  });

  // secuencias: serial/bigserial/identity en una tabla nueva
  if (tablas.length && /\b(?:big|small)?serial\b|generated\s+(?:always|by\s+default)\s+as\s+identity/i.test(t)) {
    if (!/grant\s+[^;]*\bon\s+(?:all\s+sequences\s+in\s+schema\s+public|sequence\s+public\.)/i.test(t)) problemas.push('hay una columna serial/identity pero no hay GRANT USAGE sobre su secuencia');
  }
  return problemas;
}

// Revisa todas las migraciones posteriores al corte. Devuelve [{archivo, problemas}] solo de las que fallan.
function revisarCarpeta(dir) {
  return fs.readdirSync(dir).filter((f) => /^\d{14}_.+\.sql$/.test(f) && f.slice(0, 14) > GRANTS_DESDE).sort()
    .map((f) => ({ archivo: f, problemas: revisarMigracion(fs.readFileSync(path.join(dir, f), 'utf8')) }))
    .filter((r) => r.problemas.length);
}

module.exports = { revisarMigracion, revisarCarpeta, GRANTS_DESDE };
