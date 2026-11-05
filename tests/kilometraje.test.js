import { describe, it, expect } from 'vitest';
import { kilometrajeAnalizar } from '../logic.js';

// Planilla «Control Kilometraje» del 02-11-2026 (valores reales), como la entrega XLSX.utils.sheet_to_json({header:1}): la fecha de actualización viene como número de serie.
const F = 46327; // 01-11-2026
const PLANILLA = [
  ['CONTROL EQUIPOS LIVIANOS'],
  ['Sigla ', 'Tipo Equipo ', 'Equipo', 'Patente', 'Km Actual', 'KM Ultima Mantencion', 'Km Próxima Mantención', 'Km Faltantes', 'Última Actualización', 'Días Sin Informar', 'Rev. Técnica ', 'Días Rev. Técnica ', 'Estado', 'Comentarios', F],
  ['BS-5752', 'Bus', 'King long', 'RTGK.77-2', 436018, 430000, 440000, 3982, F, 0, 0, 89, 'OPERATIVA'],
  ['CA-5135', 'Camioneta', 'Amarok', 'PSRG.90-2', null, 284789, 294789, 294789, null, 46327, 0, 150, 'OPERATIVA', 'Camioneta fuera de faena', 'Pendiente la informacion de km'],
  ['CA-5979', 'Camioneta', 'Hilux', 'SKKW.28-K', 124127, 114681, 124681, 554, F, 0, 0, 394, 'OPERATIVA', null, 'Pendiente firmas OC 791917'],
  ['CA-6146', 'Camioneta', 'Poer', 'TJJF.80-9', 84281, 80856, 90856, 6575, F, 0, 0, 119, 'OPERATIVA', 'Reparación de transmisión'],
  ['CA-9927', 'Camioneta', 'Poer', 'TRDD.27', 101360, 101000, 111000, 9640, F, 0, 0, -2, 'OPERATIVA'],
  ['CA-10505', 'Camioneta', 'Ranger', 'VXBK.91-0', 23667, 16000, 26000, 2333, F, 0, 0, 850, 'OPERATIVA'],
  ['CA-10506', 'Camioneta', 'Ranger', 'VXBK.90-2', 19190, 16000, 32000, 12810, F, 0, 0, 911, 'OPERATIVA'],
  ['CA-10712', 'Camioneta', 'Ranger XLS', 'VXSL.97-7', 4854, 0, 16000, 11146, F, 0, 0, 1094, 'OPERATIVA'],
];
const EQ = [
  { sigla: 'BS-5752', frecPM: 10000, horomProxPM: 440000, horomActual: 421499 },
  { sigla: 'CA-5979', frecPM: 10000, horomProxPM: 130000, horomActual: 118900 },
  { sigla: 'CA-6146', frecPM: 10000, horomProxPM: 90000, horomActual: 80133 },
  { sigla: 'CA-9927', frecPM: 10000, horomProxPM: 110000, horomActual: 93599 },
  { sigla: 'CA-10505', frecPM: 16000, horomProxPM: 32000, horomActual: 7032 },
  { sigla: 'CA-10506', frecPM: 16000, horomProxPM: 32000, horomActual: 9064 },
];
const HIST = [
  { sigla: 'BS-5752', fecha: '2026-08-24', horomFin: 421499 },
  { sigla: 'CA-5979', fecha: '2026-08-24', horomFin: 118900 },
  { sigla: 'CA-6146', fecha: '2026-08-24', horomFin: 80133 },
  { sigla: 'CA-9927', fecha: '2026-08-24', horomFin: 93599 },
  { sigla: 'CA-10505', fecha: '2026-08-24', horomFin: 7032 },
  { sigla: 'CA-10506', fecha: '2026-08-24', horomFin: 9064 },
];
const an = (over) => kilometrajeAnalizar(over && over.filas || PLANILLA, { equipos: EQ, hist: HIST, ...(over || {}) });
const lect = (r, s) => r.lecturas.find((x) => x.sigla === s);
const mant = (r, s) => r.mantenciones.find((x) => x.sigla === s);

describe('kilometrajeAnalizar: lecturas de km', () => {
  const r = an();
  it('lee la fecha de la planilla y la planilla completa', () => {
    expect(r.fecha).toBe('2026-11-01');
    expect(r.fechaOrigen).toBe('planilla');
    expect(r.resumen.filas).toBe(8);
  });
  it('las lecturas que cuadran vienen marcadas, con la anterior a la vista', () => {
    expect(r.lecturas).toHaveLength(6);
    const l = lect(r, 'BS-5752');
    expect(l).toMatchObject({ valor: 436018, fecha: '2026-11-01', estado: 'ok', marcado: true, prev: { fecha: '2026-08-24', valor: 421499 } });
    expect(r.resumen.lecturasOk).toBe(6);
  });
  it('un km menor que la lectura anterior se propone sin marcar', () => {
    const f = PLANILLA.map((x) => (x[0] === 'CA-5979' ? [...x.slice(0, 4), 100000, ...x.slice(5)] : x));
    const l = lect(kilometrajeAnalizar(f, { equipos: EQ, hist: HIST }), 'CA-5979');
    expect(l).toMatchObject({ estado: 'menor', marcado: false });
  });
  it('un salto de más de 1.000 km por día se propone sin marcar', () => {
    const f = PLANILLA.map((x) => (x[0] === 'CA-5979' ? [...x.slice(0, 4), 218900, ...x.slice(5)] : x));
    const l = lect(kilometrajeAnalizar(f, { equipos: EQ, hist: HIST }), 'CA-5979');
    expect(l).toMatchObject({ estado: 'rapido', marcado: false });
  });
  it('si ya hay una lectura ese día no se duplica', () => {
    const h = [...HIST, { sigla: 'BS-5752', fecha: '2026-11-01', horomFin: 436018 }];
    const l = lect(kilometrajeAnalizar(PLANILLA, { equipos: EQ, hist: h }), 'BS-5752');
    expect(l).toMatchObject({ estado: 'ya', marcado: false });
  });
  it('sin km (equipo fuera de faena) no se propone lectura', () => {
    const r2 = kilometrajeAnalizar(PLANILLA, { equipos: [...EQ, { sigla: 'CA-5135', frecPM: 10000, horomProxPM: 290000 }], hist: HIST });
    expect(r2.sinKm.map((x) => x.sigla)).toEqual(['CA-5135']);
    expect(lect(r2, 'CA-5135')).toBeUndefined();
  });
  it('los equipos que no están en el sistema se informan con sus datos, sin cargarse', () => {
    expect(r.sinEquipo.map((x) => x.sigla)).toEqual(['CA-5135', 'CA-10712']);
    expect(r.sinEquipo[1]).toMatchObject({ patente: 'VXSL.97-7', km: 4854, ultima: 0, prox: 16000 });
  });
  it('sin fecha en la planilla pide elegirla; con fecha elegida la usa', () => {
    const sinF = PLANILLA.map((x, i) => (i === 1 ? x.slice(0, 14) : i > 1 ? [...x.slice(0, 8), null, ...x.slice(9)] : x));
    const r1 = kilometrajeAnalizar(sinF, { equipos: EQ, hist: HIST });
    expect(lect(r1, 'BS-5752')).toMatchObject({ estado: 'sinfecha', marcado: false });
    const r2 = kilometrajeAnalizar(sinF, { equipos: EQ, hist: HIST, fecha: '2026-11-02' });
    expect(r2.fechaOrigen).toBe('manual');
    expect(lect(r2, 'BS-5752')).toMatchObject({ estado: 'ok', fecha: '2026-11-02' });
  });
  it('un archivo que no es la planilla da un error claro', () => {
    expect(kilometrajeAnalizar([['a', 'b'], [1, 2]], { equipos: EQ, hist: HIST }).error).toMatch(/Sigla/);
  });
});

describe('kilometrajeAnalizar: próxima mantención (el sistema recalcula desde su grilla; solo manda pmPendienteManual si es menor)', () => {
  const r = an();
  it('igual al sistema: nada que hacer', () => {
    expect(mant(r, 'BS-5752')).toMatchObject({ estado: 'igual', marcado: false });
    expect(mant(r, 'CA-10506')).toMatchObject({ estado: 'igual', marcado: false });
  });
  it('planilla más cercana que el sistema y coherente con último + frecuencia: se propone fijarla a mano', () => {
    expect(mant(r, 'CA-5979')).toMatchObject({ estado: 'manual', marcado: true, proxPlanilla: 124681, proxSistema: 130000 });
    expect(r.resumen.mantOk).toBe(1);
  });
  it('planilla más lejana que el sistema: manda el sistema y solo se informa', () => {
    expect(mant(r, 'CA-6146')).toMatchObject({ estado: 'sistema', marcado: false });
    expect(mant(r, 'CA-9927')).toMatchObject({ estado: 'sistema', marcado: false });
  });
  it('la planilla suma 10.000 a una camioneta de 16.000: se avisa y no se propone', () => {
    const m = mant(r, 'CA-10505');
    expect(m).toMatchObject({ estado: 'frecuencia', marcado: false, esperado: 32000, proxPlanilla: 26000 });
    expect(m.nota).toContain('32000');
  });
});

describe('kilometrajeAnalizar: notas', () => {
  it('trae los comentarios y pendientes de la derecha de «Estado»', () => {
    const r = an();
    const t = r.notas.map((n) => n.sigla + ': ' + n.texto);
    expect(t).toContain('CA-5979: Pendiente firmas OC 791917');
    expect(t).toContain('CA-6146: Reparación de transmisión');
  });
});
