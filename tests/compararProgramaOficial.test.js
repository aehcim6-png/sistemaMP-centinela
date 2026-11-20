import { describe, it, expect } from 'vitest';
import { compararProgramaOficial } from '../logic.js';

// Programa oficial del taller de una semana (jueves 12-nov a miércoles 18-nov) contra los PM registrados.
const semana = '2026-11-12';
const fila = (sigla, tipoPM, fechaProgramada, extra) => Object.assign({ sigla, tipoPM, fechaSemana: semana, fechaProgramada }, extra || {});
const filas = [
  fila('A', 'PM2', '2026-11-12'),       // se hizo el mismo día
  fila('B', 'PM1', '2026-11-13'),       // se hizo otro día de la semana, con un PM de nivel mayor
  fila('C', 'PM1', '2026-11-14'),       // se hizo antes
  fila('D', 'PM1', '2026-11-14'),       // se hizo después
  fila('E', 'PM1', '2026-11-15'),       // no hay nada
  fila('F', 'PM3', '2026-11-16'),       // hay un PM de menor nivel: no cubre
  fila('G', 'PM1', '2026-11-12', { nota: 'Condicionada: Programar mantencion pm1 cuando quede operativo' }),
];
const reg = [
  { equipo: 'A', tipoPM: 'PM2', fechaEntrada: '2026-11-12' },
  { equipo: 'B', tipoPM: 'PM2', fechaEntrada: '2026-11-17' },
  { equipo: 'C', tipoPM: 'PM1', fechaEntrada: '2026-11-09' },
  { equipo: 'D', tipoPM: 'PM1', fechaEntrada: '2026-11-22' },
  { equipo: 'F', tipoPM: 'PM1', fechaEntrada: '2026-11-16' },
];
describe('compararProgramaOficial', () => {
  const r = compararProgramaOficial(filas, reg, [], '2026-11-30');
  const e = (s) => r.filas.find((x) => x.sigla === s);
  it('ejecutado en la semana, con el día programado o con otro', () => {
    expect(e('A')).toMatchObject({ estado: 'ejecutado', fechaEjecucion: '2026-11-12', mismoDia: true });
    expect(e('B')).toMatchObject({ estado: 'ejecutado', fechaEjecucion: '2026-11-17', mismoDia: false });
  });
  it('anticipado (en los 7 días antes), ejecutado después (hasta 28 días) y sin registro', () => {
    expect(e('C').estado).toBe('anticipado');
    expect(e('D')).toMatchObject({ estado: 'ejecutado_despues', fechaEjecucion: '2026-11-22' });
    expect(e('E').estado).toBe('sin_registro');
  });
  it('un PM de nivel menor no cubre al programado', () => {
    expect(e('F').estado).toBe('sin_registro');
  });
  it('las filas condicionadas van aparte: no cuentan como programadas', () => {
    expect(e('G').condicionada).toBe(true);
    expect(r.resumen).toMatchObject({ programadas: 6, ejecutadas: 2, anticipadas: 1, ejecutadasDespues: 1, sinRegistro: 2, pendientes: 0, condicionadas: 1 });
  });
  it('mientras la semana no termina, lo que falta está pendiente y no «sin registro»', () => {
    const v = compararProgramaOficial([fila('E', 'PM1', '2026-11-15')], [], [], '2026-11-16');
    expect(v.filas[0].estado).toBe('pendiente');
  });
  it('adjunta la reprogramación guardada del mismo equipo y PM desde esa semana', () => {
    const rp = { sigla: 'E', tipoPM: 'PM1', fechaOrigen: '2026-11-12', semanaDestino: 47, motivo: 'Falta de personal', estado: 'Pendiente' };
    const v = compararProgramaOficial([fila('E', 'PM1', '2026-11-15')], [], [rp], '2026-11-30');
    expect(v.filas[0].reprogramacion).toBe(rp);
    expect(v.resumen.reprogramadas).toBe(1);
    const cancelada = Object.assign({}, rp, { estado: 'Cancelada' });
    expect(compararProgramaOficial([fila('E', 'PM1', '2026-11-15')], [], [cancelada], '2026-11-30').filas[0].reprogramacion).toBeNull();
  });
  it('sin filas devuelve ceros', () => {
    expect(compararProgramaOficial([], [], [], '2026-11-30').resumen.programadas).toBe(0);
  });
});
