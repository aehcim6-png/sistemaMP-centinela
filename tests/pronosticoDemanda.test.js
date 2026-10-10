import { describe, it, expect } from 'vitest';
import { pronosticarSerie, pronRecortarAtipicos, serieMensualDe, mesesFinalesIncompletos, mesesSiguientes } from '../logic.js';

// Generador pseudoaleatorio con semilla (mulberry32) para que las pruebas sean reproducibles.
const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const PATRON = [50, 40, 45, 60, 80, 120, 150, 140, 90, 70, 55, 45];

describe('pronosticarSerie', () => {
  it('menos de 12 datos → null', () => { expect(pronosticarSerie([1, 2, 3])).toBeNull(); });
  it('12–17 meses no alcanzan para validar modelos: usa el promedio y lo avisa', () => {
    const r = pronosticarSerie(Array.from({ length: 14 }, (_, i) => 10 + i));
    expect(r.modelo).toBe('media');
    expect(r.hayBacktest).toBe(false);
    expect(r.nota).toMatch(/Historia corta/);
  });
  it('una estacionalidad exacta se reproduce: el pronóstico de los 12 meses siguientes es el patrón', () => {
    const y = []; for (let a = 0; a < 3; a++) y.push(...PATRON);
    const r = pronosticarSerie(y, { recortar: false });
    expect(['estacional', 'hw']).toContain(r.modelo);
    r.pronostico.forEach((v, i) => expect(Math.abs(v - PATRON[i])).toBeLessThan(2));
    expect(r.ranking[0].mae).toBeLessThan(1);
    expect(r.ranking.find(m => m.modelo === 'media').mae).toBeGreaterThan(20);
  });
  it('estacionalidad con ruido: elige un modelo estacional y supera al promedio por más de 30%', () => {
    const f = rng(7), y = []; for (let a = 0; a < 4; a++) PATRON.forEach(v => y.push(v + (f() - 0.5) * 16));
    const r = pronosticarSerie(y, { recortar: false });
    expect(['estacional', 'hw']).toContain(r.modelo);
    expect(r.ranking[0].mejoraVsMedia).toBeGreaterThan(0.3);
    expect(Math.abs(r.total - PATRON.reduce((s, v) => s + v, 0))).toBeLessThan(0.08 * 840);
  });
  it('tendencia creciente sin estacionalidad: pronostica más que el promedio histórico', () => {
    const f = rng(11), y = Array.from({ length: 36 }, (_, t) => 100 + 4 * t + (f() - 0.5) * 10);
    const r = pronosticarSerie(y, { recortar: false });
    expect(r.modelo).not.toBe('media');
    expect(r.cambioVsBase).toBeGreaterThan(0);
    expect(r.total).toBeGreaterThan(_prom(y) * 12);
  });
  it('serie sin estructura (ruido): ningún modelo gana con claridad → se queda con el promedio y lo dice', () => {
    const f = rng(3), y = Array.from({ length: 48 }, () => 100 + (f() - 0.5) * 40);
    const r = pronosticarSerie(y, { recortar: false });
    expect(r.modelo).toBe('media');
    expect(r.nota).toMatch(/promedio/);
  });
  it('demanda intermitente (muchos ceros) incluye Croston; los demás pronósticos nunca son negativos', () => {
    const f = rng(5), y = Array.from({ length: 36 }, () => (f() < 0.25 ? 1 + Math.floor(f() * 4) : 0));
    const r = pronosticarSerie(y);
    expect(r.ranking.map(m => m.modelo)).toContain('croston');
    r.pronostico.forEach(v => expect(v).toBeGreaterThanOrEqual(0));
    expect(r.totalLo).toBeGreaterThanOrEqual(0);
  });
  it('el intervalo rodea al total y se ensancha con el horizonte', () => {
    const f = rng(9), y = Array.from({ length: 40 }, () => 100 + (f() - 0.5) * 60);
    const r = pronosticarSerie(y, { recortar: false });
    expect(r.totalLo).toBeLessThanOrEqual(r.total);
    expect(r.totalHi).toBeGreaterThanOrEqual(r.total);
    expect(r.sdPaso[11]).toBeGreaterThanOrEqual(r.sdPaso[0]);
    expect(r.pronostico).toHaveLength(12);
  });
  it('saltar: pronostica el tramo posterior a los meses que hay que saltarse, con su propio rango', () => {
    const y = []; for (let a = 0; a < 3; a++) y.push(...PATRON);
    const base = pronosticarSerie(y, { recortar: false, h: 15 }), sk = pronosticarSerie(y, { recortar: false, saltar: 3 });
    expect(sk.pronostico).toHaveLength(12);
    sk.pronostico.forEach((v, i) => expect(v).toBeCloseTo(base.pronostico[i + 3], 8));
    expect(sk.sdPaso).toHaveLength(12);
    expect(sk.sdPaso.every(v => v >= 0)).toBe(true);
  });
  it('el recorte de atípicos evita que una compra única gigante infle el pronóstico', () => {
    const f = rng(13), y = Array.from({ length: 36 }, () => 100 + (f() - 0.5) * 20); y[30] = 20000;
    const con = pronosticarSerie(y), sin = pronosticarSerie(y, { recortar: false });
    expect(con.recorte.n).toBe(1);
    expect(con.total).toBeLessThan(1500 * 1.0);
    expect(sin.total).toBeGreaterThan(2 * con.total);
  });
});
const _prom = (a) => a.reduce((s, x) => s + x, 0) / a.length;

describe('pronRecortarAtipicos', () => {
  it('no toca series sin atípicos ni series casi toda en cero (MAD=0)', () => {
    expect(pronRecortarAtipicos([10, 11, 9, 10, 12, 8]).n).toBe(0);
    expect(pronRecortarAtipicos([0, 0, 0, 0, 5, 0]).n).toBe(0);
  });
  it('recorta a mediana + k·1,4826·MAD y suma lo recortado', () => {
    const r = pronRecortarAtipicos([10, 12, 8, 11, 9, 10, 1000], 3);
    // mediana 10, MAD = mediana(|x-10|) = 1 → umbral = 10 + 3·1,4826
    expect(r.umbral).toBeCloseTo(10 + 3 * 1.4826, 8);
    expect(r.n).toBe(1);
    expect(r.serie[6]).toBeCloseTo(r.umbral, 8);
    expect(r.montoRecortado).toBeCloseTo(1000 - r.umbral, 8);
  });
});

describe('serieMensualDe / meses', () => {
  it('suma por mes y rellena con 0 los meses sin movimiento', () => {
    const r = serieMensualDe([{ fecha: '2026-01-05', valor: 10 }, { fecha: '2026-01-20', valor: 5 }, { fecha: '2026-04-01', valor: 7 }, { fecha: 'basura', valor: 99 }]);
    expect(r.meses).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(r.serie).toEqual([15, 0, 0, 7]);
    expect(r.lineas).toEqual([2, 0, 0, 1]);
  });
  it('sin datos → vacío', () => { expect(serieMensualDe([]).meses).toEqual([]); });
  it('mesesSiguientes cruza el fin de año', () => { expect(mesesSiguientes('2026-11', 3)).toEqual(['2026-12', '2027-01', '2027-02']); });
  it('mesesFinalesIncompletos quita los meses finales con pocas líneas y se detiene en el primero normal', () => {
    const l = [...Array(18).fill(100), 20, 8];
    expect(mesesFinalesIncompletos(l)).toBe(2);
    expect(mesesFinalesIncompletos(Array(20).fill(100))).toBe(0);
    expect(mesesFinalesIncompletos([...Array(18).fill(100), 20, 90])).toBe(0); // el último mes está bien: no se toca nada
  });
});
