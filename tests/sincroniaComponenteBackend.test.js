const fs = require('fs');
const path = require('path');
const { _CATEGORIAS_COMPONENTE } = require('../logic.js');

// Guardarraíl automático (2026-08-30): la clasificación de "componente" por
// texto libre vive en logic.js (usada por Predictivo, OT y Estadística) PERO
// también en dos funciones Supabase que Deno no puede sincronizar importando
// logic.js directamente (es un archivo CommonJS/browser) — parseCorrectivo.ts
// (WhatsApp/correo entrante) y alerta-pm/index.ts (alertas de mantención).
// Esas dos son copias a mano que ya se desincronizaron una vez (se quedaron
// congeladas 9 pasadas atrás, sin "pala" ni varias categorías nuevas — ver
// commit de sincronización). Este test evita que vuelva a pasar sin que nadie
// se dé cuenta: si logic.js cambia y las copias no, el test falla en cada
// "npm test" (que corre antes de cada fusión a producción), en vez de quedar
// en silencio hasta que alguien lo note por accidente.

// Extrae el array literal `<marcador> = [ ... ]` de un archivo fuente
// (funciona igual para .js y .ts porque el array en sí es sintaxis JS válida
// — solo el tipo TS alrededor cambia, y lo saltamos buscando el '[' real).
function extraerArrayDeArchivo(rutaRelativa, marcador) {
  const ruta = path.join(__dirname, '..', rutaRelativa);
  const txt = fs.readFileSync(ruta, 'utf8');
  const idxNombre = txt.indexOf(marcador);
  if (idxNombre < 0) {
    throw new Error(`No se encontró "${marcador}" en ${rutaRelativa} — ¿se renombró la variable?`);
  }
  const idxIgual = txt.indexOf('= [', idxNombre);
  if (idxIgual < 0) {
    throw new Error(`No se encontró "= [" después de "${marcador}" en ${rutaRelativa}`);
  }
  const inicioArray = idxIgual + 2; // posición del '['
  let profundidad = 0, fin = -1;
  for (let i = inicioArray; i < txt.length; i++) {
    if (txt[i] === '[') profundidad++;
    else if (txt[i] === ']') { profundidad--; if (profundidad === 0) { fin = i; break; } }
  }
  if (fin < 0) throw new Error(`Array sin cerrar para "${marcador}" en ${rutaRelativa}`);
  // eslint-disable-next-line no-eval
  return eval(txt.slice(inicioArray, fin + 1));
}

// Normaliza para comparar: un RegExp no es comparable con === ni con
// JSON.stringify de forma útil, así que se representa como texto.
function normalizar(categorias) {
  return categorias.map(([cat, keys]) => [
    cat,
    keys.map((k) => (k instanceof RegExp ? `RE:${k.source}` : k)),
  ]);
}

describe('Sincronía del clasificador de componente entre logic.js y las funciones Supabase', () => {
  const base = normalizar(_CATEGORIAS_COMPONENTE);

  it('parseCorrectivo.ts (WhatsApp/correo entrante) tiene EXACTAMENTE las mismas categorías y palabras clave que logic.js', () => {
    const copia = normalizar(
      extraerArrayDeArchivo('supabase/functions/_shared/parseCorrectivo.ts', 'const CATEGORIAS_COMPONENTE')
    );
    expect(copia).toEqual(base);
  });

  it('alerta-pm/index.ts (alertas de mantención por correo) tiene EXACTAMENTE las mismas categorías y palabras clave que logic.js', () => {
    const copia = normalizar(
      extraerArrayDeArchivo('supabase/functions/alerta-pm/index.ts', 'const reglas')
    );
    expect(copia).toEqual(base);
  });
});
