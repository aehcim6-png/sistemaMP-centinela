import { describe, it, expect } from 'vitest';
import { rangoDias } from '../logic.js';

describe('rangoDias — días de una salida de servicio por período', () => {
  it('un solo día', () => {
    expect(rangoDias('2026-07-10', '2026-07-10')).toEqual(['2026-07-10']);
  });

  it('rango de varios días, inclusive ambos extremos', () => {
    expect(rangoDias('2026-07-10', '2026-07-13')).toEqual([
      '2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13'
    ]);
  });

  it('cruza fin de mes', () => {
    expect(rangoDias('2026-06-29', '2026-07-02')).toEqual([
      '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02'
    ]);
  });

  it('sin "hasta" -> solo el día "desde"', () => {
    expect(rangoDias('2026-07-10')).toEqual(['2026-07-10']);
  });

  it('"hasta" anterior a "desde" -> vacío (no inventa días)', () => {
    expect(rangoDias('2026-07-10', '2026-07-05')).toEqual([]);
  });

  it('fecha inválida o vacía -> vacío', () => {
    expect(rangoDias('')).toEqual([]);
    expect(rangoDias(null)).toEqual([]);
  });
});
