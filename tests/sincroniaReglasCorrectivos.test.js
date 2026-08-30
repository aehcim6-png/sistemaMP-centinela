const fs = require('fs');
const path = require('path');

// Guardarraíl automático (2026-08-30, mismo espíritu que los otros tests de
// sincronía en esta carpeta): "Documentación por Técnico" y "Reingresos
// Tempranos" existen en DOS lugares — la vista interactiva (ot.js, botones
// bajo Correctivos) y el correo diario (alerta-pm/index.ts, secciones 7 y
// 9) — con la MISMA regla de negocio reimplementada a mano en cada uno
// (Deno no puede importar ot.js). Si alguien ajusta un umbral en una vista
// (ej. sube el mínimo de 15 OT a 20, o cambia la ventana de reingreso de 7 a
// 10 días) sin replicarlo en el otro lado, el correo y la pantalla
// empezarían a decir cosas distintas sobre el mismo técnico — silenciosamente.

function leer(rutaRelativa) {
  return fs.readFileSync(path.join(__dirname, '..', rutaRelativa), 'utf8');
}

// Extrae el contenido de un array literal `[...]` que empieza justo después
// del texto `marcador` (ej. "const EXCLUIR=" o "Set(").
function extraerArrayLiteral(txt, marcador) {
  const idx = txt.indexOf(marcador);
  if (idx < 0) throw new Error(`No se encontró "${marcador}"`);
  const inicio = txt.indexOf('[', idx);
  let profundidad = 0, fin = -1;
  for (let i = inicio; i < txt.length; i++) {
    if (txt[i] === '[') profundidad++;
    else if (txt[i] === ']') { profundidad--; if (profundidad === 0) { fin = i; break; } }
  }
  // eslint-disable-next-line no-eval
  return eval(txt.slice(inicio, fin + 1));
}

describe('Sincronía de reglas de Documentación/Reingresos entre ot.js y alerta-pm/index.ts', () => {
  const ot = leer('modules/renders/ot.js');
  const pm = leer('supabase/functions/alerta-pm/index.ts');

  it('la lista de componentes-consumibles excluidos de "reingresos tempranos" es la MISMA en ambos lados', () => {
    const listaOt = extraerArrayLiteral(ot, 'const EXCLUIR=');
    const listaPm = extraerArrayLiteral(pm, 'const EXCLUIR_REINGRESO = new Set(');
    expect(new Set(listaPm)).toEqual(new Set(listaOt));
    expect(listaPm.length).toBe(listaOt.length); // detecta duplicados accidentales también
  });

  it('el umbral mínimo de OT para entrar en "Documentación por Técnico" (15) es el MISMO en ambos lados', () => {
    expect(ot.match(/porTecnico\)\.filter\(function\(t\)\{return t\.total>=(\d+);/)[1]).toBe('15');
    expect(pm.match(/\.filter\(\(t\) => t\.total >= (\d+) && t\.pct < 50\)/)[1]).toBe('15');
  });

  it('el umbral de "baja documentación" (<50%) es el MISMO en ambos lados', () => {
    // ot.js lo usa para el color del semáforo en la tabla; alerta-pm lo usa
    // para decidir si ese técnico entra en el correo — deben coincidir o el
    // correo avisaría de menos (o más) técnicos que los que se ven en rojo
    // en pantalla.
    expect(ot.match(/var col=t\.pct<(\d+)\?'var\(--danger\)'/)[1]).toBe('50');
    expect(pm.match(/&& t\.pct < (\d+)\)/)[1]).toBe('50');
  });

  it('la ventana de "reingreso temprano" (≤7 días) es la MISMA en ambos lados', () => {
    expect(ot.match(/dias>=0&&dias<=(\d+)\)porTecnico/)[1]).toBe('7');
    expect(pm.match(/dias >= 0 && dias <= (\d+)\) porTecnicoReingreso/)[1]).toBe('7');
  });

  it('el umbral mínimo de OT para entrar en "Reingresos Tempranos" (15) es el MISMO en ambos lados', () => {
    const otMin = ot.slice(ot.indexOf('window.analisisReingresos')).match(/filter\(function\(t\)\{return t\.total>=(\d+);/)[1];
    const pmMin = pm.match(/\.filter\(\(t\) => t\.total >= (\d+) && t\.pct >= 15\)/)[1];
    expect(pmMin).toBe(otMin);
  });
});
