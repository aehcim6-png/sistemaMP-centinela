import { describe, it, expect } from 'vitest';
import { programaSemanaReconstruido } from '../logic.js';

// Planificación semanal: el plan de una semana pasada se reconstruye (qué tocaba y qué pasó), porque el plan en vivo no se guardaba.
const dia = (n) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
const hist = (sigla, base, ritmo) => Array.from({ length: 60 }, (_, d) => ({ sigla, fecha: dia(d), horom: base + ritmo * d, horomFin: base + ritmo * d }));
const eq = (sigla) => ({ sigla, modelo: 'Komatsu HD785-7', frecPM: 250, hrsDia: 10 });
const desde = '2026-02-01', hasta = '2026-02-07', hoy = '2026-03-01';

describe('programaSemanaReconstruido', () => {
  const equipos = ['A', 'B', 'C', 'D', 'E'].map(eq);
  const h = [
    ...hist('A', 150, 10), // llega a 500 el 5 de febrero y se ejecuta
    ...hist('B', 150, 10).map((x, i) => Object.assign(x, { horom: i < 31 ? 150 + 10 * i : 450, horomFin: i < 31 ? 150 + 10 * i : 450 })), // se para en 450
    ...hist('C', 150, 10), // llega a 500 y no se registra PM
    ...hist('E', 220, 10), // el hito de 500 ya estaba vencido
  ];
  const reg = [{ equipo: 'A', horomReal: 501, fechaEntrada: '2026-02-05', tipoPM: 'PM2' }, { equipo: 'E', horomReal: 250, fechaEntrada: '2026-01-10', tipoPM: 'PM1' }];
  const r = programaSemanaReconstruido(equipos, reg, h, desde, hasta, hoy);
  const e = (sigla) => r.filas.find((x) => x.sigla === sigla);

  it('cada hito queda en un estado: ejecutado, sin registro, no llegó (parado) o arrastre', () => {
    expect(e('A')).toMatchObject({ estado: 'ejecutado', hito: 500, tipoPM: 'PM2' });
    expect(e('C')).toMatchObject({ estado: 'sin_registro', hito: 500 });
    expect(e('B')).toMatchObject({ estado: 'no_llego', hito: 500 });
    expect(e('E')).toMatchObject({ estado: 'arrastre' });
  });
  it('un equipo sin lecturas cercanas no se evalúa y se avisa', () => {
    expect(r.sinHorometro).toEqual(['D']);
    expect(r.filas.some((x) => x.sigla === 'D')).toBe(false);
  });
  it('el resumen cuenta cuántos tocaban, cuántos se hicieron y cuántos no tienen PM registrado', () => {
    expect(r.resumen).toMatchObject({ programados: 3, programadosEjecutados: 1, ejecutados: 1, sinRegistro: 1, noLlego: 1, arrastrados: 1, sinHorometro: 1, fueraDePrograma: 0 });
  });
  it('lo que falta por registrar va primero', () => {
    expect(r.filas[0].estado).toBe('sin_registro');
    expect(r.filas[r.filas.length - 1].estado).toBe('arrastre');
  });
  it('una semana sin hitos devuelve ceros', () => {
    const v = programaSemanaReconstruido([eq('A')], [], hist('A', 150, 10), '2026-02-20', '2026-02-26', hoy);
    expect(v.filas).toEqual([]);
    expect(v.resumen.programados).toBe(0);
  });
});
