import { describe, it, expect } from 'vitest';
const { kijimaEquipo } = require('../logic.js');

describe('kijimaEquipo', () => {
  it('con menos de 5 fallas reales, devuelve null', () => {
    expect(kijimaEquipo([1000, 1200, 1400, 1600], 1600)).toBeNull();
    expect(kijimaEquipo([], 0)).toBeNull();
    expect(kijimaEquipo(null, 0)).toBeNull();
  });

  // Horómetros desplazados +500 respecto a los intervalos originales
  // usados en la verificación Python — horom=0 se filtra como "sin dato"
  // en toda la app (mismo criterio que ajusteWeibull/edadVirtualEquipo),
  // así que el primer horómetro real nunca puede ser 0. El desplazamiento
  // no cambia ningún intervalo (todas las diferencias se conservan).
  const HOROMS = [500, 1707, 1815, 2701, 3217, 4163, 4270, 5356, 5696, 6091, 7119, 7548, 8709];

  it('caso calculado y verificado con script Python independiente (Newton-Raphson + sección áurea) — sin censura', () => {
    // 12 intervalos, construidos a partir de un proceso Kijima Tipo II
    // sintético con q_true=0.3 — la MLE no tiene por qué recuperar
    // exactamente el q verdadero con muestra chica, pero sí debe identificar
    // el TIPO correcto por verosimilitud, que es lo que se verifica acá.
    // Python: ajuste base beta=1.71 eta=763; Tipo I q=0.00 ll=-88.377;
    // Tipo II q=0.16 ll=-87.677 -> elegido Tipo II (mayor verosimilitud).
    const r = kijimaEquipo(HOROMS, HOROMS[HOROMS.length - 1]);
    expect(r.beta).toBeCloseTo(1.71, 1);
    expect(r.eta).toBeCloseTo(763, 0);
    expect(r.nFallas).toBe(12);
    expect(r.nCensurados).toBe(0);
    expect(r.tipoI.q).toBeCloseTo(0, 2);
    expect(r.tipoII.q).toBeCloseTo(0.16, 1);
    expect(r.tipoII.logLik).toBeGreaterThan(r.tipoI.logLik);
    expect(r.modeloElegido).toBe('II');
    expect(r.q).toBeCloseTo(0.16, 1);
  });

  it('mismo caso pero con el equipo todavía en servicio (censura real) — cambia el ajuste base y el q', () => {
    // horomActual = última falla + 600h -> tramo censurado final. Python:
    // ajuste base CON censura beta=1.76 eta=791; Tipo I q=0.00; Tipo II
    // q=0.14 -> elegido Tipo II.
    const r = kijimaEquipo(HOROMS, HOROMS[HOROMS.length - 1] + 600);
    expect(r.beta).toBeCloseTo(1.76, 1);
    expect(r.eta).toBeCloseTo(791, 0);
    expect(r.nFallas).toBe(12);
    expect(r.nCensurados).toBe(1);
    expect(r.modeloElegido).toBe('II');
    expect(r.q).toBeCloseTo(0.14, 1);
  });

  it('en el límite q=0, Tipo I y Tipo II coinciden (son el mismo modelo — proceso de renovación)', () => {
    // Python: intervalos [180,230,180,230,210,210] -> ambos tipos dan
    // q=0.00 con log-verosimilitud IDÉNTICA (-26.4886) — verificación de
    // que la fórmula recursiva realmente colapsa al mismo modelo en q=0,
    // no una coincidencia numérica de la búsqueda.
    const horoms = [500, 680, 910, 1090, 1320, 1530, 1740];
    const r = kijimaEquipo(horoms, horoms[horoms.length - 1]);
    expect(r.tipoI.q).toBeCloseTo(0, 2);
    expect(r.tipoII.q).toBeCloseTo(0, 2);
    expect(r.tipoI.logLik).toBeCloseTo(r.tipoII.logLik, 2);
  });

  it('la interpretación corresponde al rango real de q', () => {
    const r = kijimaEquipo(HOROMS, HOROMS[HOROMS.length - 1]);
    // q≈0.16 -> "Restauración alta"
    expect(r.interpretacion).toContain('Restauración alta');
  });

  it('q siempre queda en [0,1] y modeloElegido es "I" o "II"', () => {
    const r = kijimaEquipo(HOROMS, HOROMS[HOROMS.length - 1]);
    expect(r.q).toBeGreaterThanOrEqual(0);
    expect(r.q).toBeLessThanOrEqual(1);
    expect(['I', 'II']).toContain(r.modeloElegido);
  });
});
