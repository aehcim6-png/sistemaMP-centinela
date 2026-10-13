// Aviso de muestra chica: efecto mínimo detectable con α=5 % y potencia 80 %, y cuándo corresponde avisar.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

describe('efectoMinimoDetectable', () => {
  it('coincide con la fórmula (1,96+0,84)·√(2/n)', () => {
    expect(L.efectoMinimoDetectable(5)).toBeCloseTo(2.8016 * Math.sqrt(0.4), 4);
    expect(L.efectoMinimoDetectable(25)).toBeCloseTo(0.7926, 3);   // con 25 por grupo ya se detecta un efecto "grande" (≈0,8)
    expect(L.efectoMinimoDetectable(100)).toBeCloseTo(0.396, 3);
  });
  it('baja al crecer la muestra y no existe con menos de 2 datos', () => {
    expect(L.efectoMinimoDetectable(10)).toBeGreaterThan(L.efectoMinimoDetectable(40));
    expect(L.efectoMinimoDetectable(1)).toBeNull();
  });
});

describe('avisoMuestraChica', () => {
  it('avisa cuando no es significativo y el grupo más chico tiene pocos datos', () => {
    const a = L.avisoMuestraChica(false, 6);
    expect(a.tipo).toBe('efecto');
    expect(a.n).toBe(6);
    expect(a.d).toBeGreaterThan(1.5);
  });
  it('no avisa si el resultado es significativo (ya se detectó la diferencia)', () => {
    expect(L.avisoMuestraChica(true, 6)).toBeNull();
  });
  it('no avisa cuando la muestra alcanza para detectar efectos grandes (≥ 25 por grupo)', () => {
    expect(L.avisoMuestraChica(false, 25)).toBeNull();
    expect(L.avisoMuestraChica(false, 24)).not.toBeNull();
    expect(L.avisoMuestraChica(false, 200)).toBeNull();
  });
  it('sin dato del tamaño no inventa un aviso', () => {
    expect(L.avisoMuestraChica(false, null)).toBeNull();
    expect(L.avisoMuestraChica(false, undefined)).toBeNull();
  });
});

describe('supervivencia (Log-Rank)', () => {
  it('cociente de riesgos mínimo detectable según las fallas de cada grupo (Schoenfeld)', () => {
    expect(L.hrMinimoDetectable(10, 10)).toBeCloseTo(Math.exp(2.8016 * Math.sqrt(0.2)), 3);   // ≈ 3,5
    expect(L.hrMinimoDetectable(50, 50)).toBeLessThan(L.hrMinimoDetectable(10, 10));
    expect(L.hrMinimoDetectable(0, 10)).toBeNull();
  });
  it('avisa con pocas fallas y no cuando hay muchas o el resultado es significativo', () => {
    const a = L.avisoMuestraChicaSupervivencia(false, 6, 9);
    expect(a.tipo).toBe('hr');
    expect(a.fallasMin).toBe(6);
    expect(a.hr).toBeGreaterThan(3);
    expect(L.avisoMuestraChicaSupervivencia(true, 6, 9)).toBeNull();
    expect(L.avisoMuestraChicaSupervivencia(false, 60, 80)).toBeNull();      // HR mínimo ≈ 1,6
    expect(L.avisoMuestraChicaSupervivencia(false, 0, 5)).toBeNull();
  });
});
