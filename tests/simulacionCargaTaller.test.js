import { describe, it, expect } from 'vitest';
import { simulacionCargaTaller, backtestCargaTaller } from '../logic.js';

const hoy = '2026-10-19';
const plus = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

// Escenario exacto: entra 1 equipo por día y cada uno se queda 3 días → siempre hay 3 en el taller.
const exacto = () => { const iv = []; for (let d = 0; d < 400; d++) { const e = plus(hoy, -d); iv.push({ entrada: e, salida: plus(e, 2) }); } return iv; };

describe('simulacionCargaTaller', () => {
  it('escenario exacto (1 por día, 3 días de permanencia): siempre 3 equipos en el taller', () => {
    const r = simulacionCargaTaller(exacto(), hoy, { nSim: 200, rng: lcg(1) });
    expect(r.hoyAbiertos).toBe(2);                       // los que entraron ayer y hoy aún no salen
    expect(r.llegadasPorDia).toBe(1);
    expect(r.duracionMedianaDias).toBe(3);
    expect(r.mediaPromedio).toEqual({ p10: 3, p50: 3, p90: 3 });
    expect(r.maximo).toEqual({ p10: 3, p50: 3, p90: 3 });
    expect(r.probabilidadAlMenos[3]).toBe(100);
    expect(r.probabilidadAlMenos[4]).toBe(0);
  });
  it('ley de Little: con 2 entradas por día en promedio y permanencia media de 3 días, el promedio simulado ronda 6', () => {
    const rnd = lcg(5), iv = [];
    for (let d = 0; d < 365; d++) {
      const n = Math.floor(rnd() * 5);                  // 0..4, promedio 2
      for (let j = 0; j < n; j++) { const e = plus(hoy, -d), dur = 1 + Math.floor(rnd() * 5); iv.push({ entrada: e, salida: plus(e, dur - 1) }); }
    }
    const r = simulacionCargaTaller(iv, hoy, { nSim: 400, rng: lcg(9), ventanaLlegadasDias: 365 });
    expect(r.mediaPromedio.p50).toBeGreaterThan(5.3);
    expect(r.mediaPromedio.p50).toBeLessThan(6.7);
    expect(r.mediaPromedio.p10).toBeLessThanOrEqual(r.mediaPromedio.p50);
    expect(r.mediaPromedio.p90).toBeGreaterThanOrEqual(r.mediaPromedio.p50);
  });
  it('sin datos suficientes no inventa', () => {
    expect(simulacionCargaTaller([], hoy)).toBeNull();
    expect(simulacionCargaTaller(exacto().slice(0, 8), hoy)).toBeNull();
  });
});

describe('backtestCargaTaller', () => {
  it('escenario exacto: cobertura 100 % y error 0', () => {
    const r = backtestCargaTaller(exacto(), hoy, { rng: lcg(2), nSim: 100 });
    expect(r.ok).toBe(true);
    expect(r.meses).toBeGreaterThanOrEqual(8);
    expect(r.coberturaMedia).toBe(100);
    expect(r.coberturaMax).toBe(100);
    expect(r.errorModelo).toBe(0);
  });
  it('con poca historia no se evalúa', () => {
    const r = backtestCargaTaller(exacto().slice(0, 60), hoy, { rng: lcg(2), nSim: 50 });
    expect(r.ok).toBe(false);
  });
});

import { cargaRealTallerPorMes } from '../logic.js';
describe('cargaRealTallerPorMes', () => {
  it('cuenta los equipos en el taller por día y resume por mes (cálculo manual)', () => {
    // 2026-03: A entra el 1 y sale el 3 (días 1,2,3), B entra el 2 y sale el 2, C sin salida entra el 31
    const r = cargaRealTallerPorMes([
      { entrada: '2026-03-01', salida: '2026-03-03' },
      { entrada: '2026-03-02', salida: '2026-03-02' },
      { entrada: '2026-03-31', salida: null },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].mes).toBe('2026-03');
    expect(r[0].dias).toBe(31);
    // día 1:1, día 2:2, día 3:1, días 4–30: 0, día 31: 1  → suma 5 en 31 días
    expect(r[0].media).toBeCloseTo(5 / 31, 1);
    expect(r[0].maximo).toBe(2);
    expect(cargaRealTallerPorMes([])).toEqual([]);
  });
});
