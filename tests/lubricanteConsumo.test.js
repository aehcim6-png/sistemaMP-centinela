import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const L = require('../logic.js');

const lub = [
  { nombre: 'MOBILTRANS HD 50', unidad: 'Litro', stock: 100 },
  { nombre: 'MOBILGREASE XHP 322 MINE', unidad: 'Kilo', stock: 20 },
];

describe('Aceite y grasa repuestos en OT', () => {
  it('unidad corta y tipo', () => {
    expect(L.lubUnidadCorta('Litro')).toBe('L');
    expect(L.lubUnidadCorta('Kilo')).toBe('kg');
    expect(L.lubTipoDe(lub[0])).toBe('aceite');
    expect(L.lubTipoDe(lub[1])).toBe('grasa');
    expect(L.lubTipoDe({ nombre: 'Grasa litio', unidad: 'Litro' })).toBe('grasa');
    expect(L.lubTipoDe({ nombre: 'X', unidad: 'Unidad' })).toBe('otro');
  });

  it('origen del movimiento según el campo pm', () => {
    expect(L.lubOrigenDeMov({ pm: 'OT Correctivo' })).toBe('OT');
    expect(L.lubOrigenDeMov({ pm: 'Manual' })).toBe('Manual');
    expect(L.lubOrigenDeMov({ pm: 'PM4' })).toBe('PM');
    expect(L.lubOrigenDeMov({})).toBe('PM');
  });

  it('valida la línea: equipo, fecha, lubricante y cantidad', () => {
    const ok = { equipo: 'CF-9510', fecha: '2026-09-20', item: 'MOBILTRANS HD 50', cantidad: 1000 };
    expect(L.lubRegistroError(ok, lub)).toBeNull();
    expect(L.lubRegistroError({ ...ok, equipo: '' }, lub)).toMatch(/equipo/);
    expect(L.lubRegistroError({ ...ok, fecha: '20-09-2026' }, lub)).toMatch(/fecha/);
    expect(L.lubRegistroError({ ...ok, item: 'otro' }, lub)).toMatch(/lubricante/);
    expect(L.lubRegistroError({ ...ok, cantidad: 0 }, lub)).toMatch(/mayor que cero/);
    expect(L.lubRegistroError({ ...ok, cantidad: -3 }, lub)).toMatch(/mayor que cero/);
    expect(L.lubRegistroError({ ...ok, cantidad: 6000 }, lub)).toMatch(/error de digitación/);
    expect(L.lubRegistroError({ ...ok, item: 'MOBILGREASE XHP 322 MINE', cantidad: 2 }, lub)).toBeNull();
    expect(L.lubRegistroError({ ...ok, item: 'MOBILGREASE XHP 322 MINE', cantidad: 0 }, lub)).toMatch(/kg/);
  });

  it('arma el movimiento y descuenta el stock sin bajar de cero', () => {
    const r = { equipo: 'CF-9510', fecha: '2026-09-20', item: 'MOBILTRANS HD 50', cantidad: 30.456 };
    const { mov, stockNuevo } = L.lubMovDeRegistro(r, lub[0], 'OT Correctivo');
    expect(mov).toMatchObject({ tipo: 'Lubricante', item: 'MOBILTRANS HD 50', unidad: 'Litro', cant: 30.46, equipo: 'CF-9510', pm: 'OT Correctivo', ant: 100, nuevo: 69.54, mes: '2026-09' });
    expect(stockNuevo).toBe(69.54);
    const grande = L.lubMovDeRegistro({ ...r, cantidad: 500 }, lub[0], 'Manual');
    expect(grande.stockNuevo).toBe(0);
    expect(grande.mov.cant).toBe(500);
  });

  it('texto para la solución de la OT', () => {
    const t = L.lubTextoParaOT([{ item: 'MOBILTRANS HD 50', cantidad: 1000 }, { item: 'MOBILGREASE XHP 322 MINE', cantidad: 2.5 }], lub);
    expect(t).toBe('Aceite: MOBILTRANS HD 50 1000 L · Grasa: MOBILGREASE XHP 322 MINE 2.5 kg');
  });

  const mov = [
    { tipo: 'Lubricante', item: 'MOBILTRANS HD 50', fecha: '2026-11-08', cant: 20, pm: 'OT Correctivo' },
    { tipo: 'Lubricante', item: 'MOBILTRANS HD 50', fecha: '2026-11-03', cant: 10, pm: 'PM4' },
    { tipo: 'Lubricante', item: 'MOBILTRANS HD 50', fecha: '2026-11-02', cant: 5, pm: 'Manual' },
    { tipo: 'Lubricante', item: 'MOBILTRANS HD 50', fecha: '2026-10-20', cant: 1000, pm: 'OT Relleno de Fluidos' },
    { tipo: 'Lubricante', item: 'MOBILTRANS HD 50', fecha: '2026-09-10', cant: 300, pm: 'PM4' },
    { tipo: 'Lubricante', item: 'MOBILTRANS HD 50', fecha: '2026-08-15', cant: 60, pm: 'OT Correctivo' },
    { tipo: 'Lubricante', item: 'OTRO', fecha: '2026-11-08', cant: 999, pm: 'OT' },
    { tipo: 'Filtro', item: 'MOBILTRANS HD 50', fecha: '2026-11-08', cant: 999 },
  ];

  it('suma por período solo del lubricante pedido', () => {
    expect(L.lubConsumoPeriodo(mov, 'MOBILTRANS HD 50', '2026-11-01', '2026-11-10')).toBe(35);
    expect(L.lubConsumoPeriodo(mov, 'MOBILTRANS HD 50', '2026-11-01', '2026-11-10', 'OT')).toBe(20);
    expect(L.lubConsumoPeriodo(mov, 'MOBILTRANS HD 50', '2026-11-01', '2026-11-10', 'PM')).toBe(10);
    expect(L.lubConsumoPeriodo(mov, 'MOBILTRANS HD 50', '2026-11-01', '2026-11-10', 'Manual')).toBe(5);
  });

  it('resumen semanal y mensual con origen', () => {
    const r = L.lubConsumoResumen(mov, 'MOBILTRANS HD 50', '2026-11-10');
    expect(r.semana).toBe(20);              // 04-nov a 10-nov: solo los 20 L del 08-nov (el 03-nov ya queda fuera de la ventana)
    expect(r.semanaAnt).toBe(15);           // 28-oct a 03-nov: 10 (03-nov) + 5 (02-nov)
    expect(r.mes).toBe(35);
    expect(r.mesAnt).toBe(1000);
    expect(r.porOrigenMes).toEqual({ OT: 20, PM: 10, Manual: 5 });
    expect(r.prom3m).toBe(453.33);          // (1000 + 300 + 60) / 3
    expect(r.mesesPromedio).toBe(3);
    expect(r.ultimo).toBe('2026-11-08');
    expect(r.registros).toBe(6);
  });

  it('sin movimientos: todo en cero y sin inventar', () => {
    const r = L.lubConsumoResumen([], 'MOBILTRANS HD 50', '2026-11-10');
    expect(r).toMatchObject({ semana: 0, mes: 0, prom3m: 0, mesesPromedio: 0, ultimo: null, registros: 0 });
  });

  it('el promedio no se diluye cuando el primer registro es reciente', () => {
    const solo = [{ tipo: 'Lubricante', item: 'A', fecha: '2026-10-05', cant: 90, pm: 'OT' }];
    const r = L.lubConsumoResumen(solo, 'A', '2026-11-10');
    expect(r.mesesPromedio).toBe(1);
    expect(r.prom3m).toBe(90);
  });

  it('consumo mensual efectivo: lo real manda; si no hay, lo anotado a mano', () => {
    expect(L.lubConsumoMensualEfectivo({ prom3m: 120 }, 50, 80)).toBe(120);
    expect(L.lubConsumoMensualEfectivo({ prom3m: 0 }, 50, 80)).toBe(50);
    expect(L.lubConsumoMensualEfectivo({ prom3m: 0 }, 0, 80)).toBe(80);
    expect(L.lubConsumoMensualEfectivo(null, 0, 0)).toBe(0);
  });
});
