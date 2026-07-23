import { describe, it, expect } from 'vitest';
import { tasaDiariaReal, horomEnFecha } from '../logic.js';

describe('tasaDiariaReal — tasa diaria robusta desde el historial', () => {
  it('usa la mediana de avances diarios positivos', () => {
    const r = [
      { fecha: '2026-01-01', horom: 1000 },
      { fecha: '2026-01-11', horom: 1100 }, // +10/día
      { fecha: '2026-01-21', horom: 1200 }, // +10/día
    ];
    expect(tasaDiariaReal(r, 16)).toBe(10);
  });

  it('ignora un reset de horómetro (salto enorme) y no lo promedia', () => {
    const r = [
      { fecha: '2026-01-01', horom: 0 },      // primera lectura arranca en 0…
      { fecha: '2026-01-02', horom: 16000 },  // …salto imposible (reset/import) -> descartado
      { fecha: '2026-01-12', horom: 16120 },  // +12/día real
      { fecha: '2026-01-22', horom: 16240 },  // +12/día real
    ];
    expect(tasaDiariaReal(r, 16)).toBe(12);
  });

  it('sin pares usables cae a la tasa nominal', () => {
    expect(tasaDiariaReal([{ fecha: '2026-01-01', horom: 500 }], 14)).toBe(14);
    expect(tasaDiariaReal([], 14)).toBe(14);
  });
});

describe('horomEnFecha — estimación fiel del horómetro en una fecha', () => {
  const hist = [
    { fecha: '2026-01-01', horom: 1000 },
    { fecha: '2026-01-31', horom: 1300 }, // 300h en 30 días -> 10 h/día
  ];

  it('interpola cuando la fecha cae dentro del historial', () => {
    const e = horomEnFecha(hist, '2026-01-16', 1300, '2026-02-01', 16);
    expect(e.metodo).toBe('interpolado');
    expect(e.horom).toBe(1150); // mitad del tramo
  });

  it('extrapola hacia atrás con la tasa real para fechas anteriores', () => {
    const e = horomEnFecha(hist, '2025-12-22', 1300, '2026-02-01', 16);
    expect(e.metodo).toBe('extrapolado');
    expect(e.horom).toBe(900); // 1000 - 10*10días
  });

  it('nunca devuelve negativo: extrapolación demasiado atrás se limita a 0', () => {
    const e = horomEnFecha(hist, '2020-01-01', 1300, '2026-02-01', 16);
    expect(e.horom).toBe(0);
  });

  it('sin historial usa horomActual y tasa nominal hacia atrás', () => {
    const e = horomEnFecha([], '2026-01-01', 2000, '2026-01-31', 10);
    expect(e.metodo).toBe('nominal');
    expect(e.horom).toBe(1700); // 2000 - 10*30
  });
});
