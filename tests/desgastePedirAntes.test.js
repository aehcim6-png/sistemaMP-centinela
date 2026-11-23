// Qué pedir de las piezas de desgaste (23-nov-2026): próximo cambio − plazo real, con el stock del MODELO y la última compra como referencia. Sin inventar.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const L = createRequire(import.meta.url)('../logic.js');

const hoy = '2026-11-23';
const cambio = (sigla, pieza, fecha, h) => ({ sigla, pieza, fecha, descripcion: pieza + ': cambio', horometro: h || null });
// MN-6112: cuchillas cada ~25 días, último cambio hace 10 días → próximo en ~15 días
const cambios = [cambio('MN-6112', 'Cuchillas', '2026-09-14'), cambio('MN-6112', 'Cuchillas', '2026-10-09'), cambio('MN-6112', 'Cuchillas', '2026-11-03'),
  // CF-9511: último cambio de entredientes hace 233 días → sin registros recientes
  cambio('CF-9511', 'Entredientes', '2026-03-30'), cambio('CF-9511', 'Entredientes', '2026-04-02'), cambio('CF-9511', 'Entredientes', '2026-04-04')];
const equipos = [{ sigla: 'MN-6112', modelo: 'Komatsu GD-705-5' }, { sigla: 'CF-9511', modelo: 'Komatsu WA900-3' }];
const plazoFn = (monto) => ({ dias: monto > 3e6 ? 24 : 18, peor: monto > 3e6 ? 126 : 77, supuesto: false, fuente: 'mediana de OC' });
const repuestos = [
  { componente: 'Cuchilla niveladora', equipo: 'GD705-5', stockActual: '4', stockMinimo: '6' },
  { componente: 'Cuchilla niveladora', equipo: 'GD705-5', stockActual: '12', stockMinimo: '6' },
  { componente: 'Perno cuchilla', equipo: 'GD705-5', stockActual: '64', stockMinimo: '96' },
  { componente: 'Cuchilla central', equipo: 'D65', stockActual: '22', stockMinimo: '2' },
];
const compras = [{ sigla: 'MN-6112', fecha: '2026-10-20', detalle: 'Cuchilla 7x8x1 3/4 4t2233', cant: 6, costo: 900000, oc: '1' }, { sigla: 'MN-6112', fecha: '2026-10-20', detalle: 'Perno cuchilla', cant: 60, costo: 100000, oc: '1' }];

describe('desgastePedirAntes', () => {
  const r = L.desgastePedirAntes({ cambios, hoy, plazoFn, equipos, repuestos, compras });
  it('próximo cambio − plazo = pedir antes de, con el peor caso aparte', () => {
    const f = r.filas.find(x => x.sigla === 'MN-6112' && x.pieza === 'Cuchillas');
    expect(f.proximoCambio).toBe('2026-11-28');
    expect(f.plazo.dias).toBe(18);
    expect(f.pedirAntes).toBe('2026-11-10');
    expect(f.ya).toBe(true);
    expect(f.pedirAntesPeor).toBe('2026-09-12');
  });
  it('el stock sale del modelo del equipo (GD705-5), suma sus filas y no cuenta pernos ni otros modelos', () => {
    const f = r.filas.find(x => x.sigla === 'MN-6112');
    expect(f.stock).toBe(16);
    expect(f.stockMinimo).toBe(12);
    expect(f.filasStock).toBe(2);
  });
  it('la última compra del equipo y pieza es solo referencia (cantidad y monto de la compra, sin pernos)', () => {
    const f = r.filas.find(x => x.sigla === 'MN-6112');
    expect(f.ultimaCompra.cant).toBe(6);
    expect(f.ultimaCompra.monto).toBe(900000);
  });
  it('sin registros recientes no se inventa fecha: queda aparte con el motivo', () => {
    expect(r.filas.find(x => x.sigla === 'CF-9511')).toBeUndefined();
    const s = r.sinFecha.find(x => x.sigla === 'CF-9511');
    expect(s.proximoCambio).toBeNull();
    expect(s.motivo).toContain('2026-04-04');
  });
  it('sin stock cargado para el modelo dice null y avisa', () => {
    const r2 = L.desgastePedirAntes({ cambios, hoy, plazoFn, equipos, repuestos: [], compras: [] });
    expect(r2.filas[0].stock).toBeNull();
    expect(r2.avisos.join(' ')).toContain('no tienen stock cargado');
  });
  it('el monto de la última compra elige la banda del plazo (más de $3 millones tarda más)', () => {
    const r3 = L.desgastePedirAntes({ cambios, hoy, plazoFn, equipos, repuestos, compras: [{ sigla: 'MN-6112', fecha: '2026-10-20', detalle: 'Cuchilla', cant: 6, costo: 4e6 }] });
    expect(r3.filas[0].plazo.dias).toBe(24);
  });
  it('sin plazo real usa 34 días y lo declara supuesto', () => {
    const r4 = L.desgastePedirAntes({ cambios, hoy, plazoFn: null, equipos, repuestos, compras });
    expect(r4.filas[0].plazo.supuesto).toBe(true);
    expect(r4.avisos.join(' ')).toContain('supuesto');
  });

  it('trae cuántas piezas lleva un cambio completo según el modelo y si el stock del modelo alcanza', () => {
    const f = r.filas.find(x => x.sigla === 'MN-6112');
    expect(f.unidadesPorCambio).toBe(2);
    expect(f.alcanza).toBe(true);   // 16 en stock del modelo vs 2 cuchillas
    const r5 = L.desgastePedirAntes({ cambios, hoy, plazoFn, equipos, repuestos: [{ componente: 'Cuchilla niveladora', equipo: 'GD705-5', stockActual: '1', stockMinimo: '6' }], compras: [] });
    expect(r5.filas[0].alcanza).toBe(false);
    expect(r5.filas[0].faltan).toBe(1);
  });
});

describe('desgasteUnidadesPorCambio (lo que lleva cada modelo)', () => {
  const u = (m, p) => L.desgasteUnidadesPorCambio(m, p);
  it('motoniveladora, cargador y los dos bulldozer', () => {
    expect(u('Komatsu GD-705-5', 'Cuchillas').n).toBe(2);
    expect(u('Komatsu GD-705-5', 'Puntas').n).toBe(5);
    expect(u('Komatsu WA900-8R', 'Entredientes').n).toBe(15);
    expect(u('Komatsu WA900-8R', 'Canilleras').n).toBe(4);
    expect(u('Komatsu D65EX-18E0', 'Cuchillas').n).toBe(2);
    expect(u('Komatsu D65EX-18E0', 'Cantoneras').n).toBe(2);
    expect(u('Komatsu D65EX-18E0', 'Puntas').n).toBe(3);
    expect(u('Komatsu D375A-6R', 'Cuchillas').n).toBe(4);
    expect(u('Komatsu D375A-6R', 'Cantoneras').n).toBe(2);
    expect(u('Komatsu D375A-6R', 'Puntas').n).toBe(1);
  });
  it('lo que no se sabe es null (no se inventa)', () => {
    expect(u('Komatsu WA900-8R', 'Cuchillas')).toBeNull();
    expect(u('Modelo desconocido', 'Cuchillas')).toBeNull();
  });
});
