import { describe, it, expect } from 'vitest';
const { indiceEfectividadMantenimiento, interpretacionEfectividadMantenimiento } = require('../logic.js');

describe('indiceEfectividadMantenimiento', () => {
  it('con menos de 5 intervalos de algún lado, devuelve null', () => {
    expect(indiceEfectividadMantenimiento([], [])).toBeNull();
    expect(indiceEfectividadMantenimiento(undefined, undefined)).toBeNull();
    const pocasFallas = [{ sigla: 'CN-1', fecha: '2025-01-01' }, { sigla: 'CN-1', fecha: '2025-06-01' }];
    const pocosPM = [{ sigla: 'CN-1', fecha: '2025-02-01' }];
    expect(indiceEfectividadMantenimiento(pocasFallas, pocosPM)).toBeNull();
  });

  it('caso "PM efectivo" calculado a mano y verificado con script Python — el intervalo se alarga después del PM', () => {
    // CN-1: fallas en 10-ene, 01-feb, 25-feb, 01-jun, 15-sep; PM en 10-feb, 05-mar, 01-jul.
    // Necesita ≥5 equipos/PM para superar el mínimo de 5 intervalos de cada lado —
    // se repite el mismo patrón real en 2 equipos más para tener muestra suficiente.
    function fallasEq(sigla) {
      return [
        { sigla, fecha: '2025-01-10' }, { sigla, fecha: '2025-02-01' }, { sigla, fecha: '2025-02-25' },
        { sigla, fecha: '2025-06-01' }, { sigla, fecha: '2025-09-15' },
      ];
    }
    function pmEq(sigla) {
      return [{ sigla, fecha: '2025-02-10' }, { sigla, fecha: '2025-03-05' }, { sigla, fecha: '2025-07-01' }];
    }
    const fallas = [...fallasEq('CN-1'), ...fallasEq('CN-2')];
    const pm = [...pmEq('CN-1'), ...pmEq('CN-2')];
    const r = indiceEfectividadMantenimiento(fallas, pm);
    expect(r).not.toBeNull();
    expect(r.nAntes).toBe(6); // 3 intervalos "antes" x 2 equipos
    expect(r.nDespues).toBe(6);
    expect(r.medianaAntesDias).toBe(9);
    expect(r.medianaDespuesDias).toBe(76);
    expect(r.ratio).toBeCloseTo(76 / 9, 1);
    expect(r.veredicto).toBe('efectivo');
  });

  it('caso "PM no efectivo" calculado a mano y verificado con script Python — el intervalo se acorta después del PM', () => {
    // Intervalos "antes" largos (19,11,19 días), "después" cortos (5,5,4 días) —
    // repetido en 2 equipos para tener muestra suficiente (≥5 de cada lado).
    function fallasEq(sigla) {
      return [
        { sigla, fecha: '2025-01-01' }, { sigla, fecha: '2025-01-25' }, { sigla, fecha: '2025-02-10' },
        { sigla, fecha: '2025-03-05' }, { sigla, fecha: '2025-03-20' },
      ];
    }
    function pmEq(sigla) {
      return [{ sigla, fecha: '2025-01-20' }, { sigla, fecha: '2025-02-05' }, { sigla, fecha: '2025-03-01' }];
    }
    const fallas = [...fallasEq('CN-1'), ...fallasEq('CN-2')];
    const pm = [...pmEq('CN-1'), ...pmEq('CN-2')];
    const r = indiceEfectividadMantenimiento(fallas, pm);
    expect(r).not.toBeNull();
    expect(r.medianaAntesDias).toBe(19);
    expect(r.medianaDespuesDias).toBe(5);
    expect(r.ratio).toBeCloseTo(0.263, 2);
    expect(r.veredicto).toBe('no_efectivo');
  });

  it('sin ningún PM ejecutado, o sin ninguna falla registrada, devuelve null', () => {
    const fallas = [{ sigla: 'CN-1', fecha: '2025-01-01' }];
    expect(indiceEfectividadMantenimiento(fallas, [])).toBeNull();
    const pm = [{ sigla: 'CN-1', fecha: '2025-01-01' }];
    expect(indiceEfectividadMantenimiento([], pm)).toBeNull();
  });

  it('ignora fallas/PM sin sigla o fecha válida', () => {
    const fallas = [{ sigla: '', fecha: '2025-01-01' }, { sigla: 'CN-1', fecha: '' }];
    const pm = [{ sigla: 'CN-1', fecha: '2025-01-01' }];
    expect(indiceEfectividadMantenimiento(fallas, pm)).toBeNull();
  });
});

describe('interpretacionEfectividadMantenimiento', () => {
  it('devuelve un texto distinto para cada uno de los 3 veredictos', () => {
    const textos = new Set([
      interpretacionEfectividadMantenimiento('efectivo'),
      interpretacionEfectividadMantenimiento('no_efectivo'),
      interpretacionEfectividadMantenimiento('sin_diferencia_clara'),
    ]);
    expect(textos.size).toBe(3);
  });
});
