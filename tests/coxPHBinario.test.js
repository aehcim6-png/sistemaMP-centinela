import { describe, it, expect } from 'vitest';
import { coxPHBinario } from '../logic.js';

describe('coxPHBinario', () => {
  it('null con menos de 5 observaciones en algún grupo', () => {
    const grupoA = [{ tiempo: 5, censurado: false }, { tiempo: 8, censurado: false }];
    const grupoB = [
      { tiempo: 5, censurado: false }, { tiempo: 8, censurado: false }, { tiempo: 10, censurado: false },
      { tiempo: 12, censurado: false }, { tiempo: 15, censurado: false },
    ];
    expect(coxPHBinario(grupoA, grupoB)).toBeNull();
    expect(coxPHBinario([], grupoB)).toBeNull();
    expect(coxPHBinario(null, grupoB)).toBeNull();
  });

  it('caso normal: coincide con statsmodels.duration.hazard_regression.PHReg (ties=breslow)', () => {
    // Verificado independientemente contra statsmodels PHReg antes de
    // escribir el test (mismos datos que la prueba "no significativa" de
    // logRankTest.test.js): β≈-0.600873, SE≈0.643879, HR≈0.548333,
    // z≈-0.933207 — coincide a 5+ decimales con mi implementación.
    const grupoA = [
      { tiempo: 4, censurado: false }, { tiempo: 6, censurado: false }, { tiempo: 6, censurado: false },
      { tiempo: 9, censurado: false }, { tiempo: 14, censurado: false }, { tiempo: 19, censurado: true },
    ];
    const grupoB = [
      { tiempo: 7, censurado: false }, { tiempo: 10, censurado: false }, { tiempo: 10, censurado: false },
      { tiempo: 15, censurado: false }, { tiempo: 15, censurado: false }, { tiempo: 25, censurado: true },
    ];
    const r = coxPHBinario(grupoA, grupoB);
    expect(r).not.toBeNull();
    expect(r.beta).toBeCloseTo(-0.601, 2);
    expect(r.se).toBeCloseTo(0.644, 2);
    expect(r.hr).toBeCloseTo(0.55, 1);
    expect(r.z).toBeCloseTo(-0.93, 1);
    expect(r.significativo).toBe(false);
    expect(r.nA).toBe(6);
    expect(r.nB).toBe(6);
    expect(r.fallasA).toBe(5);
    expect(r.fallasB).toBe(5);
    // HR<1 -> grupoB falla más lento que grupoA (consistente con logRankTest,
    // donde O_A=5>E_A: grupoA acumula más fallas de las esperadas).
    expect(r.hr).toBeLessThan(1);
  });

  it('separación perfecta entre grupos: null (la verosimilitud diverge, no se inventa un HR)', () => {
    // Mismo dataset donde logRankTest da χ²≈16.94 (separación total, ningún
    // solapamiento de tiempos entre grupos) — verificado independientemente
    // que tanto mi algoritmo como statsmodels PHReg DIVERGEN acá (β se va a
    // valores absurdos, SE explota). La guardia de convergencia/magnitud
    // debe devolver null, no un número sin sentido.
    const grupoA = [3, 4, 5, 6, 7, 8, 9, 10].map((t) => ({ tiempo: t, censurado: false }));
    const grupoB = [
      { tiempo: 15, censurado: true },
      { tiempo: 20, censurado: false }, { tiempo: 22, censurado: false }, { tiempo: 25, censurado: false },
      { tiempo: 28, censurado: false }, { tiempo: 30, censurado: false },
      { tiempo: 32, censurado: true }, { tiempo: 35, censurado: true },
    ];
    expect(coxPHBinario(grupoA, grupoB)).toBeNull();
  });

  it('sin fallas reales en ningún grupo: null', () => {
    const soloCensurados = Array(5).fill(null).map((_, i) => ({ tiempo: 10 + i, censurado: true }));
    expect(coxPHBinario(soloCensurados, soloCensurados)).toBeNull();
  });
});
