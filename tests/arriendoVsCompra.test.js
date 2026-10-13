import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const hd785 = { clave: 'hd7857', nombre: 'Komatsu HD785-7', nEquipos: 6, horasDia: 16, valorCompra: 1034440000, vidaContableH: 26000, repuestosPorHora: 11838, neumaticosPorHora: 10604.108 };
const d375 = { clave: 'd375a6r', nombre: 'Komatsu D375A-6R', nEquipos: 2, horasDia: 12, valorCompra: 1015000000, vidaContableH: 17000, repuestosPorHora: 15023, neumaticosPorHora: null };
const grua = { clave: 'grua1', nombre: 'Grúa sin sugerencias', nEquipos: 1, horasDia: 10, valorCompra: null, vidaContableH: null, repuestosPorHora: null, neumaticosPorHora: null };
const casi = (a, b, d = 2) => expect(Math.abs(a - b)).toBeLessThan(Math.pow(10, -d));

describe('arriendoVsCompra', () => {
  it('sin el valor de la UF no calcula nada y dice por qué', () => {
    const r = L.arriendoVsCompra([hd785], {});
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/UF/);
  });

  it('reproduce la planilla de referencia del CAEX (UF a $39.000)', () => {
    const f = L.arriendoVsCompra([hd785], { uf: 39000 }).filas[0];
    casi(f.horasMes, 486.4, 1);
    casi(f.costosCLP.operador, 13157.9, 0);     // 4 operadores × $1.600.000 ÷ 486,4 h
    casi(f.costosCLP.mecanico, 12335.5, 0);     // 4 mecánicos × $1.500.000 ÷ 486,4 h
    casi(f.costosCLP.combustible, 32700, 0);    // 1.308 L ÷ 12 h × $300
    casi(f.propiosUF, 2.0676, 3);
    casi(f.seco.min, 5.2676, 3); casi(f.seco.max, 6.0676, 3); casi(f.seco.medio, 5.6676, 3);
    expect(f.humedo).toEqual({ min: 8, max: 10, medio: 9 });
    casi(f.diferencia.min, 1.9324, 3); casi(f.diferencia.max, 4.7324, 3); casi(f.diferencia.medio, 3.3324, 3);
    casi(f.equilibrio, 0.551, 3);                // 55 % de disponibilidad
    casi(f.compra.capitalUF, 1.0202, 3); casi(f.compra.totalUF, 3.0877, 3);
    casi(f.chequeo.veces, 3.17, 2);              // en seco se paga ~3,2 veces el valor de compra
    expect(f.completo).toBe(true);
  });

  it('marca como sugeridos los valores que el usuario no puso y no los cuenta si los puso', () => {
    const a = L.arriendoVsCompra([hd785], { uf: 39000 }).filas[0];
    expect(a.sugeridos).toEqual(expect.arrayContaining(['operadores', 'litrosCarga', 'secaMin', 'humMax']));
    const b = L.arriendoVsCompra([hd785], { uf: 39000, modelos: { hd7857: { litrosCarga: 1000, humMin: 7 } } }).filas[0];
    expect(b.sugeridos).not.toContain('litrosCarga');
    expect(b.sugeridos).not.toContain('humMin');
    expect(b.entradas.litrosCarga).toBe(1000);
    expect(b.humedo.min).toBe(7);
  });

  it('la dotación sugerida es 2 por cada turno de 12 h (relevo 7x7)', () => {
    const e = (h) => L.arriendoVsCompra([{ ...hd785, horasDia: h }], { uf: 39000 }).filas[0].entradas.operadores;
    expect(e(16)).toBe(4); expect(e(12)).toBe(2); expect(e(8)).toBe(2); expect(e(24)).toBe(4);
  });

  it('un equipo sin neumáticos registrados (orugas) cuenta 0 y la fila queda completa', () => {
    const f = L.arriendoVsCompra([d375], { uf: 39000 }).filas[0];
    expect(f.costosCLP.neumaticos).toBe(0);
    expect(f.completo).toBe(true);
    casi(f.horasMes, 364.8, 1);
  });

  it('lo que falta se lista y el total no lo inventa', () => {
    const f = L.arriendoVsCompra([{ ...hd785, repuestosPorHora: null, valorCompra: null }], { uf: 39000 }).filas[0];
    expect(f.completo).toBe(false);
    expect(f.faltan.join(' ')).toMatch(/repuestos/);
    expect(f.faltan.join(' ')).toMatch(/valor de compra/);
    expect(f.costosCLP.repuestos).toBeNull();
    expect(f.compra).toBeNull();
  });

  it('un modelo sin sugerencias ni tarifas del usuario no tiene comparación', () => {
    const f = L.arriendoVsCompra([grua], { uf: 39000 }).filas[0];
    expect(f.seco).toBeNull(); expect(f.humedo).toBeNull(); expect(f.diferencia).toBeNull(); expect(f.equilibrio).toBeNull();
    expect(f.faltan.join(' ')).toMatch(/litros/);
    expect(f.faltan.join(' ')).toMatch(/tarifa seca/);
    expect(f.faltan.join(' ')).toMatch(/tarifa húmeda/);
    expect(f.completo).toBe(false);
  });

  it('con tarifas propias del usuario sí compara aunque el modelo no tenga sugerencias', () => {
    const f = L.arriendoVsCompra([{ ...grua, repuestosPorHora: 10000, valorCompra: 5e8, vidaContableH: 20000 }], { uf: 40000, modelos: { grua1: { litrosCarga: 600, secaMin: 2, secaMax: 3, humMin: 5, humMax: 6 } } }).filas[0];
    expect(f.completo).toBe(true);
    expect(f.diferencia.medio).toBeCloseTo(5.5 - (2.5 + f.propiosUF), 6);
  });

  it('el valor residual baja el capital por hora y la disponibilidad se usa por hora productiva', () => {
    const a = L.arriendoVsCompra([hd785], { uf: 39000 }).filas[0];
    const b = L.arriendoVsCompra([hd785], { uf: 39000, residual: 0.3, dispSeco: 0.7, dispHumedo: 0.9 }).filas[0];
    casi(b.compra.capitalUF, a.compra.capitalUF * 0.7, 6);
    casi(b.productivo.seco, a.seco.medio / 0.7, 6);
    casi(b.productivo.humedo, 9 / 0.9, 6);
    casi(b.equilibrio, a.seco.medio / (9 / 0.9), 6);
  });

  it('el precio del diésel y los litros mueven el combustible por hora', () => {
    const f = L.arriendoVsCompra([hd785], { uf: 39000, diesel: 600, horasCarga: 24 }).filas[0];
    casi(f.costosCLP.combustible, 1308 / 24 * 600, 6);
  });
});
