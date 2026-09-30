import { describe, it, expect } from 'vitest';
import {
  _parsearTiempoRespuestaDias,
  tiempoRespuestaPorProveedor,
  pedidosPotencialmenteTrabados,
} from '../logic.js';

describe('_parsearTiempoRespuestaDias', () => {
  it('parsea "X dias Yh Zm" completo', () => {
    expect(_parsearTiempoRespuestaDias('19 dias 17h 40m')).toBeCloseTo(19.7, 1);
  });

  it('parsea singular "1 dia"', () => {
    expect(_parsearTiempoRespuestaDias('1 dia 1h 0m')).toBeCloseTo(1.04, 1);
  });

  it('parsea solo días, sin horas ni minutos', () => {
    expect(_parsearTiempoRespuestaDias('5 dias')).toBe(5);
  });

  it('parsea solo horas', () => {
    expect(_parsearTiempoRespuestaDias('12h')).toBeCloseTo(0.5, 1);
  });

  it('devuelve null para texto vacío, undefined o no parseable', () => {
    expect(_parsearTiempoRespuestaDias('')).toBeNull();
    expect(_parsearTiempoRespuestaDias(undefined)).toBeNull();
    expect(_parsearTiempoRespuestaDias('pendiente')).toBeNull();
  });
});

describe('tiempoRespuestaPorProveedor', () => {
  it('array vacío sin datos', () => {
    expect(tiempoRespuestaPorProveedor([])).toEqual([]);
    expect(tiempoRespuestaPorProveedor(undefined)).toEqual([]);
  });

  it('ignora filas que no son Recepcion Bodega (ciclo abierto no cuenta)', () => {
    const c = [
      { estado: 'OC Firmada', proveedor: 'ACME', tiempoRespuesta: '5 dias' },
      { estado: 'OC por Firmar', proveedor: 'ACME', tiempoRespuesta: '2 dias' },
    ];
    expect(tiempoRespuestaPorProveedor(c)).toEqual([]);
  });

  it('ignora filas sin proveedor o sin tiempoRespuesta parseable', () => {
    const c = [
      { estado: 'Recepcion Bodega', tiempoRespuesta: '5 dias' },
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: 'pendiente' },
    ];
    expect(tiempoRespuestaPorProveedor(c)).toEqual([]);
  });

  it('agrupa por proveedor y calcula promedio/mediana/costo', () => {
    const c = [
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias', costo: 1000 },
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '20 dias', costo: 2000 },
    ];
    const r = tiempoRespuestaPorProveedor(c);
    expect(r).toHaveLength(1);
    expect(r[0].proveedor).toBe('ACME');
    expect(r[0].nPedidos).toBe(2);
    expect(r[0].diasPromedio).toBe(15);
    expect(r[0].diasMediana).toBe(15);
    expect(r[0].costoTotal).toBe(3000);
  });

  it('ordena de mayor a menor diasPromedio (proveedor más lento primero)', () => {
    const c = [
      { estado: 'Recepcion Bodega', proveedor: 'RAPIDO', tiempoRespuesta: '2 dias', costo: 100 },
      { estado: 'Recepcion Bodega', proveedor: 'LENTO', tiempoRespuesta: '30 dias', costo: 100 },
    ];
    const r = tiempoRespuestaPorProveedor(c);
    expect(r.map((x) => x.proveedor)).toEqual(['LENTO', 'RAPIDO']);
  });

  it('no cuenta costo negativo o cero', () => {
    const c = [{ estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '5 dias', costo: 0 }];
    expect(tiempoRespuestaPorProveedor(c)[0].costoTotal).toBe(0);
  });
});

describe('pedidosPotencialmenteTrabados', () => {
  it('array vacío sin datos', () => {
    expect(pedidosPotencialmenteTrabados([])).toEqual([]);
    expect(pedidosPotencialmenteTrabados(undefined)).toEqual([]);
  });

  it('ignora pedidos ya cerrados (Recepcion Bodega)', () => {
    const c = [{ estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '100 dias' }];
    expect(pedidosPotencialmenteTrabados(c)).toEqual([]);
  });

  it('marca trabado un pedido abierto que supera la mediana del proveedor x factorAlerta', () => {
    const c = [
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'OC Firmada', pedido: 'P1', proveedor: 'ACME', tiempoRespuesta: '20 dias' },
    ];
    const r = pedidosPotencialmenteTrabados(c, 1.5, 3);
    expect(r).toHaveLength(1);
    expect(r[0].pedido).toBe('P1');
    expect(r[0].diasReferencia).toBe(10);
    expect(r[0].usaRespaldoGlobal).toBe(false);
  });

  it('no marca trabado un pedido abierto dentro de lo normal', () => {
    const c = [
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'OC Firmada', pedido: 'P1', proveedor: 'ACME', tiempoRespuesta: '12 dias' },
    ];
    expect(pedidosPotencialmenteTrabados(c, 1.5, 3)).toEqual([]);
  });

  it('usa la mediana global como respaldo si el proveedor no tiene muestra mínima', () => {
    const c = [
      { estado: 'Recepcion Bodega', proveedor: 'OTRO1', tiempoRespuesta: '8 dias' },
      { estado: 'Recepcion Bodega', proveedor: 'OTRO2', tiempoRespuesta: '8 dias' },
      { estado: 'Recepcion Bodega', proveedor: 'NUEVO', tiempoRespuesta: '8 dias' },
      { estado: 'OC por Firmar', pedido: 'P2', proveedor: 'NUEVO', tiempoRespuesta: '20 dias' },
    ];
    const r = pedidosPotencialmenteTrabados(c, 1.5, 3);
    expect(r).toHaveLength(1);
    expect(r[0].usaRespaldoGlobal).toBe(true);
  });

  it('respeta factorAlerta explícito', () => {
    const c = [
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'OC Firmada', pedido: 'P1', proveedor: 'ACME', tiempoRespuesta: '13 dias' },
    ];
    expect(pedidosPotencialmenteTrabados(c, 1.5, 3)).toEqual([]);
    expect(pedidosPotencialmenteTrabados(c, 1.2, 3)).toHaveLength(1);
  });

  it('ordena por mayor exceso sobre la referencia primero', () => {
    const c = [
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'OC Firmada', pedido: 'POCO', proveedor: 'ACME', tiempoRespuesta: '16 dias' },
      { estado: 'OC Firmada', pedido: 'MUCHO', proveedor: 'ACME', tiempoRespuesta: '40 dias' },
    ];
    const r = pedidosPotencialmenteTrabados(c, 1.5, 3);
    expect(r.map((x) => x.pedido)).toEqual(['MUCHO', 'POCO']);
  });

  it('no muta el arreglo original (pura)', () => {
    const c = [
      { estado: 'Recepcion Bodega', proveedor: 'ACME', tiempoRespuesta: '10 dias' },
      { estado: 'OC Firmada', pedido: 'P1', proveedor: 'ACME', tiempoRespuesta: '20 dias' },
    ];
    const copia = c.map((x) => ({ ...x }));
    pedidosPotencialmenteTrabados(c);
    expect(c).toEqual(copia);
  });
});
