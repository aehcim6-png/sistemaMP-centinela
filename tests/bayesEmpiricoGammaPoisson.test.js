import { describe, it, expect } from 'vitest';
import { bayesEmpiricoGammaPoisson } from '../logic.js';

describe('bayesEmpiricoGammaPoisson', () => {
  it('null con menos de 5 grupos con exposición real', () => {
    const pocos = [
      { id: 'A', n: 2, exposicion: 10 },
      { id: 'B', n: 5, exposicion: 8 },
      { id: 'C', n: 1, exposicion: 15 },
      { id: 'D', n: 8, exposicion: 12 },
    ];
    expect(bayesEmpiricoGammaPoisson(pocos)).toBeNull();
    expect(bayesEmpiricoGammaPoisson([])).toBeNull();
    expect(bayesEmpiricoGammaPoisson(null)).toBeNull();
  });

  it('descarta grupos sin exposición real antes de contar el mínimo', () => {
    const grupos = [
      { id: 'A', n: 2, exposicion: 10 },
      { id: 'B', n: 5, exposicion: 8 },
      { id: 'C', n: 1, exposicion: 15 },
      { id: 'D', n: 8, exposicion: 12 },
      { id: 'SIN-EXPO', n: 3, exposicion: 0 },
    ];
    // Solo 4 grupos con exposición real -> sigue bajo el mínimo.
    expect(bayesEmpiricoGammaPoisson(grupos)).toBeNull();
  });

  it('caso normal: hiperparámetros y estimación estabilizada por grupo (verificado independientemente con Python)', () => {
    // Verificado con Python antes de escribir el test (método de momentos,
    // desde cero): μ̂≈0.41667, σ²_entre≈0.025139, α≈6.90608, β≈16.57459,
    // λ̂ por grupo (orden A..F):
    // [0.33514, 0.48449, 0.25039, 0.52166, 0.43882, 0.50464]
    const grupos = [
      { id: 'A', n: 2, exposicion: 10 },
      { id: 'B', n: 5, exposicion: 8 },
      { id: 'C', n: 1, exposicion: 15 },
      { id: 'D', n: 8, exposicion: 12 },
      { id: 'E', n: 3, exposicion: 6 },
      { id: 'F', n: 6, exposicion: 9 },
    ];
    const r = bayesEmpiricoGammaPoisson(grupos);
    expect(r).not.toBeNull();
    expect(r.k).toBe(6);
    expect(r.fullShrink).toBe(false);
    expect(r.mu).toBeCloseTo(0.41667, 3);
    expect(r.sigma2Entre).toBeCloseTo(0.025139, 4);
    expect(r.alpha).toBeCloseTo(6.906, 1);
    expect(r.beta).toBeCloseTo(16.575, 1);
    const esperado = [0.33514, 0.48449, 0.25039, 0.52166, 0.43882, 0.50464];
    r.detalle.forEach((d, i) => {
      expect(d.tasaEstabilizada).toBeCloseTo(esperado[i], 3);
    });
    // La tasa cruda del grupo C (1/15≈0.0667) es mucho más chica que su
    // estimación estabilizada (0.250) -- con poca exposición propia, pesa
    // más el promedio de flota (shrinkage hacia μ̂≈0.417).
    expect(r.detalle[2].tasaCruda).toBeCloseTo(0.0667, 3);
    expect(r.detalle[2].tasaEstabilizada).toBeGreaterThan(r.detalle[2].tasaCruda);
  });

  it('sin heterogeneidad real entre grupos: shrinkage total a la tasa de flota (nunca inventa una diferencia)', () => {
    // Verificado con Python: las 4 tasas son EXACTAMENTE 0.2 -> σ²_entre
    // sale <=0 -> fullShrink=true, todos los grupos con μ̂=0.2.
    const grupos = [
      { id: 'A', n: 2, exposicion: 10 },
      { id: 'B', n: 4, exposicion: 20 },
      { id: 'C', n: 6, exposicion: 30 },
      { id: 'D', n: 8, exposicion: 40 },
      { id: 'E', n: 10, exposicion: 50 },
    ];
    const r = bayesEmpiricoGammaPoisson(grupos);
    expect(r).not.toBeNull();
    expect(r.fullShrink).toBe(true);
    expect(r.mu).toBeCloseTo(0.2, 5);
    expect(r.alpha).toBeNull();
    expect(r.beta).toBeNull();
    r.detalle.forEach((d) => expect(d.tasaEstabilizada).toBeCloseTo(0.2, 5));
  });
});
