import { describe, it, expect } from 'vitest';
import { stockEstado } from '../logic.js';

describe('stockEstado — reabastecimiento por lead time (no por proxy de 1 mes)', () => {
  it('sin consumo registrado -> OK (no alarma falsa)', () => {
    expect(stockEstado(0, 0).nivel).toBe('OK');
    expect(stockEstado(5, 0).nivel).toBe('OK');
  });

  it('stock en cero con consumo -> COMPRAR', () => {
    const r = stockEstado(0, 3);
    expect(r.nivel).toBe('COMPRAR');
    expect(r.motivo).toContain('sin stock');
  });

  it('el punto de quiebre es el LEAD TIME, no 1 mes: 1 mes de stock con lead de 34d = COMPRAR', () => {
    // 3 de stock, consumo 3/mes = 1 mes de cobertura. Lead 34d (~1.13 meses) > cobertura -> COMPRAR.
    // Con el proxy viejo (stock <= 1 mes) esto daba "OK" y se quebraba antes de que llegara.
    const r = stockEstado(3, 3);
    expect(r.nivel).toBe('COMPRAR');
    expect(r.motivo).toContain('reposición tarda 34');
  });

  it('cobertura entre el lead time y 2 meses -> BAJO', () => {
    // 5 de stock, consumo 3/mes = 1.67 meses. > lead (1.13) y < 2 -> BAJO.
    expect(stockEstado(5, 3).nivel).toBe('BAJO');
  });

  it('más de 2 meses de cobertura -> OK', () => {
    expect(stockEstado(9, 3).nivel).toBe('OK'); // 3 meses
  });

  it('lead time propio del ítem cambia el umbral', () => {
    // 3 de stock, consumo 3/mes = 1 mes. Con lead corto de 15d (0.5 meses), 1 mes alcanza -> no COMPRAR.
    expect(stockEstado(3, 3, 15).nivel).not.toBe('COMPRAR');
    // Con lead largo de 60d (2 meses), 1 mes no alcanza -> COMPRAR.
    expect(stockEstado(3, 3, 60).nivel).toBe('COMPRAR');
  });
});
