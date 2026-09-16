import { describe, it, expect } from 'vitest';
const { testChiCuadradoUniforme, patronesOcultosFalla } = require('../logic.js');

describe('testChiCuadradoUniforme', () => {
  it('con menos de 2 categorías, o menos de 5 observaciones totales, devuelve null', () => {
    expect(testChiCuadradoUniforme({ A: 10 }, { A: 1 })).toBeNull();
    expect(testChiCuadradoUniforme({}, {})).toBeNull();
    expect(testChiCuadradoUniforme({ A: 2, B: 2 }, { A: 1, B: 1 })).toBeNull();
  });

  it('caso desbalanceado calculado a mano y verificado con script Python — χ²=36, significativo', () => {
    const r = testChiCuadradoUniforme({ Día: 80, Noche: 20 }, { Día: 1, Noche: 1 });
    expect(r.chi2).toBeCloseTo(36, 1);
    expect(r.gl).toBe(1);
    expect(r.critico).toBeCloseTo(3.841, 2);
    expect(r.significativo).toBe(true);
    expect(r.n).toBe(100);
  });

  it('caso balanceado calculado a mano — χ²=0.16, NO significativo (la diferencia es ruido de muestra)', () => {
    const r = testChiCuadradoUniforme({ Día: 52, Noche: 48 }, { Día: 1, Noche: 1 });
    expect(r.chi2).toBeCloseTo(0.16, 1);
    expect(r.significativo).toBe(false);
  });

  it('el índice por categoría es observado/esperado — mayor a 1 significa "falla más de lo esperado"', () => {
    const r = testChiCuadradoUniforme({ Día: 80, Noche: 20 }, { Día: 1, Noche: 1 });
    const dia = r.detalle.find((d) => d.categoria === 'Día');
    const noche = r.detalle.find((d) => d.categoria === 'Noche');
    expect(dia.indice).toBeGreaterThan(1);
    expect(noche.indice).toBeLessThan(1);
    // Ordenado de mayor a menor índice.
    expect(r.detalle[0].categoria).toBe('Día');
  });

  it('respeta exposición NO pareja (ej. días reales del mes) — un mes con más días esperando proporcionalmente más fallas no cuenta como patrón', () => {
    // 31 fallas en enero (31 días) vs 28 en febrero (28 días) — misma tasa diaria exacta, sin patrón real.
    const dias = { '01': 31, '02': 28 };
    const r = testChiCuadradoUniforme({ '01': 31, '02': 28 }, dias);
    expect(r.chi2).toBeCloseTo(0, 1);
    expect(r.significativo).toBe(false);
  });
});

describe('patronesOcultosFalla', () => {
  function ot(fecha, turno) {
    return { sigla: 'CN-1', tipo: 'Correctivo', fecha, turno, estadoOT: 'Cerrada' };
  }

  it('caso de estacionalidad real por mes, calculado a mano y verificado con script Python — χ²≈63,53, significativo', () => {
    const conteosMes = { '01': 20, '02': 18, '03': 5, '04': 5, '05': 4, '06': 4, '07': 5, '08': 5, '09': 4, '10': 5, '11': 4, '12': 21 };
    const correctivos = [];
    let id = 0;
    Object.keys(conteosMes).forEach((mm) => {
      for (let i = 0; i < conteosMes[mm]; i++) {
        correctivos.push(ot(`2025-${mm}-${String(1 + (i % 27)).padStart(2, '0')}`, i % 2 === 0 ? 'Día' : 'Noche'));
        id++;
      }
    });
    const r = patronesOcultosFalla(correctivos);
    expect(r.mes).not.toBeNull();
    expect(r.mes.chi2).toBeCloseTo(63.53, 0);
    expect(r.mes.gl).toBe(11);
    expect(r.mes.significativo).toBe(true);
    expect(r.mes.n).toBe(100);
  });

  it('detecta un desbalance real de turno (mismo caso 80/20 ya verificado)', () => {
    const correctivos = [];
    for (let i = 0; i < 80; i++) correctivos.push(ot('2025-0' + (1 + (i % 9)) + '-15', 'Día'));
    for (let i = 0; i < 20; i++) correctivos.push(ot('2025-0' + (1 + (i % 9)) + '-15', 'Noche'));
    const r = patronesOcultosFalla(correctivos);
    expect(r.turno).not.toBeNull();
    expect(r.turno.significativo).toBe(true);
    expect(r.turno.detalle[0].categoria).toBe('Día');
  });

  it('solo cuenta fallas reales (esFallaMTBF) e ignora correctivos sin fecha/turno válidos', () => {
    const correctivos = [
      { sigla: 'CN-1', tipo: 'Correctivo', fecha: '2025-01-01', turno: 'Día' },
      { sigla: 'CN-1', tipo: 'Fuera de Servicio', criticidad: 'No Aplica', fecha: '2025-01-02', turno: 'Noche' }, // no cuenta (no es falla real)
      { sigla: 'CN-1', tipo: 'Correctivo', fecha: '', turno: 'Día' }, // sin fecha
      { sigla: 'CN-1', tipo: 'Correctivo', fecha: '2025-01-03', turno: '' }, // sin turno
    ];
    const r = patronesOcultosFalla(correctivos);
    // Solo 1 correctivo real cuenta para mes (la fecha vacía se descarta); ninguno
    // tiene turno válido junto con suficiente muestra -> turno queda null (< 5 obs).
    expect(r.turno).toBeNull();
  });

  it('sin ningún dato real, ambos ejes devuelven null', () => {
    expect(patronesOcultosFalla([])).toEqual({ mes: null, turno: null });
  });
});
