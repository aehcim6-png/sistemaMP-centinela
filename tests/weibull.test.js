import { describe, it, expect } from 'vitest';
import { ajusteWeibull, ajusteWeibullVidas, analisisVidaUtilPorGrupo, confiabilidadWeibull, interpretacionFormaWeibull } from '../logic.js';

describe('ajusteWeibull', () => {
  it('null con menos de 5 intervalos (4 intervalos = 5 fallas, bajo el mínimo)', () => {
    expect(ajusteWeibull([1000, 1800, 2500, 3100, 3600])).toBeNull();
  });

  it('null sin datos / arreglo vacío', () => {
    expect(ajusteWeibull([])).toBeNull();
    expect(ajusteWeibull(undefined)).toBeNull();
  });

  it('ignora horómetros no válidos (0 o negativos)', () => {
    expect(ajusteWeibull([0, 0, 1000, 1800, 2500, 3100])).toBeNull();
  });

  it('ignora intervalos de largo 0 (horómetro duplicado) y sigue exigiendo el mínimo sobre los válidos', () => {
    // 7 valores crudos, uno duplicado -> 6 intervalos crudos, 1 de largo 0 -> 5 válidos (justo el mínimo)
    const r = ajusteWeibull([1000, 1000, 1800, 2500, 3100, 3600, 4000]);
    expect(r).not.toBeNull();
    expect(r.n).toBe(5);
  });

  it('devuelve beta/eta/n con datos suficientes (7 fallas, forma de desgaste)', () => {
    const r = ajusteWeibull([1000, 1800, 2500, 3100, 3600, 4000, 4300]);
    expect(r).toEqual({ beta: 2.9, eta: 620, n: 6 });
  });

  it('es insensible al orden de entrada (no depende de que vengan ya ordenadas)', () => {
    const ordenado = ajusteWeibull([1000, 1800, 2500, 3100, 3600, 4000, 4300]);
    const desordenado = ajusteWeibull([4300, 1000, 3600, 1800, 4000, 2500, 3100]);
    expect(desordenado).toEqual(ordenado);
  });

  it('null cuando los intervalos son todos iguales (varianza 0, pendiente indefinida)', () => {
    // Caso degenerado real: sin variación en los intervalos no hay pendiente que
    // ajustar (división por cero en la regresión) — se devuelve null en vez de
    // NaN/Infinity, nunca un número inventado.
    expect(ajusteWeibull([1000, 2000, 3000, 4000, 5000, 6000])).toBeNull();
  });

  it('no muta el arreglo original (pura)', () => {
    const original = [1000, 1800, 2500, 3100, 3600, 4000, 4300];
    const copia = [...original];
    ajusteWeibull(original);
    expect(original).toEqual(copia);
  });
});

describe('confiabilidadWeibull', () => {
  it('null si no hay ajuste', () => {
    expect(confiabilidadWeibull(null, 1000)).toBeNull();
  });

  it('null si no hay horasPeriodo válido', () => {
    expect(confiabilidadWeibull({ beta: 1, eta: 1000 }, null)).toBeNull();
    expect(confiabilidadWeibull({ beta: 1, eta: 1000 }, -5)).toBeNull();
  });

  it('R(0) = 100% sin importar beta/eta', () => {
    expect(confiabilidadWeibull({ beta: 2, eta: 1000 }, 0)).toBe(100);
  });

  it('con beta=1 (equivalente a la exponencial de siempre) coincide con e^(-t/eta)', () => {
    // e^(-1000/1000) = e^-1 = 0.36788...
    expect(confiabilidadWeibull({ beta: 1, eta: 1000 }, 1000)).toBe(36.8);
  });

  it('con beta=2 (forma de desgaste) da un resultado distinto a la exponencial para el mismo t/eta', () => {
    // (500/1000)^2 = 0.25 -> e^-0.25 = 0.7788...
    expect(confiabilidadWeibull({ beta: 2, eta: 1000 }, 500)).toBe(77.9);
  });
});

describe('ajusteWeibullVidas', () => {
  it('ajusta directamente sobre vidas completas (no calcula intervalos, a diferencia de ajusteWeibull)', () => {
    const r = ajusteWeibullVidas([2200, 2450, 2600, 2750, 2900, 3100, 3300]);
    expect(r).toEqual({ beta: 7.71, eta: 2921, n: 7 });
  });

  it('null con menos de 5 vidas', () => {
    expect(ajusteWeibullVidas([2200, 2450, 2600, 2750])).toBeNull();
  });

  it('null sin datos', () => {
    expect(ajusteWeibullVidas([])).toBeNull();
    expect(ajusteWeibullVidas(undefined)).toBeNull();
  });
});

describe('analisisVidaUtilPorGrupo', () => {
  const items = [
    { grupo: 'Michelin 24.00R35', vida: 2200 },
    { grupo: 'Michelin 24.00R35', vida: 2450 },
    { grupo: 'Michelin 24.00R35', vida: 2600 },
    { grupo: 'Michelin 24.00R35', vida: 2750 },
    { grupo: 'Michelin 24.00R35', vida: 2900 },
    { grupo: 'Michelin 24.00R35', vida: 3100 },
    { grupo: 'Michelin 24.00R35', vida: 3300 },
    { grupo: 'Bridgestone 24.00R35', vida: 1800 },
    { grupo: 'Bridgestone 24.00R35', vida: 2000 },
    { grupo: 'Bridgestone 24.00R35', vida: 2100 },
  ];

  it('agrupa por "grupo" y ajusta cada grupo por separado (no mezcla marcas distintas)', () => {
    const r = analisisVidaUtilPorGrupo(items);
    expect(r).toEqual([
      { grupo: 'Bridgestone 24.00R35', n: 3, ajuste: null },
      { grupo: 'Michelin 24.00R35', n: 7, ajuste: { beta: 7.71, eta: 2921, n: 7 } },
    ]);
  });

  it('grupo con menos de 5 vidas trae ajuste null pero igual aparece listado con su n real', () => {
    const r = analisisVidaUtilPorGrupo(items).find(g => g.grupo === 'Bridgestone 24.00R35');
    expect(r.n).toBe(3);
    expect(r.ajuste).toBeNull();
  });

  it('ignora ítems sin grupo o sin vida válida (>0)', () => {
    const conInvalidos = [...items, { grupo: 'X', vida: 0 }, { grupo: null, vida: 5000 }, { grupo: 'Y' }];
    const r = analisisVidaUtilPorGrupo(conInvalidos);
    expect(r.find(g => g.grupo === 'X')).toBeUndefined();
    expect(r.find(g => g.grupo === 'Y')).toBeUndefined();
  });

  it('array vacío sin ítems', () => {
    expect(analisisVidaUtilPorGrupo([])).toEqual([]);
  });
});

describe('interpretacionFormaWeibull', () => {
  it('null sin beta', () => {
    expect(interpretacionFormaWeibull(null)).toBeNull();
  });

  it('fallas tempranas cuando beta < 0.9', () => {
    expect(interpretacionFormaWeibull(0.5)).toMatch(/tempranas/i);
  });

  it('fallas aleatorias cuando beta está cerca de 1', () => {
    expect(interpretacionFormaWeibull(1)).toMatch(/aleatorias/i);
  });

  it('desgaste cuando beta > 1.1', () => {
    expect(interpretacionFormaWeibull(2.9)).toMatch(/desgaste/i);
  });
});
