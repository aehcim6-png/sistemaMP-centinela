const { agruparPeriodo } = require('../logic.js');

describe('agruparPeriodo', () => {
  it('devuelve el mismo mes cuando la granularidad es mes', () => {
    expect(agruparPeriodo('2024-03', 'mes')).toBe('2024-03');
  });

  it('acepta una fecha ISO completa y la reduce a mes', () => {
    expect(agruparPeriodo('2024-03-15', 'mes')).toBe('2024-03');
  });

  it('agrupa por semestre: meses 1-6 en S1, 7-12 en S2', () => {
    expect(agruparPeriodo('2024-01', 'semestre')).toBe('2024-S1');
    expect(agruparPeriodo('2024-06', 'semestre')).toBe('2024-S1');
    expect(agruparPeriodo('2024-07', 'semestre')).toBe('2024-S2');
    expect(agruparPeriodo('2024-12', 'semestre')).toBe('2024-S2');
  });

  it('agrupa por año', () => {
    expect(agruparPeriodo('2024-07-20', 'año')).toBe('2024');
  });

  it('sin granularidad (undefined) se comporta como "mes" (fallback de cada llamador)', () => {
    // agruparPeriodo en sí no aplica un default — cada llamador ya resuelve
    // gran=gran||'mes' antes de invocarla. Acá solo se confirma que un valor
    // no reconocido cae al comportamiento de "mes" (return mes sin agrupar).
    expect(agruparPeriodo('2024-03', undefined)).toBe('2024-03');
  });
});
