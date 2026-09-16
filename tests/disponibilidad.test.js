import { describe, it, expect } from 'vitest';
import { dispDownMap, dispEquipoMes, dispIntrinsecaEquipoMes } from '../logic.js';

describe('dispDownMap — mapa de horas de detención (fuente única)', () => {
  it('salida de servicio por período marca cada día del rango con día completo', () => {
    const ot = [{ sigla: 'CN-1', estatusEq: 'Fuera de Servicio', fechaEntrada: '2026-07-10', fechaSalida: '2026-07-12' }];
    const dm = dispDownMap([], ot);
    expect(dm['CN-1']['2026-07-10']).toBe(24);
    expect(dm['CN-1']['2026-07-11']).toBe(24);
    expect(dm['CN-1']['2026-07-12']).toBe(24);
    expect(dm['CN-1']['2026-07-13']).toBeUndefined();
  });

  it('correctivo fuera de servicio de un solo día = 24h', () => {
    const dm = dispDownMap([], [{ sigla: 'CN-2', fecha: '2026-07-05', estatusEq: 'Fuera de Servicio' }]);
    expect(dm['CN-2']['2026-07-05']).toBe(24);
  });

  it('registro PM usa su duración; supuesto 4h si falta', () => {
    const dm = dispDownMap([{ equipo: 'CN-3', fechaEntrada: '2026-07-01', duracionH: 6 }, { equipo: 'CN-3', fechaEntrada: '2026-07-02' }], []);
    expect(dm['CN-3']['2026-07-01']).toBe(6);
    expect(dm['CN-3']['2026-07-02']).toBe(4);
  });

  it('correctivo con duración real <1h ("0h 32min") NO se sobreescribe con el supuesto de 8h', () => {
    // Bug real (auditoría 2026-09-14): el regex /(\d+)h/ sobre "0h 32min" da
    // durH=0, un dato REAL medido — pero '0' es falsy en JS y el código viejo
    // lo trataba igual que "sin duración registrada", reemplazándolo por 8h.
    const dm = dispDownMap([], [{ sigla: 'CN-5', fecha: '2026-07-06', duracion: '0h 32min' }]);
    expect(dm['CN-5']['2026-07-06']).toBe(0);
  });

  it('correctivo SIN ningún dato de duración sí usa el supuesto de 8h', () => {
    const dm = dispDownMap([], [{ sigla: 'CN-6', fecha: '2026-07-07' }]);
    expect(dm['CN-6']['2026-07-07']).toBe(8);
  });

  it('salida de servicio SIN fecha de término (aún en curso) marca cada día hasta hoy', () => {
    // El equipo sigue fuera de servicio — no hay fechaSalida todavía.
    const ot = [{ sigla: 'CN-4', estatusEq: 'Fuera de Servicio', fechaEntrada: '2026-07-20', fechaSalida: null }];
    const dm = dispDownMap([], ot, '2026-07-24');
    expect(dm['CN-4']['2026-07-20']).toBe(24);
    expect(dm['CN-4']['2026-07-21']).toBe(24);
    expect(dm['CN-4']['2026-07-22']).toBe(24);
    expect(dm['CN-4']['2026-07-23']).toBe(24);
    expect(dm['CN-4']['2026-07-24']).toBe(24); // incluye hoy
    expect(dm['CN-4']['2026-07-25']).toBeUndefined(); // aún no llega ahí
  });
});

describe('dispEquipoMes — disponibilidad mensual (%)', () => {
  const hoy = '2026-07-31';
  it('sin detenciones = 100%', () => {
    expect(dispEquipoMes('CN-1', '2026-07', { downMap: {}, hrsDia: 12, hoy })).toBe(100);
  });

  it('un día completo caído baja el promedio del mes', () => {
    // julio: 31 días hasta hoy; 1 día a 0% -> (30*100 + 0)/31 ≈ 96.8
    const downMap = { 'CN-1': { '2026-07-10': 24 } };
    const v = dispEquipoMes('CN-1', '2026-07', { downMap, hrsDia: 12, hoy });
    expect(v).toBeGreaterThan(96);
    expect(v).toBeLessThan(97);
  });

  it('override manual tiene prioridad sobre el cálculo', () => {
    const downMap = { 'CN-1': { '2026-07-10': 24 } };
    expect(dispEquipoMes('CN-1', '2026-07', { downMap, dispCalc: { 'CN-1': { '2026-07': 88 } }, hoy })).toBe(88);
  });

  it('mes sin ningún día con dato -> null', () => {
    expect(dispEquipoMes('CN-1', '2027-01', { downMap: {}, hoy: '2026-07-31' })).toBeNull();
  });
});

describe('dispDownMap con opts.incluirPM:false — mapa solo de correctivos (para Ai)', () => {
  it('excluye el downtime de PM (reg), conserva el de correctivos (ot)', () => {
    const reg = [{ equipo: 'CN-1', fechaEntrada: '2026-07-01', duracionH: 6 }];
    const ot = [{ sigla: 'CN-1', fecha: '2026-07-15', estatusEq: 'Fuera de Servicio' }];
    const dmAo = dispDownMap(reg, ot);
    const dmAi = dispDownMap(reg, ot, undefined, { incluirPM: false });
    expect(dmAo['CN-1']['2026-07-01']).toBe(6); // Ao sí cuenta el PM
    expect(dmAi['CN-1']['2026-07-01']).toBeUndefined(); // Ai no
    expect(dmAo['CN-1']['2026-07-15']).toBe(24); // ambos cuentan el correctivo
    expect(dmAi['CN-1']['2026-07-15']).toBe(24);
  });

  it('sin correctivos y solo PM, el mapa Ai queda vacío para ese equipo', () => {
    const reg = [{ equipo: 'CN-9', fechaEntrada: '2026-07-01', duracionH: 8 }];
    const dmAi = dispDownMap(reg, [], undefined, { incluirPM: false });
    expect(dmAi['CN-9']).toBeUndefined();
  });

  it('una salida de servicio marcada explícitamente como NO falla real (criticidad="No Aplica") no resta en Ai, pero sí en Ao (auditoría 2026-09-16)', () => {
    const ot = [{ sigla: 'CN-1', fecha: '2026-07-15', estatusEq: 'Fuera de Servicio', criticidad: 'No Aplica' }];
    const dmAo = dispDownMap([], ot);
    const dmAi = dispDownMap([], ot, undefined, { incluirPM: false });
    expect(dmAo['CN-1']['2026-07-15']).toBe(24); // Ao cuenta cualquier causa de detención
    expect(dmAi['CN-1']).toBeUndefined(); // Ai no — no es una falla real del equipo
  });
});

describe('dispIntrinsecaEquipoMes (Ai) — disponibilidad intrínseca mensual (%)', () => {
  const hoy = '2026-07-31';
  it('sin fallas registradas = 100% (aunque haya habido PM, que no cuenta acá)', () => {
    const v = dispIntrinsecaEquipoMes('CN-1', '2026-07', { downMapCorrectivo: {}, hrsDia: 12, hoy });
    expect(v).toBe(100);
  });

  it('Ai es mayor o igual que Ao cuando el equipo tuvo PM además de fallas', () => {
    const reg = [{ equipo: 'CN-1', fechaEntrada: '2026-07-05', duracionH: 6 }];
    const ot = [{ sigla: 'CN-1', fecha: '2026-07-20', estatusEq: 'Fuera de Servicio' }];
    const downMapAo = dispDownMap(reg, ot);
    const downMapAi = dispDownMap(reg, ot, undefined, { incluirPM: false });
    const ao = dispEquipoMes('CN-1', '2026-07', { downMap: downMapAo, hrsDia: 12, hoy });
    const ai = dispIntrinsecaEquipoMes('CN-1', '2026-07', { downMapCorrectivo: downMapAi, hrsDia: 12, hoy });
    expect(ai).toBeGreaterThan(ao);
  });

  it('mes sin ningún día con dato -> null', () => {
    expect(dispIntrinsecaEquipoMes('CN-1', '2027-01', { downMapCorrectivo: {}, hoy: '2026-07-31' })).toBeNull();
  });
});
