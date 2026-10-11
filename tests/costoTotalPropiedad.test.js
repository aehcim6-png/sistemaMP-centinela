// Costo total de propiedad (TCO) por equipo: capital + mantención + detención, por hora de operación.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const hoy = new Date('2025-12-31T12:00:00Z');
const base = { sigla: 'A', modelo: 'Komatsu HD785-7', tipo: 'Camion', horomActual: 20000, hrsDia: 16, valorCompra: 780000000, valorHoraAmort: 31000, anioFab: 2021 };
const compras = [{ sigla: 'A', fecha: '2023-01-10', costo: 10e6 }, { sigla: 'A', fecha: '2024-06-10', costo: 30e6 }, { sigla: 'A', fecha: '2025-06-10', costo: 20e6 }];
const hist = [{ sigla: 'A', fecha: '2023-01-01', horom: 10000 }, { sigla: 'A', fecha: '2024-01-01', horom: 14000 }, { sigla: 'A', fecha: '2025-01-01', horom: 17000 }, { sigla: 'A', fecha: '2025-12-31', horom: 20000 }];
const dd = (extra) => Object.assign({ compras, hist, downMap: { A: { '2024-03-01': 24, '2025-03-01': 10 } }, hoy }, extra);

describe('tcoCapitalPorHora', () => {
  it('manda la amortización contable por hora del equipo', () => {
    expect(L.tcoCapitalPorHora(base)).toEqual({ porHora: 31000, fuente: 'amortización contable por hora' });
  });
  it('sin ella: valor de compra ÷ vida contable del equipo, o la de referencia por clase (camión 26.000 h)', () => {
    const a = L.tcoCapitalPorHora(Object.assign({}, base, { valorHoraAmort: null, vidaContableH: 30000 }));
    expect(a.porHora).toBeCloseTo(780000000 / 30000, 6);
    const b = L.tcoCapitalPorHora(Object.assign({}, base, { valorHoraAmort: 0 }));
    expect(b.porHora).toBeCloseTo(780000000 / 26000, 6); expect(b.fuente).toMatch(/camion/);
    expect(L.TCO_VIDA_CONTABLE_H).toEqual({ camion: 26000, cargador: 18000, bulldozer: 17000 });
  });
  it('sin valor de compra ni amortización, o modelo sin clase: null (no se inventa capital)', () => {
    expect(L.tcoCapitalPorHora({ sigla: 'X', modelo: 'Komatsu HD785-7' })).toBeNull();
    expect(L.tcoCapitalPorHora({ sigla: 'X', modelo: 'Doosan LCV6-LED', valorCompra: 1e7 })).toBeNull();
  });
});

describe('tcoEquipo', () => {
  const r = L.tcoEquipo(base, dd(), { costoHoraDet: 122850 });
  it('mide horas, mantención y detención en la misma ventana (primera compra → fin)', () => {
    expect(r.desde).toBe('2023-01-10'); expect(r.hasta).toBe('2025-12-31');
    expect(r.horas).toBe(10000); expect(r.fuenteHoras).toBe('historial de horómetros');
    expect(r.mat).toBe(60e6); expect(r.matPorHora).toBe(6000);
    expect(r.horasDet).toBe(34); expect(r.det).toBeCloseTo(34 * 122850, 6); expect(r.detPorHora).toBeCloseTo(34 * 122850 / 10000, 6);
  });
  it('TCO por hora = capital + mantención + detención y el anual es consistente', () => {
    expect(r.tcoPorHora).toBeCloseTo(31000 + r.matPorHora + r.detPorHora, 8);
    expect(r.variablePorHora).toBeCloseTo(r.matPorHora + r.detPorHora, 8);
    expect(r.tcoAnual).toBeCloseTo(r.tcoPorHora * r.horasAnio, 4);
    expect(r.matAnual + r.detAnual + r.capitalAnual).toBeCloseTo(r.tcoAnual, 4);
    expect(r.pctMat).toBeCloseTo(r.mat / (r.mat + r.det + 31000 * 10000), 8);
  });
  it('evolución por año con el horómetro de los bordes de cada año', () => {
    const a25 = r.porAnio.find(x => x.anio === 2025);
    expect(a25.horas).toBe(3000); expect(a25.mat).toBe(20e6); expect(a25.matPorHora).toBeCloseTo(20e6 / 3000, 6);
    expect(a25.horasDet).toBe(10); expect(a25.variablePorHora).toBeCloseTo((20e6 + 10 * 122850) / 3000, 6);
    expect(r.porAnio.map(x => x.anio)).toEqual([2023, 2024, 2025]);
  });
  it('sin capital el TCO total queda nulo pero el costo variable se mantiene', () => {
    const s = L.tcoEquipo({ sigla: 'A', modelo: 'Doosan X', horomActual: 20000, hrsDia: 16 }, dd(), { costoHoraDet: 122850 });
    expect(s.tcoPorHora).toBeNull(); expect(s.capital).toBeNull(); expect(s.variablePorHora).toBeGreaterThan(0);
  });
  it('sin costo de hora detenida no hay costo de detención, pero sí las horas', () => {
    const s = L.tcoEquipo(base, dd(), { costoHoraDet: 0 });
    expect(s.det).toBe(0); expect(s.horasDet).toBe(34);
  });
  it('excluye la línea de OC igual al valor de compra (la compra del propio equipo) y lo posterior al fin de ventana', () => {
    const extra = compras.concat([{ sigla: 'A', fecha: '2023-02-01', costo: 780000000 }, { sigla: 'A', fecha: '2026-03-01', costo: 5e6 }]);
    expect(L.tcoEquipo(base, dd({ compras: extra }), {}).mat).toBe(60e6);
  });
  it('detenciones fuera de la ventana no cuentan', () => {
    const s = L.tcoEquipo(base, dd({ downMap: { A: { '2022-06-01': 100, '2024-03-01': 24, '2026-01-01': 50 } } }), { costoHoraDet: 1000 });
    expect(s.horasDet).toBe(24);
  });
  it('ventana de menos de 90 días o sin mantención → null', () => {
    expect(L.tcoEquipo(base, dd({ compras: [{ sigla: 'A', fecha: '2025-12-01', costo: 1e6 }] }), {})).toBeNull();
    expect(L.tcoEquipo(base, dd({ compras: [] }), {})).toBeNull();
    expect(L.tcoEquipo(base, dd({ compras: [{ sigla: 'B', fecha: '2023-01-01', costo: 1e6 }] }), {})).toBeNull();
  });
  it('sin historial de horómetros estima las horas con las horas/día declaradas y lo dice', () => {
    const s = L.tcoEquipo(base, dd({ hist: [] }), {});
    expect(s.fuenteHoras).toMatch(/estimado/);
    expect(s.horas).toBe(Math.min(16 * s.dias, 20000));
  });
});

describe('tcoFlota', () => {
  const mk = (sigla, anio, cap, extra) => Object.assign({}, base, { sigla, anioFab: anio, valorHoraAmort: cap, horomActual: 20000 }, extra);
  const eqs = [mk('A', 2021, 31000), mk('B', 2021, 31000), mk('C', 2021, 31000), mk('N', 2026, 57000, { horomActual: 900 })];
  const cp = [];
  [['A', 60e6], ['B', 30e6], ['C', 90e6]].forEach(([s, v]) => { cp.push({ sigla: s, fecha: '2023-01-10', costo: v / 3 }, { sigla: s, fecha: '2024-06-10', costo: v / 3 }, { sigla: s, fecha: '2025-06-10', costo: v / 3 }); });
  const h = [];
  ['A', 'B', 'C'].forEach(s => h.push({ sigla: s, fecha: '2023-01-01', horom: 10000 }, { sigla: s, fecha: '2025-12-31', horom: 20000 }));
  const r = L.tcoFlota(eqs, { compras: cp, hist: h, downMap: {}, hoy }, { costoHoraDet: 0 });
  it('calcula los equipos con datos, ordenados por TCO por hora', () => {
    expect(r.equipos.map(x => x.sigla)).toEqual(['C', 'A', 'B']);
    expect(r.equipos.every(x => x.tcoPorHora != null)).toBe(true);
  });
  it('compara contra la mediana del modelo (con ≥3 unidades) y contra el capital de la unidad más nueva', () => {
    const c = r.equipos.find(x => x.sigla === 'C');
    expect(c.modeloN).toBe(3); expect(c.medianaModelo).toBeCloseTo(6000, 6);       // A 6.000, B 3.000, C 9.000 por hora
    expect(c.indiceVsModelo).toBeCloseTo(1.5, 6);
    expect(c.refNuevo).toBe('N'); expect(c.capitalNuevoPorHora).toBe(57000);
    expect(c.razonVariableCapitalNuevo).toBeCloseTo(9000 / 57000, 6);
  });
  it('con menos de 3 unidades del modelo no hay mediana', () => {
    const solo = L.tcoFlota(eqs.slice(0, 2), { compras: cp.filter(c => c.sigla !== 'C'), hist: h, downMap: {}, hoy }, {});
    expect(solo.equipos.every(x => x.medianaModelo === null)).toBe(true);
  });
  it('si los últimos meses de compras vienen con carga incompleta, el fin de la ventana retrocede al último mes completo', () => {
    const cpm = [];
    for (let m = 1; m <= 24; m++) { const mes = 2024 + Math.floor((m - 1) / 12) + '-' + String(((m - 1) % 12) + 1).padStart(2, '0'); for (let k = 0; k < 10; k++) cpm.push({ sigla: 'A', fecha: mes + '-1' + (k % 9), costo: 1e5 }); }
    cpm.push({ sigla: 'A', fecha: '2026-01-05', costo: 1e5 }, { sigla: 'A', fecha: '2026-02-05', costo: 1e5 });   // 1 línea en los dos últimos meses
    const f = L.tcoFlota([mk('A', 2021, 31000, { horomActual: 90000 })], { compras: cpm, hist: [], downMap: {}, hoy: new Date('2026-03-15T12:00:00Z') }, {});
    expect(f.mesesQuitados).toEqual(['2026-01', '2026-02']);
    expect(f.hasta).toBe('2025-12-31');
  });
});

describe('parsearHorasAmortizar (listado Horas a Amortizar)', () => {
  const eq = [{ sigla: 'CN-9500' }, { sigla: 'CN-9506' }, { sigla: 'CF-9510' }, { sigla: 'BD-10139' }];
  const filas = [
    { Sigla: 'CN-9500', Saldo_Horas_Real: 26000, Valor_Hora: 31000, Faena: 'Centinela Ripios OXE' },
    { Sigla: 'cn-9506 ', Saldo_Horas_Real: 26000, Valor_Hora: 31788.4, Faena: 'Sal Lobos Mina 2018' },
    { Sigla: 'CF-9510', Saldo_Horas_Real: 18000, Valor_Hora: 87891 },
    { Sigla: 'BD-10139', Saldo_Horas_Real: 17000, Valor_Hora: 0 },
    { Sigla: 'RE-1', Saldo_Horas_Real: 1000, Valor_Hora: 500 },
    { Sigla: '', Valor_Hora: 5 }
  ];
  const r = L.parsearHorasAmortizar(filas, eq);
  it('actualiza solo los equipos del programa con Valor_Hora positivo (sigla sin importar mayúsculas ni espacios)', () => {
    expect(r.actualizar.map(a => a.sigla)).toEqual(['CN-9500', 'CN-9506', 'CF-9510']);
    expect(r.actualizar[0]).toEqual({ sigla: 'CN-9500', valorHoraAmort: 31000, vidaContableH: 26000, faena: 'Centinela Ripios OXE' });
    expect(r.actualizar[1].valorHoraAmort).toBe(31788);                  // se redondea a pesos
  });
  it('informa lo que no se pudo usar: sigla ajena, sin valor', () => {
    expect(r.sinEquipo).toEqual(['RE-1']);
    expect(r.sinValor).toEqual(['BD-10139']);
  });
  it('una sigla repetida se queda con la primera con valor y se avisa', () => {
    const d = L.parsearHorasAmortizar([{ Sigla: 'CN-9500', Valor_Hora: 31000, Saldo_Horas_Real: 26000 }, { Sigla: 'CN-9500', Valor_Hora: 99999 }], eq);
    expect(d.actualizar).toHaveLength(1); expect(d.actualizar[0].valorHoraAmort).toBe(31000); expect(d.repetidas).toEqual(['CN-9500']);
  });
  it('sin vida contable válida queda null (se usa la de referencia por clase) y números como texto se leen', () => {
    const d = L.parsearHorasAmortizar([{ Sigla: 'CN-9500', Valor_Hora: '31000', Saldo_Horas_Real: '' }], eq);
    expect(d.actualizar[0]).toMatchObject({ valorHoraAmort: 31000, vidaContableH: null });
  });
  it('entradas vacías no revientan', () => {
    expect(L.parsearHorasAmortizar(null, null)).toEqual({ actualizar: [], sinEquipo: [], sinValor: [], repetidas: [] });
  });
});
