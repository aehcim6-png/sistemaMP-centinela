import { describe, it, expect } from 'vitest';
const { rotacionInventarioMRO, obsolescenciaStockMRO } = require('../logic.js');

describe('rotacionInventarioMRO — rotación anual = valor consumido (anualizado) / valor de inventario actual (acotado a Filtros/Lubricantes, único tipo con historial de fecha real)', () => {
  it('sin ventana de historial (mesesHistorial), devuelve null — no se puede anualizar sin saber qué período cubre el consumo', () => {
    expect(rotacionInventarioMRO([{ stockActual: 10, precioUnit: 100, consumoPeriodo: 5 }], 0)).toBeNull();
    expect(rotacionInventarioMRO([{ stockActual: 10, precioUnit: 100, consumoPeriodo: 5 }], null)).toBeNull();
  });

  it('sin valor de inventario (todo stock en 0 o sin precio), devuelve null', () => {
    expect(rotacionInventarioMRO([], 3)).toBeNull();
    expect(rotacionInventarioMRO([{ stockActual: 0, precioUnit: 100, consumoPeriodo: 5 }], 3)).toBeNull();
  });

  it('anualiza correctamente el consumo de una ventana parcial (ej. 3 meses reales de historial)', () => {
    // 1 ítem: stock 10 × $100 = $1000 inventario. Consumo real en 3 meses: 6 unidades × $100 = $600.
    // Anualizado: 600 × (12/3) = $2400. Rotación = 2400/1000 = 2.4
    const r = rotacionInventarioMRO([{ stockActual: 10, precioUnit: 100, consumoPeriodo: 6 }], 3);
    expect(r.valorInventario).toBe(1000);
    expect(r.valorConsumidoAnualizado).toBe(2400);
    expect(r.rotacionAnual).toBe(2.4);
  });

  it('suma correctamente varios ítems con distinto precio', () => {
    const items = [
      { stockActual: 5, precioUnit: 200, consumoPeriodo: 10 },  // inv 1000, consumo 2000 (×12/12)
      { stockActual: 2, precioUnit: 500, consumoPeriodo: 1 },   // inv 1000, consumo 500
    ];
    const r = rotacionInventarioMRO(items, 12);
    expect(r.valorInventario).toBe(2000);
    expect(r.valorConsumidoAnualizado).toBe(2500);
  });
});

describe('obsolescenciaStockMRO — % de ítems/valor con stock pero sin consumo en los últimos N meses', () => {
  it('sin ítems con stock >0, devuelve null', () => {
    expect(obsolescenciaStockMRO([], '2026-10-02', 12)).toBeNull();
    expect(obsolescenciaStockMRO([{ clave: 'A', stockActual: 0, precioUnit: 100, ultimoConsumoISO: '2020-01-01' }], '2026-10-02', 12)).toBeNull();
  });

  it('ítem con consumo reciente (dentro del umbral) NO es obsoleto', () => {
    const r = obsolescenciaStockMRO([{ clave: 'A', stockActual: 5, precioUnit: 100, ultimoConsumoISO: '2026-09-01' }], '2026-10-02', 12);
    expect(r.nObsoletos).toBe(0);
    expect(r.porcentajeItems).toBe(0);
  });

  it('ítem sin consumo hace más de 12 meses SÍ es obsoleto', () => {
    const r = obsolescenciaStockMRO([{ clave: 'A', stockActual: 5, precioUnit: 100, ultimoConsumoISO: '2024-01-01' }], '2026-10-02', 12);
    expect(r.nObsoletos).toBe(1);
    expect(r.porcentajeItems).toBe(100);
  });

  it('ítem que JAMÁS registró consumo (ultimoConsumoISO null) cuenta como obsoleto — peor caso', () => {
    const r = obsolescenciaStockMRO([{ clave: 'A', stockActual: 5, precioUnit: 100, ultimoConsumoISO: null }], '2026-10-02', 12);
    expect(r.nObsoletos).toBe(1);
  });

  it('calcula % por VALOR además de % por cantidad de ítems (pueden diferir mucho)', () => {
    const items = [
      { clave: 'BARATO', stockActual: 100, precioUnit: 1, ultimoConsumoISO: '2020-01-01' },   // obsoleto, valor 100
      { clave: 'CARO', stockActual: 1, precioUnit: 10000, ultimoConsumoISO: '2026-09-01' },    // no obsoleto, valor 10000
    ];
    const r = obsolescenciaStockMRO(items, '2026-10-02', 12);
    expect(r.porcentajeItems).toBe(50); // 1 de 2 ítems
    expect(r.porcentajeValor).toBe(Math.round(100 / 10100 * 100)); // muy bajo en valor, aunque sea 50% en cantidad
  });
});
