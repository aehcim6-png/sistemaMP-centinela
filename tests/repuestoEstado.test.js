// Semáforo de Repuestos (6-nov-2026): un stock vacío es «sin contar» y no se confunde con un cero real.
import { describe, it, expect } from 'vitest';
import { repuestoEstado, stockEstado } from '../logic.js';

describe('repuestoEstado — stock sin contar vs sin stock', () => {
  it('stock vacío (null, undefined o texto vacío) = SIN CONTAR, nunca rojo', () => {
    for (const v of [null, undefined, '']) {
      const r = repuestoEstado(v, 5, null, 34);
      expect(r).toMatchObject({ estado: '⚪ SIN CONTAR', sinContar: true });
      expect(r.estado).not.toContain('🔴');
    }
  });
  it('sin contar sigue siéndolo aunque haya consumo real o stock mínimo', () => {
    expect(repuestoEstado(null, 5, 10, 34).sinContar).toBe(true);
    expect(repuestoEstado(undefined, 0, 3, 10).estado).toBe('⚪ SIN CONTAR');
  });
  it('un cero escrito a mano sí es SIN STOCK (con o sin consumo real)', () => {
    expect(repuestoEstado(0, 5, null, 34)).toMatchObject({ estado: '🔴 SIN STOCK', sinContar: false });
    expect(repuestoEstado(0, 5, 4, 34).estado).toBe('🔴 SIN STOCK');
    expect(repuestoEstado('0', 5, null, 34).estado).toBe('🔴 SIN STOCK');
  });
  it('sin consumo real compara contra el stock mínimo', () => {
    expect(repuestoEstado(1, 4, null, 34).estado).toBe('🟡 STOCK BAJO');
    expect(repuestoEstado(4, 4, null, 34).estado).toBe('🟢 OK');
    expect(repuestoEstado(10, 0, null, 34).estado).toBe('🟢 OK');
  });
  it('con consumo real usa la misma regla que stockEstado (Stock Filtros/Lubricantes)', () => {
    for (const [stock, cons, lead] of [[2, 10, 34], [15, 10, 34], [40, 10, 34], [1, 100, 10]]) {
      const se = stockEstado(stock, cons, lead);
      const esperado = se.nivel === 'COMPRAR' ? '🔴 PEDIR YA' : se.nivel === 'BAJO' ? '🟡 STOCK BAJO' : '🟢 OK';
      expect(repuestoEstado(stock, 3, cons, lead).estado).toBe(esperado);
    }
  });
});
