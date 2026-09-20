import { describe, it, expect } from 'vitest';
import { analisisABCXYZRepuestos } from '../logic.js';

function movs(nParte, valoresPorMes) {
  return Object.keys(valoresPorMes)
    .filter((mes) => valoresPorMes[mes] > 0)
    .map((mes) => ({ nParte, mes, cant: valoresPorMes[mes] }));
}

describe('analisisABCXYZRepuestos', () => {
  it('vacío sin movimientos', () => {
    expect(analisisABCXYZRepuestos([], [])).toEqual([]);
    expect(analisisABCXYZRepuestos(null, null)).toEqual([]);
  });

  it('excluye ítems sin precioUnit real (nunca inventa un precio)', () => {
    const mov = movs('SIN-PRECIO', { '2026-01': 5, '2026-02': 5, '2026-03': 5 });
    expect(analisisABCXYZRepuestos(mov, [])).toEqual([]);
    expect(analisisABCXYZRepuestos(mov, [{ nParte: 'SIN-PRECIO', precioUnit: 0 }])).toEqual([]);
  });

  it('excluye ítems con menos de 3 meses de historial', () => {
    const mov = movs('NUEVO', { '2026-03': 5, '2026-04': 5 });
    const stk = [{ nParte: 'NUEVO', precioUnit: 100 }];
    expect(analisisABCXYZRepuestos(mov, stk)).toEqual([]);
  });

  it('clasificación ABC-XYZ verificada independientemente con Python: 4 ítems, ejes ABC y XYZ independientes entre sí', () => {
    // Verificado con Python antes de escribir el test (media, varianza
    // muestral n-1, cv=sd/media, valor anualizado=media*12*precio,
    // clasificación ABC por % acumulado de valor ordenado descendente):
    // P-CARO-ESTABLE:  media=10, cv=0,      valor=120000 -> pctAcum 0.4630 -> A, X -> AX
    // P-CARO-ERRATICO: media=10, cv≈1.1547, valor=108000 -> pctAcum 0.8796 -> B, Z -> BZ
    // P-MEDIO:         media=5,  cv≈0.5164, valor=30000  -> pctAcum 0.9954 -> C, Y -> CY
    // P-BARATO-ESTABLE:media=2,  cv=0,      valor=1200   -> pctAcum 1.0    -> C, X -> CX
    const mov = [
      ...movs('P-CARO-ESTABLE', { '2026-01': 10, '2026-02': 10, '2026-03': 10, '2026-04': 10 }),
      ...movs('P-CARO-ERRATICO', { '2026-01': 20, '2026-03': 20 }), // meses 02 y 04 sin movimiento real -> 0
      ...movs('P-MEDIO', { '2026-01': 4, '2026-02': 8, '2026-03': 2, '2026-04': 6 }),
      ...movs('P-BARATO-ESTABLE', { '2026-01': 2, '2026-02': 2, '2026-03': 2, '2026-04': 2 }),
    ];
    const stk = [
      { nParte: 'P-CARO-ESTABLE', precioUnit: 1000 },
      { nParte: 'P-CARO-ERRATICO', precioUnit: 900 },
      { nParte: 'P-MEDIO', precioUnit: 500 },
      { nParte: 'P-BARATO-ESTABLE', precioUnit: 50 },
    ];
    const r = analisisABCXYZRepuestos(mov, stk);
    expect(r.length).toBe(4);
    const porNParte = Object.fromEntries(r.map((it) => [it.nParte, it]));

    expect(porNParte['P-CARO-ESTABLE'].valorAnualizado).toBe(120000);
    expect(porNParte['P-CARO-ESTABLE'].cv).toBe(0);
    expect(porNParte['P-CARO-ESTABLE'].claseABC).toBe('A');
    expect(porNParte['P-CARO-ESTABLE'].claseXYZ).toBe('X');
    expect(porNParte['P-CARO-ESTABLE'].clase).toBe('AX');

    expect(porNParte['P-CARO-ERRATICO'].valorAnualizado).toBe(108000);
    expect(porNParte['P-CARO-ERRATICO'].cv).toBeCloseTo(1.15, 1);
    expect(porNParte['P-CARO-ERRATICO'].claseABC).toBe('B');
    expect(porNParte['P-CARO-ERRATICO'].claseXYZ).toBe('Z');
    expect(porNParte['P-CARO-ERRATICO'].clase).toBe('BZ');

    expect(porNParte['P-MEDIO'].valorAnualizado).toBe(30000);
    expect(porNParte['P-MEDIO'].cv).toBeCloseTo(0.52, 1);
    expect(porNParte['P-MEDIO'].claseABC).toBe('C');
    expect(porNParte['P-MEDIO'].claseXYZ).toBe('Y');
    expect(porNParte['P-MEDIO'].clase).toBe('CY');

    expect(porNParte['P-BARATO-ESTABLE'].valorAnualizado).toBe(1200);
    expect(porNParte['P-BARATO-ESTABLE'].cv).toBe(0);
    expect(porNParte['P-BARATO-ESTABLE'].claseABC).toBe('C');
    expect(porNParte['P-BARATO-ESTABLE'].claseXYZ).toBe('X');
    expect(porNParte['P-BARATO-ESTABLE'].clase).toBe('CX');

    // Ordenado de mayor a menor valor anualizado.
    expect(r.map((it) => it.nParte)).toEqual(['P-CARO-ESTABLE', 'P-CARO-ERRATICO', 'P-MEDIO', 'P-BARATO-ESTABLE']);
  });

  it('demanda cero como dato real: dos ítems con igual valor anualizado pero distinta variabilidad quedan en clases XYZ distintas', () => {
    const mov = [
      ...movs('ESTABLE', { '2026-01': 5, '2026-02': 5, '2026-03': 5, '2026-04': 5 }),
      ...movs('ERRATICO', { '2026-01': 20 }), // 3 meses de consumo cero reales, 1 mes con todo el consumo
    ];
    const stk = [
      { nParte: 'ESTABLE', precioUnit: 100 },
      { nParte: 'ERRATICO', precioUnit: 100 },
    ];
    const r = analisisABCXYZRepuestos(mov, stk);
    const porNParte = Object.fromEntries(r.map((it) => [it.nParte, it]));
    expect(porNParte.ESTABLE.valorAnualizado).toBe(porNParte.ERRATICO.valorAnualizado);
    expect(porNParte.ESTABLE.claseXYZ).toBe('X');
    expect(porNParte.ERRATICO.claseXYZ).toBe('Z');
  });
});
