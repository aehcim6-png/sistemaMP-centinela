const { C } = require('../logic.js');

// C.mttrReal (2026-08-30): consolida en una sola fuente el cálculo de MTTR
// (tiempo medio de reparación) que estaba reimplementado por separado, casi
// línea por línea, en cos.js y kpi.js — hallazgo del inventario de
// duplicación de esta sesión (a diferencia de mtbfReal, el cálculo hermano,
// que ya tenía una fuente única desde antes). Este test fija el
// comportamiento EXACTO de las dos copias originales (denominador = OT con
// 'duracion' registrada, no solo las que matchean el regex; 0 en vez de
// null cuando no hay ninguna) para que el refactor no haya cambiado ningún
// número que ya se ve en pantalla.

describe('C.mttrReal', () => {
  it('devuelve 0 (no null) cuando no hay reparaciones', () => {
    expect(C.mttrReal([])).toBe(0);
    expect(C.mttrReal(null)).toBe(0);
    expect(C.mttrReal(undefined)).toBe(0);
  });

  it('ignora entradas vacías o "—" (sin duración registrada)', () => {
    expect(C.mttrReal([null, undefined, '', '—'])).toBe(0);
  });

  it('promedia las horas parseadas del formato "Xh"', () => {
    expect(C.mttrReal(['4h', '8h'])).toBe(6);
    expect(C.mttrReal(['3h', '5h', '7h'])).toBe(5);
  });

  it('redondea a 1 decimal', () => {
    expect(C.mttrReal(['1h', '2h', '2h'])).toBe(1.7); // 5/3 = 1.666... -> 1.7
  });

  it('mismo comportamiento exacto de las 2 copias originales: el denominador cuenta TODAS las reparaciones con duración registrada, aunque alguna no matchee el formato "Xh" (esto ya pasaba en cos.js/kpi.js antes de consolidar — se preserva, no se inventa)', () => {
    // 2 reparaciones con duración registrada, pero solo 1 matchea "Xh" ->
    // denominador 2, no 1.
    expect(C.mttrReal(['6h', 'formato raro'])).toBe(3); // 6/2, no 6/1
  });

  it('caso real equivalente al que ya se ve en pantalla (cos.js/kpi.js): mezcla de OT con y sin duración', () => {
    const duraciones = ['—', null, '4h', '4h', '4h', '4h']; // 4 reparaciones válidas, todas 4h
    expect(C.mttrReal(duraciones)).toBe(4);
  });
});
