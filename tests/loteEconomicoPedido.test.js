import { describe, it, expect } from 'vitest';
import { loteEconomicoPedido, eoqRazonCosto, politicasReposicionRepuestos } from '../logic.js';

describe('loteEconomicoPedido (EOQ)', () => {
  it('ejemplo de libro: D=1200, K=100, h=6 → Q*=200 y costo anual 1.200 (pedidos = mantención)', () => {
    const r = loteEconomicoPedido(1200, 30, 100, 0.2); // h = 0,2·30 = 6
    expect(r.qOptimo).toBeCloseTo(200, 10);
    expect(r.q).toBe(200);
    expect(r.costoAnual).toBeCloseTo(1200, 8);
    expect(r.costoPedidos).toBeCloseTo(r.costoMantencion, 8);
    expect(r.pedidosAnio).toBeCloseTo(6, 10);
    expect(r.cicloDias).toBeCloseTo(365 / 6, 8);
  });
  it('el entero elegido es el de menor costo anual (comparado con búsqueda exhaustiva)', () => {
    for (const [D, p, K, i] of [[37, 12000, 90000, 0.2], [500, 800, 50000, 0.25], [9, 450000, 100000, 0.2], [2400, 150, 30000, 0.15]]) {
      const r = loteEconomicoPedido(D, p, K, i, { maxMeses: 1200 });
      const h = i * p, trc = (q) => D / q * K + q / 2 * h;
      let mejor = 1; for (let q = 1; q <= 5000; q++) if (trc(q) < trc(mejor)) mejor = q;
      expect(r.costoAnual).toBeCloseTo(trc(mejor), 6);
    }
  });
  it('el óptimo continuo cumple la condición de primer orden: costo de pedidos = costo de mantención', () => {
    const r = loteEconomicoPedido(777, 5000, 65000, 0.18);
    const D = 777, K = 65000, h = 0.18 * 5000;
    expect(D / r.qOptimo * K).toBeCloseTo(r.qOptimo / 2 * h, 6);
    expect(r.costoMinimo).toBeCloseTo(Math.sqrt(2 * D * K * h), 6);
  });
  it('sensibilidad: pedir el doble o la mitad cuesta 25% más (k+1/k)/2', () => {
    expect(eoqRazonCosto(2)).toBeCloseTo(1.25, 12);
    expect(eoqRazonCosto(0.5)).toBeCloseTo(1.25, 12);
    expect(eoqRazonCosto(1)).toBe(1);
    const r = loteEconomicoPedido(1200, 30, 100, 0.2);
    const h = 6, trc = (q) => 1200 / q * 100 + q / 2 * h;
    expect(trc(400) / r.costoAnual).toBeCloseTo(1.25, 10);
  });
  it('el lote nunca es menor a 1 ni mayor que la demanda de maxMeses; avisa si lo topó', () => {
    const chico = loteEconomicoPedido(2, 1000000, 1000, 0.2);
    expect(chico.q).toBe(1);
    const caro = loteEconomicoPedido(10, 10, 1000000, 0.2); // pedir es carísimo y guardar es barato: Q* >> D
    expect(caro.q).toBe(10);
    expect(caro.topado).toBe(true);
    expect(loteEconomicoPedido(120, 10, 1000000, 0.2, { maxMeses: 6 }).q).toBe(60);
  });
  it('ahorra frente a pedir de a uno cuando el pedido es caro, y no cuando es casi gratis', () => {
    expect(loteEconomicoPedido(1200, 30, 100, 0.2).ahorroVsUnoAUno).toBeGreaterThan(0);
    expect(loteEconomicoPedido(12, 1000000, 1, 0.2).ahorroVsUnoAUno).toBeCloseTo(0, 6);
  });
  it('entradas inválidas → null', () => {
    expect(loteEconomicoPedido(0, 10, 10, 0.2)).toBeNull();
    expect(loteEconomicoPedido(10, 0, 10, 0.2)).toBeNull();
    expect(loteEconomicoPedido(10, 10, 0, 0.2)).toBeNull();
    expect(loteEconomicoPedido(10, 10, 10, 0)).toBeNull();
    expect(loteEconomicoPedido(null, 10, 10, 0.2)).toBeNull();
  });
});

describe('politicasReposicionRepuestos (s,S)', () => {
  const items = [
    { nParte: 'A', claseABC: 'A', claseXYZ: 'X', consumoMensualProm: 10, cv: 0.1 },
    { nParte: 'B', claseABC: 'B', claseXYZ: 'Z', consumoMensualProm: 10, cv: 0.6 },
    { nParte: 'C', claseABC: 'C', claseXYZ: 'X', consumoMensualProm: 5, cv: 0.1 }, // sin precio: se omite
  ];
  const stk = [
    { nParte: 'A', stockBodega: 20, precioUnit: 30, leadTime: 34 },
    { nParte: 'B', stockBodega: 5, pendiente: 5, precioUnit: 30, leadTime: 34 },
    { nParte: 'C', stockBodega: 1, leadTime: 34 },
  ];
  const cfg = { costoPedido: 100, tasaMantencion: 0.2 };
  it('s es el punto de reorden y S = s + Q', () => {
    const r = politicasReposicionRepuestos(items, stk, cfg, 0.95);
    const a = r.find(x => x.nParte === 'A');
    expect(a.s).toBe(14);
    expect(a.q).toBe(63); // D=10·12=120/año, K=100, h=0,2·30=6 → √(2·120·100/6)=63,2
    expect(a.S).toBe(a.s + a.q);
  });
  it('pide hasta S solo cuando el stock (bodega + pendiente) está bajo s', () => {
    const r = politicasReposicionRepuestos(items, stk, cfg, 0.95);
    const a = r.find(x => x.nParte === 'A'), b = r.find(x => x.nParte === 'B');
    expect(a.pedirAhora).toBe(0); // 20 ≥ 14
    expect(b.stockActual).toBe(10);
    expect(b.pedirAhora).toBe(b.S - 10); // 10 < 22
    expect(b.valorPedido).toBe(b.pedirAhora * 30);
  });
  it('omite repuestos sin precio y configuración inválida', () => {
    expect(politicasReposicionRepuestos(items, stk, cfg, 0.95).map(x => x.nParte).sort()).toEqual(['A', 'B']);
    expect(politicasReposicionRepuestos(items, stk, { costoPedido: 0, tasaMantencion: 0.2 }, 0.95)).toEqual([]);
  });
});
