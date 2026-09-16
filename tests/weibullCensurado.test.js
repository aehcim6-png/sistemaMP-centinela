import { describe, it, expect } from 'vitest';
const {
  ajusteWeibullCensurado,
  ajusteWeibullEquipoCensurado,
  analisisVidaUtilPorGrupoCensurado,
  ajusteWeibullCorrectivosPorComponenteCensurado
} = require('../logic.js');

describe('ajusteWeibullCensurado', () => {
  it('con menos de 5 fallas reales, devuelve null (las censuras no bajan el mínimo de evidencia)', () => {
    const obs = [
      { tiempo: 100, censurado: false },
      { tiempo: 150, censurado: false },
      { tiempo: 200, censurado: false },
      { tiempo: 400, censurado: true },
      { tiempo: 400, censurado: true },
      { tiempo: 400, censurado: true },
    ];
    expect(ajusteWeibullCensurado(obs)).toBeNull();
    expect(ajusteWeibullCensurado([])).toBeNull();
    expect(ajusteWeibullCensurado(null)).toBeNull();
  });

  it('caso calculado a mano y verificado con script Python (Newton-Raphson independiente) — 5 fallas + 2 censuras', () => {
    // fallas=[100,150,200,250,300], censurados=[400,400] -> Python:
    // beta_hat=1.877708 eta_hat=330.8541, confirmado como máximo local real
    // de la log-verosimilitud (no solo raíz de la derivada) y g(beta_hat)≈0.
    const obs = [
      { tiempo: 100, censurado: false },
      { tiempo: 150, censurado: false },
      { tiempo: 200, censurado: false },
      { tiempo: 250, censurado: false },
      { tiempo: 300, censurado: false },
      { tiempo: 400, censurado: true },
      { tiempo: 400, censurado: true },
    ];
    const r = ajusteWeibullCensurado(obs);
    expect(r.beta).toBeCloseTo(1.88, 1);
    expect(r.eta).toBeCloseTo(331, 0);
    expect(r.n).toBe(7);
    expect(r.nFallas).toBe(5);
    expect(r.nCensurados).toBe(2);
  });

  it('las mismas 5 fallas SIN censura dan un ajuste distinto (ignorar la censura sesga hacia vidas cortas)', () => {
    // Mismas 5 fallas, sin los 2 censurados -> Python: beta_hat=3.195644 eta_hat=224.1923
    // (eta más chico y beta más alto que con censura: sin la censura el
    // modelo no "sabe" que 2 unidades sobrevivieron más allá de 400).
    const obs = [
      { tiempo: 100, censurado: false },
      { tiempo: 150, censurado: false },
      { tiempo: 200, censurado: false },
      { tiempo: 250, censurado: false },
      { tiempo: 300, censurado: false },
    ];
    const r = ajusteWeibullCensurado(obs);
    expect(r.beta).toBeCloseTo(3.2, 1);
    expect(r.eta).toBeCloseTo(224, 0);
    expect(r.nCensurados).toBe(0);
    // La versión censurada arriba da un eta MAYOR (reconoce vida más larga).
    const conCensura = ajusteWeibullCensurado([
      { tiempo: 100, censurado: false },
      { tiempo: 150, censurado: false },
      { tiempo: 200, censurado: false },
      { tiempo: 250, censurado: false },
      { tiempo: 300, censurado: false },
      { tiempo: 400, censurado: true },
      { tiempo: 400, censurado: true },
    ]);
    expect(conCensura.eta).toBeGreaterThan(r.eta);
  });

  it('ignora observaciones con tiempo<=0', () => {
    const obs = [
      { tiempo: 100, censurado: false },
      { tiempo: 150, censurado: false },
      { tiempo: 200, censurado: false },
      { tiempo: 250, censurado: false },
      { tiempo: 300, censurado: false },
      { tiempo: 0, censurado: false },
      { tiempo: -50, censurado: true },
    ];
    const r = ajusteWeibullCensurado(obs);
    expect(r.n).toBe(5);
  });
});

describe('ajusteWeibullEquipoCensurado', () => {
  it('sin horómetro actual por encima de la última falla, no agrega censura (mismos intervalos que ajusteWeibull)', () => {
    const horoms = [1000, 1100, 1250, 1400, 1600, 1750];
    const r = ajusteWeibullEquipoCensurado(horoms, 1750);
    expect(r.nCensurados).toBe(0);
    expect(r.nFallas).toBe(5);
  });

  it('con el equipo todavía en servicio después de la última falla, agrega el tramo censurado', () => {
    const horoms = [1000, 1100, 1250, 1400, 1600, 1750];
    const r = ajusteWeibullEquipoCensurado(horoms, 1900);
    expect(r.nCensurados).toBe(1);
    expect(r.nFallas).toBe(5);
    expect(r.n).toBe(6);
  });

  it('sin suficientes fallas, devuelve null aunque haya censura', () => {
    expect(ajusteWeibullEquipoCensurado([1000, 1100, 1250], 2000)).toBeNull();
  });
});

describe('analisisVidaUtilPorGrupoCensurado', () => {
  it('agrupa por grupo y marca censurado:true en las unidades aún en uso', () => {
    const items = [
      { grupo: 'DI', vida: 100, censurado: false },
      { grupo: 'DI', vida: 150, censurado: false },
      { grupo: 'DI', vida: 200, censurado: false },
      { grupo: 'DI', vida: 250, censurado: false },
      { grupo: 'DI', vida: 300, censurado: false },
      { grupo: 'DI', vida: 400, censurado: true },
      { grupo: 'DI', vida: 400, censurado: true },
    ];
    const r = analisisVidaUtilPorGrupoCensurado(items);
    expect(r.length).toBe(1);
    expect(r[0].grupo).toBe('DI');
    expect(r[0].n).toBe(7);
    expect(r[0].ajuste.nCensurados).toBe(2);
    expect(r[0].ajuste.beta).toBeCloseTo(1.88, 1);
  });

  it('ítems sin grupo o sin vida positiva se descartan', () => {
    const items = [
      { grupo: '', vida: 100, censurado: false },
      { grupo: 'DI', vida: 0, censurado: false },
      { grupo: null, vida: 100, censurado: true },
    ];
    expect(analisisVidaUtilPorGrupoCensurado(items)).toEqual([]);
  });
});

describe('ajusteWeibullCorrectivosPorComponenteCensurado', () => {
  function ev(sigla, componente, horom) {
    return { sigla, componente, horom };
  }

  it('agrega el tramo final censurado cuando el equipo sigue con horomActual por encima de la última falla', () => {
    const eventos = [
      ev('CN-1', 'Motor', 1000),
      ev('CN-1', 'Motor', 1150),
      ev('CN-1', 'Motor', 1350),
      ev('CN-1', 'Motor', 1600),
      ev('CN-1', 'Motor', 1900),
      ev('CN-1', 'Motor', 2250),
    ];
    const eq = [{ sigla: 'CN-1', horomActual: 2500 }];
    const r = ajusteWeibullCorrectivosPorComponenteCensurado(eventos, eq);
    expect(r.length).toBe(1);
    expect(r[0].componente).toBe('Motor');
    expect(r[0].ajuste.nFallas).toBe(5);
    expect(r[0].ajuste.nCensurados).toBe(1);
  });

  it('sin dato de equipo (sigla no está en eq), no inventa censura', () => {
    const eventos = [
      ev('CN-9', 'Motor', 1000),
      ev('CN-9', 'Motor', 1150),
      ev('CN-9', 'Motor', 1350),
      ev('CN-9', 'Motor', 1600),
      ev('CN-9', 'Motor', 1900),
      ev('CN-9', 'Motor', 2250),
    ];
    const r = ajusteWeibullCorrectivosPorComponenteCensurado(eventos, []);
    expect(r[0].ajuste.nCensurados).toBe(0);
    expect(r[0].ajuste.nFallas).toBe(5);
  });
});
