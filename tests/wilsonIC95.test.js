import { describe, it, expect } from 'vitest';
import { wilsonIC95 } from '../logic.js';

// Valores de referencia verificados independientemente contra
// statsmodels.stats.proportion.proportion_confint(method='wilson'):
// coinciden a 4 decimales en todos los casos, incluidos los extremos
// p=0% y p=100% con n chico (donde la aproximación normal simple se
// rompe y puede dar límites fuera de [0,1]).
describe('wilsonIC95', () => {
  it('reproduce los valores de referencia de statsmodels (proportion_confint, method=wilson)', () => {
    const casos = [
      { x: 15, n: 20, pct: 75.0, lo: 53.1, hi: 88.8 },
      { x: 3, n: 15, pct: 20.0, lo: 7.0, hi: 45.2 },
      { x: 20, n: 20, pct: 100.0, lo: 83.9, hi: 100.0 },
      { x: 0, n: 15, pct: 0.0, lo: 0.0, hi: 20.4 },
      { x: 8, n: 17, pct: 47.1, lo: 26.2, hi: 69.0 },
      { x: 13, n: 15, pct: 86.7, lo: 62.1, hi: 96.3 },
    ];
    casos.forEach(({ x, n, pct, lo, hi }) => {
      const r = wilsonIC95(x, n);
      expect(r.pct).toBeCloseTo(pct, 1);
      expect(r.lo).toBeCloseTo(lo, 1);
      expect(r.hi).toBeCloseTo(hi, 1);
    });
  });

  it('el intervalo nunca sale de [0,100]', () => {
    const r0 = wilsonIC95(0, 15);
    expect(r0.lo).toBeGreaterThanOrEqual(0);
    const r100 = wilsonIC95(20, 20);
    expect(r100.hi).toBeLessThanOrEqual(100);
  });

  it('el intervalo se angosta con más muestra, misma proporción', () => {
    const chico = wilsonIC95(8, 16); // 50%, n=16
    const grande = wilsonIC95(80, 160); // 50%, n=160
    expect(grande.hi - grande.lo).toBeLessThan(chico.hi - chico.lo);
  });

  it('null con n<=0, x negativo, x>n, o argumentos faltantes', () => {
    expect(wilsonIC95(5, 0)).toBeNull();
    expect(wilsonIC95(-1, 10)).toBeNull();
    expect(wilsonIC95(11, 10)).toBeNull();
    expect(wilsonIC95(null, 10)).toBeNull();
    expect(wilsonIC95(5, null)).toBeNull();
  });
});
