import { describe, it, expect } from 'vitest';
import { _normalizarModelo, rendimientoTeoricoCargadorFrontal, produccionPerdidaPorDetencion } from '../logic.js';

describe('_normalizarModelo', () => {
  it('normaliza a solo letras/números en minúscula, ignorando guiones/espacios', () => {
    expect(_normalizarModelo('Komatsu HD785-7')).toBe('komatsuhd7857');
    expect(_normalizarModelo('Komatsu HD-785-7')).toBe('komatsuhd7857');
    expect(_normalizarModelo('  Komatsu   WA900-8R ')).toBe('komatsuwa9008r');
  });

  it('nunca lanza con entradas vacías', () => {
    expect(_normalizarModelo('')).toBe('');
    expect(_normalizarModelo(undefined)).toBe('');
    expect(_normalizarModelo(null)).toBe('');
  });
});

describe('rendimientoTeoricoCargadorFrontal', () => {
  it('calcula R = Q×LF×E×60/Cm, mismo ejemplo verificado por el usuario', () => {
    // Q=1,30 LF=0,85 E=0,75 Cm=1,00 -> R=49,73 m3/h (Cosrec R&H, ejemplo real)
    const r = rendimientoTeoricoCargadorFrontal({ q: 1.3, lf: 0.85, e: 0.75, cm: 1.0 });
    expect(r).toBeCloseTo(49.725, 2);
  });

  it('devuelve null si falta cualquiera de los 4 parámetros (nunca inventa)', () => {
    expect(rendimientoTeoricoCargadorFrontal({ lf: 0.85, e: 0.75, cm: 1.0 })).toBeNull();
    expect(rendimientoTeoricoCargadorFrontal({ q: 13, e: 0.75, cm: 1.0 })).toBeNull();
    expect(rendimientoTeoricoCargadorFrontal({ q: 13, lf: 0.85, cm: 1.0 })).toBeNull();
    expect(rendimientoTeoricoCargadorFrontal({ q: 13, lf: 0.85, e: 0.75 })).toBeNull();
    expect(rendimientoTeoricoCargadorFrontal({})).toBeNull();
    expect(rendimientoTeoricoCargadorFrontal(null)).toBeNull();
  });

  it('devuelve null si algún parámetro es 0 o negativo (división por cero incluida)', () => {
    expect(rendimientoTeoricoCargadorFrontal({ q: 13, lf: 0.85, e: 0.75, cm: 0 })).toBeNull();
    expect(rendimientoTeoricoCargadorFrontal({ q: 0, lf: 0.85, e: 0.75, cm: 1 })).toBeNull();
    expect(rendimientoTeoricoCargadorFrontal({ q: 13, lf: -0.5, e: 0.75, cm: 1 })).toBeNull();
  });
});

describe('produccionPerdidaPorDetencion', () => {
  const rendModelos = [
    { modelo: 'Komatsu WA900-8R', tipo: 'Cargador Frontal', parametros: { q: 13.0, lf: 0.85, e: 0.75, cm: 1.0 } },
    { modelo: 'Komatsu HD785-7', tipo: 'Camión Minero', parametros: { q: 60 } }, // incompleto a propósito
  ];

  it('array vacío sin equipos, sin rendModelos o sin downMap', () => {
    expect(produccionPerdidaPorDetencion([], [], {})).toEqual([]);
    expect(produccionPerdidaPorDetencion(undefined, undefined, undefined)).toEqual([]);
  });

  it('calcula m3Perdidos = horasDetenidas × rendimientoTeorico para un Cargador Frontal con datos completos', () => {
    const equipos = [{ sigla: 'CF-9510', tipo: 'Cargador Frontal', modelo: 'Komatsu WA900-8R' }];
    const downMap = { 'CF-9510': { '2026-01-05': 10, '2026-01-06': 14 } }; // 24h total
    const r = produccionPerdidaPorDetencion(equipos, rendModelos, downMap);
    expect(r).toHaveLength(1);
    expect(r[0].sigla).toBe('CF-9510');
    expect(r[0].horasDetenidas).toBe(24);
    // Q=13,0 LF=0,85 E=0,75 Cm=1,00 -> R=497,25 m3/h
    expect(r[0].rendimientoTeorico).toBeCloseTo(497.25, 1);
    expect(r[0].m3Perdidos).toBe(Math.round(24 * 497.25));
  });

  it('ignora un equipo cuyo modelo tiene los parámetros incompletos (Camión Minero de ejemplo)', () => {
    const equipos = [{ sigla: 'CN-4656', tipo: 'Camión Minero', modelo: 'Komatsu HD785-7' }];
    const downMap = { 'CN-4656': { '2026-01-05': 24 } };
    expect(produccionPerdidaPorDetencion(equipos, rendModelos, downMap)).toEqual([]);
  });

  it('ignora un equipo sin horas de detención registradas', () => {
    const equipos = [{ sigla: 'CF-9510', tipo: 'Cargador Frontal', modelo: 'Komatsu WA900-8R' }];
    expect(produccionPerdidaPorDetencion(equipos, rendModelos, {})).toEqual([]);
  });

  it('ignora un equipo cuyo modelo no tiene fila en rendModelos', () => {
    const equipos = [{ sigla: 'MN-1', tipo: 'Motoniveladora', modelo: 'Komatsu GD-705-5' }];
    const downMap = { 'MN-1': { '2026-01-05': 24 } };
    expect(produccionPerdidaPorDetencion(equipos, rendModelos, downMap)).toEqual([]);
  });

  it('cruza el modelo aunque esté escrito distinto (guion extra) — mismo caso real de la flota', () => {
    const equipos = [{ sigla: 'CF-X', tipo: 'Cargador Frontal', modelo: 'Komatsu WA-900-8R' }];
    const downMap = { 'CF-X': { '2026-01-05': 10 } };
    const r = produccionPerdidaPorDetencion(equipos, rendModelos, downMap);
    expect(r).toHaveLength(1);
    expect(r[0].sigla).toBe('CF-X');
  });

  it('ignora un equipo con modelo real pero tipo distinto al de la fórmula implementada', () => {
    // mismo modelo string pero el equipo dice ser otro tipo (dato inconsistente) -> no se calcula
    const equipos = [{ sigla: 'X-1', tipo: 'Bulldozer', modelo: 'Komatsu WA900-8R' }];
    const downMap = { 'X-1': { '2026-01-05': 10 } };
    const r = produccionPerdidaPorDetencion(equipos, rendModelos, downMap);
    expect(r).toHaveLength(1); // el match es por rm.tipo==='Cargador Frontal' desde rendModelos, no desde eqp.tipo
  });

  it('suma varios equipos y ordena de mayor a menor m3Perdidos', () => {
    const equipos = [
      { sigla: 'CF-1', tipo: 'Cargador Frontal', modelo: 'Komatsu WA900-8R' },
      { sigla: 'CF-2', tipo: 'Cargador Frontal', modelo: 'Komatsu WA900-8R' },
    ];
    const downMap = { 'CF-1': { '2026-01-05': 10 }, 'CF-2': { '2026-01-05': 40 } };
    const r = produccionPerdidaPorDetencion(equipos, rendModelos, downMap);
    expect(r).toHaveLength(2);
    expect(r[0].sigla).toBe('CF-2');
    expect(r[0].m3Perdidos).toBeGreaterThan(r[1].m3Perdidos);
  });

  it('ignora equipos sin sigla o sin modelo (nunca inventa el cruce)', () => {
    const equipos = [{ tipo: 'Cargador Frontal', modelo: 'Komatsu WA900-8R' }, { sigla: 'CF-1', tipo: 'Cargador Frontal' }];
    const downMap = { 'CF-1': { '2026-01-05': 10 } };
    expect(produccionPerdidaPorDetencion(equipos, rendModelos, downMap)).toEqual([]);
  });

  it('no muta los arreglos originales (pura)', () => {
    const equipos = [{ sigla: 'CF-9510', tipo: 'Cargador Frontal', modelo: 'Komatsu WA900-8R' }];
    const downMap = { 'CF-9510': { '2026-01-05': 10 } };
    const copiaEq = equipos.map((e) => ({ ...e }));
    const copiaRM = rendModelos.map((r) => ({ ...r }));
    produccionPerdidaPorDetencion(equipos, rendModelos, downMap);
    expect(equipos).toEqual(copiaEq);
    expect(rendModelos).toEqual(copiaRM);
  });
});
