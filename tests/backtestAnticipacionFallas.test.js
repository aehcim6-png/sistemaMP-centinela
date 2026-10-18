import { describe, it, expect } from 'vitest';
import { backtestAnticipacionFallas } from '../logic.js';

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
