import { describe, it, expect } from 'vitest';
import { minutosPautaPM, evaluarTiempoPM, cumplimientoTiempoPM, pautaTiempoRefSigla, PM_CUADRILLA_SUPUESTA, actividadPorPeriodo, esOTPredictiva } from '../logic.js';

// Tiempo por tarea de las pautas (tabla pautas_tiempos, PDF «Pauta Mantencion» del 18-11-2026) frente a la duración anotada del PM.
// Pauta de prueba (minutos por persona): 2 tareas a 250 h (10 + 20), 1 a 500 h (30), 1 a 1000 h (60), 1 a 2000 h (120), 1 de 100 h (5) y una de 400 h (50) que no divide a ningún hito.
const tareas = [
  { topeHoras: 250, minutos: 10 }, { topeHoras: 250, minutos: 20 }, { topeHoras: 500, minutos: 30 },
  { topeHoras: 1000, minutos: 60 }, { topeHoras: 2000, minutos: 120 }, { topeHoras: 100, minutos: 5 }, { topeHoras: 400, minutos: 50 },
];

describe('minutosPautaPM: trabajo que pide la pauta en cada nivel', () => {
  it('PM1 (250 h): las de 250 h y las de menos de 250 h → 10 + 20 + 5 = 35 min', () => {
    const r = minutosPautaPM(tareas, 'PM1');
    expect(r.minutos).toBe(35);
    expect(r.tareas).toBe(3);
    expect(r.horasPersona).toBeCloseTo(35 / 60, 6);
  });
  it('PM2 (500 h) suma la de 500 h: 35 + 30 = 65 min; la de 400 h no divide a 500 y no cuenta', () => {
    expect(minutosPautaPM(tareas, 'PM2').minutos).toBe(65);
  });
  it('PM3 (1000 h) suma la de 1000 h: 65 + 60 = 125 min', () => {
    expect(minutosPautaPM(tareas, 'PM3').minutos).toBe(125);
  });
  it('PM4 (2000 h) suma la de 2000 h y también la de 400 h, porque 2000 es múltiplo de 400: 125 + 120 + 50 = 295 min', () => {
    expect(minutosPautaPM(tareas, 'PM4').minutos).toBe(295);
  });
  it('acepta minúsculas y espacios en el nombre del PM', () => {
    expect(minutosPautaPM(tareas, ' pm2 ').minutos).toBe(65);
  });
  it('un nivel que no es PM1-PM4, o sin tareas, devuelve null', () => {
    expect(minutosPautaPM(tareas, 'PM5')).toBeNull();
    expect(minutosPautaPM(tareas, 'Correctivo')).toBeNull();
    expect(minutosPautaPM([], 'PM1')).toBeNull();
    expect(minutosPautaPM(null, 'PM1')).toBeNull();
  });
  it('las tareas en kilómetros (bus) no se cuentan como horas', () => {
    const bus = [{ topeHoras: 10000, unidad: 'km', minutos: 30 }, { topeHoras: 250, unidad: 'km', minutos: 10 }];
    expect(minutosPautaPM(bus, 'PM1')).toBeNull();
  });
  it('ignora tareas con tope o minutos inválidos, pero una tarea de 0 minutos sí cuenta como tarea', () => {
    const t = [{ topeHoras: 250, minutos: 10 }, { topeHoras: 0, minutos: 99 }, { topeHoras: 250, minutos: -5 }, { topeHoras: 250, minutos: 0 }];
    const r = minutosPautaPM(t, 'PM1');
    expect(r.minutos).toBe(10);
    expect(r.tareas).toBe(2);
  });
});

describe('evaluarTiempoPM: ¿cabe la pauta en la duración anotada?', () => {
  it('15 h-persona en 3 h con 3 técnicos: cobertura 0,60 (parcial) y se necesitan 5 técnicos', () => {
    const r = evaluarTiempoPM(15, 3, 3);
    expect(r.cobertura).toBe(0.6);
    expect(r.tecnicosNecesarios).toBe(5);
    expect(r.clase).toBe('parcial');
  });
  it('menos de la mitad: 15 h-persona en 2 h con 3 técnicos → 0,40 = corto', () => {
    expect(evaluarTiempoPM(15, 2, 3).clase).toBe('corto');
  });
  it('justo la mitad (0,50) ya es parcial, y justo 1,00 ya alcanza', () => {
    expect(evaluarTiempoPM(6, 1, 3).clase).toBe('parcial');
    expect(evaluarTiempoPM(6, 2, 3).clase).toBe('alcanza');
  });
  it('sin cuadrilla informada usa la supuesta (3)', () => {
    expect(PM_CUADRILLA_SUPUESTA).toBe(3);
    expect(evaluarTiempoPM(6, 2).cuadrilla).toBe(3);
  });
  it('sin horas de pauta o sin duración no evalúa', () => {
    expect(evaluarTiempoPM(0, 3, 3)).toBeNull();
    expect(evaluarTiempoPM(6, 0, 3)).toBeNull();
    expect(evaluarTiempoPM(6, null, 3)).toBeNull();
  });
});

describe('pautaTiempoRefSigla: sigla de referencia de la pauta', () => {
  it('usa el grupo de GRUPO_PAUTAS, luego el extra de los modelos que faltan en él, y si no la misma sigla', () => {
    expect(pautaTiempoRefSigla('CN-9500', { 'CN-9500': 'CN-9507' })).toBe('CN-9507');
    expect(pautaTiempoRefSigla('CN-10093', { 'CN-9500': 'CN-9507' })).toBe('CN-9507');
    expect(pautaTiempoRefSigla('CF-10162', {})).toBe('CF-9510');
    expect(pautaTiempoRefSigla('BD-10139', {})).toBe('BD-10139');
  });
});

describe('cumplimientoTiempoPM: el tiempo anotado de los PM frente a la pauta', () => {
  // Pauta de CN-9507 (referencia del grupo HD785-7) con los minutos de arriba ×10, como las reales: PM1 = 350 min = 5,83 h-persona, PM2 = 650 min = 10,83 h-persona.
  const tiempos = tareas.map(t => ({ sigla: 'CN-9507', unidad: 'h', topeHoras: t.topeHoras, minutos: t.minutos * 10 }));
  const eq = [
    { sigla: 'CN-9500', frecPM: 250 },
    { sigla: 'CN-9501', frecPM: 250 },
    { sigla: 'XX-1', frecPM: 250 },
    { sigla: 'CA-1', frecPM: 10000 },
  ];
  const grupo = { 'CN-9500': 'CN-9507', 'CN-9501': 'CN-9507' };
  const r = (equipo, tipoPM, duracionH, fecha) => ({ equipo, tipoPM, duracionH, fechaEntrada: fecha || '2026-05-10' });

  it('cada PM usa la pauta de su grupo (CN-9500 y CN-9501 comparten la de CN-9507): PM1 = 350 min = 5,8 h-persona, cuadrilla 3', () => {
    const out = cumplimientoTiempoPM([r('CN-9500', 'PM1', 1), r('CN-9501', 'PM1', 1)], eq, tiempos, { grupoPautas: grupo });
    expect(out.nPM).toBe(2);
    expect(out.filas[0].horasPersona).toBe(5.8);
    expect(out.cuadrilla).toBe(3);
  });
  it('PM1 de 5,83 h-persona con 3 técnicos: 0,5 h → cobertura 0,26 (corto); 1,5 h → 0,77 (parcial); 3 h → 1,54 (alcanza)', () => {
    const out = cumplimientoTiempoPM([r('CN-9500', 'PM1', 0.5), r('CN-9500', 'PM1', 1.5), r('CN-9501', 'PM1', 3)], eq, tiempos, { grupoPautas: grupo });
    const clases = out.filas.map(f => f.clase).sort();
    expect(clases).toEqual(['alcanza', 'corto', 'parcial']);
    expect(out.total.pctAlcanza).toBe(33);
  });
  it('agrupa por nivel y calcula mediana de técnicos necesarios y % que exige más de 4 técnicos', () => {
    // PM2 = 650 min = 10,83 h-persona. Duraciones 2 h (5,4 técnicos), 3 h (3,6) y 5 h (2,2): mediana 3,6; uno de tres sobre 4.
    const out = cumplimientoTiempoPM([r('CN-9500', 'PM2', 2), r('CN-9500', 'PM2', 3), r('CN-9501', 'PM2', 5)], eq, tiempos, { grupoPautas: grupo });
    expect(out.niveles).toHaveLength(1);
    const n = out.niveles[0];
    expect(n.tipoPM).toBe('PM2');
    expect(n.n).toBe(3);
    expect(n.tecnicosNecesariosMediana).toBe(3.6);
    expect(n.pctMasDe4Tecnicos).toBe(33);
    expect(n.duracionMediana).toBe(3);
  });
  it('cuenta aparte los PM sin pauta de tiempos, sin duración válida y los equipos no medidos en horas', () => {
    const out = cumplimientoTiempoPM([
      r('XX-1', 'PM1', 2),           // sin pauta de tiempos
      r('CN-9500', 'PM1', 0),        // sin duración
      r('CN-9500', 'PM1', 100),      // duración de 72 h o más: dato malo
      r('CA-1', 'PM1', 2),           // camioneta (frecPM ≠ 250)
      r('CN-9500', 'PM1', 2),        // este sí
      r('CN-9500', 'Correctivo', 2), // no es PM1-PM4
    ], eq, tiempos, { grupoPautas: grupo });
    expect(out.nPM).toBe(1);
    expect(out.sinPauta).toBe(1);
    expect(out.sinDuracion).toBe(2);
    expect(out.fueraDeAlcance).toBe(1);
  });
  it('el filtro "desde" deja fuera los PM anteriores', () => {
    const out = cumplimientoTiempoPM([r('CN-9500', 'PM1', 2, '2022-05-01'), r('CN-9500', 'PM1', 2, '2026-05-01')], eq, tiempos, { grupoPautas: grupo, desde: '2023-01-01' });
    expect(out.nPM).toBe(1);
  });
  it('la cuadrilla se puede cambiar: con 6 técnicos el mismo PM de 0,9 h pasa de corto (0,46) a parcial (0,93)', () => {
    const a = cumplimientoTiempoPM([r('CN-9500', 'PM1', 0.9)], eq, tiempos, { grupoPautas: grupo, cuadrilla: 3 });
    const b = cumplimientoTiempoPM([r('CN-9500', 'PM1', 0.9)], eq, tiempos, { grupoPautas: grupo, cuadrilla: 6 });
    expect(a.filas[0].clase).toBe('corto');
    expect(b.filas[0].clase).toBe('parcial');
  });
  it('sin datos devuelve ceros sin romperse', () => {
    const out = cumplimientoTiempoPM([], [], [], {});
    expect(out.nPM).toBe(0);
    expect(out.niveles).toEqual([]);
    expect(out.total.n).toBe(0);
    expect(cumplimientoTiempoPM(null, null, null).nPM).toBe(0);
  });
});

describe('actividadPorPeriodo: PM, correctivas y predictivas por mes, trimestre y año', () => {
  const reg = [
    { equipo: 'A', tipoPM: 'PM1', fechaEntrada: '2026-01-10' }, { equipo: 'A', tipoPM: 'PM2', fechaEntrada: '2026-02-20' },
    { equipo: 'B', tipoPM: 'PM1', fechaEntrada: '2026-04-05' }, { equipo: 'B', tipoPM: 'Correctivo', fechaEntrada: '2026-04-06' },
    { equipo: 'C', tipoPM: 'PM1', fechaEntrada: '2025-12-30' }, { equipo: 'C', tipoPM: 'PM1', fechaEntrada: 'sin fecha' },
  ];
  const fallas = [
    { tipo: 'Correctivo', fecha: '2026-01-15' }, { tipo: 'Correctivo', fecha: '2026-01-20' }, { tipo: 'Falla Operacional', fecha: '2026-03-31' },
    { tipo: 'Fuera de Servicio', criticidad: 'Reparación Inmediata', fecha: '2026-04-01' },
    { tipo: 'Fuera de Servicio', criticidad: 'Baja', fecha: '2026-04-02' },      // no es falla para el sistema
    { tipo: 'Inspección y Diagnóstico', fecha: '2026-04-03' },                    // tampoco
  ];
  const aceite = [{ fecha: '2026-01-05' }, { fecha: '2026-04-09' }, { fecha: '2026-04-30' }];
  const ot = [{ tipo: 'Medición Elemento de Desgaste', fecha: '2026-02-02' }, { tipo: 'Correctivo', fecha: '2026-02-03' }];
  const otHist = [{ tipoInt: 'Predictiva', fecha: '2025-12-15' }, { tipoInt: 'Correctiva', fecha: '2025-12-16' }];
  const d = { reg, fallas, aceite, ot, otHist };

  it('por mes: cuenta cada columna en su mes y ordena del más reciente al más antiguo', () => {
    const r = actividadPorPeriodo(d, 'mes');
    expect(r.filas.map(f => f.periodo)).toEqual(['2026-04', '2026-03', '2026-02', '2026-01', '2025-12']);
    const ene = r.filas.find(f => f.periodo === '2026-01');
    expect(ene).toMatchObject({ pm: 1, correctivas: 2, muestrasAceite: 1, medicionesOT: 0, correctivasPorPM: 2 });
    const abr = r.filas.find(f => f.periodo === '2026-04');
    expect(abr).toMatchObject({ pm: 1, correctivas: 1, muestrasAceite: 2, medicionesOT: 0 });
    expect(r.filas.find(f => f.periodo === '2026-02')).toMatchObject({ pm: 1, correctivas: 0, medicionesOT: 1, correctivasPorPM: 0 });
    expect(r.filas.find(f => f.periodo === '2025-12')).toMatchObject({ pm: 1, correctivas: 0, medicionesOT: 1 });
  });
  it('por trimestre: ene-mar = T1, abr-jun = T2', () => {
    const r = actividadPorPeriodo(d, 'trimestre');
    expect(r.filas.map(f => f.periodo)).toEqual(['2026-T2', '2026-T1', '2025-T4']);
    expect(r.filas.find(f => f.periodo === '2026-T1')).toMatchObject({ pm: 2, correctivas: 3, muestrasAceite: 1, medicionesOT: 1 });
  });
  it('por año: totales por año y total general', () => {
    const r = actividadPorPeriodo(d, 'anio');
    expect(r.filas.map(f => f.periodo)).toEqual(['2026', '2025']);
    expect(r.filas[0]).toMatchObject({ pm: 3, correctivas: 4, muestrasAceite: 3, medicionesOT: 1 });
    expect(r.total).toMatchObject({ pm: 4, correctivas: 4, muestrasAceite: 3, medicionesOT: 2 });
    expect(r.total.correctivasPorPM).toBe(1);
  });
  it('un PM sin tipo PM1-PM9 o sin fecha válida no cuenta; una falla que esFallaMTBF descarta tampoco', () => {
    const r = actividadPorPeriodo(d, 'anio');
    expect(r.total.pm).toBe(4);            // 6 registros: 1 "Correctivo" y 1 sin fecha quedan fuera
    expect(r.total.correctivas).toBe(4);   // 6 filas: la FS de criticidad baja y la inspección quedan fuera
  });
  it('sin datos devuelve listas vacías y nulos sin romperse; un modo desconocido cae en mes', () => {
    const r = actividadPorPeriodo({}, 'xx');
    expect(r.agrupar).toBe('mes');
    expect(r.filas).toEqual([]);
    expect(r.total.correctivasPorPM).toBeNull();
    expect(actividadPorPeriodo(null).filas).toEqual([]);
  });
  it('esOTPredictiva: «Predictiva» del histórico y las mediciones o inspecciones y diagnóstico de las OT vigentes', () => {
    expect(esOTPredictiva({ tipoInt: 'Predictiva' })).toBe(true);
    expect(esOTPredictiva({ tipo: 'Medición Elemento de Desgaste' })).toBe(true);
    expect(esOTPredictiva({ tipo: 'Medicion de Desgaste Neumaticos' })).toBe(true);
    expect(esOTPredictiva({ tipo: 'Inspección y Diagnóstico' })).toBe(true);
    expect(esOTPredictiva({ tipo: 'Correctivo' })).toBe(false);
    expect(esOTPredictiva({ tipoInt: 'Programada' })).toBe(false);
    expect(esOTPredictiva(null)).toBe(false);
  });
});
