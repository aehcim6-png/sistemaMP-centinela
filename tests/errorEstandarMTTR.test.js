import { describe, it, expect } from 'vitest';
import { errorEstandarMTTR } from '../logic.js';

describe('errorEstandarMTTR', () => {
  it('null con menos de 2 reparaciones con duración', () => {
    expect(errorEstandarMTTR([])).toBeNull();
    expect(errorEstandarMTTR(['4h'])).toBeNull();
    expect(errorEstandarMTTR(['—', '4h'])).toBeNull(); // solo 1 válida
    expect(errorEstandarMTTR(null)).toBeNull();
  });

  it('muestra chica y dispersa (2 reparaciones muy distintas): SE grande, IC muy ancho', () => {
    // Verificado independientemente contra scipy.stats.norm.ppf antes de
    // escribir el test (mismos números, sin librería de estadística real
    // disponible en el proyecto).
    const r = errorEstandarMTTR(['2h', '10h']);
    expect(r).not.toBeNull();
    expect(r.media).toBe(6);
    expect(r.n).toBe(2);
    expect(r.se).toBe(4);
    // El límite inferior teórico da negativo (6 - 1.96*4 = -1.84h) — una
    // duración de reparación negativa no tiene sentido, se acota a 0.
    expect(r.inferior).toBe(0);
    expect(r.superior).toBeCloseTo(13.8, 1);
  });

  it('muestra grande y consistente (20 reparaciones): SE chico, IC angosto', () => {
    const duraciones = [
      ...Array(10).fill('4h'),
      ...Array(6).fill('5h'),
      ...Array(4).fill('3h'),
    ];
    const r = errorEstandarMTTR(duraciones);
    expect(r).not.toBeNull();
    expect(r.media).toBe(4.1);
    expect(r.n).toBe(20);
    expect(r.se).toBe(0.16);
    expect(r.inferior).toBeCloseTo(3.8, 1);
    expect(r.superior).toBeCloseTo(4.4, 1);
    // Con 20 reparaciones consistentes el IC es mucho más angosto que el
    // caso de 2 reparaciones dispersas de arriba.
    expect(r.superior - r.inferior).toBeLessThan(1);
  });

  it('ignora entradas sin duración ("—", vacías) y las que no matchean el formato "Xh"', () => {
    const a = errorEstandarMTTR(['2h', '10h']);
    const b = errorEstandarMTTR(['2h', '—', '', null, undefined, '10h', 'sin dato']);
    expect(b).toEqual(a);
  });

  it('respeta el nivel de confianza custom (90% da un IC más angosto que 95%)', () => {
    const duraciones = ['3h', '4h', '5h', '6h', '4h'];
    const ic95 = errorEstandarMTTR(duraciones, 0.95);
    const ic90 = errorEstandarMTTR(duraciones, 0.90);
    expect(ic95.media).toBe(ic90.media);
    expect(ic95.se).toBe(ic90.se);
    expect(ic90.inferior).toBeGreaterThan(ic95.inferior);
    expect(ic90.superior).toBeLessThan(ic95.superior);
  });

  it('confianza fuera de (0,1) cae al default 95%', () => {
    const duraciones = ['2h', '10h'];
    expect(errorEstandarMTTR(duraciones, 0)).toEqual(errorEstandarMTTR(duraciones));
    expect(errorEstandarMTTR(duraciones, 1)).toEqual(errorEstandarMTTR(duraciones));
    expect(errorEstandarMTTR(duraciones, -2)).toEqual(errorEstandarMTTR(duraciones));
  });
});
