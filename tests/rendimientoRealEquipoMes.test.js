import { describe, it, expect } from 'vitest';
import { rendimientoRealEquipoMes } from '../logic.js';

function turno(id, fecha) {
  return { id, fecha };
}
function fila(turnoId, sigla, vueltas, totalHoras, extra) {
  return Object.assign({ turnoId, sigla, categoria: 'CAEX', vueltas, totalHoras }, extra || {});
}

describe('rendimientoRealEquipoMes', () => {
  it('con menos de 3 turnos válidos en el mes, devuelve null (nunca inventa con poca muestra)', () => {
    const prodTurno = [turno('t1', '2026-08-29'), turno('t2', '2026-08-30')];
    const prodTurnoEq = [fila('t1', 'CN-9503', 20, 10), fila('t2', 'CN-9503', 18, 9)];
    expect(rendimientoRealEquipoMes('CN-9503', '2026-08', prodTurnoEq, prodTurno)).toBeNull();
  });

  it('con 3+ turnos válidos, calcula el promedio PONDERADO por horas (vueltas totales / horas totales) — verificado a mano', () => {
    const prodTurno = [turno('t1', '2026-08-28'), turno('t2', '2026-08-29'), turno('t3', '2026-08-30')];
    const prodTurnoEq = [
      fila('t1', 'CN-9503', 20, 10),
      fila('t2', 'CN-9503', 15, 8),
      fila('t3', 'CN-9503', 18, 9),
    ];
    // (20+15+18)/(10+8+9) = 53/27 = 1.9629... -> 1.96
    const r = rendimientoRealEquipoMes('CN-9503', '2026-08', prodTurnoEq, prodTurno);
    expect(r).not.toBeNull();
    expect(r.valor).toBeCloseTo(1.96, 2);
    expect(r.n).toBe(3);
    expect(r.unidad).toBe('vueltas/hr');
  });

  it('un turno "fuera de servicio" (totalHoras null, el equipo no produjo) se EXCLUYE del promedio — nunca se trata como 0', () => {
    const prodTurno = [turno('t1', '2026-08-28'), turno('t2', '2026-08-29'), turno('t3', '2026-08-30'), turno('t4', '2026-08-31')];
    const prodTurnoEq = [
      fila('t1', 'CN-9503', 20, 10),
      fila('t2', 'CN-9503', 15, 8),
      fila('t3', 'CN-9503', null, null, { estadoTexto: 'fuera de servicio' }),
      fila('t4', 'CN-9503', 18, 9),
    ];
    const r = rendimientoRealEquipoMes('CN-9503', '2026-08', prodTurnoEq, prodTurno);
    expect(r.n).toBe(3); // la fila fuera de servicio no cuenta como turno válido
    expect(r.valor).toBeCloseTo(1.96, 2); // mismo resultado que el caso anterior, no se diluye con un 0
  });

  it('no mezcla filas de otro mes ni de otra sigla', () => {
    const prodTurno = [turno('t1', '2026-08-28'), turno('t2', '2026-08-29'), turno('t3', '2026-08-30'), turno('t4', '2026-09-01')];
    const prodTurnoEq = [
      fila('t1', 'CN-9503', 20, 10),
      fila('t2', 'CN-9503', 15, 8),
      fila('t3', 'CN-9503', 18, 9),
      fila('t4', 'CN-9503', 999, 1), // otro mes, no debe contarse
      fila('t1', 'CN-9504', 999, 1), // otra sigla, no debe contarse
    ];
    const r = rendimientoRealEquipoMes('CN-9503', '2026-08', prodTurnoEq, prodTurno);
    expect(r.n).toBe(3);
    expect(r.valor).toBeCloseTo(1.96, 2);
  });

  it('no mezcla filas que no sean categoria CAEX (ej. PerdidaIndisponibilidad)', () => {
    const prodTurno = [turno('t1', '2026-08-28'), turno('t2', '2026-08-29'), turno('t3', '2026-08-30')];
    const prodTurnoEq = [
      fila('t1', 'CN-9503', 20, 10),
      fila('t2', 'CN-9503', 15, 8),
      fila('t3', 'CN-9503', 18, 9),
      { turnoId: 't1', sigla: 'CN-9503', categoria: 'PerdidaIndisponibilidad', totalHoras: 5, tonAsociadoPerdida: 300 },
    ];
    const r = rendimientoRealEquipoMes('CN-9503', '2026-08', prodTurnoEq, prodTurno);
    expect(r.n).toBe(3);
  });

  it('nunca lanza con arreglos vacíos o undefined', () => {
    expect(rendimientoRealEquipoMes('CN-9503', '2026-08', [], [])).toBeNull();
    expect(rendimientoRealEquipoMes('CN-9503', '2026-08', undefined, undefined)).toBeNull();
  });
});
