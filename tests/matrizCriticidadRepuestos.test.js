import { describe, it, expect } from 'vitest';
const {
  probabilidadQuiebreLeadTime,
  probabilidadQuiebreABanda,
  criticidadEquipoABanda,
  matrizCriticidadRepuestos,
} = require('../logic.js');

describe('probabilidadQuiebreLeadTime', () => {
  it('sin lambda, leadDias inválido, devuelve null', () => {
    expect(probabilidadQuiebreLeadTime(null, 34, 1)).toBeNull();
    expect(probabilidadQuiebreLeadTime(2, 0, 1)).toBeNull();
    expect(probabilidadQuiebreLeadTime(2, -5, 1)).toBeNull();
  });

  it('casos calculados a mano y verificados con script Python', () => {
    expect(probabilidadQuiebreLeadTime(2, 34, 1)).toBeCloseTo(0.661, 2);
    expect(probabilidadQuiebreLeadTime(0.5, 34, 3)).toBeCloseTo(0.003, 2);
    expect(probabilidadQuiebreLeadTime(1, 30, 0)).toBeCloseTo(0.632, 2);
  });

  it('sin demanda real (lambda=0), nunca hay riesgo de quiebre', () => {
    expect(probabilidadQuiebreLeadTime(0, 34, 0)).toBe(0);
  });

  it('más stock siempre reduce (o mantiene) la probabilidad de quiebre, nunca la aumenta', () => {
    const p1 = probabilidadQuiebreLeadTime(2, 34, 1);
    const p3 = probabilidadQuiebreLeadTime(2, 34, 3);
    const p5 = probabilidadQuiebreLeadTime(2, 34, 5);
    expect(p3).toBeLessThanOrEqual(p1);
    expect(p5).toBeLessThanOrEqual(p3);
  });

  it('lead time más largo (misma demanda mensual) aumenta la probabilidad de quiebre', () => {
    const pCorto = probabilidadQuiebreLeadTime(2, 15, 1);
    const pLargo = probabilidadQuiebreLeadTime(2, 60, 1);
    expect(pLargo).toBeGreaterThan(pCorto);
  });
});

describe('probabilidadQuiebreABanda', () => {
  it('mapea la probabilidad continua a bandas 1-5, sin inventar riesgo cuando es 0', () => {
    expect(probabilidadQuiebreABanda(null)).toBeNull();
    expect(probabilidadQuiebreABanda(0)).toBeNull();
    expect(probabilidadQuiebreABanda(0.01)).toBe(1);
    expect(probabilidadQuiebreABanda(0.1)).toBe(2);
    expect(probabilidadQuiebreABanda(0.3)).toBe(3);
    expect(probabilidadQuiebreABanda(0.6)).toBe(4);
    expect(probabilidadQuiebreABanda(0.9)).toBe(5);
  });
});

describe('criticidadEquipoABanda', () => {
  it('mapea los 3 valores reales de eq.criticidad a la escala 1-5', () => {
    expect(criticidadEquipoABanda('Crítico')).toBe(5);
    expect(criticidadEquipoABanda('Esencial')).toBe(3);
    expect(criticidadEquipoABanda('General')).toBe(1);
    expect(criticidadEquipoABanda('')).toBeNull();
    expect(criticidadEquipoABanda(undefined)).toBeNull();
  });
});

describe('matrizCriticidadRepuestos', () => {
  it('filtra ítems sin riesgo real (probQuiebre nulo o 0) — nunca aparecen en la matriz', () => {
    const items = [
      { nParte: 'A', probQuiebre: 0, precioUnit: 100000 },
      { nParte: 'B', probQuiebre: null, precioUnit: 100000 },
    ];
    expect(matrizCriticidadRepuestos(items)).toEqual([]);
  });

  it('el Impacto toma el PEOR CASO entre costo y criticidad de equipo — nunca minimiza una señal real', () => {
    const items = [
      // Barato (impacto bajo por costo) pero en un equipo Crítico (impacto 5 por criticidad).
      { nParte: 'A', item: 'Repuesto barato equipo crítico', probQuiebre: 0.6, precioUnit: 5000, criticidadEquipo: 5 },
      // Caro (impacto alto por costo) sin equipo asociado.
      { nParte: 'B', item: 'Repuesto caro sin equipo', probQuiebre: 0.6, precioUnit: 9000000, criticidadEquipo: null },
      // Relleno para que umbralesImpacto tenga muestra suficiente (≥5).
      { nParte: 'C', item: 'C', probQuiebre: 0.3, precioUnit: 200000, criticidadEquipo: null },
      { nParte: 'D', item: 'D', probQuiebre: 0.3, precioUnit: 400000, criticidadEquipo: null },
      { nParte: 'E', item: 'E', probQuiebre: 0.3, precioUnit: 1000000, criticidadEquipo: null },
    ];
    const r = matrizCriticidadRepuestos(items);
    const a = r.find((x) => x.nParte === 'A');
    const b = r.find((x) => x.nParte === 'B');
    // A: costo bajísimo (impactoCosto bajo) pero criticidadEquipo=5 -> impacto final debe ser 5.
    expect(a.impacto).toBe(5);
    expect(a.impactoCosto).toBeLessThan(5);
    // B: sin criticidadEquipo -> impacto final = impactoCosto (el más caro del set -> alto).
    expect(b.impacto).toBe(b.impactoCosto);
  });

  it('ordena de mayor a menor PxI (más urgente primero)', () => {
    const items = [
      { nParte: 'A', probQuiebre: 0.9, precioUnit: 5000000, criticidadEquipo: 5 },
      { nParte: 'B', probQuiebre: 0.1, precioUnit: 10000, criticidadEquipo: 1 },
      { nParte: 'C', probQuiebre: 0.5, precioUnit: 500000, criticidadEquipo: 3 },
      { nParte: 'D', probQuiebre: 0.3, precioUnit: 200000, criticidadEquipo: 2 },
      { nParte: 'E', probQuiebre: 0.6, precioUnit: 800000, criticidadEquipo: 4 },
    ];
    const r = matrizCriticidadRepuestos(items);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].pxi).toBeLessThanOrEqual(r[i - 1].pxi);
    }
    expect(r[0].nParte).toBe('A');
  });

  it('con menos de 5 valores de costo, el Impacto por costo queda neutral (3) — mismo criterio de la Matriz de Riesgo estática', () => {
    const items = [
      { nParte: 'A', probQuiebre: 0.6, precioUnit: 100000, criticidadEquipo: null },
      { nParte: 'B', probQuiebre: 0.6, precioUnit: 9000000, criticidadEquipo: null },
    ];
    const r = matrizCriticidadRepuestos(items);
    r.forEach((x) => expect(x.impactoCosto).toBe(3));
  });
});
