import { describe, it, expect } from 'vitest';
import { mannWhitneyU, indiceEfectividadMantenimiento } from '../logic.js';

describe('mannWhitneyU', () => {
  it('null con menos de 5 observaciones en alguna muestra', () => {
    expect(mannWhitneyU([1, 2, 3, 4], [1, 2, 3, 4, 5])).toBeNull();
    expect(mannWhitneyU([], [1, 2, 3, 4, 5])).toBeNull();
    expect(mannWhitneyU(null, [1, 2, 3, 4, 5])).toBeNull();
  });

  it('diferencia grande, sin empates: significativa (verificado contra scipy.stats.mannwhitneyu)', () => {
    // Verificado independientemente contra scipy.stats.mannwhitneyu
    // (alternative='two-sided', method='asymptotic', use_continuity=False)
    // antes de escribir el test: U=0.0, p≈0.0007775 (z≈-3.3607, coincide a
    // 6 decimales con mi implementación).
    const a = [10, 12, 14, 15, 18, 20, 22, 25];
    const b = [30, 32, 35, 38, 40, 42, 45, 50];
    const r = mannWhitneyU(a, b);
    expect(r).not.toBeNull();
    expect(r.u).toBe(0);
    expect(r.z).toBeCloseTo(-3.36, 1);
    expect(r.significativo).toBe(true);
    expect(r.nA).toBe(8);
    expect(r.nB).toBe(8);
    expect(r.medianaA).toBeLessThan(r.medianaB);
  });

  it('sin diferencia clara: no significativa (verificado contra scipy)', () => {
    // scipy: U=10.0, p≈0.60151, z≈-0.5222.
    const a = [10, 12, 14, 20, 25];
    const b = [11, 13, 15, 22, 26];
    const r = mannWhitneyU(a, b);
    expect(r).not.toBeNull();
    expect(r.u).toBe(10);
    expect(r.z).toBeCloseTo(-0.52, 1);
    expect(r.significativo).toBe(false);
  });

  it('con empates (corrección de varianza): coincide con scipy', () => {
    // scipy: U=30.0, p≈0.82977, z≈-0.2150.
    const a = [5, 5, 5, 10, 10, 12, 15, 20];
    const b = [5, 6, 8, 10, 10, 10, 15, 30];
    const r = mannWhitneyU(a, b);
    expect(r).not.toBeNull();
    expect(r.u).toBe(30);
    expect(r.z).toBeCloseTo(-0.21, 1);
    expect(r.significativo).toBe(false);
  });

  it('filtra valores inválidos (null/NaN) antes de contar el mínimo', () => {
    const a = [10, 12, null, NaN, 14, 20, 25];
    const b = [11, 13, 15, 22, 26];
    // 'a' tiene solo 5 valores válidos (10,12,14,20,25) -> igual pasa el mínimo.
    const r = mannWhitneyU(a, b);
    expect(r).not.toBeNull();
    expect(r.nA).toBe(5);
  });
});

describe('indiceEfectividadMantenimiento: incluye testEstadistico (Mann-Whitney U)', () => {
  it('agrega el resultado de mannWhitneyU sin romper el resto del cálculo existente', () => {
    const fallas = [];
    const pmEjecutados = [];
    // 6 equipos: PM ejecutado el día 100 de cada uno; falla ANTES cerca
    // (intervalo corto) y falla DESPUÉS lejos (intervalo largo) — mismo
    // patrón que ya cubre efectividadMantenimiento.test.js, reusado acá
    // solo para confirmar que testEstadistico aparece y es coherente.
    ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'].forEach((sigla, i) => {
      fallas.push({ sigla, fecha: `2026-01-${String(10 + i).padStart(2, '0')}` });
      pmEjecutados.push({ sigla, fecha: `2026-02-01` });
      fallas.push({ sigla, fecha: `2026-04-${String(10 + i).padStart(2, '0')}` });
    });
    const r = indiceEfectividadMantenimiento(fallas, pmEjecutados);
    expect(r).not.toBeNull();
    expect(r.testEstadistico).not.toBeNull();
    expect(typeof r.testEstadistico.significativo).toBe('boolean');
    expect(r.testEstadistico.nA).toBe(r.nAntes);
    expect(r.testEstadistico.nB).toBe(r.nDespues);
  });
});
