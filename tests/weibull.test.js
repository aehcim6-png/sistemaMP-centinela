import { describe, it, expect } from 'vitest';
import { ajusteWeibull, confiabilidadWeibull, interpretacionFormaWeibull } from '../logic.js';

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
