import { describe, it, expect } from 'vitest';
import { levenePruebaVarianzas } from '../logic.js';

// Datasets verificados independientemente contra scipy.stats.levene
// (center='median', la variante Brown-Forsythe): 3 grupos con la MISMA
// media aproximada (~5) pero muy distinta variabilidad -- A y C
// consistentes, B muy inconsistente.
const A = [5.22, 4.83, 6.22, 4.87, 5.05, 5.79, 4.55, 4.7, 5.09, 4.84, 4.4, 4.9, 4.82, 5.3, 4.17];
const B = [3.25, 7.88, 9.64, 1.22, 6.61, 2.55, 2.86, 2.82, 3.94, 7.49, 6.78, 5.15, 4.09, 5.01, 4.74];
const C = [5.56, 4.56, 5.0, 4.93, 4.96, 5.17, 5.14, 5.93, 4.94, 6.09, 4.79, 4.67, 5.07, 5.25, 5.19];

describe('levenePruebaVarianzas', () => {
  it('reproduce el valor de referencia de scipy.stats.levene(center="median")', () => {
    const r = levenePruebaVarianzas({ A, B, C }, 5);
    expect(r.W).toBeCloseTo(17.083, 1);
    expect(r.pValor).toBeCloseTo(0.000004, 4);
    expect(r.significativo).toBe(true);
  });

  it('grupos con la misma variabilidad no son significativos', () => {
    const iguales = {
      X: [5, 5.5, 4.5, 5.2, 4.8, 5.1, 4.9, 5.3],
      Y: [5, 4.5, 5.5, 4.8, 5.2, 4.9, 5.1, 4.7],
      Z: [5.1, 5.4, 4.6, 5.0, 5.2, 4.8, 5.3, 4.9],
    };
    const r = levenePruebaVarianzas(iguales, 5);
    expect(r.significativo).toBe(false);
  });

  it('null con menos de 2 grupos con muestra suficiente', () => {
    expect(levenePruebaVarianzas({ A: [1, 2, 3, 4, 5, 6] }, 5)).toBeNull();
    expect(levenePruebaVarianzas({ A: [1, 2], B: [1, 2] }, 5)).toBeNull();
    expect(levenePruebaVarianzas({}, 5)).toBeNull();
    expect(levenePruebaVarianzas(null, 5)).toBeNull();
  });

  it('descarta grupos por debajo del mínimo de muestra, pero sigue si quedan >=2', () => {
    const r = levenePruebaVarianzas({ A, B, C, D: [1, 2] }, 5);
    expect(r.k).toBe(3);
    expect(r.grupos.find((g) => g.grupo === 'D')).toBeUndefined();
  });

  it('reporta n, mediana y desvío absoluto respecto a la mediana por grupo, ordenados de más a menos variable', () => {
    const r = levenePruebaVarianzas({ A, B, C }, 5);
    expect(r.grupos[0].grupo).toBe('B'); // el más inconsistente primero
    expect(r.grupos[0].n).toBe(15);
    expect(r.grupos[0].desvAbsMediana).toBeGreaterThan(r.grupos[r.grupos.length - 1].desvAbsMediana);
  });
});
