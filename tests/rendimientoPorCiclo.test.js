import { describe, it, expect } from 'vitest';
import { rendimientoPorCicloEquipoMes, brechaRendimientoCiclo } from '../logic.js';

function turno(id, fecha) {
  return { id, fecha };
}
function filaCiclo(turnoId, sigla, tiempoCicloMin, tonVuelta) {
  return { turnoId, sigla, tiempoCicloMin, tonVuelta };
}

describe('rendimientoPorCicloEquipoMes — rendimiento teórico a partir del tiempo de ciclo REAL medido (no parámetros fijos de catálogo)', () => {
  it('con menos de 3 turnos con tiempoCicloMin ese mes, devuelve null — no se inventa con muestra chica', () => {
    const prodTurno = [turno('t1', '2026-10-01'), turno('t2', '2026-10-02')];
    const prodTurnoEq = [filaCiclo('t1', 'CN-9500', 18, 30), filaCiclo('t2', 'CN-9500', 20, 30)];
    expect(rendimientoPorCicloEquipoMes('CN-9500', '2026-10', prodTurnoEq, prodTurno)).toBeNull();
  });

  it('calcula la mediana del ciclo real y las vueltas/hr teóricas (60/ciclo)', () => {
    const prodTurno = [turno('t1', '2026-10-01'), turno('t2', '2026-10-02'), turno('t3', '2026-10-03')];
    // ciclos 15,20,25 -> mediana 20min -> 60/20 = 3 vueltas/hr teóricas
    const prodTurnoEq = [
      filaCiclo('t1', 'CN-9500', 15, null),
      filaCiclo('t2', 'CN-9500', 20, null),
      filaCiclo('t3', 'CN-9500', 25, null),
    ];
    const r = rendimientoPorCicloEquipoMes('CN-9500', '2026-10', prodTurnoEq, prodTurno);
    expect(r.cicloMedianoMin).toBe(20);
    expect(r.vueltasHrTeorico).toBe(3);
    expect(r.n).toBe(3);
    expect(r.tonHrTeorico).toBeNull(); // sin tonVuelta cargado
  });

  it('calcula tonHrTeorico cuando hay tonVuelta cargado (mediana también)', () => {
    const prodTurno = [turno('t1', '2026-10-01'), turno('t2', '2026-10-02'), turno('t3', '2026-10-03')];
    // ciclo mediana 20min -> 3 vueltas/hr; tonVuelta mediana 30 -> 90 ton/hr teórico
    const prodTurnoEq = [
      filaCiclo('t1', 'CN-9500', 20, 28),
      filaCiclo('t2', 'CN-9500', 20, 30),
      filaCiclo('t3', 'CN-9500', 20, 35),
    ];
    const r = rendimientoPorCicloEquipoMes('CN-9500', '2026-10', prodTurnoEq, prodTurno);
    expect(r.vueltasHrTeorico).toBe(3);
    expect(r.tonHrTeorico).toBe(90);
  });

  it('no mezcla equipos ni meses distintos, y descarta ciclos <= 0', () => {
    const prodTurno = [
      turno('t1', '2026-10-01'), turno('t2', '2026-10-02'), turno('t3', '2026-10-03'),
      turno('t4', '2026-11-01'),
    ];
    const prodTurnoEq = [
      filaCiclo('t1', 'CN-9500', 20, null),
      filaCiclo('t2', 'CN-9500', 20, null),
      filaCiclo('t3', 'CN-9500', 20, null),
      filaCiclo('t4', 'CN-9500', 20, null), // otro mes
      filaCiclo('t1', 'CN-9501', 999, null), // otra sigla
      filaCiclo('t1', 'CN-9500', 0, null), // ciclo inválido, mismo turno/sigla/mes pero no cuenta (no debería duplicar id de todas formas)
    ];
    const r = rendimientoPorCicloEquipoMes('CN-9500', '2026-10', prodTurnoEq, prodTurno);
    expect(r.n).toBe(3);
    expect(r.cicloMedianoMin).toBe(20);
  });

  it('nunca lanza con arreglos vacíos o undefined', () => {
    expect(rendimientoPorCicloEquipoMes('CN-9500', '2026-10', undefined, undefined)).toBeNull();
    expect(rendimientoPorCicloEquipoMes('CN-9500', '2026-10', [], [])).toBeNull();
  });
});

describe('brechaRendimientoCiclo — gap entre lo que el ciclo real permitiría y lo que de verdad se logró', () => {
  it('positiva cuando el real queda por debajo del teórico (producción perdida en esperas no registradas)', () => {
    const real = { valor: 2.4, n: 10, unidad: 'vueltas/hr' };
    const teorico = { cicloMedianoMin: 20, vueltasHrTeorico: 3, tonHrTeorico: null, n: 5 };
    expect(brechaRendimientoCiclo(real, teorico)).toBe(20); // 1 - 2.4/3 = 0.2 -> 20%
  });

  it('negativa cuando el real superó la mediana teórica (dato real válido, no un error)', () => {
    const real = { valor: 3.3, n: 10, unidad: 'vueltas/hr' };
    const teorico = { cicloMedianoMin: 20, vueltasHrTeorico: 3, tonHrTeorico: null, n: 5 };
    expect(brechaRendimientoCiclo(real, teorico)).toBe(-10); // 1 - 3.3/3 = -0.1 -> -10%
  });

  it('null si falta el real, el teórico, o el teórico no tiene vueltasHrTeorico válido', () => {
    const real = { valor: 2.4, n: 10, unidad: 'vueltas/hr' };
    const teorico = { cicloMedianoMin: 20, vueltasHrTeorico: 3, tonHrTeorico: null, n: 5 };
    expect(brechaRendimientoCiclo(null, teorico)).toBeNull();
    expect(brechaRendimientoCiclo(real, null)).toBeNull();
    expect(brechaRendimientoCiclo(real, { cicloMedianoMin: 20, vueltasHrTeorico: 0, n: 5 })).toBeNull();
  });
});
