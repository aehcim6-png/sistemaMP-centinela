// Curva S de PM (plan vs real acumulado, ponderado por horas) y cumplimiento del programa.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const dia = (desde, n) => iso(new Date(desde + 'T12:00:00').getTime() + n * 86400000);
// lecturas diarias de horómetro: desde `desde` con `h0`, avanzando `ritmo` por día durante `n` días
const lecturas = (sigla, desde, h0, ritmo, n) => Array.from({ length: n + 1 }, (_, k) => ({ sigla, fecha: dia(desde, k), horom: h0 + ritmo * k }));
const A = { sigla: 'A', modelo: 'Komatsu HD785-7', hrsDia: 10, frecPM: 250, horomActual: 1100, unidad: 'hr' };
const hist = lecturas('A', '2026-04-30', 450, 10, 37);                // 450 el 30-abr → 760 el 31-may → 820 el 6-jun

describe('constantes y equivalencias de PM', () => {
  it('duraciones estándar: PM1 3 h, PM2 5 h, PM3 8 h, PM4 12 h; PM5–PM9 equivalen a un PM del ciclo', () => {
    expect(L.PM_DURACION_ESTANDAR_H).toEqual({ PM1: 3, PM2: 5, PM3: 8, PM4: 12 });
    expect(['PM1', 'PM2', 'PM3', 'PM4', 'PM5', 'PM6', 'PM7', 'PM8', 'PM9', 'pm4 ', 'Correctivo', '', null].map(L.pmTipoEfectivo))
      .toEqual(['PM1', 'PM2', 'PM3', 'PM4', 'PM1', 'PM2', 'PM1', 'PM4', 'PM1', 'PM4', null, null, null]);
  });
  it('pmDuracionesEstandar respeta los valores válidos de Configuración y cae al estándar en los demás', () => {
    expect(L.pmDuracionesEstandar({ PM1: 2, PM2: 0, PM3: 'x', PM4: 15 })).toEqual({ PM1: 2, PM2: 5, PM3: 8, PM4: 15 });
    expect(L.pmDuracionesEstandar(null)).toEqual({ PM1: 3, PM2: 5, PM3: 8, PM4: 12 });
  });
});

describe('curvaSPM', () => {
  const reg = [{ equipo: 'A', tipoPM: 'PM2', fechaEntrada: '2026-05-07' }, { equipo: 'A', tipoPM: 'PM1', fechaEntrada: '2026-05-28' }];
  it('arma el plan con los hitos del horómetro (PM2 en 500 h, PM1 en 750 h) y la curva acumulada ponderada por horas', () => {
    const c = L.curvaSPM([A], { reg, hist, hoy: '2026-06-05' }, { mes: '2026-05' });
    expect(c.dias).toBe(31); expect(c.diaCorte).toBe(31);
    expect(c.serie[4].planH).toBe(0); expect(c.serie[5].planH).toBe(5); expect(c.serie[29].planH).toBe(5); expect(c.serie[30].planH).toBe(8);
    expect(c.serie[6].realH).toBe(0); expect(c.serie[7].realH).toBe(5); expect(c.serie[28].realH).toBe(8);
    expect(c.totales).toMatchObject({ planH: 8, planN: 2, realH: 8, realN: 2 });
    expect(c.cumplimiento).toBe(1); expect(c.brechaH).toBe(0);
    expect(c.tipos.PM2).toMatchObject({ plan: 1, real: 1, horas: 5 }); expect(c.tipos.PM1).toMatchObject({ plan: 1, real: 1, horas: 3 });
  });
  it('pondera por horas, no por cantidad: un PM4 pesa 4 veces un PM1', () => {
    const r = [{ equipo: 'A', tipoPM: 'PM4', fechaEntrada: '2026-05-10' }];
    const c = L.curvaSPM([A], { reg: r, hist, hoy: '2026-06-05' }, { mes: '2026-05' });
    expect(c.totales.realH).toBe(12); expect(c.totales.realN).toBe(1);
    expect(c.cumplimiento).toBeCloseTo(12 / 8, 5);                 // más horas ejecutadas que planificadas
    expect(c.cumplimientoN).toBeCloseTo(1 / 2, 5);                 // pero la mitad de los PM
  });
  it('las duraciones de Configuración reemplazan a las estándar', () => {
    const c = L.curvaSPM([A], { reg, hist, hoy: '2026-06-05' }, { mes: '2026-05', duraciones: { PM1: 1, PM2: 2 } });
    expect(c.totales.planH).toBe(3); expect(c.totales.realH).toBe(3);
  });
  it('PM5–PM9 cuentan como su PM equivalente y un tipo desconocido no suma horas (se informa)', () => {
    const r = [{ equipo: 'A', tipoPM: 'PM7', fechaEntrada: '2026-05-07' }, { equipo: 'A', tipoPM: 'Correctivo', fechaEntrada: '2026-05-08' }, { equipo: 'A', tipoPM: 'PM8', fechaEntrada: '2026-05-09' }];
    const c = L.curvaSPM([A], { reg: r, hist, hoy: '2026-06-05' }, { mes: '2026-05' });
    expect(c.totales.realH).toBe(3 + 12); expect(c.sinTipo).toBe(1); expect(c.realTiposAntiguos).toBe(2);
  });
  it('mes en curso: el plan se ve completo, lo real llega hasta hoy, y se proyecta el cierre con el ritmo de cumplimiento', () => {
    const c = L.curvaSPM([Object.assign({}, A, { horomActual: 600 })], { reg: [{ equipo: 'A', tipoPM: 'PM2', fechaEntrada: '2026-05-07' }], hist: lecturas('A', '2026-04-30', 450, 10, 20), hoy: '2026-05-20' }, { mes: '2026-05' });
    expect(c.diaCorte).toBe(20);
    expect(c.serie[31].planH).toBe(8);                              // el PM1 de 750 h cae el día 30 por proyección
    expect(c.serie[20].realH).toBe(5); expect(c.serie[21].realH).toBeNull();
    expect(c.totales.planCorteH).toBe(5); expect(c.cumplimiento).toBe(1);
    expect(c.proyeccionCierreH).toBe(8); expect(c.proyeccionCierrePct).toBe(1);
  });
  it('un atraso se refleja en la brecha, el cumplimiento y la proyección', () => {
    const c = L.curvaSPM([A], { reg: [], hist, hoy: '2026-05-20' }, { mes: '2026-05' });
    expect(c.totales.planCorteH).toBe(5); expect(c.totales.realH).toBe(0);
    expect(c.cumplimiento).toBe(0); expect(c.brechaH).toBe(5);
    expect(c.equipos[0]).toMatchObject({ sigla: 'A', atrasoH: 5, planCorteN: 1, realN: 0 });
    expect(c.proyeccionCierreH).toBe(0);
  });
  it('mes futuro: el plan sale de horomActual + horas/día y no hay nada real', () => {
    const e = Object.assign({}, A, { horomActual: 1000 });
    const c = L.curvaSPM([e], { reg: [], hist: [], hoy: '2026-05-20' }, { mes: '2026-06' });
    expect(c.diaCorte).toBe(0);
    // hoy 20-may con 1000 h; 10 h/día → el 31-may 1110, el 30-jun 1410: hito de 1250 (PM1) cae el día 14 de junio
    expect(c.totales.planN).toBe(1); expect(c.serie[14].planH).toBe(3); expect(c.serie[13].planH).toBe(0);
    expect(c.serie.every((s) => s.realH === null || s.dia === 0)).toBe(true);
  });
  it('sin lectura antes del mes el equipo queda fuera (no se inventa un plan); con una lectura en la primera semana se ancla ahí', () => {
    const sinLect = L.curvaSPM([A], { reg: [], hist: lecturas('A', '2026-05-20', 700, 10, 10), hoy: '2026-06-05' }, { mes: '2026-05' });
    expect(sinLect.sinBase).toEqual(['A']); expect(sinLect.totales.planN).toBe(0);
    const ancla = L.curvaSPM([A], { reg: [], hist: lecturas('A', '2026-05-03', 480, 10, 60), hoy: '2026-06-05' }, { mes: '2026-05' });
    expect(ancla.estimados).toEqual(['A']); expect(ancla.totales.planN).toBeGreaterThan(0);
  });
  it('un equipo detenido (horómetro sin avance) no genera PM, y uno con más horas que las posibles en el mes se descarta como lectura mala', () => {
    const parado = L.curvaSPM([A], { reg: [], hist: lecturas('A', '2026-04-30', 450, 0, 37), hoy: '2026-06-05' }, { mes: '2026-05' });
    expect(parado.totales.planN).toBe(0); expect(parado.anomalos).toEqual([]);
    const raro = L.curvaSPM([Object.assign({}, A, { hrsDia: 5 })], { reg: [], hist: lecturas('A', '2026-04-30', 450, 40, 37), hoy: '2026-06-05' }, { mes: '2026-05' });
    expect(raro.anomalos).toEqual(['A']); expect(raro.totales.planN).toBe(0); expect(raro.conBase).toBe(0);
  });
  it('excluye equipos medidos en km y los registros de otros equipos', () => {
    const km = { sigla: 'K', hrsDia: 200, frecPM: 10000, horomActual: 5, unidad: 'km' };
    const c = L.curvaSPM([A, km], { reg: reg.concat([{ equipo: 'K', tipoPM: 'PM1', fechaEntrada: '2026-05-07' }, { equipo: 'Z', tipoPM: 'PM1', fechaEntrada: '2026-05-07' }]), hist, hoy: '2026-06-05' }, { mes: '2026-05' });
    expect(c.elegibles).toBe(1); expect(c.totales.realN).toBe(2);
  });
});

describe('cumplimientoProgramaMeses', () => {
  it('resume mes a mes, omite meses futuros y meses sin base suficiente, y marca el mes en curso como parcial', () => {
    const reg = [{ equipo: 'A', tipoPM: 'PM2', fechaEntrada: '2026-05-07' }, { equipo: 'A', tipoPM: 'PM1', fechaEntrada: '2026-05-28' }];
    const r = L.cumplimientoProgramaMeses([A], { reg, hist: lecturas('A', '2026-04-30', 450, 10, 60), hoy: '2026-06-28' }, ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
    expect(r.map((x) => x.mes)).toEqual(['2026-05', '2026-06']);          // marzo y abril sin lecturas; julio es futuro
    expect(r[0]).toMatchObject({ planH: 8, realH: 8, cumplimiento: 1, parcial: false });
    expect(r[1].parcial).toBe(true);
  });
});

describe('el pronóstico de disponibilidad usa las duraciones estándar de PM', () => {
  it('más horas por PM, menos disponibilidad esperada', () => {
    const rng = (() => { let s = 1; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; })();
    const eq = Array.from({ length: 6 }, (_, i) => ({ sigla: 'E' + i, modelo: 'X', hrsDia: 16, frecPM: 100, horomActual: 1000, horomProxPM: 1100, unidad: 'hr' }));
    const ot = []; eq.forEach((e) => { for (let d = 0; d < 300; d += 12) { const f = dia('2025-12-01', d); ot.push({ sigla: e.sigla, fecha: f, fechaEntrada: f, duracion: '4h' }); } });
    const d = { reg: [], ot, hoy: '2026-10-01' };
    const corto = L.pronosticoDisponibilidadEquipos(eq, d, { nSim: 300, rng, duracionesPM: { PM1: 1, PM2: 1, PM3: 1, PM4: 1 } });
    const largo = L.pronosticoDisponibilidadEquipos(eq, d, { nSim: 300, rng, duracionesPM: { PM1: 6, PM2: 6, PM3: 6, PM4: 6 } });
    expect(largo.flota.p50).toBeLessThan(corto.flota.p50 - 2);
    expect(largo.equipos[0].pmHoras).toBeGreaterThan(corto.equipos[0].pmHoras);
  });
});
