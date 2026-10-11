// Presupuesto limitado con costo de hora detenida por modelo: cada candidato usa el valor del modelo de su equipo.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const fila = (sigla, extra) => Object.assign({ sigla, decision: 'pedir_ya', conDato: true, costoEst: 1000000, desdeH: 14000, tbo: 16000 }, extra);
const base = { horizonte: 500, horasFalla: 48, horasProg: 8 };

describe('tboCandidatosPresupuesto con costo por modelo', () => {
  it('sin función por modelo se comporta como antes (un costo para todos)', () => {
    const r = L.tboCandidatosPresupuesto([fila('A'), fila('B')], Object.assign({ costoHoraDet: 100000 }, base));
    expect(r.usaDet).toBe(true);
    expect(r.cands.map(c => c.consecuencia)).toEqual([40 * 100000, 40 * 100000]);
    expect(r.cands.every(c => c.usaDet)).toBe(true);
  });
  it('cada fila usa el costo de su equipo: el equipo caro pesa más en el beneficio', () => {
    const costo = { A: 400000, B: 100000 };
    const r = L.tboCandidatosPresupuesto([fila('A'), fila('B')], Object.assign({ costoHoraDet: 100000, costoHoraDetDe: f => costo[f.sigla] }, base));
    expect(r.cands[0].consecuencia).toBe(40 * 400000);
    expect(r.cands[1].consecuencia).toBe(40 * 100000);
    expect(r.cands[0].beneficio).toBeCloseTo(4 * r.cands[1].beneficio, 8);
  });
  it('un equipo sin costo de hora detenida cae al precio del repuesto como consecuencia, y los demás no se ven afectados', () => {
    const costo = { A: 400000, B: 0 };
    const r = L.tboCandidatosPresupuesto([fila('A'), fila('B')], Object.assign({ costoHoraDetDe: f => costo[f.sigla] }, base));
    expect(r.cands[0].usaDet).toBe(true); expect(r.cands[1].usaDet).toBe(false);
    expect(r.cands[1].consecuencia).toBe(1000000);
    expect(r.usaDet).toBe(true);                                    // alguna fila usa detención
  });
  it('si ninguna fila tiene costo, usaDet es falso', () => {
    expect(L.tboCandidatosPresupuesto([fila('A')], Object.assign({ costoHoraDetDe: () => 0 }, base)).usaDet).toBe(false);
    expect(L.tboCandidatosPresupuesto([fila('A')], base).usaDet).toBe(false);
  });
});
