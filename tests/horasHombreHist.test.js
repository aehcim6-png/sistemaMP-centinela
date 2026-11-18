import { describe, it, expect } from 'vitest';
import { horasHombreHist, actividadPorPeriodo } from '../logic.js';

// «horasHH» de correctivos_historico = columna «Horas (h/h)» del Excel ORDENES_DE_TRABAJO: horas de trabajo de la persona. Solo las OT del histórico la traen.
const h = [
  { sistema: 'Sist. Eléctrico', horasHH: 2, claseOT: 'correctiva', fecha: '2024-03-05' },
  { sistema: 'Sistema Eléctrico', horasHH: 1, claseOT: 'preventiva', fecha: '2024-03-06' },
  { sistema: 'Neumáticos', horasHH: 0, claseOT: 'correctiva', fecha: '2024-03-07' },       // 0 h: no cuenta
  { sistema: 'Neumáticos', horasHH: 3.5, descripcion: 'se repara fuga', fecha: '2024-04-01' }, // sin claseOT: se deduce del texto → correctiva
  { sistema: 'Hidráulico', horasHH: null, claseOT: 'correctiva', fecha: '2024-04-02' },     // sin horas: no cuenta
  { sistema: null, horasHH: 4, claseOT: 'desgaste', fecha: '2025-01-10' },
];

describe('horasHombreHist: horas hombre del histórico por sistema y clase', () => {
  const r = horasHombreHist(h);
  it('total: solo las OT con horas mayores que cero; promedio por OT', () => {
    expect(r.total).toEqual({ ots: 4, hh: 10.5, hhPorOT: 2.6 });
  });
  it('une «Sist. Eléctrico» y «Sistema Eléctrico» en un solo sistema y ordena por horas', () => {
    const e = r.porSistema.find(x => /ctrico/.test(x.sistema));
    expect(e).toMatchObject({ ots: 2, hh: 3, hhPorOT: 1.5, hhCorrectiva: 2 });
    expect(r.porSistema.filter(x => /ctrico/.test(x.sistema))).toHaveLength(1);
    expect(r.porSistema.map(x => x.hh)).toEqual([...r.porSistema.map(x => x.hh)].sort((a, b) => b - a));
  });
  it('sin claseOT usa el texto para clasificar: «se repara fuga» es correctiva', () => {
    const n = r.porSistema.find(x => /Neum/.test(x.sistema));
    expect(n).toMatchObject({ ots: 1, hh: 3.5, hhCorrectiva: 3.5 });
  });
  it('una OT sin sistema queda como «(sin sistema)»', () => {
    expect(r.porSistema.find(x => x.sistema === '(sin sistema)')).toMatchObject({ ots: 1, hh: 4, hhCorrectiva: 0 });
  });
  it('por clase de OT', () => {
    expect(Object.fromEntries(r.porClase.map(c => [c.clase, c.hh]))).toEqual({ correctiva: 5.5, desgaste: 4, preventiva: 1 });
  });
  it('sin datos devuelve ceros sin romperse', () => {
    expect(horasHombreHist([]).total).toEqual({ ots: 0, hh: 0, hhPorOT: null });
    expect(horasHombreHist(null).porSistema).toEqual([]);
  });
});

describe('actividadPorPeriodo: columna de horas hombre', () => {
  it('suma las horas del histórico por período y en el total; las OT vigentes no aportan horas', () => {
    const a = actividadPorPeriodo({ otHist: h, ot: [{ tipo: 'Correctivo', fecha: '2024-03-10', horasHH: 99 }] }, 'mes');
    expect(a.filas.find(f => f.periodo === '2024-03').horasHH).toBe(3);
    expect(a.filas.find(f => f.periodo === '2024-04').horasHH).toBe(3.5);
    expect(a.filas.find(f => f.periodo === '2025-01').horasHH).toBe(4);
    expect(a.total.horasHH).toBe(10.5);
    expect(actividadPorPeriodo({ otHist: h }, 'anio').filas.find(f => f.periodo === '2024').horasHH).toBe(6.5);
  });
  it('sin histórico las horas son cero', () => {
    expect(actividadPorPeriodo({}, 'mes').total.horasHH).toBe(0);
  });
});
