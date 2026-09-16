import { describe, it, expect } from 'vitest';
import { presupuestoProrrateado } from '../logic.js';

describe('presupuestoProrrateado', () => {
  it('sin presupuesto/mes/hoyISO devuelve el presupuesto tal cual (o 0)', () => {
    expect(presupuestoProrrateado(0, '2026-09', '2026-09-16')).toBe(0);
    expect(presupuestoProrrateado(1000000, '', '2026-09-16')).toBe(1000000);
    expect(presupuestoProrrateado(1000000, '2026-09', '')).toBe(1000000);
  });

  it('mes YA CERRADO (distinto del mes de hoyISO) devuelve el presupuesto completo, sin prorratear', () => {
    expect(presupuestoProrrateado(3000000, '2026-08', '2026-09-16')).toBe(3000000);
  });

  it('mes EN CURSO prorratea por días transcurridos / días del mes', () => {
    // Septiembre 2026 tiene 30 días; hoy es el día 15 -> 15/30 = 50%
    expect(presupuestoProrrateado(3000000, '2026-09', '2026-09-15')).toBe(1500000);
  });

  it('el día 1 del mes en curso prorratea a 1/N (nunca a 0, evita división por 0 días transcurridos)', () => {
    const r = presupuestoProrrateado(3000000, '2026-09', '2026-09-01');
    expect(r).toBeCloseTo(3000000 / 30, 5);
  });

  it('el último día del mes prorratea al 100% (igual al presupuesto completo)', () => {
    expect(presupuestoProrrateado(3000000, '2026-09', '2026-09-30')).toBe(3000000);
  });

  it('respeta la cantidad real de días de cada mes (febrero no bisiesto = 28)', () => {
    const r = presupuestoProrrateado(2800000, '2026-02', '2026-02-14');
    expect(r).toBe(1400000); // 14/28 = 50%
  });
});
