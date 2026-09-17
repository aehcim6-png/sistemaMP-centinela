import { describe, it, expect } from 'vitest';
const {
  simulacionTrayectoriasGRP,
  simulacionTrayectoriasGRPDesdeKijima,
  kijimaEquipo,
} = require('../logic.js');

describe('simulacionTrayectoriasGRP', () => {
  it('sin beta/eta/horizonte válidos, devuelve null', () => {
    expect(simulacionTrayectoriasGRP(0, 1000, 0, false, 0, 3000, 100)).toBeNull();
    expect(simulacionTrayectoriasGRP(2, 0, 0, false, 0, 3000, 100)).toBeNull();
    expect(simulacionTrayectoriasGRP(2, 1000, 0, false, 0, 0, 100)).toBeNull();
  });

  it('caso determinístico (rng que siempre devuelve u=0.5): con q=0 la edad virtual se resetea a 0 en cada falla — calculado a mano con script Python', () => {
    // beta=2, eta=1000, u=0.5 constante -> cada paso da t=1000*sqrt(-ln(0.5))≈832.55h.
    // Con q=0, la edad virtual vuelve a 0 después de cada falla (Tipo I y
    // Tipo II son el mismo modelo en q=0) -> pasos en 832.55, 1665.11,
    // 2497.66, 3330.22 -> con horizonte=3000, entran los primeros 3, el 4°
    // pasa el horizonte -> 3 fallas, siempre, en cualquier simulación.
    const rngFijo = () => 0.5;
    const r = simulacionTrayectoriasGRP(2, 1000, 0, false, 0, 3000, 50, rngFijo);
    expect(r.fallasP10).toBe(3);
    expect(r.fallasP50).toBe(3);
    expect(r.fallasP90).toBe(3);
    expect(r.fallasEsperadas).toBe(3);
    expect(r.probAlMenosUnaFalla).toBe(1);

    // Mismo resultado con Tipo II (q=0 -> ambos tipos son idénticos).
    const r2 = simulacionTrayectoriasGRP(2, 1000, 0, true, 0, 3000, 50, rngFijo);
    expect(r2.fallasEsperadas).toBe(3);
  });

  it('caso determinístico Tipo I, q=0.4: trayectoria calculada paso a paso con script Python — 6 fallas', () => {
    // Mismo rng constante u=0.5. Con q=0.4 la edad virtual NO vuelve a 0
    // (restauración parcial), los pasos se acortan progresivamente:
    // t=832.555(x=832.555), t=896.689(x=563.667), t=1002.525(x=444.037),
    // t=1111.303(x=375.200), t=1215.923(x=329.739), t=1315.155(x=297.076)
    // -> acumulado tras 6 pasos = 2842.273 (<3000), el 7° paso lo supera.
    const rngFijo = () => 0.5;
    const r = simulacionTrayectoriasGRP(2, 1000, 0.4, false, 0, 3000, 50, rngFijo);
    expect(r.fallasEsperadas).toBe(6);
    expect(r.fallasP50).toBe(6);
  });

  it('a mayor q (peor restauración), más fallas esperadas en el mismo horizonte — verificado con Python (monótono: 3,0→4,6→6,4→9,0 para q=0/0,3/0,6/1,0)', () => {
    const beta = 2, eta = 1000, horizonte = 3000, v0 = 0;
    let anterior = -1;
    [0, 0.3, 0.6, 1].forEach((q) => {
      const r = simulacionTrayectoriasGRP(beta, eta, q, false, v0, horizonte, 3000);
      expect(r.fallasEsperadas).toBeGreaterThan(anterior);
      anterior = r.fallasEsperadas;
    });
  });

  it('q fuera de [0,1] cae a 0 (nunca se inventa un factor de restauración fuera de rango)', () => {
    const rngFijo = () => 0.5;
    const rNeg = simulacionTrayectoriasGRP(2, 1000, -0.5, false, 0, 3000, 50, rngFijo);
    const rCero = simulacionTrayectoriasGRP(2, 1000, 0, false, 0, 3000, 50, rngFijo);
    expect(rNeg.fallasEsperadas).toBe(rCero.fallasEsperadas);
  });

  it('P10 <= P50 <= P90 siempre, con un rng no determinístico real', () => {
    const r = simulacionTrayectoriasGRP(1.8, 800, 0.3, true, 0, 2000, 2000);
    expect(r).not.toBeNull();
    expect(r.fallasP10).toBeLessThanOrEqual(r.fallasP50);
    expect(r.fallasP50).toBeLessThanOrEqual(r.fallasP90);
    expect(r.probAlMenosUnaFalla).toBeGreaterThanOrEqual(0);
    expect(r.probAlMenosUnaFalla).toBeLessThanOrEqual(1);
  });

  it('nSimulaciones no válido cae al default (1000)', () => {
    const r = simulacionTrayectoriasGRP(2, 1000, 0.2, false, 0, 3000, 0);
    expect(r.nSimulaciones).toBe(1000);
  });
});

describe('simulacionTrayectoriasGRPDesdeKijima', () => {
  it('sin ajuste Kijima real (null), devuelve null', () => {
    expect(simulacionTrayectoriasGRPDesdeKijima(null, 3000, 100)).toBeNull();
  });

  it('integra con kijimaEquipo real: usa su beta/eta/q/modeloElegido/edadVirtualActual', () => {
    // Mismos horómetros ya verificados en tests/kijima.test.js (12 intervalos,
    // Tipo II elegido, q=0.16, beta=1.71, eta=763h).
    const horoms = [500, 1707, 1815, 2701, 3217, 4163, 4270, 5356, 5696, 6091, 7119, 7548, 8709];
    const ajuste = kijimaEquipo(horoms, horoms[horoms.length - 1]);
    expect(ajuste).not.toBeNull();
    const r = simulacionTrayectoriasGRPDesdeKijima(ajuste, 2000, 2000);
    expect(r).not.toBeNull();
    expect(r.fallasP10).toBeLessThanOrEqual(r.fallasP50);
    expect(r.fallasP50).toBeLessThanOrEqual(r.fallasP90);
    expect(r.horizonteHoras).toBe(2000);
  });
});
