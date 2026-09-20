import { describe, it, expect } from 'vitest';
import { kruskalWallis } from '../logic.js';

// Datasets verificados independientemente contra scipy.stats.kruskal.
// 3 grupos con distribución asimétrica (log-normal): C es claramente más
// lento que A y B.
const A = [6.68, 2.96, 2.74, 1.15, 3.31, 2.92, 2.68, 3.77, 3.93, 2.17, 2.33, 2.74, 4.37, 4.16, 1.97];
const B = [2.34, 4.93, 6.89, 3.62, 2.79, 5.69, 3.24, 4.91, 6.82, 4.72, 3.78, 4.92];
const C = [7.71, 9.29, 7.93, 9.19, 8.21, 9.26, 8.57, 10.34, 10.23, 11.23, 17.48, 5.37, 16.75, 9.07];

// Mismos datos redondeados a enteros -> genera empates reales (relevante
// porque horas de reparación se tipean como enteros en la práctica).
const A2 = [7, 3, 3, 1, 3, 3, 3, 4, 4, 2, 2, 3, 4, 4, 2];
const B2 = [2, 5, 7, 4, 3, 6, 3, 5, 7, 5, 4, 5];
const C2 = [8, 9, 8, 9, 8, 9, 9, 10, 10, 11, 17, 5, 17, 9];

describe('kruskalWallis', () => {
  it('reproduce el valor de referencia de scipy.stats.kruskal (sin empates)', () => {
    const r = kruskalWallis({ A, B, C }, 5);
    expect(r.H).toBeCloseTo(28.72, 1);
    expect(r.gl).toBe(2);
    expect(r.critico).toBeCloseTo(5.991, 2);
    expect(r.significativo).toBe(true);
  });

  it('reproduce el valor de referencia de scipy.stats.kruskal CON empates (corrección aplicada)', () => {
    const r = kruskalWallis({ A: A2, B: B2, C: C2 }, 5);
    expect(r.H).toBeCloseTo(28.567, 1);
    expect(r.significativo).toBe(true);
  });

  it('grupos con la misma distribución no son significativos', () => {
    const iguales = { X: [5, 6, 4, 5, 6, 4, 5, 6], Y: [5, 4, 6, 5, 4, 6, 5, 4], Z: [6, 5, 4, 6, 5, 4, 6, 5] };
    const r = kruskalWallis(iguales, 5);
    expect(r.significativo).toBe(false);
  });

  it('null con menos de 2 grupos con muestra suficiente', () => {
    expect(kruskalWallis({ A: [1, 2, 3, 4, 5, 6] }, 5)).toBeNull();
    expect(kruskalWallis({ A: [1, 2], B: [1, 2] }, 5)).toBeNull();
    expect(kruskalWallis({}, 5)).toBeNull();
    expect(kruskalWallis(null, 5)).toBeNull();
  });

  it('descarta grupos por debajo del mínimo de muestra, pero sigue si quedan >=2', () => {
    const r = kruskalWallis({ A, B, C, D: [1, 2] }, 5);
    expect(r.k).toBe(3);
    expect(r.grupos.find((g) => g.grupo === 'D')).toBeUndefined();
  });

  it('reporta mediana y n por grupo, ordenados de menor a mayor mediana', () => {
    const r = kruskalWallis({ A, B, C }, 5);
    expect(r.grupos.map((g) => g.grupo)).toEqual(['A', 'B', 'C']);
    expect(r.grupos[0].n).toBe(15);
    expect(r.grupos[2].mediana).toBeGreaterThan(r.grupos[0].mediana);
  });
});
