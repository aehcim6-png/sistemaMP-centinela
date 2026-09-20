import { describe, it, expect } from 'vitest';
import { logRankTest, kaplanMeierCorrectivosPorComponente } from '../logic.js';

describe('logRankTest', () => {
  it('null con menos de 5 observaciones en algún grupo', () => {
    const grupoA = [{ tiempo: 5, censurado: false }, { tiempo: 8, censurado: false }];
    const grupoB = [
      { tiempo: 5, censurado: false }, { tiempo: 8, censurado: false }, { tiempo: 10, censurado: false },
      { tiempo: 12, censurado: false }, { tiempo: 15, censurado: false },
    ];
    expect(logRankTest(grupoA, grupoB)).toBeNull();
    expect(logRankTest([], grupoB)).toBeNull();
    expect(logRankTest(null, grupoB)).toBeNull();
  });

  it('null si ninguno de los dos grupos tiene una falla real (todo censurado)', () => {
    const soloCensurados = Array(5).fill(null).map((_, i) => ({ tiempo: 10 + i, censurado: true }));
    expect(logRankTest(soloCensurados, soloCensurados)).toBeNull();
  });

  it('diferencia chica entre 2 grupos de 6, con censura: NO significativa (verificado con Python)', () => {
    // Verificado independientemente con Python (mismo algoritmo, escrito
    // desde cero a partir de la fórmula estándar, antes de escribir el
    // test): O_A=5, E_A≈3.5889, V≈1.983, χ²≈1.0042 — no supera 3.841 (gl=1).
    const grupoA = [
      { tiempo: 4, censurado: false }, { tiempo: 6, censurado: false }, { tiempo: 6, censurado: false },
      { tiempo: 9, censurado: false }, { tiempo: 14, censurado: false }, { tiempo: 19, censurado: true },
    ];
    const grupoB = [
      { tiempo: 7, censurado: false }, { tiempo: 10, censurado: false }, { tiempo: 10, censurado: false },
      { tiempo: 15, censurado: false }, { tiempo: 15, censurado: false }, { tiempo: 25, censurado: true },
    ];
    const r = logRankTest(grupoA, grupoB);
    expect(r).not.toBeNull();
    expect(r.observadoA).toBe(5);
    expect(r.esperadoA).toBeCloseTo(3.59, 1);
    expect(r.chi2).toBeCloseTo(1.0, 1);
    expect(r.significativo).toBe(false);
    expect(r.nA).toBe(6);
    expect(r.nB).toBe(6);
    expect(r.fallasA).toBe(5);
    expect(r.fallasB).toBe(5);
  });

  it('diferencia grande entre 2 grupos de 8: SÍ significativa (verificado con Python)', () => {
    // Verificado independientemente con Python: O_A=8, E_A≈2.697, V≈1.6598,
    // χ²≈16.94 — supera 3.841 con margen amplio.
    const grupoA = [3, 4, 5, 6, 7, 8, 9, 10].map((t) => ({ tiempo: t, censurado: false }));
    const grupoB = [
      { tiempo: 15, censurado: true },
      { tiempo: 20, censurado: false }, { tiempo: 22, censurado: false }, { tiempo: 25, censurado: false },
      { tiempo: 28, censurado: false }, { tiempo: 30, censurado: false },
      { tiempo: 32, censurado: true }, { tiempo: 35, censurado: true },
    ];
    const r = logRankTest(grupoA, grupoB);
    expect(r).not.toBeNull();
    expect(r.observadoA).toBe(8);
    expect(r.esperadoA).toBeCloseTo(2.7, 1);
    expect(r.chi2).toBeCloseTo(16.94, 1);
    expect(r.significativo).toBe(true);
    expect(r.fallasA).toBe(8);
    expect(r.fallasB).toBe(5);
  });

  it('kaplanMeierCorrectivosPorComponente expone las observaciones crudas (obs) para poder comparar pares de componentes', () => {
    const eventos = [];
    ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'].forEach((sigla, i) => {
      eventos.push({ sigla, componente: 'Motor', horom: 100 });
      eventos.push({ sigla, componente: 'Motor', horom: 100 + 500 + i * 10 });
    });
    const lista = kaplanMeierCorrectivosPorComponente(eventos, []);
    const motor = lista.find((g) => g.componente === 'Motor');
    expect(motor).toBeDefined();
    expect(Array.isArray(motor.obs)).toBe(true);
    expect(motor.obs.length).toBe(motor.n);
    expect(motor.obs.every((o) => o.tiempo > 0 && typeof o.censurado === 'boolean')).toBe(true);
  });
});
