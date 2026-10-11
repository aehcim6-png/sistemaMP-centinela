// Reposición alimentada por el programa de PM: demanda planificada de filtros y lubricantes a partir de los PM calendarizados y sus pautas.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const hoy = new Date('2026-10-11T12:00:00Z');

describe('pmProgramadosEquipo', () => {
  const e = { sigla: 'CN-1', frecPM: 250, hrsDia: 20, horomActual: 1100, horomProxPM: 1250 };
  it('recorre los PM del horizonte con su tipo (PM1, PM2, PM1, PM4…) y la fecha según el ritmo diario', () => {
    const r = L.pmProgramadosEquipo(e, hoy, 50);
    expect(r.map(x => x.pm)).toEqual(['PM1', 'PM2', 'PM1', 'PM4']);
    expect(r[0]).toMatchObject({ horom: 1250, dias: 8, fecha: '2026-10-19' }); // 150 h ÷ 20 h/día = 7,5 → 8
    expect(r.map(x => x.horom)).toEqual([1250, 1500, 1750, 2000]);
    expect(L.pmProgramadosEquipo(e, hoy, 100).map(x => x.pm)).toEqual(['PM1', 'PM2', 'PM1', 'PM4', 'PM1', 'PM2', 'PM1', 'PM3']); // 2250…3000: el múltiplo de 1.000 es PM3
    r.forEach((x, i) => { if (i) expect(x.dias).toBeGreaterThan(r[i - 1].dias); });
  });
  it('respeta el horizonte: no devuelve PM más allá', () => {
    expect(L.pmProgramadosEquipo(e, hoy, 7)).toEqual([]);
    expect(L.pmProgramadosEquipo(e, hoy, 20).map(x => x.horom)).toEqual([1250, 1500]);
  });
  it('sin ritmo diario no se puede calendarizar: vacío (no inventa un ritmo)', () => {
    expect(L.pmProgramadosEquipo(Object.assign({}, e, { hrsDia: 0 }), hoy, 100)).toEqual([]);
    expect(L.pmProgramadosEquipo(null, hoy, 100)).toEqual([]);
  });
  it('sin horomProxPM válido usa la grilla oficial desde el horómetro actual (frecPM por defecto 250)', () => {
    const r = L.pmProgramadosEquipo({ sigla: 'X', hrsDia: 10, horomActual: 1100 }, hoy, 60);
    expect(r[0].horom).toBe(1250);
  });
  it('un PM del múltiplo de 2.000 es PM4', () => {
    const r = L.pmProgramadosEquipo({ sigla: 'X', frecPM: 250, hrsDia: 25, horomActual: 1900, horomProxPM: 2000 }, hoy, 10);
    expect(r[0].pm).toBe('PM4');
  });
});

describe('pautaResolverStock (mismo criterio que descontarStock)', () => {
  const stk = [
    { _id: 's1', nParte: '600-211-1341', codAlt: 'LF9009', descripcion: 'Filtro aceite motor' },
    { _id: 's2', nParte: '600-185-6110', codAlt: '', descripcion: 'Filtro aire primario' },
    { _id: 's3', nParte: '-', codAlt: '', descripcion: 'Filtro hidraulico principal tanque' }
  ];
  const lub = [{ _id: 'l1', nombre: 'Aceite Motor 15W40' }, { _id: 'l2', nombre: 'Aceite Hidraulico 68' }];
  it('por N° de parte principal o alternativo', () => {
    expect(L.pautaResolverStock({ rep: 'Filtro aceite 600-211-1341' }, stk, lub, [])).toEqual({ tipo: 'filtro', idx: 0 });
    expect(L.pautaResolverStock({ rep: 'filtro alternativo LF9009' }, stk, lub, [])).toEqual({ tipo: 'filtro', idx: 0 });
  });
  it('ignora números muy cortos y cae a las palabras de la descripción (al menos 2 coincidencias)', () => {
    expect(L.pautaResolverStock({ rep: 'filtro 12 hidraulico principal' }, stk, lub, [])).toEqual({ tipo: 'filtro', idx: 2 });
  });
  it('lubricantes: puntaje por palabras y exige coincidir al menos un número', () => {
    expect(L.pautaResolverStock({ rep: 'Aceite motor 15W40' }, [], lub, [])).toEqual({ tipo: 'lubricante', idx: 0 });
    expect(L.pautaResolverStock({ rep: 'Aceite hidraulico 68' }, [], lub, [])).toEqual({ tipo: 'lubricante', idx: 1 });
    expect(L.pautaResolverStock({ rep: 'Aceite hidraulico 46' }, [], lub, [])).toBeNull();
  });
  it('el caché de mapaRep manda sobre la heurística y se ignora si el ítem ya no existe', () => {
    const mapa = [{ pautaId: 'p1', tipo: 'filtro', refId: 's2' }, { pautaId: 'p2', tipo: 'filtro', refId: 'borrado' }];
    expect(L.pautaResolverStock({ _id: 'p1', rep: 'Filtro aceite 600-211-1341' }, stk, lub, mapa)).toEqual({ tipo: 'filtro', idx: 1 });
    expect(L.pautaResolverStock({ _id: 'p2', rep: 'Filtro aceite 600-211-1341' }, stk, lub, mapa)).toEqual({ tipo: 'filtro', idx: 0 });
  });
  it('sin coincidencia o sin texto → null', () => {
    expect(L.pautaResolverStock({ rep: 'Pintura epóxica azul' }, stk, lub, [])).toBeNull();
    expect(L.pautaResolverStock({ rep: '  ' }, stk, lub, [])).toBeNull();
    expect(L.pautaResolverStock({}, stk, lub, [])).toBeNull();
  });
  it('igual que descontarStock: una línea de lubricante que comparte 2 palabras con la descripción de un filtro se vincula al filtro', () => {
    expect(L.pautaResolverStock({ rep: 'Aceite motor 15W40' }, stk, lub, [])).toEqual({ tipo: 'filtro', idx: 0 }); // "aceite" y "motor" están en "Filtro aceite motor"
  });
  it('el N° de parte tiene prioridad sobre la descripción', () => {
    const r = L.pautaResolverStock({ rep: 'filtro aire primario 600-211-1341' }, stk, lub, []);
    expect(r).toEqual({ tipo: 'filtro', idx: 0 });
  });
});

describe('demandaPlanificadaPM', () => {
  const stk = [{ _id: 's1', nParte: '600-211-1341', descripcion: 'Filtro aceite motor', stockBodega: 10 }];
  const lub = [{ _id: 'l1', nombre: 'Aceite Hidraulico 68', stock: 100 }];
  const pautas = { PM1: [{ rep: 'Filtro aceite 600-211-1341', can: 2 }, { rep: 'Aceite hidraulico 68', can: 30 }, { rep: 'Pintura epoxica', can: 1 }], PM2: [{ rep: 'Filtro aceite 600-211-1341', can: 2 }, { rep: 'Aceite hidraulico 68', can: 30 }] };
  const consumosFn = (sigla, pm) => pautas[pm] || [];
  const eqs = [{ sigla: 'A', frecPM: 250, hrsDia: 20, horomActual: 1100, horomProxPM: 1250 }, { sigla: 'B', frecPM: 250, hrsDia: 20, horomActual: 1100, horomProxPM: 1250 }, { sigla: 'C', hrsDia: 0, horomActual: 5 }];
  it('suma las pautas de los PM calendarizados de todos los equipos por ítem', () => {
    const d = L.demandaPlanificadaPM(eqs, consumosFn, stk, lub, [], hoy, 25);
    expect(d.pmContados).toBe(4);                              // A y B: PM1 (día 8) y PM2 (día 20)
    expect(d.items['filtro:0'].eventos.reduce((s, x) => s + x.cant, 0)).toBe(8);
    expect(d.items['lubricante:0'].eventos.reduce((s, x) => s + x.cant, 0)).toBe(120);
    expect(d.items['filtro:0'].eventos.map(x => x.sigla).sort()).toEqual(['A', 'A', 'B', 'B']);
  });
  it('lo que no tiene ítem de stock se informa aparte y los equipos sin ritmo se listan', () => {
    const d = L.demandaPlanificadaPM(eqs, consumosFn, stk, lub, [], hoy, 25);
    expect(d.sinStock['Pintura epoxica']).toBe(2);
    expect(d.sinRitmo).toEqual(['C']);
  });
  it('líneas con cantidad cero o negativa no cuentan', () => {
    const d = L.demandaPlanificadaPM([eqs[0]], () => [{ rep: 'Filtro aceite 600-211-1341', can: 0 }, { rep: 'Filtro aceite 600-211-1341', can: -3 }], stk, lub, [], hoy, 25);
    expect(Object.keys(d.items)).toEqual([]);
  });
});

describe('planReposicionPM', () => {
  const mk = (stock, pend, lead, eventos, extra) => {
    const stk = [Object.assign({ _id: 's', nParte: 'X', descripcion: 'Filtro X', stockBodega: stock, pendiente: pend, leadTime: lead, consumoMes: 4 }, extra)];
    return { stk, demanda: { items: { 'filtro:0': { tipo: 'filtro', idx: 0, eventos } } } };
  };
  it('el quiebre llega antes que el pedido: pedir ya, con el faltante de lead + cobertura', () => {
    const { stk, demanda } = mk(10, 0, 34, [{ dias: 10, cant: 6 }, { dias: 20, cant: 6 }, { dias: 50, cant: 6 }, { dias: 90, cant: 6 }]);
    const [r] = L.planReposicionPM(demanda, stk, [], {});
    expect(r.quiebreDias).toBe(20);                      // 6, 12 > 10
    expect(r.pedirAntesDias).toBe(-14);                  // 20 − 34
    expect(r.estado).toBe('pedir_ya');
    expect(r.necesidad).toBe(18);                        // hasta el día 64: 6+6+6
    expect(r.faltante).toBe(8); expect(r.pedir).toBe(8);
  });
  it('el quiebre está a menos de 30 días de ser tarde: planificar; si alcanza todo el horizonte: cubierto', () => {
    const a = mk(10, 0, 34, [{ dias: 50, cant: 6 }, { dias: 60, cant: 6 }]);
    expect(L.planReposicionPM(a.demanda, a.stk, [], {})[0]).toMatchObject({ estado: 'planificar', pedirAntesDias: 26 });
    const b = mk(100, 0, 34, [{ dias: 50, cant: 6 }, { dias: 60, cant: 6 }]);
    expect(L.planReposicionPM(b.demanda, b.stk, [], {})[0]).toMatchObject({ estado: 'cubierto', quiebreDias: null, pedir: 0 });
  });
  it('lo pendiente de llegar suma a la posición de stock', () => {
    const a = mk(5, 20, 34, [{ dias: 10, cant: 6 }, { dias: 20, cant: 6 }]);
    expect(L.planReposicionPM(a.demanda, a.stk, [], {})[0]).toMatchObject({ posicion: 25, estado: 'cubierto' });
  });
  it('usa el plazo del ítem o 34 días si no lo tiene; la cobertura es ajustable', () => {
    const a = mk(0, 0, 0, [{ dias: 40, cant: 3 }, { dias: 70, cant: 3 }]);
    const r = L.planReposicionPM(a.demanda, a.stk, [], {})[0];
    expect(r.lead).toBe(34); expect(r.leadPropio).toBe(false);
    expect(r.necesidad).toBe(3);                          // hasta el día 64
    expect(L.planReposicionPM(a.demanda, a.stk, [], { cobertura: 60 })[0].necesidad).toBe(6); // hasta el día 94
  });
  it('lubricantes usan su stock; el plan se compara con el consumo histórico', () => {
    const lub = [{ _id: 'l', nombre: 'Aceite 15W40', stock: 50, consumoMes: 40 }];
    const dem = { items: { 'lubricante:0': { tipo: 'lubricante', idx: 0, eventos: [{ dias: 5, cant: 30 }, { dias: 25, cant: 30 }] } } };
    const r = L.planReposicionPM(dem, [], lub, {})[0];
    expect(r.posicion).toBe(50); expect(r.quiebreDias).toBe(25);
    expect(r.plan30).toBe(60); expect(r.razonPlanHist).toBeCloseTo(1.5, 10);
  });
  it('ordena lo urgente primero y dentro de cada estado por la holgura', () => {
    const stk = [
      { _id: 'a', descripcion: 'A', stockBodega: 100, leadTime: 34 },
      { _id: 'b', descripcion: 'B', stockBodega: 1, leadTime: 34 },
      { _id: 'c', descripcion: 'C', stockBodega: 5, leadTime: 34 }
    ];
    const dem = { items: {
      'filtro:0': { tipo: 'filtro', idx: 0, eventos: [{ dias: 10, cant: 1 }] },
      'filtro:1': { tipo: 'filtro', idx: 1, eventos: [{ dias: 5, cant: 4 }] },
      'filtro:2': { tipo: 'filtro', idx: 2, eventos: [{ dias: 20, cant: 6 }] } } };
    expect(L.planReposicionPM(dem, stk, [], {}).map(r => r.nombre)).toEqual(['B', 'C', 'A']);
  });
  it('un ítem que ya no existe se omite', () => {
    expect(L.planReposicionPM({ items: { 'filtro:9': { tipo: 'filtro', idx: 9, eventos: [{ dias: 1, cant: 1 }] } } }, [], [], {})).toEqual([]);
  });
});
