import { describe, it, expect } from 'vitest';
import { tonPerdidaIndisponibilidadMes } from '../logic.js';

function turno(id, fecha) {
  return { id, fecha };
}
function filaPerdida(turnoId, sigla, totalHoras, tonAsociado) {
  return { turnoId, sigla, categoria: 'PerdidaIndisponibilidad', totalHoras, tonAsociadoPerdida: tonAsociado };
}

describe('tonPerdidaIndisponibilidadMes', () => {
  it('sin filas de ese equipo/mes, devuelve null (no hay nada que reportar)', () => {
    expect(tonPerdidaIndisponibilidadMes('CN-9503', '2026-08', [], [])).toBeNull();
  });

  it('un solo turno real ya es un dato válido — no exige mínimo de muestra (es una suma, no una tasa)', () => {
    const prodTurno = [turno('t1', '2026-08-29')];
    const prodTurnoEq = [filaPerdida('t1', 'CN-9503', 5, 300)];
    const r = tonPerdidaIndisponibilidadMes('CN-9503', '2026-08', prodTurnoEq, prodTurno);
    expect(r).toEqual({ totalTon: 300, totalHoras: 5 });
  });

  it('suma correctamente varias filas del mismo equipo/mes — verificado a mano', () => {
    const prodTurno = [turno('t1', '2026-08-28'), turno('t2', '2026-08-29'), turno('t3', '2026-08-30')];
    const prodTurnoEq = [
      filaPerdida('t1', 'CN-9503', 5, 300),
      filaPerdida('t2', 'CN-9503', 3, 180),
      filaPerdida('t3', 'CN-9503', 2.5, 150),
    ];
    // horas: 5+3+2.5=10.5 ton: 300+180+150=630
    const r = tonPerdidaIndisponibilidadMes('CN-9503', '2026-08', prodTurnoEq, prodTurno);
    expect(r.totalTon).toBeCloseTo(630, 1);
    expect(r.totalHoras).toBeCloseTo(10.5, 1);
  });

  it('no mezcla filas de otro mes, otra sigla, ni otra categoría', () => {
    const prodTurno = [turno('t1', '2026-08-28'), turno('t2', '2026-09-01')];
    const prodTurnoEq = [
      filaPerdida('t1', 'CN-9503', 5, 300),
      filaPerdida('t2', 'CN-9503', 999, 99999), // otro mes
      filaPerdida('t1', 'CN-9504', 999, 99999), // otra sigla
      { turnoId: 't1', sigla: 'CN-9503', categoria: 'CAEX', totalHoras: 10, vueltas: 20 }, // otra categoría
    ];
    const r = tonPerdidaIndisponibilidadMes('CN-9503', '2026-08', prodTurnoEq, prodTurno);
    expect(r).toEqual({ totalTon: 300, totalHoras: 5 });
  });

  it('nunca lanza con arreglos vacíos o undefined', () => {
    expect(tonPerdidaIndisponibilidadMes('CN-9503', '2026-08', undefined, undefined)).toBeNull();
  });
});
