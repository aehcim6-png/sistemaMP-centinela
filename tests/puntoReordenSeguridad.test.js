import { describe, it, expect } from 'vitest';
import { puntoReordenSeguridad, puntosReordenRepuestos } from '../logic.js';

// Valores de referencia calculados independientemente en Python (misma
// fórmula: ROP = mu_L + z*sigma_L, mu_L = muMensual*leadDias/30,
// sigma_L = cv*muMensual*sqrt(leadDias/30)) y verificados con una
// simulación Monte Carlo de 2M iteraciones: usando el ROP calculado, la
// probabilidad real de NO quebrar stock durante el lead time coincidió con
// el nivel de servicio elegido a 4 decimales (90%->0.9000, 95%->0.9500,
// 97.5%->0.9749).
describe('puntoReordenSeguridad', () => {
  it('null si faltan datos básicos', () => {
    expect(puntoReordenSeguridad(null, 0.3, 34)).toBeNull();
    expect(puntoReordenSeguridad(10, 0.3, 0)).toBeNull();
    expect(puntoReordenSeguridad(-1, 0.3, 34)).toBeNull();
  });

  it('reproduce los valores de referencia verificados en Python (cv bajo vs cv alto, mismo consumo promedio)', () => {
    const x = puntoReordenSeguridad(10, 0.1, 34, 0.95);
    expect(x.muL).toBeCloseTo(11.33, 2);
    expect(x.sigmaL).toBeCloseTo(1.06, 2);
    expect(x.stockSeguridad).toBeCloseTo(1.75, 1);
    expect(x.rop).toBe(14);

    const z = puntoReordenSeguridad(10, 0.6, 34, 0.95);
    expect(z.muL).toBeCloseTo(11.33, 2);
    expect(z.sigmaL).toBeCloseTo(6.39, 2);
    expect(z.stockSeguridad).toBeCloseTo(10.51, 1);
    expect(z.rop).toBe(22);

    // Mismo consumo promedio, pero clase Z (errático) necesita mucho más
    // stock de seguridad que clase X (predecible) — justamente el hueco
    // que stockEstado (umbral fijo) no ve.
    expect(z.rop).toBeGreaterThan(x.rop);
  });

  it('sin variabilidad (cv=0 o null), ROP = demanda esperada en el lead time, redondeada hacia arriba', () => {
    const r = puntoReordenSeguridad(10, 0, 34, 0.95);
    expect(r.stockSeguridad).toBe(0);
    expect(r.rop).toBe(12); // muL=11.33 -> ceil = 12
    const r2 = puntoReordenSeguridad(10, null, 34, 0.95);
    expect(r2.rop).toBe(12);
  });

  it('nivel de servicio más alto exige más stock de seguridad (z mayor)', () => {
    const s90 = puntoReordenSeguridad(10, 0.3, 34, 0.90);
    const s99 = puntoReordenSeguridad(10, 0.3, 34, 0.99);
    expect(s99.stockSeguridad).toBeGreaterThan(s90.stockSeguridad);
    expect(s99.rop).toBeGreaterThan(s90.rop);
  });

  it('nivel de servicio desconocido cae a 95% por defecto', () => {
    const a = puntoReordenSeguridad(10, 0.3, 34, 0.5);
    const b = puntoReordenSeguridad(10, 0.3, 34, 0.95);
    expect(a).toEqual(b);
    expect(a.nivelServicio).toBe(0.95);
  });
});

describe('puntosReordenRepuestos', () => {
  const itemsABCXYZ = [
    { nParte: 'FIL-001', claseABC: 'A', claseXYZ: 'X', consumoMensualProm: 10, cv: 0.1 },
    { nParte: 'FIL-002', claseABC: 'B', claseXYZ: 'Z', consumoMensualProm: 10, cv: 0.6 },
    { nParte: 'FIL-003', claseABC: 'C', claseXYZ: 'X', consumoMensualProm: 5, cv: 0.1 },
  ];
  const stk = [
    { nParte: 'FIL-001', stockBodega: 20, leadTime: 34 },
    { nParte: 'FIL-002', stockBodega: 20, leadTime: 34 },
    // FIL-003 sin fila en stk: usa el default de 34 días del sistema, no se descarta
  ];

  it('cruza demanda (ABC-XYZ) con stock y lead time reales, marcando bajoReorden', () => {
    const r = puntosReordenRepuestos(itemsABCXYZ, stk, 0.95);
    expect(r.length).toBe(3);
    const f1 = r.find((x) => x.nParte === 'FIL-001');
    const f2 = r.find((x) => x.nParte === 'FIL-002');
    expect(f1.rop).toBe(14);
    expect(f1.stockActual).toBe(20);
    expect(f1.bajoReorden).toBe(false); // 20 >= 14
    expect(f2.rop).toBe(22);
    expect(f2.stockActual).toBe(20);
    expect(f2.bajoReorden).toBe(true); // 20 < 22, clase errática necesita más margen
  });

  it('usa el lead time default (34d) del sistema cuando el repuesto no tiene fila en stk, sin descartarlo', () => {
    const r = puntosReordenRepuestos(itemsABCXYZ, stk, 0.95);
    const f3 = r.find((x) => x.nParte === 'FIL-003');
    expect(f3.leadDias).toBe(34);
    expect(f3.stockActual).toBe(0);
    expect(f3.bajoReorden).toBe(true);
  });

  it('vacío sin ítems', () => {
    expect(puntosReordenRepuestos([], stk)).toEqual([]);
    expect(puntosReordenRepuestos(null, stk)).toEqual([]);
  });

  it('suma stock pendiente de llegar al stock actual', () => {
    const r = puntosReordenRepuestos(
      [{ nParte: 'FIL-001', claseABC: 'A', claseXYZ: 'X', consumoMensualProm: 10, cv: 0.1 }],
      [{ nParte: 'FIL-001', stockBodega: 5, pendiente: 10, leadTime: 34 }],
      0.95
    );
    expect(r[0].stockActual).toBe(15);
  });
});
