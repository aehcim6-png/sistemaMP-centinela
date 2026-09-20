import { describe, it, expect } from 'vitest';
import { r2RegresionLineal } from '../logic.js';

describe('r2RegresionLineal', () => {
  it('null con menos de 2 puntos válidos', () => {
    expect(r2RegresionLineal([])).toBeNull();
    expect(r2RegresionLineal([{ x: 0, y: 5 }])).toBeNull();
    expect(r2RegresionLineal([{ x: 0, y: 5 }, { x: 1, y: null }])).toBeNull();
    expect(r2RegresionLineal(null)).toBeNull();
  });

  it('null cuando todos los x son iguales (sin pendiente que ajustar)', () => {
    expect(r2RegresionLineal([{ x: 2, y: 5 }, { x: 2, y: 8 }, { x: 2, y: 3 }])).toBeNull();
  });

  it('ajuste perfecto (línea recta exacta): R²=1', () => {
    // Verificado independientemente a mano/con numpy antes de escribir el
    // test: pendiente=-2, intercepto=10, R²=1.
    const pts = [{ x: 0, y: 10 }, { x: 1, y: 8 }, { x: 2, y: 6 }, { x: 3, y: 4 }];
    const r = r2RegresionLineal(pts);
    expect(r).not.toBeNull();
    expect(r.n).toBe(4);
    expect(r.pendiente).toBeCloseTo(-2, 6);
    expect(r.intercepto).toBeCloseTo(10, 6);
    expect(r.r2).toBe(1);
  });

  it('ajuste ruidoso, sin relación real clara: R² bajo', () => {
    // Verificado independientemente contra numpy antes de escribir el
    // test: pendiente=-0.6, intercepto=4.9, R²≈0.18.
    const pts = [{ x: 0, y: 5 }, { x: 1, y: 3 }, { x: 2, y: 6 }, { x: 3, y: 2 }];
    const r = r2RegresionLineal(pts);
    expect(r).not.toBeNull();
    expect(r.pendiente).toBeCloseTo(-0.6, 4);
    expect(r.intercepto).toBeCloseTo(4.9, 4);
    expect(r.r2).toBeCloseTo(0.18, 2);
  });

  it('caso realista de desgaste de neumático (8 mediciones, tendencia clara con algo de ruido): R² alto', () => {
    // Remanente bajando de forma consistente con ruido chico — el patrón
    // real de una goma desgastándose parejo. Verificado contra numpy:
    // pendiente≈-1.9643, R²≈0.9889.
    const pts = [50, 48, 47, 44, 43, 40, 39, 36].map((y, i) => ({ x: i, y }));
    const r = r2RegresionLineal(pts);
    expect(r).not.toBeNull();
    expect(r.n).toBe(8);
    expect(r.pendiente).toBeCloseTo(-1.9643, 3);
    expect(r.r2).toBeCloseTo(0.9889, 2);
    expect(r.r2).toBeGreaterThan(0.9);
  });

  it('ignora puntos con y=null/undefined, no interrumpe el ajuste de los válidos', () => {
    const conNulos = [{ x: 0, y: 10 }, { x: 1, y: null }, { x: 2, y: 6 }, { x: 3, y: 4 }, { x: 4, y: undefined }];
    const sinNulos = [{ x: 0, y: 10 }, { x: 2, y: 6 }, { x: 3, y: 4 }];
    const r1 = r2RegresionLineal(conNulos);
    const r2 = r2RegresionLineal(sinNulos);
    expect(r1).toEqual(r2);
  });

  it('todos los y iguales (varianza total cero): R²=1 trivial, no NaN', () => {
    const pts = [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }];
    const r = r2RegresionLineal(pts);
    expect(r).not.toBeNull();
    expect(r.pendiente).toBe(0);
    expect(r.r2).toBe(1);
  });
});
