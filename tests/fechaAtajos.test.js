import { describe, it, expect } from 'vitest';
import { fechaAyer, fechaMismoDiaAnioPasado } from '../logic.js';

// fechaAyer / fechaMismoDiaAnioPasado (2026-09-11): atajos "Hoy"/"Ayer"/"Año
// pasado" del selector de fecha del Dashboard. Puras — 'hoyISO' siempre viene
// de afuera, nunca de new Date() interno, para poder testear casos límite
// (cambio de mes, cambio de año, 29 de febrero) sin depender del reloj real.

describe('fechaAyer', () => {
  it('resta un día dentro del mismo mes', () => {
    expect(fechaAyer('2026-09-11')).toBe('2026-09-10');
  });

  it('cruza al mes anterior en el día 1', () => {
    expect(fechaAyer('2026-09-01')).toBe('2026-08-31');
  });

  it('cruza al año anterior el 1 de enero', () => {
    expect(fechaAyer('2026-01-01')).toBe('2025-12-31');
  });

  it('respeta años bisiestos (1-mar bisiesto -> 29-feb)', () => {
    expect(fechaAyer('2028-03-01')).toBe('2028-02-29');
  });
});

describe('fechaMismoDiaAnioPasado', () => {
  it('resta un año manteniendo mes y día', () => {
    expect(fechaMismoDiaAnioPasado('2026-09-11')).toBe('2025-09-11');
  });

  it('29 de febrero de año bisiesto cae en 1 de marzo del año no bisiesto (comportamiento estándar de Date, no un bug)', () => {
    expect(fechaMismoDiaAnioPasado('2024-02-29')).toBe('2023-03-01');
  });

  it('un día cualquiera de un año no bisiesto no tiene ningún caso especial', () => {
    expect(fechaMismoDiaAnioPasado('2025-06-15')).toBe('2024-06-15');
  });
});
