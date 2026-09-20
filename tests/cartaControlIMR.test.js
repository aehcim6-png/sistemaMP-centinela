import { describe, it, expect } from 'vitest';
import { cartaControlIMR } from '../logic.js';

describe('cartaControlIMR', () => {
  it('null con menos de 6 puntos válidos', () => {
    expect(cartaControlIMR([])).toBeNull();
    expect(cartaControlIMR(null)).toBeNull();
    const pocos = [
      { periodo: '2026-01', valor: 100 },
      { periodo: '2026-02', valor: 105 },
      { periodo: '2026-03', valor: 98 },
      { periodo: '2026-04', valor: 102 },
      { periodo: '2026-05', valor: 99 },
    ];
    expect(cartaControlIMR(pocos)).toBeNull();
  });

  it('descarta puntos inválidos (sin periodo, sin valor, valor NaN) antes de contar el mínimo', () => {
    const puntos = [
      { periodo: '2026-01', valor: 100 },
      { periodo: '2026-02', valor: 105 },
      { periodo: '2026-03', valor: 98 },
      { periodo: null, valor: 999 },
      { periodo: '2026-04', valor: null },
      { periodo: '2026-05', valor: 102 },
      { periodo: '2026-06', valor: 99 },
    ];
    // Solo 5 puntos válidos -> sigue bajo el mínimo de 6.
    expect(cartaControlIMR(puntos)).toBeNull();
  });

  it('serie de 9 meses con un mes fuera de control (verificado independientemente con Python)', () => {
    // Verificado con Python antes de escribir el test (misma fórmula):
    // valores = [100,105,98,102,99,101,97,104,300]
    // xBarra≈122.8889, mrBarra=28.5, UCL≈198.6989, LCL≈47.0789, UCL_MR≈93.1095
    // único punto fuera de control: 300 (mes 09).
    const periodos = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    const valores = [100, 105, 98, 102, 99, 101, 97, 104, 300];
    const puntos = periodos.map((p, i) => ({ periodo: p, valor: valores[i] }));
    const r = cartaControlIMR(puntos);
    expect(r).not.toBeNull();
    expect(r.n).toBe(9);
    expect(r.xBarra).toBeCloseTo(122.89, 1);
    expect(r.mrBarra).toBeCloseTo(28.5, 1);
    expect(r.UCL).toBeCloseTo(198.7, 1);
    expect(r.LCL).toBeCloseTo(47.08, 1);
    expect(r.UCL_MR).toBeCloseTo(93.11, 1);
    expect(r.puntosFueraControl).toBe(1);
    expect(r.detalle[8].periodo).toBe('2026-09');
    expect(r.detalle[8].fueraControl).toBe(true);
    expect(r.detalle[8].rangoMovilFueraControl).toBe(true);
    // Los primeros 8 meses, todos dentro de control.
    for (let i = 0; i < 8; i++) expect(r.detalle[i].fueraControl).toBe(false);
  });

  it('serie estable de 6 meses: sin puntos fuera de control', () => {
    const puntos = [
      { periodo: '2026-01', valor: 1000 },
      { periodo: '2026-02', valor: 1050 },
      { periodo: '2026-03', valor: 980 },
      { periodo: '2026-04', valor: 1020 },
      { periodo: '2026-05', valor: 995 },
      { periodo: '2026-06', valor: 1010 },
    ];
    const r = cartaControlIMR(puntos);
    expect(r).not.toBeNull();
    expect(r.puntosFueraControl).toBe(0);
    r.detalle.forEach((d) => expect(d.fueraControl).toBe(false));
  });

  it('ordena los puntos por periodo aunque lleguen desordenados', () => {
    const puntos = [
      { periodo: '2026-03', valor: 98 },
      { periodo: '2026-01', valor: 100 },
      { periodo: '2026-06', valor: 99 },
      { periodo: '2026-02', valor: 105 },
      { periodo: '2026-05', valor: 995 },
      { periodo: '2026-04', valor: 1020 },
    ];
    const r = cartaControlIMR(puntos);
    expect(r.detalle.map((d) => d.periodo)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  });
});
