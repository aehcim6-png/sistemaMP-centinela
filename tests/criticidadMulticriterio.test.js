// Matriz M2: criticidad de equipos = frecuencia × consecuencia (1-5 cada una, relativas a la flota), comparada con la etiqueta manual.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const hoy = '2026-10-13';
const hist = (sigla, usoDia) => [
  { sigla, fecha: '2025-10-20', horom: 1000 },
  { sigla, fecha: '2026-04-20', horom: 1000 + usoDia * 182 },
  { sigla, fecha: '2026-10-10', horom: 1000 + usoDia * 355 },
];
// 8 equipos: i = 0..7; más fallas y reparaciones más largas hacia el final
const mk = () => {
  const equipos = [], eventos = [];
  let h = [];
  for (let i = 0; i < 8; i++) {
    const sigla = 'EQ-' + i;
    equipos.push({ sigla, tipo: 'Camion', modelo: i < 4 ? 'Modelo A' : 'Modelo B', criticidad: i >= 6 ? 'Crítico' : i >= 3 ? 'Esencial' : 'General', hrsDia: 16 });
    h = h.concat(hist(sigla, 16));
    for (let k = 0; k < i; k++) eventos.push({ sigla, fecha: '2026-0' + (1 + (k % 8)) + '-10', durH: 2 + i * 2 });
  }
  return { equipos, eventos, hist: h };
};
const costoHoraDe = (m) => (m === 'Modelo B' ? 200 : 100);

describe('criticidadEquiposMulticriterio', () => {
  it('ordena de mayor a menor criticidad y asigna niveles Alta/Media/Baja', () => {
    const { equipos, eventos, hist } = mk();
    const r = L.criticidadEquiposMulticriterio(equipos, { eventos, hist, hoy, costoHoraDe });
    expect(r.ok).toBe(true);
    expect(r.filas[0].sigla).toBe('EQ-7');
    expect(r.filas[r.filas.length - 1].puntaje).toBeLessThanOrEqual(r.filas[0].puntaje);
    expect(r.filas.find((f) => f.sigla === 'EQ-7').nivel).toBe('Alta');
    expect(r.filas.find((f) => f.sigla === 'EQ-0').nivel).toBe('Baja');
    expect(r.resumen.Alta + r.resumen.Media + r.resumen.Baja).toBe(r.filas.length);
  });
  it('un equipo sin fallas tiene frecuencia 1 y las escalas están entre 1 y 5', () => {
    const { equipos, eventos, hist } = mk();
    const r = L.criticidadEquiposMulticriterio(equipos, { eventos, hist, hoy, costoHoraDe });
    expect(r.filas.find((f) => f.sigla === 'EQ-0').F).toBe(1);
    r.filas.forEach((f) => { expect(f.F).toBeGreaterThanOrEqual(1); expect(f.F).toBeLessThanOrEqual(5); expect(f.C).toBeGreaterThanOrEqual(1); expect(f.C).toBeLessThanOrEqual(5); });
  });
  it('fallas por 1.000 h usa las horas del horómetro', () => {
    const { equipos, eventos, hist } = mk();
    const f = L.criticidadEquiposMulticriterio(equipos, { eventos, hist, hoy, costoHoraDe }).filas.find((x) => x.sigla === 'EQ-4');
    expect(f.horasOrigen).toBe('horómetro');
    expect(f.fallas).toBe(4);
    expect(f.fallas1000).toBeCloseTo(4 / f.horas * 1000, 6);
    expect(f.horas).toBeGreaterThan(5000);          // ≈16 h/día × 365
  });
  it('un criterio sin variación (mismo costo de hora detenida en todos) se excluye y los pesos se reparten', () => {
    const { equipos, eventos, hist } = mk();
    const r = L.criticidadEquiposMulticriterio(equipos, { eventos, hist, hoy, costoHoraDe: () => 135 });
    expect(r.criteriosSinVariacion).toContain('costoHora');
    expect(r.criteriosUsados).toEqual(expect.arrayContaining(['mttr', 'importancia']));
    expect(r.pesos.mttr + r.pesos.importancia).toBeGreaterThanOrEqual(99);
    expect(r.pesos.costoHora).toBeUndefined();
  });
  it('compara con la etiqueta manual: coincide, más alta o más baja', () => {
    const { equipos, eventos, hist } = mk();
    equipos[7].criticidad = 'General';              // el más crítico por datos, etiquetado como General
    const r = L.criticidadEquiposMulticriterio(equipos, { eventos, hist, hoy, costoHoraDe });
    expect(r.filas.find((f) => f.sigla === 'EQ-7').comparacion).toBe('mas_alta');
    expect(r.comparacion.mas_alta).toBeGreaterThanOrEqual(1);
    equipos[1].criticidad = null;
    const r2 = L.criticidadEquiposMulticriterio(equipos, { eventos, hist, hoy, costoHoraDe });
    expect(r2.filas.find((f) => f.sigla === 'EQ-1').comparacion).toBe('sin_etiqueta');
  });
  it('excluye con motivo a los equipos sin horas confiables y no los inventa', () => {
    const { equipos, eventos, hist } = mk();
    equipos.push({ sigla: 'SIN-HORAS', tipo: 'Camion', modelo: 'Modelo A', criticidad: 'General' });   // sin lecturas ni horas/día
    const r = L.criticidadEquiposMulticriterio(equipos, { eventos, hist, hoy, costoHoraDe });
    expect(r.excluidos.find((x) => x.sigla === 'SIN-HORAS').motivo).toMatch(/horas de operación/);
    expect(r.filas.find((f) => f.sigla === 'SIN-HORAS')).toBeUndefined();
  });
  it('sin horómetro usa las horas/día declaradas y lo informa; equipos en km no entran', () => {
    const { equipos, eventos } = mk();
    equipos.push({ sigla: 'BUS', tipo: 'Bus', modelo: 'Modelo A', unidad: 'km', hrsDia: 300 });
    const r = L.criticidadEquiposMulticriterio(equipos, { eventos, hist: [], hoy, costoHoraDe });
    expect(r.filas.every((f) => f.horasOrigen === 'horas/día declaradas')).toBe(true);
    expect(r.filas.find((f) => f.sigla === 'BUS')).toBeUndefined();
    expect(r.excluidos.find((x) => x.sigla === 'BUS')).toBeUndefined();
  });
  it('un equipo sin reparaciones ni etiqueta queda con un solo criterio y se excluye con su motivo', () => {
    const { equipos, eventos, hist } = mk();
    equipos[0].criticidad = null;                  // EQ-0 no tiene fallas (sin MTTR) ni etiqueta: solo le queda el costo de hora detenida
    const r = L.criticidadEquiposMulticriterio(equipos, { eventos, hist, hoy, costoHoraDe });
    expect(r.filas.find((f) => f.sigla === 'EQ-0')).toBeUndefined();
    expect(r.excluidos.find((x) => x.sigla === 'EQ-0').motivo).toMatch(/menos de 2 criterios/);
  });
  it('con menos de 5 equipos no calcula', () => {
    const { equipos, eventos, hist } = mk();
    const r = L.criticidadEquiposMulticriterio(equipos.slice(0, 4), { eventos, hist, hoy, costoHoraDe });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/al menos 5/);
  });
  it('la matriz 5×5 ubica a cada equipo en su celda frecuencia × consecuencia', () => {
    const { equipos, eventos, hist } = mk();
    const r = L.criticidadEquiposMulticriterio(equipos, { eventos, hist, hoy, costoHoraDe });
    let total = 0; r.matriz.forEach((fila) => fila.forEach((c) => { total += c.length; }));
    expect(total).toBe(r.filas.length);
    const f7 = r.filas.find((f) => f.sigla === 'EQ-7');
    expect(r.matriz[f7.F - 1][Math.min(5, Math.max(1, Math.round(f7.C))) - 1]).toContain('EQ-7');
  });
});
