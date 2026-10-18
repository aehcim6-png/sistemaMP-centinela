import { describe, it, expect } from 'vitest';
import { backtestAnticipacionFallas, _btScoresModelos } from '../logic.js';

// Datos deterministas: 8 equipos que fallan cada 20, 30, 45, 60, 90, 120, 180 y 250 días desde 2023.
// Las referencias (AUC y precisión de cada regla) salen de un script Python independiente que repite el cálculo
// paso a paso (sin usar logic.js); el JS debe coincidir a 3 decimales.
const hoy = '2026-10-18';
const ciclos = [20, 30, 45, 60, 90, 120, 180, 250];
const mkEventos = () => {
  const ev = [];
  ciclos.forEach((c, i) => {
    let d = new Date(Date.UTC(2023, 0, 1) + 5 * i * 864e5), n = 0;
    while (d < new Date(hoy + 'T00:00:00Z')) {
      ev.push({ sigla: 'E' + i, fecha: d.toISOString().slice(0, 10), componente: ['Motor', 'Frenos', 'Mangueras'][n % 3] });
      d = new Date(d.getTime() + c * 864e5); n++;
    }
  });
  return ev;
};
const equipos = ciclos.map((_, i) => ({ sigla: 'E' + i }));
const rngFijo = () => { let s = 1; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };

describe('backtestAnticipacionFallas', () => {
  it('reproduce AUC y precisión del cálculo independiente', () => {
    const r = backtestAnticipacionFallas(mkEventos(), equipos, hoy, { rng: rngFijo() });
    expect(r.ok).toBe(true);
    expect(r.origenes).toBe(24);
    expect(r.tasaBase).toBeCloseTo(0.505, 3);
    const por = Object.fromEntries(r.predictores.map((p) => [p.clave, p]));
    expect(por.prob30.auc).toBeCloseTo(0.921, 3);
    expect(por.prob30.precisionTop).toBeCloseTo(1.0, 3);
    expect(por.vencido.auc).toBeCloseTo(0.643, 3);
    expect(por.vencido.precisionTop).toBeCloseTo(0.833, 3);
    expect(por.fallas90.auc).toBeCloseTo(0.831, 3);
    expect(por.fallas365.auc).toBeCloseTo(0.926, 3);
    expect(por.fallas365.veredicto).toBe('referencia');
  });
  it('el veredicto sale del intervalo de la diferencia contra la referencia: peor / no distinguible', () => {
    const r = backtestAnticipacionFallas(mkEventos(), equipos, hoy, { rng: rngFijo() });
    const por = Object.fromEntries(r.predictores.map((p) => [p.clave, p]));
    expect(por.fallas90.veredicto).toBe('peor');          // 0.831 vs 0.926, intervalo entero bajo 0
    expect(por.prob30.veredicto).toBe('no distinguible'); // 0.921 vs 0.926: sin diferencia real
    expect(por.prob30.difVsReferencia.lo).toBeLessThanOrEqual(0);
    expect(por.prob30.difVsReferencia.hi).toBeGreaterThanOrEqual(0);
  });
  it('Weibull y Kijima sin horómetro no saben ordenar: AUC 0,5 (no inventan)', () => {
    const r = backtestAnticipacionFallas(mkEventos(), equipos, hoy, { rng: rngFijo() });
    const por = Object.fromEntries(r.predictores.map((p) => [p.clave, p]));
    expect(r.predictores).toHaveLength(6);
    expect(por.weibull.auc).toBeCloseTo(0.5, 3);
    expect(por.kijima.auc).toBeCloseTo(0.5, 3);
  });
  it('con horómetro, Weibull y Kijima ordenan los equipos (reciben puntajes distintos)', () => {
    // intervalos con variación (con intervalos idénticos Weibull no se puede ajustar); horómetro = 12 h por día
    let sem = 99;
    const azar = () => { sem = (sem * 1103515245 + 12345) % 2147483648; return sem / 2147483648; };
    const ev = [];
    ciclos.forEach((c, i) => {
      let t = new Date(Date.UTC(2023, 0, 1) + 5 * i * 864e5);
      while (t < new Date(hoy + 'T00:00:00Z')) {
        const f = t.toISOString().slice(0, 10);
        ev.push({ sigla: 'E' + i, fecha: f, componente: 'Motor', horom: Math.round((t - new Date('2023-01-01')) / 864e5 * 12) + 100 });
        t = new Date(t.getTime() + Math.max(2, Math.round(c * (0.6 + 0.8 * azar()))) * 864e5);
      }
    });
    const eqs = ciclos.map((_, i) => ({ sigla: 'E' + i, hrsDia: 12 }));
    const r = backtestAnticipacionFallas(ev, eqs, hoy, { rng: rngFijo() });
    const por = Object.fromEntries(r.predictores.map((p) => [p.clave, p]));
    expect(Math.abs(por.weibull.auc - 0.5)).toBeGreaterThan(0.05);   // sí ordena (no es el empate de «sin modelo»)
    expect(Math.abs(por.kijima.auc - 0.5)).toBeGreaterThan(0.05);
  });
  it('no evalúa con poca historia o sin eventos (no inventa)', () => {
    expect(backtestAnticipacionFallas([], equipos, hoy)).toBeNull();
    const pocos = mkEventos().filter((e) => e.fecha >= '2026-06-01');
    const r = backtestAnticipacionFallas(pocos, equipos, hoy);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/menos de 3 meses/);
  });
  it('solo usa lo que se sabía a cada fecha: borrar los eventos posteriores al último origen no cambia el pasado', () => {
    const ev = mkEventos();
    const a = backtestAnticipacionFallas(ev, equipos, hoy, { rng: rngFijo(), maxOrigenes: 6 });
    expect(a.origenes).toBe(6);
    expect(a.hasta <= '2026-09-18').toBe(true);   // el último origen deja 30 días de resultado antes de hoy
  });
});

describe('_btScoresModelos', () => {
  // Referencia de un script Python independiente (Weibull por máxima verosimilitud con censura, sección áurea de Kijima,
  // misma fórmula de probabilidad condicional); el JS redondea β y η a 1 decimal como las pantallas, de ahí la tolerancia.
  const horoms = [100, 520, 880, 1500, 1790, 2300, 2650, 3300, 3520, 4100];
  it('reproduce las probabilidades de Weibull y Kijima del cálculo independiente', () => {
    const r = _btScoresModelos(horoms, 4400, 150);
    expect(r.weibull).toBeCloseTo(0.409, 2);   // Python: 0.40908
    expect(r.kijima).toBeCloseTo(0.472, 2);    // Python: 0.47193
  });
  it('con menos de 5 intervalos no ajusta: puntaje 0', () => {
    const r = _btScoresModelos([100, 500, 900, 1400], 1800, 100);
    expect(r).toEqual({ weibull: 0, kijima: 0 });
  });
});
