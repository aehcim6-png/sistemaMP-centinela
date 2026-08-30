const fs = require('fs');
const path = require('path');
const glob = fs.readdirSync(path.join(__dirname, '../modules/renders')).filter((f) => f.endsWith('.js'));

// Guardarraíl (2026-08-30) del inventario de duplicación entre pestañas: se
// encontraron 61 llamadas a `.toLocaleString()` repartidas en 17 archivos —
// unas sin especificar idioma (formato inconsistente según el navegador del
// usuario) y otras con 'es-CL' a mano — en vez de usar `fn()`, la función ya
// compartida en logic.js. Se migraron todas a `fn()`, salvo 7 casos
// legítimos que este test documenta explícitamente y no se tocan:
//   - 4 son formato de FECHA (Date.toLocaleString), un problema distinto al
//     de formato de NÚMERO — fn() no aplica ahí.
//   - 3 son en neu.js, con encadenamiento opcional + fallback ('v?.
//     toLocaleString(...)||"—"'): a propósito distinguen "sin dato" de
//     "cero", algo que fn() (que trata null/undefined como 0) no replica —
//     forzarlas a fn() habría cambiado ese comportamiento.
// Este test evita que alguien reintroduzca un `.toLocaleString()` suelto
// nuevo sin darse cuenta (bastaría con no llamar a fn() en un archivo
// nuevo o una pestaña nueva) — un `git diff` que agregue una fila acá
// debe ser una decisión consciente, no un accidente.
const EXCEPCIONES = {
  'cfg.js': 2,     // Date() (mensaje de prueba a Sentry) + 'd' (fecha ya parseada)
  'informes.js': 1, // Date() (timestamp del PDF)
  'neu.js': 3,      // v?.toLocaleString(...)||'—'/'0' — distingue sin-dato de cero
  'uso.js': 1,      // Date(f.ultima)
};

describe('Consolidación de formato de números: fn() es la única fuente, sin reimplementaciones sueltas', () => {
  it('ninguna pestaña tiene más llamadas a .toLocaleString() de las ya revisadas y documentadas como excepción (fecha, o distingue sin-dato de cero)', () => {
    for (const file of glob) {
      const txt = fs.readFileSync(path.join(__dirname, '../modules/renders', file), 'utf8');
      const n = (txt.match(/\.toLocaleString\(/g) || []).length;
      const esperado = EXCEPCIONES[file] || 0;
      expect(n, `${file}: se esperaban ${esperado} llamada(s) documentada(s) a .toLocaleString(), se encontraron ${n}. Si es una fecha nueva, agrégala a EXCEPCIONES con el motivo; si es un número, usa fn() en vez de .toLocaleString().`).toBe(esperado);
    }
  });

  it('cos.js y kpi.js calculan MTTR llamando a la fuente única C.mttrReal(), no con una copia local', () => {
    const cos = fs.readFileSync(path.join(__dirname, '../modules/renders/cos.js'), 'utf8');
    const kpi = fs.readFileSync(path.join(__dirname, '../modules/renders/kpi.js'), 'utf8');
    expect(cos).toMatch(/C\.mttrReal\(/);
    expect(kpi).toMatch(/C\.mttrReal\(/);
  });
});
