// MTBF de flota por horas operadas ÷ paradas largas (23-oct-2026): incluye equipos con 0 o 1 parada y trae su intervalo de confianza.
import { describe, it, expect } from 'vitest';
import { mtbfFlotaAgrupado, mtbfFlotaReal, MTBF_MIN_PARADAS } from '../logic.js';

const iso = (n) => new Date(Date.UTC(2026, 0, 1) + n * 864e5).toISOString().slice(0, 10);
// lecturas diarias de horómetro, 10 h por día, del día 0 al día 180
const lecturas = (sigla, base) => Array.from({ length: 181 }, (_, d) => ({ sigla, fecha: iso(d), horom: base + d * 10 }));
const ot = (sigla, dia, duracion, horom) => ({ sigla, tipo: 'Correctivo', fecha: iso(dia), duracion, horom });

describe('mtbfFlotaAgrupado', () => {
  const eq = [{ sigla: 'A' }, { sigla: 'B' }, { sigla: 'C' }];
  const hist = [].concat(lecturas('A', 1000), lecturas('B', 5000), lecturas('C', 200));
  // ventana = del día 10 (primera OT con duración) al día 110 (última): 100 días × 10 h = 1.000 h por equipo
  const ots = [
    ot('A', 10, '2h', 1100), ot('A', 30, '30h', 1300), ot('A', 90, '50h', 1900),   // A: 2 paradas largas
    ot('C', 110, '24h', 300),                                                       // C: 1 parada larga
    ot('B', 50, '3h', 5500),                                                        // B: ninguna parada larga (solo una corta)
  ];
  it('horas operadas de todos los equipos ÷ paradas largas, incluidos los que tienen 0 o 1', () => {
    const r = mtbfFlotaAgrupado(eq, ots, hist);
    expect(r.equipos).toBe(3);
    expect(r.horas).toBe(3000);
    expect(r.paradas).toBe(3);
    expect(r.mtbf).toBe(1000);
    expect(r.equiposSinParadas).toBe(1);
    expect(r.ini).toBe(iso(10));
    expect(r.fin).toBe(iso(110));
  });
  it('el promedio por equipo (método anterior) ve solo al único equipo con 2 paradas y da otro número', () => {
    expect(mtbfFlotaReal(eq, ots)).toBe(600);   // A: (1900 − 1300) ÷ 1 = 600; B y C no aportan
  });
  it('trae intervalo de confianza 95 % que contiene al MTBF y es más ancho con pocas paradas', () => {
    const r = mtbfFlotaAgrupado(eq, ots, hist);
    expect(r.inferior).toBeLessThan(r.mtbf);
    expect(r.superior).toBeGreaterThan(r.mtbf);
    const muchas = ots.concat([ot('A', 40, '25h', 1400), ot('A', 50, '25h', 1500), ot('B', 60, '25h', 5600), ot('B', 70, '25h', 5700), ot('C', 80, '25h', 280)]);
    const r2 = mtbfFlotaAgrupado(eq, muchas, hist);
    expect((r2.superior - r2.inferior) / r2.mtbf).toBeLessThan((r.superior - r.inferior) / r.mtbf);
  });
  it('sin ninguna parada larga: hay horas pero no hay MTBF (no se inventa)', () => {
    const r = mtbfFlotaAgrupado(eq, [ot('A', 10, '2h', 1100), ot('A', 110, '3h', 2100)], hist);
    expect(r.mtbf).toBeNull();
    expect(r.horas).toBe(3000);
    expect(r.paradas).toBe(0);
  });
  it('sin historial de horómetros o sin OT con duración devuelve null', () => {
    expect(mtbfFlotaAgrupado(eq, ots, [])).toBeNull();
    expect(mtbfFlotaAgrupado(eq, [ot('A', 10, '—', 1100)], hist)).toBeNull();
  });
  it('excluye equipos por km y descarta lecturas imposibles', () => {
    const conSalto = hist.concat([{ sigla: 'A', fecha: iso(60), horom: 900000 }]);   // lectura imposible a mitad de ventana
    const r = mtbfFlotaAgrupado(eq.concat([{ sigla: 'K', unidad: 'km' }]), ots, conSalto);
    expect(r.equipos).toBe(3);
    expect(r.horas).toBe(3000);
  });
  it('el umbral de muestra chica por equipo es 3 paradas', () => {
    expect(MTBF_MIN_PARADAS).toBe(3);
  });
});
