import { describe, it, expect } from 'vitest';
import { analisisDemandaRepuestos } from '../logic.js';

function mov(nParte, mes, cant) {
  return { nParte, mes, cant, tipo: 'Filtro', item: 'Filtro X' };
}

describe('analisisDemandaRepuestos', () => {
  it('array vacío sin movimientos', () => {
    expect(analisisDemandaRepuestos([])).toEqual([]);
    expect(analisisDemandaRepuestos(undefined)).toEqual([]);
  });

  it('con menos de 3 meses de historial TOTAL del sistema, lambda queda null para todos (sin inventar un promedio con ruido)', () => {
    const movs = [mov('F-1', '2026-01', 2), mov('F-1', '2026-02', 3)];
    const r = analisisDemandaRepuestos(movs);
    const f1 = r.find((x) => x.nParte === 'F-1');
    expect(f1.lambda).toBeNull();
    expect(f1.nMeses).toBe(2);
  });

  it('calcula lambda como total consumido / TOTAL de meses observados por el sistema, no solo los meses con movimiento de ese ítem', () => {
    // F-1 solo tiene movimiento en 2 de los 6 meses observados (ene y jun) —
    // el promedio real es 6/6=1, NO 6/2=3 (que sería si se ignoraran los
    // meses de consumo cero, un error real que se quiso evitar).
    const movs = [
      mov('F-1', '2026-01', 3), mov('F-1', '2026-06', 3),
      mov('OTRO', '2026-02', 1), mov('OTRO', '2026-03', 1),
      mov('OTRO', '2026-04', 1), mov('OTRO', '2026-05', 1),
    ];
    const r = analisisDemandaRepuestos(movs);
    const f1 = r.find((x) => x.nParte === 'F-1');
    expect(f1.nMeses).toBe(6); // 2026-01 a 2026-06 inclusive
    expect(f1.lambda).toBe(1);
  });

  it('probSinConsumo y probAlMenosUno son la PMF de Poisson evaluada en lambda (verificado contra e^-1 conocido)', () => {
    const movs = [
      mov('F-1', '2026-01', 1), mov('F-1', '2026-02', 1), mov('F-1', '2026-03', 1),
    ];
    const r = analisisDemandaRepuestos(movs);
    const f1 = r.find((x) => x.nParte === 'F-1');
    expect(f1.lambda).toBe(1);
    // P(X=0) con lambda=1 es e^-1 = 0.3679...
    expect(f1.probSinConsumo).toBeCloseTo(0.368, 2);
    expect(f1.probAlMenosUno).toBeCloseTo(0.632, 2);
  });

  it('stockSeguridad95 da la cantidad mínima que cubre el 95% de los meses (crece con lambda)', () => {
    // lambda chico (F-1: 1 unidad total repartida en la ventana de 3 meses) -> stock chico cubre casi todo
    const rBaja = analisisDemandaRepuestos([mov('F-1', '2026-01', 1), mov('F-2', '2026-02', 1), mov('F-2', '2026-03', 1)]);
    const f1 = rBaja.find((x) => x.nParte === 'F-1'); // lambda=1/3
    expect(f1.stockSeguridad95).toBeGreaterThanOrEqual(1);
    expect(f1.stockSeguridad95).toBeLessThan(5);

    // lambda alto -> stock de seguridad debe ser mayor
    const altaDemanda = [1, 2, 3].flatMap((n) => [mov('F-ALTA', `2026-0${n}`, 20)]);
    const rAlta = analisisDemandaRepuestos(altaDemanda);
    const alta = rAlta.find((x) => x.nParte === 'F-ALTA'); // lambda=20
    expect(alta.stockSeguridad95).toBeGreaterThan(f1.stockSeguridad95);
  });

  it('agrupa por nParte sin mezclar ítems distintos', () => {
    const movs = [
      mov('F-1', '2026-01', 10), mov('F-1', '2026-02', 10), mov('F-1', '2026-03', 10),
      mov('F-2', '2026-01', 1), mov('F-2', '2026-02', 1), mov('F-2', '2026-03', 1),
    ];
    const r = analisisDemandaRepuestos(movs);
    expect(r.find((x) => x.nParte === 'F-1').lambda).toBe(10);
    expect(r.find((x) => x.nParte === 'F-2').lambda).toBe(1);
  });

  it('ignora movimientos sin nParte o sin mes', () => {
    const movs = [
      { nParte: '', mes: '2026-01', cant: 100 }, { nParte: 'F-1', mes: '', cant: 100 },
      mov('F-1', '2026-01', 5), mov('F-1', '2026-02', 5), mov('F-1', '2026-03', 5),
    ];
    const r = analisisDemandaRepuestos(movs);
    expect(r.find((x) => x.nParte === 'F-1').lambda).toBe(5);
  });

  it('no muta el arreglo original (pura)', () => {
    const movs = [mov('F-1', '2026-01', 5), mov('F-1', '2026-02', 5), mov('F-1', '2026-03', 5)];
    const copia = movs.map((m) => ({ ...m }));
    analisisDemandaRepuestos(movs);
    expect(movs).toEqual(copia);
  });
});
