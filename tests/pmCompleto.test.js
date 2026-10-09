import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { validarPMCompleto, estadoPMCompleto } = require('../logic.js');

// "¿PM completo según pauta?" (2026-10-09). El punto delicado: un registro anterior a
// este campo (null/undefined) es "sin dato" — NUNCA completo ni incompleto, porque
// contarlo como completo inflaría la calidad de ejecución con datos que nadie confirmó.
describe('validarPMCompleto', () => {
  it('PM incompleto sin explicar qué faltó es inválido', () => {
    expect(validarPMCompleto(false, '')).toMatch(/qué faltó/i);
    expect(validarPMCompleto(false, '   ')).toMatch(/qué faltó/i);
    expect(validarPMCompleto(false, null)).toMatch(/qué faltó/i);
    expect(validarPMCompleto(false, undefined)).toMatch(/qué faltó/i);
  });
  it('PM incompleto explicando qué faltó es válido', () => {
    expect(validarPMCompleto(false, 'filtro secundario — sin stock')).toBeNull();
  });
  it('PM completo no exige explicación', () => {
    expect(validarPMCompleto(true, '')).toBeNull();
  });
  it('sin indicar (null) no exige explicación', () => {
    expect(validarPMCompleto(null, '')).toBeNull();
  });
});

describe('estadoPMCompleto', () => {
  it('true → completo', () => {
    expect(estadoPMCompleto({ pmCompleto: true })).toEqual({ estado: 'completo', faltante: '' });
  });
  it('false → incompleto, con lo que faltó sin espacios sobrantes', () => {
    expect(estadoPMCompleto({ pmCompleto: false, queFalto: '  filtro secundario ' }))
      .toEqual({ estado: 'incompleto', faltante: 'filtro secundario' });
  });
  it('false sin texto → incompleto con faltante vacío (no revienta)', () => {
    expect(estadoPMCompleto({ pmCompleto: false })).toEqual({ estado: 'incompleto', faltante: '' });
  });
  it('registro anterior (sin el campo, null o undefined) → sin_dato', () => {
    expect(estadoPMCompleto({})).toEqual({ estado: 'sin_dato', faltante: '' });
    expect(estadoPMCompleto({ pmCompleto: null })).toEqual({ estado: 'sin_dato', faltante: '' });
    expect(estadoPMCompleto(null)).toEqual({ estado: 'sin_dato', faltante: '' });
    expect(estadoPMCompleto(undefined)).toEqual({ estado: 'sin_dato', faltante: '' });
  });
  it('un valor "raro" (0, "", "no") NO se interpreta como false: sin_dato', () => {
    expect(estadoPMCompleto({ pmCompleto: 0 }).estado).toBe('sin_dato');
    expect(estadoPMCompleto({ pmCompleto: '' }).estado).toBe('sin_dato');
    expect(estadoPMCompleto({ pmCompleto: 'no' }).estado).toBe('sin_dato');
  });
});
