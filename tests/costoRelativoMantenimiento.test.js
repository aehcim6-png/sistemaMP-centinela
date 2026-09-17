import { describe, it, expect } from 'vitest';
import { costoRelativoMantenimiento, costoRelativoMantenimientoFlota, _concentracionMaximaOC } from '../logic.js';

describe('costoRelativoMantenimiento', () => {
  it('null sin historial (arreglo vacío)', () => {
    expect(costoRelativoMantenimiento([], 1000000)).toBeNull();
  });

  it('null sin valorCompra (0, null, undefined)', () => {
    const oc = [{ fecha: '2024-01-01', costo: 1000 }, { fecha: '2024-06-01', costo: 2000 }];
    expect(costoRelativoMantenimiento(oc, 0)).toBeNull();
    expect(costoRelativoMantenimiento(oc, null)).toBeNull();
    expect(costoRelativoMantenimiento(oc, undefined)).toBeNull();
  });

  it('null con menos de 90 días de historial (default)', () => {
    const oc = [{ fecha: '2024-01-01', costo: 1000 }, { fecha: '2024-01-15', costo: 2000 }];
    expect(costoRelativoMantenimiento(oc, 1000000)).toBeNull();
  });

  it('calcula gasto anualizado y % correctamente con 1 año exacto de historial', () => {
    // 1 año exacto (365 días), gasto total 100.000, valorCompra 1.000.000 -> 10%
    const oc = [{ fecha: '2023-01-01', costo: 40000 }, { fecha: '2024-01-01', costo: 60000 }];
    const r = costoRelativoMantenimiento(oc, 1000000);
    expect(r).not.toBeNull();
    expect(r.gastoTotal).toBe(100000);
    expect(r.diasHistorial).toBe(365);
    expect(r.gastoAnual).toBe(100000); // ~ 1 año exacto, no se anualiza a más
    expect(r.pct).toBe(10);
  });

  it('anualiza correctamente con medio año de historial (duplica el gasto anual)', () => {
    // ~182 días de historial, gasto total 50.000 -> anualizado a ~100.000
    const oc = [{ fecha: '2024-01-01', costo: 20000 }, { fecha: '2024-07-02', costo: 30000 }];
    const r = costoRelativoMantenimiento(oc, 1000000);
    expect(r).not.toBeNull();
    expect(r.gastoTotal).toBe(50000);
    expect(r.gastoAnual).toBeGreaterThan(95000);
    expect(r.gastoAnual).toBeLessThan(105000);
  });

  it('ignora filas sin fecha o sin costo (costo undefined = 0)', () => {
    const oc = [
      { fecha: '2024-01-01', costo: 10000 },
      { fecha: null, costo: 99999 }, // sin fecha, no cuenta para el rango de días
      { fecha: '2024-06-01' }, // sin costo -> suma 0
    ];
    const r = costoRelativoMantenimiento(oc, 1000000);
    expect(r).not.toBeNull();
    expect(r.gastoTotal).toBe(10000);
  });

  it('es insensible al orden de entrada de las fechas', () => {
    const oc1 = [{ fecha: '2023-01-01', costo: 1000 }, { fecha: '2024-01-01', costo: 2000 }];
    const oc2 = [{ fecha: '2024-01-01', costo: 2000 }, { fecha: '2023-01-01', costo: 1000 }];
    expect(costoRelativoMantenimiento(oc1, 500000)).toEqual(costoRelativoMantenimiento(oc2, 500000));
  });

  it('respeta minDias custom vía opts', () => {
    const oc = [{ fecha: '2024-01-01', costo: 1000 }, { fecha: '2024-02-01', costo: 1000 }]; // 31 días
    expect(costoRelativoMantenimiento(oc, 1000000)).toBeNull(); // default 90 días
    expect(costoRelativoMantenimiento(oc, 1000000, { minDias: 20 })).not.toBeNull();
  });
});

describe('costoRelativoMantenimientoFlota', () => {
  it('excluye equipos sin valorCompra', () => {
    const ocHist = [
      { sigla: 'CN-1', fecha: '2023-01-01', costo: 10000 },
      { sigla: 'CN-1', fecha: '2024-01-01', costo: 10000 },
    ];
    const eq = [{ sigla: 'CN-1', tipo: 'Camion', valorCompra: 0 }];
    expect(costoRelativoMantenimientoFlota(ocHist, eq)).toEqual([]);
  });

  it('excluye equipos sin suficiente historial de OC', () => {
    const ocHist = [{ sigla: 'CN-1', fecha: '2024-01-01', costo: 5000 }];
    const eq = [{ sigla: 'CN-1', tipo: 'Camion', valorCompra: 1000000 }];
    expect(costoRelativoMantenimientoFlota(ocHist, eq)).toEqual([]);
  });

  it('agrupa por sigla y ordena de mayor a menor %', () => {
    const ocHist = [
      { sigla: 'CN-1', fecha: '2023-01-01', costo: 10000 },
      { sigla: 'CN-1', fecha: '2024-01-01', costo: 10000 }, // 20.000 / 1.000.000 = 2%
      { sigla: 'CN-2', fecha: '2023-01-01', costo: 100000 },
      { sigla: 'CN-2', fecha: '2024-01-01', costo: 100000 }, // 200.000 / 1.000.000 = 20%
      { sigla: 'CN-3', fecha: '2023-06-01', costo: 500 }, // sin equipo correspondiente en eq
    ];
    const eq = [
      { sigla: 'CN-1', tipo: 'Camion', valorCompra: 1000000 },
      { sigla: 'CN-2', tipo: 'Camion', valorCompra: 1000000 },
    ];
    const r = costoRelativoMantenimientoFlota(ocHist, eq);
    expect(r.map(x => x.sigla)).toEqual(['CN-2', 'CN-1']);
    expect(r[0].pct).toBe(20);
    expect(r[1].pct).toBe(2);
  });

  it('arreglo vacío sin equipos ni historial', () => {
    expect(costoRelativoMantenimientoFlota([], [])).toEqual([]);
  });
});

describe('_concentracionMaximaOC', () => {
  it('null con menos de 3 líneas válidas', () => {
    expect(_concentracionMaximaOC([{ costo: 1000 }])).toBeNull();
    expect(_concentracionMaximaOC([{ costo: 1000 }, { costo: 900 }])).toBeNull();
    expect(_concentracionMaximaOC([])).toBeNull();
    expect(_concentracionMaximaOC(null)).toBeNull();
  });

  it('null cuando la línea más grande no llega al 50% del total', () => {
    // 3 líneas parejas, ninguna domina
    const oc = [{ costo: 1000 }, { costo: 1200 }, { costo: 900 }];
    expect(_concentracionMaximaOC(oc)).toBeNull();
  });

  it('caso real replicado (CN-9502, antes de corregir el error de tipeo): 91x el precio normal del mismo ítem -> 97,9% de concentración', () => {
    // Mismos 3 números reales encontrados en ordenes_compra_historico antes
    // de la corrección: 2 compras normales de "Mts. Flexible 3/4 R2 9850" a
    // $139.997 c/u, y 1 con error de tipeo a $12.791.624 (19x ese precio
    // unitario, pero acá ya viene como costo de línea).
    const oc = [
      { detalle: 'Mts. Flexible 3/4 R2 9850', fecha: '2022-01-01', costo: 139997 },
      { detalle: 'Mts. Flexible 3/4 R2 9850', fecha: '2022-06-01', costo: 139997 },
      { detalle: 'Mts. Flexible 3/4 R2 9850', fecha: '2023-10-19', costo: 12791624 },
    ];
    const r = _concentracionMaximaOC(oc);
    expect(r).not.toBeNull();
    expect(r.detalle).toBe('Mts. Flexible 3/4 R2 9850');
    expect(r.fecha).toBe('2023-10-19');
    expect(r.costo).toBe(12791624);
    expect(r.pctDelTotal).toBeCloseTo(97.9, 1);
  });

  it('no marca como sospechosa una concentración real y legítima (reparación grande real, ~35%, con historial largo)', () => {
    // Réplica de un caso real de la flota: una reparación grande genuina
    // (motor/componente mayor) puede ser ~35% del gasto histórico de un
    // equipo con muchas líneas de repuestos chicos alrededor — no debe
    // marcarse como "línea sospechosa" solo por ser la más grande.
    const oc = [{ costo: 176635833 }];
    for (let i = 0; i < 50; i++) oc.push({ costo: 6500000 }); // 50 x 6.5M = 325M, total 501.6M, max/total ≈ 35.2%
    const r = _concentracionMaximaOC(oc);
    expect(r).toBeNull();
  });

  it('ignora líneas sin costo positivo', () => {
    const oc = [{ costo: 1000 }, { costo: 0 }, { costo: null }, { costo: 900 }, { costo: 1100 }];
    // de las válidas (1000,900,1100), ninguna llega al 50% del total (3000)
    expect(_concentracionMaximaOC(oc)).toBeNull();
  });
});

describe('costoRelativoMantenimiento — integración con concentracionMaxima', () => {
  it('incluye concentracionMaxima cuando una sola línea domina el gasto del equipo', () => {
    const oc = [
      { fecha: '2022-01-01', detalle: 'Mts. Flexible 3/4 R2 9850', costo: 139997 },
      { fecha: '2022-06-01', detalle: 'Mts. Flexible 3/4 R2 9850', costo: 139997 },
      { fecha: '2023-10-19', detalle: 'Mts. Flexible 3/4 R2 9850', costo: 12791624 },
    ];
    const r = costoRelativoMantenimiento(oc, 783090000);
    expect(r).not.toBeNull();
    expect(r.concentracionMaxima).toBeDefined();
    expect(r.concentracionMaxima.pctDelTotal).toBeCloseTo(97.9, 1);
  });

  it('NO incluye concentracionMaxima en el caso normal ya cubierto arriba (gasto parejo)', () => {
    const oc = [{ fecha: '2023-01-01', costo: 40000 }, { fecha: '2024-01-01', costo: 60000 }];
    const r = costoRelativoMantenimiento(oc, 1000000);
    expect(r.concentracionMaxima).toBeUndefined();
  });
});
