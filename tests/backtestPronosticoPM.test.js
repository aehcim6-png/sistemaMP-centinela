// Precisión del pronóstico de PM: cuántos días se equivoca el sistema al predecir la fecha del próximo PM (24-nov-2026).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const L = createRequire(import.meta.url)('../logic.js');

// Equipo de 250 h, 10 h/día reales. PM a las 250 h el 2026-01-01; el siguiente toca a las 500 h = 25 días después (2026-01-26).
const dia = (n) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
const lecturas = (sigla, desdeDia, hastaDia, h0, porDia) => Array.from({ length: hastaDia - desdeDia + 1 }, (_, i) => ({ sigla, fecha: dia(desdeDia + i), horom: h0 + i * porDia }));
const eq = [{ sigla: 'X-1', frecPM: 250, hrsDia: 10, unidad: 'h' }];

describe('backtestPronosticoPM', () => {
  it('con un ritmo estable el pronóstico acierta el día', () => {
    const reg = [{ equipo: 'X-1', tipoPM: 'PM1', fechaEntrada: dia(0), horomReal: 250 }, { equipo: 'X-1', tipoPM: 'PM2', fechaEntrada: dia(25), horomReal: 500 }];
    const r = L.backtestPronosticoPM(reg, lecturas('X-1', -10, 0, 150, 10), eq, { desde: '2025-01-01' });
    expect(r.pares).toBe(1);
    expect(r.mae).toBe(0);
    expect(r.pct7).toBe(100);
    expect(r.sesgo).toBe(0);
  });
  it('si el PM se hizo 12 días tarde, el error es de 12 días y el sistema «adelantó» (signo negativo)', () => {
    const reg = [{ equipo: 'X-1', fechaEntrada: dia(0), horomReal: 250 }, { equipo: 'X-1', fechaEntrada: dia(37), horomReal: 500 }];
    const r = L.backtestPronosticoPM(reg, lecturas('X-1', -10, 0, 150, 10), eq, { desde: '2025-01-01' });
    expect(r.mae).toBe(12);
    expect(r.sesgo).toBe(-12);
    expect(r.pct7).toBe(0);
    expect(r.pct14).toBe(100);
  });
  it('solo cuenta PM hechos cerca de su hito (un PM extra a las 300 h no entra) y salta los estimados', () => {
    const reg = [
      { equipo: 'X-1', fechaEntrada: dia(0), horomReal: 250 },
      { equipo: 'X-1', fechaEntrada: dia(5), horomReal: 300 },                                   // visita extra: hito lejano
      { equipo: 'X-1', fechaEntrada: dia(25), horomReal: 500, origen: 'Estimado desde Control Kilometraje 23-11-2026' },
    ];
    expect(L.backtestPronosticoPM(reg, lecturas('X-1', -10, 0, 150, 10), eq, { desde: '2025-01-01' }).pares).toBe(0);
  });
  it('un equipo sin frecuencia o sin ritmo utilizable no entra y nada revienta con datos vacíos', () => {
    expect(L.backtestPronosticoPM([], [], [], {}).pares).toBe(0);
    expect(L.backtestPronosticoPM(null, null, null).mae).toBeNull();
  });
  it('marca como poco confiables los equipos con error medio de más de 14 días (con al menos minPares pares)', () => {
    const regs = [], hist = lecturas('X-1', -10, 400, 150, 10);
    let h = 250, d = 0;
    for (let k = 0; k < 4; k++) { regs.push({ equipo: 'X-1', fechaEntrada: dia(d), horomReal: h }); h += 250; d += 25 + 20; }   // siempre 20 días tarde
    regs.push({ equipo: 'X-1', fechaEntrada: dia(d), horomReal: h });
    const r = L.backtestPronosticoPM(regs, hist, eq, { desde: '2025-01-01', minPares: 4 });
    expect(r.pares).toBe(4);
    expect(r.peores.map(x => x.sigla)).toEqual(['X-1']);
  });
});
