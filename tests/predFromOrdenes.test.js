const { predFromOrdenes } = require('../logic.js');

describe('predFromOrdenes', () => {
  it('devuelve una estructura vacía y coherente para un arreglo vacío', () => {
    const pred = predFromOrdenes([]);
    expect(pred.equipos).toEqual({});
    expect(pred.topItems).toEqual([]);
    expect(pred.costoMes).toEqual([]);
    expect(pred.resumen).toEqual({
      totalPedidos: 0, totalCosto: 0, promedioMensual: 0,
      leadTimeGlobal: 34, rangoDesde: '—', rangoHasta: '—'
    });
  });

  it('ignora filas sin pedido o sin fecha (no cuentan ni rompen el rango)', () => {
    const pred = predFromOrdenes([
      { pedido: '', fecha: '2024-01-05', sigla: 'AA-1', detalle: 'X', costo: 1000 },
      { pedido: '1', fecha: '', sigla: 'AA-1', detalle: 'X', costo: 1000 },
      { pedido: '2', fecha: '2024-02-10', sigla: 'AA-1', detalle: 'X', costo: 500 },
    ]);
    expect(pred.resumen.totalPedidos).toBe(1);
    expect(pred.resumen.totalCosto).toBe(500);
    expect(pred.resumen.rangoDesde).toBe('2024-02');
  });

  it('cuenta pedidos distintos por equipo, no líneas', () => {
    const pred = predFromOrdenes([
      { pedido: '1', fecha: '2024-01-05', sigla: 'AA-1', detalle: 'Filtro X', costo: 1000 },
      { pedido: '1', fecha: '2024-01-05', sigla: 'AA-1', detalle: 'Filtro Y', costo: 1000 },
      { pedido: '2', fecha: '2024-02-10', sigla: 'AA-1', detalle: 'Filtro X', costo: 1000 },
    ]);
    expect(pred.equipos['AA-1'].totalPedidos).toBe(2);
    expect(pred.equipos['AA-1'].totalCosto).toBe(3000);
  });

  it('rellena con ceros los meses sin pedidos dentro del rango de cada equipo', () => {
    const pred = predFromOrdenes([
      { pedido: '1', fecha: '2024-01-05', sigla: 'AA-1', detalle: 'X', costo: 1000 },
      { pedido: '2', fecha: '2024-03-15', sigla: 'AA-1', detalle: 'X', costo: 1000 },
    ]);
    const trend = pred.equipos['AA-1'].trend;
    expect(trend.map(t => t.m)).toEqual(['2024-01', '2024-02', '2024-03']);
    expect(trend[1]).toEqual({ m: '2024-02', n: 0, c: 0 });
  });

  it('rellena con ceros el costoMes global aunque un mes no tenga ningún pedido', () => {
    const pred = predFromOrdenes([
      { pedido: '1', fecha: '2024-01-05', sigla: 'AA-1', detalle: 'X', costo: 1000 },
      { pedido: '2', fecha: '2024-03-15', sigla: 'BB-2', detalle: 'X', costo: 500 },
    ]);
    expect(pred.costoMes).toEqual([
      { m: '2024-01', c: 1000 },
      { m: '2024-02', c: 0 },
      { m: '2024-03', c: 500 },
    ]);
  });

  it('cruza el año correctamente al construir el rango de meses', () => {
    const pred = predFromOrdenes([
      { pedido: '1', fecha: '2023-11-01', sigla: 'AA-1', detalle: 'X', costo: 100 },
      { pedido: '2', fecha: '2024-02-01', sigla: 'AA-1', detalle: 'X', costo: 100 },
    ]);
    expect(pred.costoMes.map(c => c.m)).toEqual(['2023-11', '2023-12', '2024-01', '2024-02']);
  });

  it('topItems: total = pedidos distintos, ordenado descendente', () => {
    const pred = predFromOrdenes([
      { pedido: '1', fecha: '2024-01-01', sigla: 'AA-1', detalle: 'Popular', costo: 100 },
      { pedido: '2', fecha: '2024-01-02', sigla: 'AA-1', detalle: 'Popular', costo: 100 },
      { pedido: '3', fecha: '2024-01-03', sigla: 'AA-1', detalle: 'Raro', costo: 50 },
    ]);
    expect(pred.topItems[0]).toMatchObject({ item: 'Popular', total: 2, costoTotal: 200 });
    expect(pred.topItems[1]).toMatchObject({ item: 'Raro', total: 1, costoTotal: 50 });
  });

  it('topItems: la lista de equipos por ítem se limita a 5, sin duplicados', () => {
    const oc = [];
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((s, i) => {
      oc.push({ pedido: String(i), fecha: '2024-01-01', sigla: s + '-1', detalle: 'Compartido', costo: 10 });
    });
    // repite el primer equipo para confirmar que no se duplica en la lista
    oc.push({ pedido: '99', fecha: '2024-01-02', sigla: 'A-1', detalle: 'Compartido', costo: 10 });
    const pred = predFromOrdenes(oc);
    const item = pred.topItems.find(it => it.item === 'Compartido');
    expect(item.equipos.length).toBe(5);
    expect(new Set(item.equipos).size).toBe(5);
  });

  it('promedioMensual usa la cantidad de meses del rango global, no solo los meses con datos', () => {
    const pred = predFromOrdenes([
      { pedido: '1', fecha: '2024-01-01', sigla: 'AA-1', detalle: 'X', costo: 300 },
      { pedido: '2', fecha: '2024-03-01', sigla: 'AA-1', detalle: 'X', costo: 300 },
    ]);
    // rango: ene-feb-mar = 3 meses, costo total 600 -> 200/mes
    expect(pred.resumen.promedioMensual).toBe(200);
  });
});
