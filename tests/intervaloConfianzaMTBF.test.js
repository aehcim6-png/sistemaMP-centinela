import { describe, it, expect } from 'vitest';
import { intervaloConfianzaMTBF } from '../logic.js';

describe('intervaloConfianzaMTBF', () => {
  it('null con menos de 2 horómetros válidos', () => {
    expect(intervaloConfianzaMTBF([])).toBeNull();
    expect(intervaloConfianzaMTBF([500])).toBeNull();
    expect(intervaloConfianzaMTBF([0, 500])).toBeNull(); // 0 no es válido
    expect(intervaloConfianzaMTBF(null)).toBeNull();
  });

  it('caso real CN-10155 (2 fallas, 1 intervalo): MTBF puntual engañosamente preciso, IC muy ancho', () => {
    // Horómetros reales de correctivos de CN-10155 (Supabase jyhpfwivhwzylkzxrsbt).
    // r=1 intervalo, T=430h -> MTBF=430h. Verificado independientemente contra
    // scipy.stats.chi2.ppf (coincide a >10 decimales con la CDF exacta de acá).
    const r = intervaloConfianzaMTBF([729, 1159]);
    expect(r).not.toBeNull();
    expect(r.mtbf).toBe(430);
    expect(r.r).toBe(1);
    expect(r.inferior).toBe(77);
    expect(r.superior).toBe(16984);
    // El IC es ~220x más ancho que el punto -> con 1 solo intervalo el MTBF
    // puntual no dice casi nada por sí solo.
    expect(r.superior / r.inferior).toBeGreaterThan(200);
  });

  it('caso real CA-9927 (2 fallas, 1 intervalo): mismo patrón con otra escala de horas', () => {
    const r = intervaloConfianzaMTBF([34730, 50110]);
    expect(r).not.toBeNull();
    expect(r.mtbf).toBe(15380);
    expect(r.r).toBe(1);
    expect(r.inferior).toBe(2760);
    expect(r.superior).toBe(607478);
  });

  it('caso real CN-5133 (53 fallas, 52 intervalos): muestra grande -> IC angosto y confiable', () => {
    // 53 horómetros reales de correctivos de CN-5133, de 5701h a 13137h.
    const horoms = [
      5701, 8974, 10353, 10394, 10425, 10494, 10563, 10574, 10614, 10623,
      10629, 10636, 10644, 10644, 10672, 10676, 10739, 10932, 11246, 11326,
      11510, 11513, 11594, 11657, 11803, 11877, 11950, 12064, 12124, 12186,
      12272, 12331, 12389, 12403, 12418, 12662, 12669, 12676, 12689, 12704,
      12709, 12718, 12806, 12808, 12812, 12820, 12825, 12860, 12888, 12922,
      12957, 13051, 13137,
    ];
    const r = intervaloConfianzaMTBF(horoms);
    expect(r).not.toBeNull();
    expect(r.mtbf).toBe(143);
    expect(r.r).toBe(52);
    expect(r.inferior).toBe(109);
    expect(r.superior).toBe(191);
    // Con 52 intervalos el IC es angosto: menos de 2x entre el límite
    // inferior y superior (muy distinto del caso de 1 intervalo de arriba).
    expect(r.superior / r.inferior).toBeLessThan(2);
  });

  it('es insensible al orden de entrada y a ceros/negativos intercalados', () => {
    const a = intervaloConfianzaMTBF([729, 1159]);
    const b = intervaloConfianzaMTBF([1159, 0, 729, -5]);
    expect(b).toEqual(a);
  });

  it('respeta el nivel de confianza custom (90% da un IC más angosto que 95%)', () => {
    const horoms = [10000, 10500, 11200, 12000, 12900];
    const ic95 = intervaloConfianzaMTBF(horoms, 0.95);
    const ic90 = intervaloConfianzaMTBF(horoms, 0.90);
    expect(ic95.mtbf).toBe(ic90.mtbf); // el punto no cambia con la confianza
    expect(ic90.inferior).toBeGreaterThan(ic95.inferior);
    expect(ic90.superior).toBeLessThan(ic95.superior);
  });

  it('confianza fuera de (0,1) cae al default 95%', () => {
    const horoms = [729, 1159];
    expect(intervaloConfianzaMTBF(horoms, 0)).toEqual(intervaloConfianzaMTBF(horoms));
    expect(intervaloConfianzaMTBF(horoms, 1)).toEqual(intervaloConfianzaMTBF(horoms));
    expect(intervaloConfianzaMTBF(horoms, -0.5)).toEqual(intervaloConfianzaMTBF(horoms));
  });
});
