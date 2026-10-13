// Sankey de horas de reparación y costo anual: construcción de flujos y posiciones del diagrama.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const equipos = [
  { sigla: 'CN-1', tipo: 'Camion' }, { sigla: 'CN-2', tipo: 'Camion' }, { sigla: 'CF-1', tipo: 'Cargador' }, { sigla: 'BD-1', tipo: 'Bulldozer' },
];
const hoy = (s) => s;

describe('sankeyHorasReparacion', () => {
  const eventos = [
    { sigla: 'CN-1', fecha: '2026-05-01', durH: 10, componente: 'Motor' },
    { sigla: 'CN-1', fecha: '2026-06-01', durH: 6, componente: 'Turbo' },
    { sigla: 'CN-2', fecha: '2026-06-02', durH: 4, componente: 'Motor' },
    { sigla: 'CF-1', fecha: '2026-06-03', durH: 8, componente: '' },
    { sigla: 'BD-1', fecha: '2026-06-04', durH: 2, componente: 'Frenos' },
    { sigla: 'BD-1', fecha: '2025-01-04', durH: 99, componente: 'Frenos' },        // fuera de ventana
    { sigla: 'CN-2', fecha: '2026-06-05', durH: null, componente: 'Motor' },        // sin duración: no se inventa
  ];
  it('suma las horas registradas por tipo → equipo → componente y conserva el total', () => {
    const r = L.sankeyHorasReparacion(eventos, equipos, { desde: '2025-10-13', hasta: '2026-10-13' });
    expect(r.meta.total).toBe(30);
    expect(r.meta.reparaciones).toBe(5);
    expect(r.meta.sinDuracion).toBe(1);
    const v = (a, b) => (r.links.find((l) => l.origen === a && l.destino === b) || {}).valor;
    expect(v('Camion', 'CN-1')).toBe(16);
    expect(v('CN-1', 'Motor')).toBe(10);
    expect(v('CN-1', 'Turbo')).toBe(6);
    expect(v('CN-2', 'Motor')).toBe(4);
    const colTipo = r.links.filter((l) => r.columnas[l.origen] === 0).reduce((a, l) => a + l.valor, 0);
    const colComp = r.links.filter((l) => r.columnas[l.destino] === 2).reduce((a, l) => a + l.valor, 0);
    expect(colTipo).toBe(30);
    expect(colComp).toBe(30);
  });
  it('lo que no tiene componente se muestra como "Sin componente registrado" y no se esconde en "Otros"', () => {
    const r = L.sankeyHorasReparacion(eventos, equipos, { topComponentes: 1 });
    expect(r.links.some((l) => l.destino === 'Sin componente registrado' && l.valor === 8)).toBe(true);
    expect(r.links.some((l) => l.destino === 'Otros componentes')).toBe(true);
  });
  it('los equipos fuera del top se agrupan en "Otros equipos"', () => {
    const r = L.sankeyHorasReparacion(eventos, equipos, { desde: '2025-10-13', hasta: '2026-10-13', topEquipos: 2 });
    const eq1 = r.links.filter((l) => r.columnas[l.destino] === 1).map((l) => l.destino);
    expect(eq1).toContain('Otros equipos');
    expect(r.meta.otrosEquipos).toBe(2);
    expect(r.meta.total).toBe(30);
  });
});

describe('sankeyCostoTCO', () => {
  const res = [
    { sigla: 'CN-1', tipo: 'Camion', capitalAnual: 600, matAnual: 300, detAnual: 100 },
    { sigla: 'CN-2', tipo: 'Camion', capitalAnual: 400, matAnual: 200, detAnual: 0 },
    { sigla: 'CF-1', tipo: 'Cargador', capitalAnual: null, matAnual: 150, detAnual: 50 },     // sin valor de capital: solo mantención y detención
    { sigla: 'XX', tipo: 'Cargador', capitalAnual: 0, matAnual: 0, detAnual: 0 },               // sin costo: no entra
  ];
  it('reparte el costo anual en concepto → tipo → equipo sin perder ni inventar pesos', () => {
    const r = L.sankeyCostoTCO(res, {});
    expect(r.meta.total).toBe(1800);
    expect(r.meta.equipos).toBe(3);
    expect(r.meta.sinCapital).toBe(1);
    const v = (a, b) => (r.links.find((l) => l.origen === a && l.destino === b) || {}).valor;
    expect(v('Capital (amortización)', 'Camion')).toBe(1000);
    expect(v('Mantención (repuestos y servicios)', 'Camion')).toBe(500);
    expect(v('Detención por falla', 'Cargador')).toBe(50);
    expect(v('Camion', 'CN-1')).toBe(1000);
    expect(r.links.some((l) => l.origen === 'Capital (amortización)' && l.destino === 'Cargador')).toBe(false);
    const ultimo = r.links.filter((l) => r.columnas[l.destino] === 2).reduce((a, l) => a + l.valor, 0);
    expect(ultimo).toBe(1800);
  });
});

describe('sankeyLayout', () => {
  const links = [
    { origen: 'A', destino: 'M1', valor: 30 }, { origen: 'B', destino: 'M1', valor: 10 }, { origen: 'B', destino: 'M2', valor: 20 },
    { origen: 'M1', destino: 'Z1', valor: 25 }, { origen: 'M1', destino: 'Z2', valor: 15 }, { origen: 'M2', destino: 'Z2', valor: 20 },
  ];
  const col = { A: 0, B: 0, M1: 1, M2: 1, Z1: 2, Z2: 2 };
  const lay = L.sankeyLayout(links, col, { ancho: 600, alto: 300, anchoNodo: 10, separacion: 10 });
  it('cada nodo mide lo que fluye por él y la escala es la misma en todo el diagrama', () => {
    const n = (id) => lay.nodos.find((x) => x.id === id);
    expect(n('A').h / n('A').valor).toBeCloseTo(lay.ky, 6);
    expect(n('M1').valor).toBe(40);
    expect(n('M1').h).toBeCloseTo(40 * lay.ky, 6);
    expect(n('Z2').h).toBeCloseTo(35 * lay.ky, 6);
  });
  it('los nodos de una columna no se superponen y caben en el alto', () => {
    [0, 1, 2].forEach((c) => {
      const g = lay.nodos.filter((x) => x.col === c).sort((a, b) => a.y - b.y);
      for (let i = 1; i < g.length; i++) expect(g[i].y).toBeGreaterThanOrEqual(g[i - 1].y + g[i - 1].h - 1e-6);
      g.forEach((x) => { expect(x.y).toBeGreaterThanOrEqual(-1e-6); expect(x.y + x.h).toBeLessThanOrEqual(300 + 1e-6); });
    });
  });
  it('el ancho de cada cinta es proporcional a su valor y las cintas de un nodo caben dentro de él', () => {
    lay.cintas.forEach((c) => expect(c.w).toBeCloseTo(c.valor * lay.ky, 6));
    lay.nodos.forEach((n) => {
      const sal = lay.cintas.filter((c) => c.origen === n.id), ent = lay.cintas.filter((c) => c.destino === n.id);
      sal.forEach((c) => { expect(c.y0).toBeGreaterThanOrEqual(n.y - 1e-6); expect(c.y0 + c.w).toBeLessThanOrEqual(n.y + n.h + 1e-6); });
      ent.forEach((c) => { expect(c.y1).toBeGreaterThanOrEqual(n.y - 1e-6); expect(c.y1 + c.w).toBeLessThanOrEqual(n.y + n.h + 1e-6); });
    });
  });
  it('las cintas no se solapan entre sí dentro de un mismo nodo', () => {
    lay.nodos.forEach((n) => {
      const sal = lay.cintas.filter((c) => c.origen === n.id).sort((a, b) => a.y0 - b.y0);
      for (let i = 1; i < sal.length; i++) expect(sal[i].y0).toBeGreaterThanOrEqual(sal[i - 1].y0 + sal[i - 1].w - 1e-6);
    });
  });
  it('las columnas quedan de izquierda a derecha y sin datos no dibuja nada', () => {
    const xs = [0, 1, 2].map((c) => lay.nodos.find((x) => x.col === c).x);
    expect(xs[0]).toBeLessThan(xs[1]); expect(xs[1]).toBeLessThan(xs[2]);
    expect(xs[2] + 10).toBeCloseTo(600, 6);
    expect(L.sankeyLayout([], {}).nodos).toEqual([]);
  });
});
