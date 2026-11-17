import { describe, it, expect } from 'vitest';
import { informeGestionPM, informeConfiabilidadPM, informeGestionFS, desviosPM } from '../logic.js';

// Secciones III (desviaciones de mantenimiento) y IV (equipos fuera de servicio) del informe de gestión del cliente.
const eq = [
  { sigla: 'MN-1', modelo: 'Komatsu GD-705-5', frecPM: 250, horomActual: 600 },
  { sigla: 'CN-1', modelo: 'Komatsu HD785-7', frecPM: 250, horomActual: 800 },
  { sigla: 'TI-1', modelo: 'Doosan LCV6-LED', frecPM: 250, horomActual: 520 },
  { sigla: 'CA-1', modelo: 'Toyota Hilux', frecPM: 10000, unidad: 'km', horomActual: 90000 },
];
const pm = (equipo, horomReal, fechaEntrada, extra) => Object.assign({ equipo, horomReal, fechaEntrada, tipoPM: 'PM1' }, extra || {});

describe('informeGestionPM — tabla y KPI de desviaciones (sección III)', () => {
  // mismo caso que el informe: una a +6 h (2 %), una a +7 h (3 %) y una a −7 h (−3 %), las tres dentro de ±25 h
  const reg = [pm('MN-1', 506, '2026-01-02'), pm('CN-1', 257, '2026-01-04'), pm('TI-1', 243, '2026-01-05')];
  it('devuelve horómetro programa, real, desvío en horas y en % del ciclo', () => {
    const { filas, resumen } = informeGestionPM(reg, eq, '2026-01-01', '2026-01-07');
    expect(filas.map((f) => [f.sigla, f.horomPrograma, f.horomReal, f.horas, f.pct])).toEqual([
      ['MN-1', 500, 506, 6, 2], ['CN-1', 250, 257, 7, 3], ['TI-1', 250, 243, -7, -3],
    ]);
    expect(filas[0].modelo).toBe('Komatsu GD-705-5');
    expect(resumen).toMatchObject({ total: 3, evaluables: 3, dentro: 3, pct: 100, adelantadas: 0, atrasadas: 0 });
  });
  it('solo toma los PM del rango de fechas, con los bordes incluidos', () => {
    const r = informeGestionPM(reg, eq, '2026-01-04', '2026-01-04');
    expect(r.filas.map((f) => f.sigla)).toEqual(['CN-1']);
    expect(r.resumen.total).toBe(1);
  });
  it('un PM fuera de ±25 h (adelantado o atrasado) baja el porcentaje y se cuenta aparte', () => {
    const r = informeGestionPM([pm('MN-1', 500, '2026-02-01'), pm('MN-1', 660, '2026-02-10'), pm('MN-1', 1010, '2026-02-20')], eq, '2026-02-01', '2026-02-28');
    // 500 → 0 h; 660 (hito 750) → −90 adelantado; 1010 (hito 1000) → +10... el hito tras el PM de 660 es 1000
    expect(r.resumen).toMatchObject({ evaluables: 3, dentro: 2, adelantadas: 1, atrasadas: 0, pct: 67 });
    expect(r.filas[1]).toMatchObject({ horas: -90, clase: 'adelantada', horomPrograma: 750 });
  });
  it('el hito sin registro y los equipos por km no entran a la tabla de horas', () => {
    const r = informeGestionPM([pm('MN-1', 250, '2026-03-01'), pm('MN-1', 800, '2026-03-10'), pm('CA-1', 90000, '2026-03-05', { desvioDias: 2 })], eq, '2026-03-01', '2026-03-31');
    expect(r.resumen).toMatchObject({ total: 3, hitoSinRegistro: 1, evaluables: 2, dentro: 1, atrasadas: 1 });
    expect(r.filas.map((f) => f.sigla)).toEqual(['MN-1']);
  });
  it('el porcentaje es el mismo que el de desviosPM sobre el mismo conjunto (Dashboard, KPI y Metas)', () => {
    const regs = [pm('MN-1', 500, '2026-04-01'), pm('MN-1', 790, '2026-04-12'), pm('CN-1', 250, '2026-04-03')];
    const ev = desviosPM(regs, eq);
    const evaluables = regs.filter((r) => ev.get(r).aTiempo !== null), dentro = evaluables.filter((r) => ev.get(r).aTiempo).length;
    expect(informeGestionPM(regs, eq, '2026-04-01', '2026-04-30').resumen.pct).toBe(Math.round(dentro / evaluables.length * 100));
  });
  it('sin PM en el rango no inventa porcentaje', () => {
    expect(informeGestionPM(reg, eq, '2025-01-01', '2025-01-07').resumen).toMatchObject({ total: 0, pct: null });
  });
});

describe('informeGestionFS — equipos fuera de servicio hoy (sección IV)', () => {
  const ot = [
    { sigla: 'CN-1', estatusEq: 'Fuera de Servicio', fechaEntrada: '2025-12-01', sistema: 'Motor', sintoma: 'Falla en motor', solucion: 'En proveedor externo' },
    { sigla: 'MN-1', estatusEq: 'Fuera de Servicio', fechaEntrada: '2025-11-27', componente: 'Combustible', sintoma: 'Retiro de estanque' },
    { sigla: 'TI-1', estatusEq: 'Fuera de Servicio', fechaEntrada: '2025-11-01', fechaSalida: '2025-11-05', sistema: 'Elevación' }, // ya volvió
    { sigla: 'TI-1', estatusEq: 'Operativo', fechaEntrada: '2025-12-10' },
  ];
  const reg = [pm('CN-1', 750, '2025-11-20'), pm('CN-1', 1000, '2025-12-15'), pm('MN-1', 500, '2025-11-15')];
  it('lista solo los que siguen abiertos, con días, sistema, observación y último PM, del más antiguo al más nuevo', () => {
    const { filas, total } = informeGestionFS(ot, eq, reg, '2026-01-07');
    expect(total).toBe(2);
    expect(filas.map((f) => [f.sigla, f.dias])).toEqual([['MN-1', 41], ['CN-1', 37]]);
    expect(filas[0]).toMatchObject({ sistema: 'Combustible', observacion: 'Retiro de estanque', ultimoPM: '2025-11-15', horomUltimoPM: 500, modelo: 'Komatsu GD-705-5', horomActual: 600 });
    expect(filas[1]).toMatchObject({ sistema: 'Motor', observacion: 'Falla en motor — En proveedor externo', ultimoPM: '2025-12-15', horomUltimoPM: 1000 });
  });
  it('sin salidas abiertas devuelve una lista vacía', () => {
    expect(informeGestionFS([], eq, reg, '2026-01-07')).toEqual({ filas: [], total: 0 });
  });
  it('un equipo sin PM registrado queda sin último PM, no se inventa', () => {
    const { filas } = informeGestionFS([ot[1]], eq, [], '2026-01-07');
    expect(filas[0].ultimoPM).toBeNull();
  });
});

describe('informeConfiabilidadPM — fallas por 1.000 h según lo que duró el intervalo entre PM', () => {
  const falla = (sigla, fecha) => ({ sigla, fecha, tipo: 'Correctivo' });
  it('clasifica el intervalo por su duración y cuenta las fallas de ese tramo', () => {
    // MN-1: PM a 250 (ene-10), 500 (feb-10, intervalo normal 250 h), 800 (mar-20, intervalo atrasado 300 h = 120 %)
    const reg = [pm('MN-1', 250, '2026-01-10'), pm('MN-1', 500, '2026-02-10'), pm('MN-1', 800, '2026-03-20')];
    const fallas = [falla('MN-1', '2026-01-20'), falla('MN-1', '2026-02-15'), falla('MN-1', '2026-03-01'), falla('MN-1', '2026-03-10'), falla('MN-1', '2026-04-01')];
    const r = informeConfiabilidadPM(reg, eq, fallas, '2026-06-01');
    const g = Object.fromEntries(r.grupos.map(x => [x.id, x]));
    expect(g.normal).toMatchObject({ intervalos: 1, horas: 250, fallas: 1 });
    expect(g.atrasado).toMatchObject({ intervalos: 1, horas: 300, fallas: 3 });
    expect(r.flota).toMatchObject({ intervalos: 2, horas: 550, fallas: 4 });
    expect(r.flota.tasa).toBe(7.3);
  });
  it('no cuenta fallas que no son de falla real ni de otro equipo, y no inventa tasas con pocas horas', () => {
    const reg = [pm('MN-1', 250, '2026-01-10'), pm('MN-1', 500, '2026-02-10')];
    const fallas = [{ sigla: 'MN-1', fecha: '2026-01-20', tipo: 'Preventivo' }, falla('CN-1', '2026-01-20')];
    const r = informeConfiabilidadPM(reg, eq, fallas, '2026-06-01');
    expect(r.flota.fallas).toBe(0);
    expect(r.filas[0].tasa).toBeNull();
    expect(r.grupos.every(x => x.tasa === null)).toBe(true);
  });
  it('descarta intervalos fuera de 0,4 a 2,4 ciclos y no modifica la grilla de PM', () => {
    const reg = [pm('MN-1', 250, '2026-01-10'), pm('MN-1', 500, '2026-02-10'), pm('MN-1', 1010, '2026-05-10')];
    const antes = JSON.stringify([...desviosPM(reg, eq).values()]);
    const r = informeConfiabilidadPM(reg, eq, [], '2026-06-01');
    expect(r.flota.intervalos).toBe(1);
    expect(JSON.stringify([...desviosPM(reg, eq).values()])).toBe(antes);
  });
  it('marca «Atención» al equipo que se atrasa seguido y falla sobre la flota', () => {
    const reg = [pm('MN-1', 250, '2026-01-01'), pm('MN-1', 530, '2026-02-01'), pm('MN-1', 810, '2026-03-01'), pm('MN-1', 1100, '2026-04-01'),
      pm('CN-1', 250, '2026-01-01'), pm('CN-1', 500, '2026-02-01'), pm('CN-1', 750, '2026-03-01'), pm('CN-1', 1000, '2026-04-01')];
    const fallas = [falla('MN-1', '2026-01-15'), falla('MN-1', '2026-02-15'), falla('MN-1', '2026-03-15'), falla('MN-1', '2026-03-20'), falla('CN-1', '2026-02-15')];
    const r = informeConfiabilidadPM(reg, eq, fallas, '2026-06-01');
    expect(r.filas[0].sigla).toBe('MN-1');
    expect(r.filas[0].atencion).toBe(true);
    expect(r.filas.find(f => f.sigla === 'CN-1').atencion).toBe(false);
  });
});
