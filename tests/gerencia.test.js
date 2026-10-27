// «Preguntas del gerente»: cada función contesta una pregunta con los datos que hay y dice con cuántos casos (27-oct-2026).
import { describe, it, expect } from 'vitest';
import { GER_CORTES, horasOTAprox, gerBandasDuracion, gerMotivosDemora, gerProgramaMes, gerDesgasteVsSaldo, gerReactivoPreventivo, gerPlanificacion, gerCadena, gerDotacionVsCarga, gerFrescura, panelGerencia, OT_MOTIVO_SIN_INFORMAR } from '../logic.js';

const HOY = '2026-10-27';
const ot = (extra) => ({ sigla: 'CN-1', tipo: 'Correctivo', estadoOT: 'Cerrada', fechaEntrada: '2026-03-02', ...extra });

describe('horasOTAprox', () => {
  it('usa la duración registrada; si no, los días entre fechas (marcada aproximada); si no hay nada, null', () => {
    expect(horasOTAprox(ot({ duracion: '5h 30min' }), HOY)).toEqual({ horas: 5.5, aprox: false });
    expect(horasOTAprox(ot({ fechaSalida: '2026-03-04' }), HOY)).toEqual({ horas: 48, aprox: true });
    expect(horasOTAprox(ot({}), HOY)).toEqual({ horas: null, aprox: false });
    expect(horasOTAprox(ot({ fechaSalida: '2026-03-02' }), HOY).horas).toBeNull();
  });
});

describe('gerBandasDuracion', () => {
  const lista = [ot({ duracion: '3h' }), ot({ duracion: '7h' }), ot({ duracion: '30h' }), ot({ duracion: '100h' }), ot({ duracion: '800h', sintoma: 'Motor' }), ot({}), ot({ tipo: 'Preventivo', duracion: '2h' }), ot({ estadoOT: 'Abierta', duracion: '1h' })];
  const r = gerBandasDuracion(lista, HOY);
  it('reparte los correctivos cerrados en las cuatro bandas con los cortes de 8 h, 2 días y 30 días', () => {
    expect(r.bandas.map(b => b.n)).toEqual([2, 1, 1, 1]);
    expect(r.n).toBe(5);
    expect(r.bandas[0].pct).toBe(40);
    expect(GER_CORTES).toEqual({ bajoH: 8, medioH: 48, altoH: 720 });
  });
  it('cuenta aparte lo que no trae duración y no lo inventa; ignora preventivos y abiertas', () => {
    expect(r.sinDuracion).toBe(1);
    expect(r.horasTotales).toBe(940);
    expect(r.bandas[3].pctHoras).toBeGreaterThan(80);
  });
  it('el largo ocupa más de lo que parece: pocas OT, muchas horas', () => {
    expect(r.bandas[3].pct).toBe(20);
    expect(r.bandas[3].casos[0].horas).toBe(800);
  });
  it('permite cambiar los cortes', () => {
    const q = gerBandasDuracion(lista, HOY, { bajoH: 4, medioH: 24, altoH: 240 });
    expect(q.bandas.map(b => b.n)).toEqual([1, 1, 2, 1]);
  });
  it('marca las aproximadas', () => {
    const q = gerBandasDuracion([ot({ fechaSalida: '2026-03-05' })], HOY);
    expect(q.aproximadas).toBe(1);
    expect(q.bandas[2].n).toBe(1);
  });
  it('sin OT no hay porcentajes', () => {
    const q = gerBandasDuracion([], HOY);
    expect(q.n).toBe(0);
    expect(q.bandas[0].pct).toBeNull();
    expect(q.mediana).toBeNull();
  });
});

describe('gerMotivosDemora', () => {
  const lista = [
    ot({ duracion: '20h', motivoDemora: 'Proveedor sin stock o con demora' }),
    ot({ duracion: '30h', motivoDemora: 'Proveedor sin stock o con demora' }),
    ot({ duracion: '50h', motivoDemora: 'Repuesto sin stock en bodega (no se anticipó)' }),
    ot({ duracion: '12h', motivoDemora: OT_MOTIVO_SIN_INFORMAR }),
    ot({ duracion: '40h' }),
    ot({ duracion: '2h', motivoDemora: 'Diagnóstico difícil' }),
  ];
  const r = gerMotivosDemora(lista, HOY);
  it('solo mira las de 8 h o más y reparte por grupo', () => {
    expect(r.total).toBe(5);
    expect(r.conMotivo).toBe(4);
    expect(r.sinDato).toBe(1);
    expect(r.porGrupo[0].grupo).toBe('repuesto_proveedor');
    expect(r.porGrupo[0].n).toBe(2);
    expect(r.porGrupo[0].horas).toBe(50);
  });
  it('dice cuánto está realmente informado: «Sin informar» no cuenta como respuesta', () => {
    expect(r.sinInformar).toBe(1);
    expect(r.informadosReales).toBe(3);
    expect(r.pctInformado).toBe(60);
  });
  it('sin ninguna OT larga no hay porcentaje', () => {
    expect(gerMotivosDemora([], HOY).pctInformado).toBeNull();
  });
});

describe('gerProgramaMes', () => {
  const eq = [{ sigla: 'CN-1', frecPM: 250, hrsDia: 10, horomActual: 100, horomProxPM: 250 }, { sigla: 'CN-2', frecPM: 250, hrsDia: 10, horomActual: 150, horomProxPM: 250 }, { sigla: 'CN-3', frecPM: 250, horomActual: 0 }];
  const stk = [{ _id: 'f1', descripcion: 'Filtro aceite', nParte: 'LF-9000', stockBodega: 3, pendiente: 4 }];
  const mapa = [{ pautaId: 'p1', tipo: 'filtro', refId: 'f1' }];
  const consumos = (sigla) => [{ _id: 'p1', rep: 'Filtro aceite LF-9000', can: 2 }, { _id: 'p2', rep: 'Pieza rara sin ficha', can: 1 }];
  const r = gerProgramaMes(eq, consumos, stk, [], mapa, new Date('2026-10-27T12:00:00Z'), 30);
  it('ordena los PM por fecha y reparte el stock: el primero se lo lleva, al segundo le falta', () => {
    expect(r.eventos.length).toBe(2);
    expect(r.eventos[0].sigla).toBe('CN-2');
    expect(r.eventos[0].estado).toBe('completo');
    expect(r.eventos[1].estado).toBe('falta');
    expect(r.eventos[1].faltan[0].falta).toBe(1);
  });
  it('resume faltantes con lo que hay, lo que necesita y lo que viene en camino', () => {
    expect(r.faltantes).toHaveLength(1);
    expect(r.faltantes[0]).toMatchObject({ hay: 3, necesita: 4, falta: 1, enCamino: 4 });
    expect(r.resumen).toMatchObject({ total: 2, completos: 1, conFaltantes: 1, pctCompletos: 50 });
  });
  it('lo que no se puede vincular al stock se informa aparte, y los equipos sin ritmo también', () => {
    expect(r.sinVinculo).toEqual(['Pieza rara sin ficha']);
    expect(r.sinRitmo).toEqual(['CN-3']);
  });
  it('sin eventos no hay porcentaje', () => {
    const q = gerProgramaMes([], consumos, stk, [], mapa, new Date('2026-10-27T12:00:00Z'), 30);
    expect(q.resumen.pctCompletos).toBeNull();
  });
});

describe('gerDesgasteVsSaldo', () => {
  const desg = [{ tipo: 'Cargador', pieza: 'neumático', lambda: 2, consumoMes: 2, consumoSemestre: 12, consumoAnual: 24 }, { tipo: 'Cargador', pieza: 'pasador', lambda: 1, consumoMes: 1, consumoSemestre: 6, consumoAnual: 12 }, { tipo: 'X', pieza: 'sello', lambda: null }];
  it('compara cambios proyectados con el saldo del kardex, y dice cuando no hay ítem', () => {
    const r = gerDesgasteVsSaldo(desg, [{ descripcion: 'Neumático 17.5', saldo: 14, activo: true }, { descripcion: 'Neumatico 20.5', saldo: 2, activo: true }, { descripcion: 'Neumático viejo', saldo: 99, activo: false }]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ pieza: 'neumático', saldo: 16, estado: 'alcanza_semestre', mesesCubiertos: 8 });
    expect(r[1].estado).toBe('sin_item');
  });
  it('no alcanza ni para un mes', () => {
    expect(gerDesgasteVsSaldo(desg, [{ descripcion: 'Pasador', saldo: 0 }])[1].estado).toBe('no_alcanza');
  });
});

describe('gerReactivoPreventivo', () => {
  const lista = [ot({ fechaEntrada: '2025-02-10', duracion: '10h' }), ot({ fechaEntrada: '2025-02-11', duracion: '10h' }), ot({ fechaEntrada: '2026-02-05', duracion: '30h' }), ot({ fechaEntrada: '2026-02-06', duracion: '10h' }), ot({ fechaEntrada: '2026-02-07', duracion: '10h' }), ot({ fechaEntrada: '2026-03-01', duracion: '5h' })];
  const reg = [{ fechaEjec: '2026-02-15' }, { fechaEjec: '2026-02-16' }, { fechaEjec: '2026-08-01' }];
  const r = gerReactivoPreventivo(lista, reg, HOY);
  it('calcula el % reactivo por mes', () => {
    const feb = r.meses.find(m => m.mes === '2026-02');
    expect(feb).toMatchObject({ correctivos: 3, preventivos: 2, pctReactivo: 60, horas: 50 });
  });
  it('compara con el año anterior solo donde hay OT en ambos', () => {
    expect(r.interanual).toHaveLength(1);
    expect(r.interanual[0]).toMatchObject({ mes: '2026-02', anterior: '2025-02', varCorrectivosPct: 50, varHorasPct: 150 });
  });
  it('dice hasta dónde llegan los datos de cada lado', () => {
    expect(r.ultimoMesOT).toBe('2026-03');
    expect(r.ultimoMesPM).toBe('2026-08');
  });
});

describe('gerPlanificacion', () => {
  const lista = [ot({ fechaEntrada: '2026-03-02', fechaIngreso: '02-03-2026', motivoDemora: 'Diagnóstico difícil' }), ot({ fechaEntrada: '2026-03-02', fechaIngreso: '04-03-2026', motivoDemora: OT_MOTIVO_SIN_INFORMAR }), ot({ fechaEntrada: '2026-03-02', fechaIngreso: '20-03-2026' })];
  const bk = [{ fecha: '2026-08-01', observacion: 'Reparación provisoria: OT 1' }, { fecha: '2026-10-20' }, { fecha: '2026-01-01', fechaCierre: '2026-01-10' }];
  const r = gerPlanificacion({ hoy: HOY, ot: lista, backlog: bk, planSem: [{}, {}] });
  it('mide con cuánto atraso se registran los correctivos', () => {
    expect(r.registro).toMatchObject({ n: 3, mismoDia: 1, unoDos: 1, masDeDos: 1, mismoDiaPct: 33.3 });
  });
  it('cuenta backlog abierto, vencido y las provisorias', () => {
    expect(r.backlog).toMatchObject({ abiertos: 2, vencidos: 1, provisorias: 1, total: 3 });
    expect(r.planSemanal.filas).toBe(2);
  });
  it('cuánto de lo cerrado trae su motivo de verdad', () => {
    expect(r.motivos).toEqual({ conMotivo: 2, sinInformar: 1, informados: 1 });
  });
  it('sin equipos no hay indicadores de programa', () => {
    expect(r.programa).toBeNull();
  });
});

describe('gerCadena', () => {
  const compras = [
    { estado: 'Recepcion Bodega', oc: 'A', pedido: 1, fecha: '2026-09-01', tiempoRespuesta: '20 días', costo: 1000, sigla: 'CN-1', detalle: 'Filtro', proveedor: 'P1' },
    { estado: 'Recepcion Bodega', oc: 'B', pedido: 2, fecha: '2026-08-01', tiempoRespuesta: '60 días', costo: 1000, sigla: 'CN-2', detalle: 'Bomba', proveedor: 'P2' },
    { estado: 'OC Firmada', pedido: 3, fecha: '2026-09-01', fechaEstado: '2026-09-11' },
  ];
  const lista = [ot({ duracion: '48h' }), ot({ duracion: '24h' })];
  const r = gerCadena(compras, lista, HOY);
  it('arma los tramos medibles y marca el más lento', () => {
    expect(r.tramos.map(t => t.id)).toEqual(expect.arrayContaining(['recepcion', 'firma', 'reparacion']));
    expect(r.tramos.filter(t => t.masLento)).toHaveLength(1);
    expect(r.tramos.find(t => t.masLento).id).toBe('recepcion');
    expect(r.tramos.find(t => t.id === 'firma').mediana).toBe(10);
  });
  it('lista los pedidos que más tardaron y avisa que faltan los pasos intermedios', () => {
    expect(r.lentos[0].dias).toBe(60);
    expect(r.faltaDetalle).toBe(true);
  });
  it('sin datos no hay tramos', () => {
    expect(gerCadena([], [], HOY).tramos).toEqual([]);
  });
});

describe('gerDotacionVsCarga', () => {
  const prog = [{ fecha: '2026-07-14', turno: 'Día', nombre: 'Ana', cargo: 'Mecánico' }, { fecha: '2026-07-14', turno: 'Día', nombre: 'Luis', cargo: 'Electromecánico' }];
  it('no son comparables si la dotación y las OT caen en meses distintos', () => {
    const r = gerDotacionVsCarga(prog, [ot({ fechaEntrada: '2026-03-02' })], [], HOY);
    expect(r.comparable).toBe(false);
    expect(r.desde).toBe('2026-07-14');
    expect(r.ultimoMesOT).toBe('2026-03');
    expect(r.nota).toMatch(/horas-hombre/);
  });
  it('son comparables si hay correctivos en el mismo período', () => {
    const r = gerDotacionVsCarga(prog, [ot({ fechaEntrada: '2026-07-20' })], [], HOY);
    expect(r.comparable).toBe(true);
    expect(r.cargaMismoPeriodo).toHaveLength(1);
  });
});

describe('gerFrescura y panelGerencia', () => {
  it('marca vieja una fuente sin datos recientes', () => {
    const f = gerFrescura({ hoy: HOY, ot: [ot({ fechaEntrada: '2026-03-15' })], reg: [{ fechaEjec: '2026-10-20' }], compras: [], progDia: [], insMov: [] });
    expect(f.find(x => x.id === 'ot')).toMatchObject({ ultima: '2026-03-15', vieja: true });
    expect(f.find(x => x.id === 'pm').vieja).toBe(false);
    expect(f.find(x => x.id === 'compras')).toMatchObject({ ultima: null, vieja: true });
  });
  it('el panel junta todas las respuestas sin romper con datos vacíos', () => {
    const p = panelGerencia({ hoy: HOY });
    expect(Object.keys(p)).toEqual(expect.arrayContaining(['frescura', 'duracion', 'motivos', 'programa', 'desgaste', 'reactivo', 'planificacion', 'cadena', 'dotacion']));
    expect(p.programa).toBeNull();
    expect(p.duracion.n).toBe(0);
  });
});
