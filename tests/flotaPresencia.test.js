import { describe, it, expect } from 'vitest';
import { equipoPresenteEnPeriodo, flotaEquiposPeriodo, flotaEquiposMes, dispEquipoMes, dispCoberturaMes, coberturaFlotaMes } from '../logic.js';

const eq = [{ sigla: 'A', tipo: 'Camión', modelo: 'M1', hrsDia: 12 }, { sigla: 'CF-9511', tipo: 'Cargador', modelo: 'M2', hrsDia: 12 }];
const pres = [
  { sigla: 'CF-9511', desde: null, hasta: '2026-08-05', confirmado: true },
  { sigla: 'Z', desde: '2025-01-01', hasta: '2026-02-28', confirmado: false, tipo: 'Camioneta', modelo: 'X' },
  { sigla: 'A', desde: null, hasta: null, confirmado: true },
];

describe('flota por período — equipos desmovilizados cuentan hasta su salida', () => {
  it('equipoPresenteEnPeriodo: sin fila se asume presente; con fila respeta desde/hasta', () => {
    expect(equipoPresenteEnPeriodo(pres, 'NOESTA', '2026-01-01', '2026-01-31')).toBe(true);
    expect(equipoPresenteEnPeriodo(pres, 'Z', '2026-02-01', '2026-02-28')).toBe(true);
    expect(equipoPresenteEnPeriodo(pres, 'Z', '2026-03-01', '2026-03-31')).toBe(false);
    expect(equipoPresenteEnPeriodo(pres, 'Z', '2024-12-01', '2024-12-31')).toBe(false);
  });

  it('flotaEquiposMes: incluye al desmovilizado mientras estuvo, con su fecha de salida, y lo saca después', () => {
    const feb = flotaEquiposMes(eq, pres, '2026-02');
    expect(feb.map((e) => e.sigla).sort()).toEqual(['A', 'CF-9511', 'Z']);
    const z = feb.find((e) => e.sigla === 'Z');
    expect(z).toMatchObject({ desmovilizado: true, finOper: '2026-02-28', sinConfirmar: true, tipo: 'Camioneta' });
    const sep = flotaEquiposMes(eq, pres, '2026-09');
    expect(sep.map((e) => e.sigla)).toEqual(['A']);
  });

  it('el equipo desmovilizado que sigue en `equipos` se marca; no se duplica', () => {
    const jul = flotaEquiposMes(eq, pres, '2026-07');
    expect(jul.filter((e) => e.sigla === 'CF-9511')).toHaveLength(1);
    expect(jul.find((e) => e.sigla === 'CF-9511')).toMatchObject({ desmovilizado: true, finOper: '2026-08-05', sinConfirmar: false });
    expect(flotaEquiposMes(eq, pres, '2024-04').map((e) => e.sigla)).toEqual(['A', 'CF-9511']);
  });

  it('sin tabla de presencia la flota es la de siempre', () => {
    expect(flotaEquiposPeriodo(eq, [], '2026-01-01', '2026-12-31')).toEqual(eq);
    expect(flotaEquiposPeriodo(eq, undefined, '2026-01-01', '2026-12-31')).toEqual(eq);
  });
});

describe('disponibilidad respeta el tiempo en faena', () => {
  const hoy = '2026-12-31';
  const base = { hrsDia: 12, hoy };
  it('mes de salida: solo cuentan los días hasta la salida', () => {
    // Detención de 24 h el 20-ago (después de la salida del 5-ago): no debe pesar.
    const downMap = { 'CF-9511': { '2026-08-03': 12, '2026-08-20': 12 } };
    const sin = dispEquipoMes('CF-9511', '2026-08', { ...base, downMap });
    const con = dispEquipoMes('CF-9511', '2026-08', { ...base, downMap, presencia: pres });
    // Sin límite: 2 días caídos de 31 → 93.5. Con límite (5 días, 1 caído) → 80.
    expect(sin).toBeCloseTo(93.5, 1);
    expect(con).toBe(80);
  });
  it('mes posterior a la salida: sin dato (no 100 %)', () => {
    expect(dispEquipoMes('CF-9511', '2026-09', { ...base, downMap: {}, presencia: pres })).toBeNull();
    expect(dispCoberturaMes('CF-9511', '2026-09', { ...base, downMap: {}, presencia: pres })).toBeNull();
  });
  it('coberturaFlotaMes con la flota del mes no cuenta a los que ya salieron', () => {
    const flota = flotaEquiposMes(eq, pres, '2026-09');
    const r = coberturaFlotaMes(flota, '2026-09', { downMap: {}, presencia: pres, hoy });
    expect(r.n).toBe(1);
  });
});
