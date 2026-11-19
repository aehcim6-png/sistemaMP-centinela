import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { estadoReprogramacionPM, resumenReprogramaciones, REPROG_MOTIVOS } from '../logic.js';

// Reprogramaciones de PM: un PM que tocaba una semana y pasó a otra. «Repuesta» se deduce de los PM registrados.
const rep = (o) => Object.assign({ sigla: 'CN-10160', tipoPM: 'PM4', fechaOrigen: '2026-11-12', fechaDestino: '2026-11-19', motivo: 'Falta de repuestos o insumos', estado: 'Pendiente' }, o);
// semana de origen: jueves 12-nov a miércoles 18-nov; semana de destino: 19-nov a 25-nov

describe('estadoReprogramacionPM', () => {
  it('Pendiente mientras la semana de destino no termina y no hay PM', () => {
    expect(estadoReprogramacionPM(rep(), [], '2026-11-20')).toMatchObject({ estado: 'Pendiente', fechaRepuesta: null });
  });
  it('Vencida: pasó la semana de destino y no hay PM registrado', () => {
    expect(estadoReprogramacionPM(rep(), [], '2026-11-30').estado).toBe('Vencida');
  });
  it('Repuesta: hay un PM del mismo equipo, igual o mayor, registrado después de la semana de origen; dice si cayó en la semana de destino', () => {
    const reg = [{ equipo: 'CN-10160', tipoPM: 'PM4', fechaEntrada: '2026-11-21' }];
    expect(estadoReprogramacionPM(rep(), reg, '2026-12-01')).toMatchObject({ estado: 'Repuesta', fechaRepuesta: '2026-11-21', enSemanaDestino: true });
    const tarde = [{ equipo: 'CN-10160', tipoPM: 'PM4', fechaEntrada: '2026-11-30' }];
    expect(estadoReprogramacionPM(rep(), tarde, '2026-12-01')).toMatchObject({ estado: 'Repuesta', enSemanaDestino: false });
  });
  it('no cuenta un PM de otro equipo, de nivel menor, ni uno de la propia semana de origen', () => {
    const reg = [
      { equipo: 'OTRO', tipoPM: 'PM4', fechaEntrada: '2026-11-21' },
      { equipo: 'CN-10160', tipoPM: 'PM1', fechaEntrada: '2026-11-21' },
      { equipo: 'CN-10160', tipoPM: 'PM4', fechaEntrada: '2026-11-18' },
    ];
    expect(estadoReprogramacionPM(rep(), reg, '2026-11-20').estado).toBe('Pendiente');
  });
  it('un PM de nivel mayor cubre al reprogramado (PM4 incluye PM2)', () => {
    const reg = [{ equipo: 'CN-10160', tipoPM: 'PM4', fechaEntrada: '2026-11-22' }];
    expect(estadoReprogramacionPM(rep({ tipoPM: 'PM2' }), reg, '2026-11-23').estado).toBe('Repuesta');
  });
  it('Cancelada se respeta', () => {
    expect(estadoReprogramacionPM(rep({ estado: 'Cancelada' }), [{ equipo: 'CN-10160', tipoPM: 'PM4', fechaEntrada: '2026-11-21' }], '2026-12-01').estado).toBe('Cancelada');
  });
});

describe('resumenReprogramaciones', () => {
  it('cuenta por estado y por motivo', () => {
    const reg = [{ equipo: 'A', tipoPM: 'PM1', fechaEntrada: '2026-11-21' }];
    const r = resumenReprogramaciones([
      rep({ sigla: 'A', tipoPM: 'PM1' }),
      rep({ sigla: 'B', motivo: 'Falta de personal' }),
      rep({ sigla: 'C', motivo: 'Falta de personal', estado: 'Cancelada' }),
    ], reg, '2026-11-30');
    expect(r.total).toBe(3);
    expect(r.porEstado).toEqual({ Pendiente: 0, Repuesta: 1, Vencida: 1, Cancelada: 1 });
    expect(r.porMotivo).toEqual({ 'Falta de repuestos o insumos': 1, 'Falta de personal': 2 });
  });
  it('la lista de motivos es la misma de la restricción de la base de datos', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20261119120000_crear_reprogramaciones_pm.sql', import.meta.url), 'utf8');
    const bloque = sql.match(/motivo in \(([\s\S]*?)\)\),/)[1];
    const enBase = [...bloque.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(enBase).toEqual(REPROG_MOTIVOS);
  });
  it('la lista de motivos termina en «Otro» y no repite', () => {
    expect(REPROG_MOTIVOS[REPROG_MOTIVOS.length - 1]).toBe('Otro');
    expect(new Set(REPROG_MOTIVOS).size).toBe(REPROG_MOTIVOS.length);
  });
});
