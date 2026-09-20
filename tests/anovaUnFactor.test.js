import { describe, it, expect } from 'vitest';
import { anovaUnFactor } from '../logic.js';

describe('anovaUnFactor', () => {
  it('null con menos de 2 grupos válidos (uno solo cumple minPorGrupo)', () => {
    expect(anovaUnFactor({ a: [1, 2, 3, 4, 5, 6] }, 5)).toBeNull();
    expect(anovaUnFactor({}, 5)).toBeNull();
    expect(anovaUnFactor(null, 5)).toBeNull();
  });

  it('descarta grupos con menos de minPorGrupo observaciones antes del test', () => {
    // 'chico' tiene solo 3 valores (< minPorGrupo=5) — debe quedar afuera,
    // y con solo 2 grupos válidos restantes (a, b) igual corre el test.
    const r = anovaUnFactor({ a: [4, 5, 3, 6, 4, 5], b: [8, 9, 7, 10, 8, 9], chico: [1, 1, 1] }, 5);
    expect(r).not.toBeNull();
    expect(r.k).toBe(2);
    expect(r.grupos.map((g) => g.grupo).sort()).toEqual(['a', 'b']);
  });

  it('diferencia real entre 3 técnicos (F y p-valor verificados contra scipy.stats.f_oneway)', () => {
    // Verificado independientemente con scipy antes de escribir el test:
    // F=31.032110, p≈4.6696952592e-06 (referencia calculada a mano con
    // sumas de cuadrados, coincide con scipy.stats.f_oneway).
    const grupos = {
      tecA: [4, 5, 3, 6, 4, 5, 4],
      tecB: [8, 9, 7, 10, 8, 9],
      tecC: [5, 6, 4, 5, 6],
    };
    const r = anovaUnFactor(grupos, 5);
    expect(r).not.toBeNull();
    expect(r.k).toBe(3);
    expect(r.N).toBe(18);
    expect(r.glEntre).toBe(2);
    expect(r.glDentro).toBe(15);
    expect(r.F).toBeCloseTo(31.032, 2);
    expect(r.pValor).toBeCloseTo(4.6696952592e-6, 10);
    expect(r.significativo).toBe(true);
    // El grupo con mayor media (tecB, 8.29) debe quedar primero (orden desc).
    expect(r.grupos[0].grupo).toBe('tecB');
  });

  it('caso realista de MTTR por técnico (3 técnicos, uno visiblemente más lento)', () => {
    // Verificado contra scipy: F≈37.671619, p≈1.130e-07. Medias/desv.est.
    // también verificadas contra numpy.mean/std(ddof=1).
    const grupos = {
      juan: [4, 5, 3, 6, 4, 5, 4, 5],
      pedro: [8, 9, 7, 10, 8, 9, 7],
      luis: [5, 4, 6, 5, 5, 4, 6, 5, 5],
    };
    const r = anovaUnFactor(grupos, 5);
    expect(r).not.toBeNull();
    expect(r.F).toBeCloseTo(37.672, 2);
    expect(r.pValor).toBeCloseTo(1.130e-7, 9);
    expect(r.significativo).toBe(true);
    const pedro = r.grupos.find((g) => g.grupo === 'pedro');
    expect(pedro.n).toBe(7);
    expect(pedro.media).toBeCloseTo(8.29, 1);
    expect(pedro.desvEst).toBeCloseTo(1.11, 1);
  });

  it('sin diferencia real: F bajo, p alto, no significativo (verificado contra scipy)', () => {
    // Verificado contra scipy: F≈0.041667, p≈0.9592816914.
    const grupos = {
      a: [10, 12, 11, 13, 12, 10, 11],
      b: [11, 10, 13, 12, 11, 12, 10],
      c: [12, 11, 10, 13, 11, 12, 11],
    };
    const r = anovaUnFactor(grupos, 5);
    expect(r).not.toBeNull();
    expect(r.F).toBeCloseTo(0.0417, 3);
    expect(r.pValor).toBeCloseTo(0.9592816914, 6);
    expect(r.significativo).toBe(false);
  });

  it('2 grupos (mínimo matemático de ANOVA) — verificado contra scipy', () => {
    // Verificado contra scipy: F≈37.692308, p≈1.098407e-04.
    const grupos = { x: [10, 12, 11, 13, 10, 12], y: [15, 17, 16, 14, 18, 16] };
    const r = anovaUnFactor(grupos, 5);
    expect(r).not.toBeNull();
    expect(r.k).toBe(2);
    expect(r.F).toBeCloseTo(37.692, 2);
    expect(r.pValor).toBeCloseTo(1.098407e-4, 8);
  });

  it('ignora valores null/undefined/NaN dentro de un grupo, no interrumpe el cálculo', () => {
    const conNulos = { a: [4, 5, 3, 6, 4, null, 5, undefined], b: [8, 9, 7, 10, 8, 9] };
    const sinNulos = { a: [4, 5, 3, 6, 4, 5], b: [8, 9, 7, 10, 8, 9] };
    const r1 = anovaUnFactor(conNulos, 5);
    const r2 = anovaUnFactor(sinNulos, 5);
    expect(r1.F).toBe(r2.F);
    expect(r1.pValor).toBe(r2.pValor);
  });
});
