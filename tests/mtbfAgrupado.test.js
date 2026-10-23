// MTBF de flota por horas operadas ÷ paradas largas (23-oct-2026), medido en una VENTANA COMÚN (24-oct-2026): horas y paradas del mismo período, solo meses con OT registradas.
import { describe, it, expect } from 'vitest';
import { mtbfFlotaAgrupado, mtbfFlotaReal, MTBF_MIN_PARADAS, MTBF_OT_MIN_MES, MTBF_FLOTA_MIN_PARADAS } from '../logic.js';

const iso = (n) => new Date(Date.UTC(2026, 0, 1) + n * 864e5).toISOString().slice(0, 10);
// lecturas diarias de horómetro, 10 h por día, del día 0 (1-ene) al día 180 (30-jun)
const lecturas = (sigla, base) => Array.from({ length: 181 }, (_, d) => ({ sigla, fecha: iso(d), horom: base + d * 10 }));
const ot = (sigla, dia, duracion, horom) => ({ sigla, tipo: 'Correctivo', fecha: iso(dia), duracion, horom });
// OT de relleno (no son fallas) para dar un mes por «con OT registradas»
const relleno = (meses) => meses.flatMap((m) => Array.from({ length: MTBF_OT_MIN_MES }, (_, i) => ({ sigla: 'A', tipo: 'Engrase General', fecha: `${m}-${String(i + 1).padStart(2, '0')}` })));
const ENE_ABR = relleno(['2026-01', '2026-02', '2026-03', '2026-04']);

describe('mtbfFlotaAgrupado', () => {
  const eq = [{ sigla: 'A' }, { sigla: 'B' }, { sigla: 'C' }];
  const hist = [].concat(lecturas('A', 1000), lecturas('B', 5000), lecturas('C', 200));
  const ots = [
    ot('A', 10, '2h', 1100), ot('A', 30, '30h', 1300), ot('A', 90, '50h', 1900),   // A: 2 paradas largas (31-ene y 1-abr)
    ot('C', 110, '24h', 300),                                                       // C: 1 parada larga (21-abr)
    ot('B', 50, '3h', 5500),                                                        // B: ninguna parada larga (solo una corta)
  ].concat(ENE_ABR);
  // ventana: ene a abr (los 4 meses con OT) = del 1-ene al 30-abr: 119 días × 10 h = 1.190 h por equipo
  it('horas operadas de todos los equipos ÷ paradas largas, incluidos los que tienen 0 o 1', () => {
    const r = mtbfFlotaAgrupado(eq, ots, hist);
    expect(r.equipos).toBe(3);
    expect(r.horas).toBe(3570);
    expect(r.paradas).toBe(3);
    expect(r.mtbf).toBe(1190);
    expect(r.equiposSinParadas).toBe(1);
    expect(r.ini).toBe('2026-01-01');
    expect(r.fin).toBe('2026-04-30');
    expect(r.meses).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
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
    const r = mtbfFlotaAgrupado(eq, [ot('A', 10, '2h', 1100), ot('A', 100, '3h', 2100)].concat(ENE_ABR), hist);
    expect(r.mtbf).toBeNull();
    expect(r.horas).toBe(3570);
    expect(r.paradas).toBe(0);
  });
  it('sin historial de horómetros, sin OT con duración o sin ningún mes con OT registradas devuelve null', () => {
    expect(mtbfFlotaAgrupado(eq, ots, [])).toBeNull();
    expect(mtbfFlotaAgrupado(eq, [ot('A', 10, '—', 1100)].concat(ENE_ABR), hist)).toBeNull();
    expect(mtbfFlotaAgrupado(eq, [ot('A', 10, '30h', 1100)], hist)).toBeNull();
  });
  it('excluye equipos por km y descarta lecturas imposibles', () => {
    const conSalto = hist.concat([{ sigla: 'A', fecha: iso(60), horom: 900000 }]);   // lectura imposible a mitad de ventana
    const r = mtbfFlotaAgrupado(eq.concat([{ sigla: 'K', unidad: 'km' }]), ots, conSalto);
    expect(r.equipos).toBe(3);
    expect(r.horas).toBe(3570);
  });
  it('el umbral de muestra chica por equipo es 3 paradas', () => {
    expect(MTBF_MIN_PARADAS).toBe(3);
  });
});

describe('mtbfFlotaAgrupado: ventana común de horas y paradas', () => {
  const eq = [{ sigla: 'A' }];
  const hist = lecturas('A', 1000);
  it('un mes sin OT registradas no aporta ni horas ni paradas (nadie cargó OT: no se verían paradas)', () => {
    // OT registradas solo en enero y marzo; febrero sin OT. La parada de febrero (28-feb = día 58) no cuenta y sus horas tampoco.
    const base = relleno(['2026-01', '2026-03']);
    const r = mtbfFlotaAgrupado(eq, base.concat([ot('A', 5, '30h', 1050), ot('A', 58, '30h', 1580), ot('A', 70, '30h', 1700)]), hist);
    expect(r.meses).toEqual(['2026-01', '2026-03']);
    expect(r.paradas).toBe(2);
  });
  it('las paradas de antes de la primera lectura del horómetro no se cuentan (las horas no existen)', () => {
    const histTarde = lecturas('A', 1000).filter((h) => h.fecha >= '2026-03-01');
    const antes = relleno(['2025-11', '2025-12', '2026-03']);
    const paradasViejas = [{ sigla: 'A', tipo: 'Correctivo', fecha: '2025-11-10', duracion: '40h' }, { sigla: 'A', tipo: 'Correctivo', fecha: '2025-12-10', duracion: '40h' }];
    const r = mtbfFlotaAgrupado(eq, antes.concat(paradasViejas, [ot('A', 70, '30h', 1700)]), histTarde);
    expect(r.paradas).toBe(1);
    expect(r.meses).toEqual(['2026-03']);
    expect(r.horas).toBe(300);   // 1-mar a 31-mar: 30 días × 10 h
  });
  it('con menos de 10 paradas se marca como muestra chica; con 10 o más no', () => {
    const base = ENE_ABR;
    const pocas = mtbfFlotaAgrupado(eq, base.concat([ot('A', 5, '30h', 1050)]), hist);
    expect(pocas.muestraChica).toBe(true);
    const diez = Array.from({ length: MTBF_FLOTA_MIN_PARADAS }, (_, i) => ot('A', 5 + i * 10, '30h', 1050 + i * 100));
    expect(mtbfFlotaAgrupado(eq, base.concat(diez), hist).muestraChica).toBe(false);
  });
  it('lecturas espaciadas: el avance cae en el mes de la lectura y el total del período es el correcto', () => {
    const esp = [{ sigla: 'A', fecha: '2026-01-01', horom: 1000 }, { sigla: 'A', fecha: '2026-03-31', horom: 1600 }];
    const r = mtbfFlotaAgrupado(eq, relleno(['2026-01', '2026-02', '2026-03']).concat([ot('A', 40, '30h', 1400)]), esp);
    expect(r.horas).toBe(600);
    expect(r.paradas).toBe(1);
    expect(r.mtbf).toBe(600);
  });
});
