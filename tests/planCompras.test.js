// «Qué comprar» (24-oct-2026): filtros, lubricantes, neumáticos y desgaste a 30 / 180 / 365 días, restando existencias y avisando cuando los datos están viejos.
import { describe, it, expect } from 'vitest';
import { planCompras, demandaPlanificadaPM, plazoEntregaCompras, planReposicionPM } from '../logic.js';

const HOY = '2026-10-24';
const stk = [
  { _id: 'f1', nParte: 'LF9009', descripcion: 'Filtro aceite', stockBodega: 4, pendiente: 2, consumoMes: 0, precioUnit: 10000 },
  { _id: 'f2', nParte: 'FS1212', descripcion: 'Filtro combustible', stockBodega: 0, pendiente: 0, consumoMes: 3, precioUnit: 0 },
  { _id: 'f3', nParte: 'XX', descripcion: 'Sin uso', stockBodega: 5, pendiente: 0, consumoMes: 0, precioUnit: 100 },
];
const lub = [{ _id: 'l1', nombre: 'Aceite 15W40', unidad: 'L', stock: 100, consumoMes: 0, precio: 3000 }];
const dem = {
  items: {
    'filtro:0': { tipo: 'filtro', idx: 0, eventos: [{ dias: 10, cant: 2 }, { dias: 100, cant: 3 }, { dias: 300, cant: 4 }] },
    'lubricante:0': { tipo: 'lubricante', idx: 0, eventos: [{ dias: 5, cant: 60 }, { dias: 120, cant: 60 }, { dias: 200, cant: 60 }] },
  },
  sinStock: { 'Pasador raro': 2 }, sinRitmo: ['XX-1'],
};

describe('planCompras: filtros y lubricantes', () => {
  const r = planCompras({ hoy: HOY, demanda: dem, stk, lub, equipos: [], neu: {}, desgaste: [] });
  it('resta bodega + pendiente a lo que consumen los PM de cada horizonte', () => {
    const f = r.filtros.find(x => x.nParte === 'LF9009');
    expect(f.necesidad).toEqual({ mes: 2, semestre: 5, anio: 9 });
    expect(f.posicion).toBe(6);
    expect(f.comprar).toEqual({ mes: 0, semestre: 0, anio: 3 });
    expect(f.costo.anio).toBe(30000);
  });
  it('un ítem sin PM pero con consumo histórico usa el histórico por meses', () => {
    const f = r.filtros.find(x => x.nParte === 'FS1212');
    expect(f.necesidad.mes).toBe(3);
    expect(f.necesidad.semestre).toBe(18);
    expect(f.comprar.anio).toBe(37);                 // 3 al mes × 365/30 = 36,5 → 37
    expect(f.base.mes).toBe('historico');
    expect(f.costo.anio).toBeNull();                     // sin precio: no se inventa
  });
  it('no mezcla plan e histórico: toma el mayor, no la suma', () => {
    const s2 = [{ ...stk[0], consumoMes: 1 }];
    const r2 = planCompras({ hoy: HOY, demanda: dem, stk: s2, lub: [], equipos: [], neu: {}, desgaste: [] });
    expect(r2.filtros[0].necesidad.semestre).toBe(6);    // max(plan 5, histórico 6), no 11
  });
  it('los ítems que no se consumen no aparecen', () => {
    expect(r.filtros.some(x => x.nParte === 'XX')).toBe(false);
  });
  it('lubricantes en su unidad y restando stock', () => {
    const l = r.lubricantes[0];
    expect(l.unidad).toBe('L');
    expect(l.necesidad.anio).toBe(180);
    expect(l.comprar).toEqual({ mes: 0, semestre: 20, anio: 80 });
  });
  it('totales: suma solo lo que tiene precio y cuenta lo que no', () => {
    expect(r.totales.anio.sinPrecio).toBe(1);
    expect(r.totales.anio.costo).toBe(30000 + 80 * 3000);
    expect(r.totales.mes.filtros).toBe(1);               // solo FS1212 (compra 3)
  });
});

describe('planCompras: neumáticos', () => {
  const items = [
    { sigla: 'A', posicion: '1', medida: '295/80R22.5', base: '2026-08-01', dias: 20, precio: 400000 },   // venció el 21-ago
    { sigla: 'B', posicion: '2', medida: '295/80R22.5', base: '2026-10-20', dias: 10, precio: 400000 },   // 30-oct: entra al mes
    { sigla: 'C', posicion: '3', medida: '295/80R22.5', base: '2026-10-20', dias: 100, precio: 400000 },  // semestre
    { sigla: 'D', posicion: '1', medida: '1400R24', base: '2026-10-20', dias: 300, precio: 2000000 },     // año
  ];
  const r = planCompras({ hoy: HOY, demanda: { items: {} }, stk: [], lub: [], equipos: [], neu: { items, stock: [{ medida: '295/80r22.5 ' }, { medida: '1400R24' }], estimados: 3, ultimaGlobal: '2026-08-01' }, desgaste: [] });
  it('cuenta por medida los que vencen dentro del horizonte, con los vencidos en todos', () => {
    const m = r.neumaticos.find(x => x.medida === '295/80R22.5');
    expect(m.necesidad).toEqual({ mes: 2, semestre: 3, anio: 3 });
    expect(m.vencidos).toBe(1);
  });
  it('resta las existencias de esa medida (sin distinguir mayúsculas ni espacios)', () => {
    const m = r.neumaticos.find(x => x.medida === '295/80R22.5');
    expect(m.existencias).toBe(1);
    expect(m.comprar).toEqual({ mes: 1, semestre: 2, anio: 2 });
    const g = r.neumaticos.find(x => x.medida === '1400R24');
    expect(g.comprar.anio).toBe(0);
  });
  it('avisa de mediciones viejas y de los que quedan fuera por no tener mediciones', () => {
    const t = r.avisos.map(a => a.tipo);
    expect(t).toContain('neumaticos');
    expect(t).toContain('neuSinMedicion');
  });
});

describe('planCompras: neumáticos solo en existencias', () => {
  it('una medida que solo está en existencias no rompe ni aparece (no se cambia ninguno)', () => {
    const r = planCompras({ hoy: HOY, neu: { items: [], stock: [{ medida: '1400R24' }] } });
    expect(r.neumaticos).toEqual([]);
  });
});

describe('planCompras: desgaste y avisos', () => {
  it('pasa solo los desgastes con datos suficientes y cuenta los que no', () => {
    const r = planCompras({ hoy: HOY, demanda: { items: {} }, stk: [], lub: [], equipos: [], neu: {},
      desgaste: [{ tipo: 'EXC', pieza: 'Zapata', nEventos: 9, nMeses: 6, lambda: 1.5, consumoMes: 2, consumoSemestre: 9, consumoAnual: 18 }, { tipo: 'CAR', pieza: 'Uña', nEventos: 1, nMeses: 1, lambda: null }] });
    expect(r.desgaste).toEqual([{ tipo: 'EXC', pieza: 'Zapata', nEventos: 9, nMeses: 6, mes: 2, semestre: 9, anio: 18 }]);
    expect(r.avisos.some(a => a.tipo === 'desgaste')).toBe(true);
  });
  it('avisa de horómetros sin actualizar, equipos sin ritmo y pautas sin vincular', () => {
    const eqs = [{ sigla: 'A', hrsDia: 20, fechaHorom: '2026-08-20' }, { sigla: 'B', hrsDia: 20, fechaHorom: '2026-10-23' }, { sigla: 'C', hrsDia: 0 }];
    const r = planCompras({ hoy: HOY, demanda: dem, stk: [], lub: [], equipos: eqs, neu: {}, desgaste: [] });
    const h = r.avisos.find(a => a.tipo === 'horometro');
    expect(h.n).toBe(1);
    expect(h.de).toBe(2);                                // C no tiene horas por día: no cuenta
    expect(r.avisos.map(a => a.tipo)).toEqual(expect.arrayContaining(['sinRitmo', 'sinStock']));
  });
  it('sin datos no inventa: todo vacío y solo avisa que el plazo es un supuesto', () => {
    const r = planCompras({ hoy: HOY });
    expect(r.filtros).toEqual([]);
    expect(r.neumaticos).toEqual([]);
    expect(r.avisos.map(a => a.tipo)).toEqual(['plazo']);   // sin historial de compras: lo dice
    expect(r.totales.anio.costo).toBe(0);
  });
});

// Compras recibidas: cada OC con su plazo (días) y monto. dias en el formato real «X dias Yh Zm».
function compras(lista) {
  const out = [];
  lista.forEach(([oc, dias, monto, lineas = 1], i) => {
    for (let k = 0; k < lineas; k++) out.push({ estado: 'Recepcion Bodega', oc, pedido: 'P' + i, tiempoRespuesta: dias + ' dias 0h 0m', costo: monto / lineas });
  });
  return out;
}
const muchas = (n, dias, monto, pref) => Array.from({ length: n }, (_, i) => [pref + i, dias + (i % 5), monto]);

describe('plazoEntregaCompras', () => {
  const cd = compras([...muchas(40, 10, 500000, 'a'), ...muchas(40, 20, 2000000, 'b'), ...muchas(40, 30, 5000000, 'c')]);
  const pe = plazoEntregaCompras(cd);
  it('separa por monto de la OC y dice quién la aprueba', () => {
    expect(pe.bandas.map(b => [b.clave, b.aprueba, b.n])).toEqual([['hasta1', 'subgerente', 40], ['hasta3', 'gerente', 40], ['sobre3', 'gerente general', 40]]);
    expect(pe.para(800000).dias).toBe(12);               // mediana de 10..14
    expect(pe.para(2500000).dias).toBe(22);
    expect(pe.para(9000000).dias).toBe(32);
    expect(pe.para(9000000).peor).toBeGreaterThanOrEqual(pe.para(9000000).dias);
  });
  it('las líneas de una misma OC cuentan una vez, con el mayor plazo y la suma de sus montos', () => {
    const una = plazoEntregaCompras([{ estado: 'Recepcion Bodega', oc: 'X', tiempoRespuesta: '10 dias', costo: 700000 }, { estado: 'Recepcion Bodega', oc: 'X', tiempoRespuesta: '30 dias', costo: 700000 }]);
    expect(una.global.n).toBe(1);
    expect(una.global.mediana).toBe(30);
    expect(una.bandas[1].n).toBe(1);                     // 1,4 millones: banda del gerente
  });
  it('solo cuenta lo ya recibido', () => {
    const pe2 = plazoEntregaCompras([{ estado: 'OC Firmada', oc: 'Y', tiempoRespuesta: '99 dias', costo: 1 }]);
    expect(pe2.n).toBe(0);
  });
  it('con pocas OC en la banda usa todas; sin monto usa todas; sin historial dice que es supuesto', () => {
    const poco = plazoEntregaCompras(compras([...muchas(60, 10, 500000, 'a'), ...muchas(5, 80, 9000000, 'c')]));
    expect(poco.para(9000000).banda).toBeNull();
    expect(poco.para(0).banda).toBeNull();
    const vacio = plazoEntregaCompras([]);
    expect(vacio.para(1000)).toMatchObject({ dias: 34, supuesto: true, n: 0 });
  });
});

describe('plazo real en el plan de reposición y en «Qué comprar»', () => {
  const pe = plazoEntregaCompras(compras([...muchas(60, 10, 500000, 'a')]));      // 10..14 días, mediana 12
  const stk1 = [{ _id: 'f1', nParte: 'LF9009', descripcion: 'Filtro aceite', stockBodega: 1, pendiente: 0, precioUnit: 10000 }];
  const dem1 = { items: { 'filtro:0': { tipo: 'filtro', idx: 0, eventos: [{ dias: 20, cant: 2 }, { dias: 60, cant: 2 }] } }, sinStock: {}, sinRitmo: [] };
  it('planReposicionPM usa el plazo real en vez de 34 días y da la fecha de pedir antes de', () => {
    const sin = planReposicionPM(dem1, stk1, [], { cobertura: 30 })[0];
    const con = planReposicionPM(dem1, stk1, [], { cobertura: 30, plazoFn: pe.para, hoy: '2026-10-24' })[0];
    expect(sin.lead).toBe(34);
    expect(con.lead).toBe(12);
    expect(con.leadFuente).toMatch(/mediana de 60 OC/);
    expect(con.pedirAntesDias).toBe(8);                  // quiebre en 20 d (1 de stock, el primer PM gasta 2) − 12
    expect(con.pedirAntesFecha).toBe('2026-11-01');
    expect(con.leadPeor).toBeGreaterThanOrEqual(con.lead);
  });
  it('un plazo propio del ítem manda sobre el real', () => {
    const r = planReposicionPM(dem1, [{ ...stk1[0], leadTime: 50 }], [], { plazoFn: pe.para, hoy: '2026-10-24' })[0];
    expect(r.lead).toBe(50);
    expect(r.leadPropio).toBe(true);
  });
  it('marca riesgo de demora si el peor caso ya no llega a tiempo aunque el típico sí', () => {
    const lento = plazoEntregaCompras(compras([...muchas(60, 10, 500000, 'a'), ...Array.from({ length: 12 }, (_, i) => ['z' + i, 90, 500000])]));
    const r = planReposicionPM(dem1, stk1, [], { plazoFn: lento.para, hoy: '2026-10-24' })[0];
    expect(r.pedirAntesPeorDias).toBeLessThan(0);
    expect(r.estado).not.toBe('pedir_ya');
    expect(r.riesgoDemora).toBe(true);
  });
  it('planCompras: pedir antes de = primer quiebre − plazo real, en filtros y en neumáticos', () => {
    const r = planCompras({ hoy: '2026-10-24', plazoFn: pe.para, demanda: dem1, stk: stk1, lub: [], equipos: [], desgaste: [],
      neu: { items: [{ sigla: 'A', posicion: '1', medida: '1400R24', base: '2026-10-24', dias: 40, precio: 2000000 }], stock: [] } });
    expect(r.filtros[0].quiebreDias).toBe(20);
    expect(r.filtros[0].pedirAntes).toMatchObject({ dias: 8, fecha: '2026-11-01', ya: false });
    expect(r.filtros[0].plazo.fuente).toMatch(/mediana de 60 OC/);
    const n = r.neumaticos[0];
    expect(n.quiebreDias).toBe(40);
    expect(n.pedirAntes.dias).toBe(n.plazo.dias ? 40 - n.plazo.dias : null);
    expect(r.avisos.some(a => a.tipo === 'plazo')).toBe(false);
  });
  it('lo que ya debió pedirse sale como «ya» y sin plazoFn el plazo figura como supuesto', () => {
    const r = planCompras({ hoy: '2026-10-24', demanda: { items: { 'filtro:0': { tipo: 'filtro', idx: 0, eventos: [{ dias: 5, cant: 2 }] } } }, stk: stk1, lub: [], equipos: [], neu: {}, desgaste: [] });
    expect(r.filtros[0].pedirAntes.ya).toBe(true);
    expect(r.filtros[0].plazo).toMatchObject({ dias: 34, supuesto: true });
    expect(r.avisos.some(a => a.tipo === 'plazo')).toBe(true);
  });
});
