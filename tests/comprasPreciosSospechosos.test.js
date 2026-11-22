// Aviso de precios de compra sospechosos (22-nov-2026): marca líneas cuyo monto parece tener la coma decimal mal leída (×10, ×100, ×1000).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const L = createRequire(import.meta.url)('../logic.js');

const normal = (precio, extra) => Object.assign({ pedido: '1', sigla: 'CN-9500', oc: '10', fecha: '2025-01-01', detalle: 'Filtro Aire Secundari6001', cant: 2, precioUnit: precio, costo: 2 * precio }, extra || {});

describe('comprasPreciosSospechosos', () => {
  it('marca un precio ~1000 veces el habitual del mismo artículo (caso OC 692902)', () => {
    const base = [15074, 16000, 16210, 21278, 58878].map((p, i) => normal(p, { pedido: 'a' + i }));
    const mala = normal(58878611, { pedido: '10710', oc: '692902', cant: 3, costo: 176635833 });
    const r = L.comprasPreciosSospechosos(base.concat(mala));
    expect(r.total).toBe(1);
    expect(r.filas[0].oc).toBe('692902');
    expect(r.filas[0].motivo).toBe('precio');
    expect(r.filas[0].factor).toBe(1000);
    expect(r.filas[0].sugerido).toBeCloseTo(58878.611, 3);
    expect(r.exceso).toBeCloseTo(176635833 * 0.999, 0);
  });

  it('marca un costo ×100 frente a cantidad × precio (decimales perdidos)', () => {
    const r = L.comprasPreciosSospechosos([normal(997, { detalle: 'Oring Aro 49 10mm', cant: 5, costo: 49.85 * 100 })]);
    // precio 997 × cant 5 = 4.985; costo 4.985 → no hay diferencia: no se marca
    expect(r.total).toBe(0);
    const r2 = L.comprasPreciosSospechosos([normal(9.97, { detalle: 'Oring Aro 49 10mm', cant: 5, costo: 4985 })]);
    expect(r2.total).toBe(1);
    expect(r2.filas[0].motivo).toBe('costo');
    expect(r2.filas[0].factor).toBe(100);
  });

  it('no marca precios que cambian por marca o proveedor dentro del rango normal', () => {
    const base = [15074, 36490, 58878, 63210, 86534, 90994].map((p, i) => normal(p, { pedido: 'b' + i }));
    expect(L.comprasPreciosSospechosos(base).total).toBe(0);
  });

  it('no juzga artículos con pocas compras ni líneas sin precio', () => {
    const pocas = [normal(100, { pedido: 'c1' }), normal(100000000, { pedido: 'c2', costo: 200000000 })];
    expect(L.comprasPreciosSospechosos(pocas).total).toBe(0);
    expect(L.comprasPreciosSospechosos([{ detalle: 'x' }, null, undefined]).total).toBe(0);
    expect(L.comprasPreciosSospechosos(null).total).toBe(0);
  });

  it('ordena por costo y respeta el límite', () => {
    const base = [1000, 1000, 1000, 1000].map((p, i) => normal(p, { pedido: 'd' + i, detalle: 'Perno' }));
    const m1 = normal(1000000, { pedido: 'e1', detalle: 'Perno', costo: 2000000 });
    const m2 = normal(1500000, { pedido: 'e2', detalle: 'Perno', costo: 3000000 });
    const r = L.comprasPreciosSospechosos(base.concat([m1, m2]), { limite: 1 });
    expect(r.total).toBe(2);
    expect(r.filas.length).toBe(1);
    expect(r.filas[0].pedido).toBe('e2');
  });
});
