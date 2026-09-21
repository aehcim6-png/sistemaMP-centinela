import { describe, it, expect } from 'vitest';
import { mannKendallTendencia } from '../logic.js';

// Series de referencia verificadas independientemente contra la librería
// pymannkendall (original_test): S, Var(S), Z y pendiente de Sen coinciden
// exactamente en los tres casos.
describe('mannKendallTendencia', () => {
  it('serie creciente: reproduce S=13, varS=28.33, z=2.2544, sen=1.68 (pymannkendall)', () => {
    const r = mannKendallTendencia([72.1, 74.5, 73.8, 76.2, 78.0, 80.5]);
    expect(r.S).toBe(13);
    expect(r.varS).toBeCloseTo(28.33, 1);
    expect(r.z).toBeCloseTo(2.25, 1);
    expect(r.senSlope).toBeCloseTo(1.68, 2);
    expect(r.significativo).toBe(true);
    expect(r.tendencia).toBe('mejorando');
  });

  it('serie ruidosa sin tendencia real: S=-1, z=0, sen~0, no significativo (pymannkendall)', () => {
    const r = mannKendallTendencia([75.0, 78.2, 73.1, 77.5, 74.8, 76.3]);
    expect(r.S).toBe(-1);
    expect(r.z).toBe(0);
    expect(r.senSlope).toBeCloseTo(-0.05, 2);
    expect(r.significativo).toBe(false);
    expect(r.tendencia).toBe('sin_certeza');
  });

  it('serie decreciente con empates: reproduce S=-12, varS=25.33, z=-2.1855, sen=-1 (pymannkendall)', () => {
    const r = mannKendallTendencia([80.0, 80.0, 78.0, 78.0, 76.0, 76.0]);
    expect(r.S).toBe(-12);
    expect(r.varS).toBeCloseTo(25.33, 1);
    expect(r.z).toBeCloseTo(-2.19, 1);
    expect(r.senSlope).toBeCloseTo(-1, 2);
    expect(r.significativo).toBe(true);
    expect(r.tendencia).toBe('empeorando');
  });

  it('null con menos de 4 puntos válidos', () => {
    expect(mannKendallTendencia([1, 2, 3])).toBeNull();
    expect(mannKendallTendencia([])).toBeNull();
    expect(mannKendallTendencia(null)).toBeNull();
  });

  it('ignora valores null/undefined/NaN dentro de la serie, contando solo los válidos', () => {
    const r = mannKendallTendencia([72.1, null, 74.5, 73.8, undefined, 76.2, 78.0, 80.5]);
    expect(r.n).toBe(6);
    expect(r.S).toBe(13);
  });

  it('serie perfectamente constante: S=0, sin tendencia', () => {
    const r = mannKendallTendencia([80, 80, 80, 80, 80]);
    expect(r.S).toBe(0);
    expect(r.z).toBe(0);
    expect(r.significativo).toBe(false);
    expect(r.tendencia).toBe('sin_certeza');
  });
});
