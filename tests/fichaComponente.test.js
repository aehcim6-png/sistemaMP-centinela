// Ficha de componente: lo que lee el Buscador Maestro. Debe decir lo mismo que la pestaña TBO (mismas funciones de fondo).
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const hoy = new Date('2026-10-10T12:00:00');
const eq = [{ sigla: 'CN-1', modelo: 'Komatsu HD785-7', horomActual: 12534, hrsDia: 20, criticidad: 'Crítico' }, { sigla: 'TI-1', modelo: 'Doosan LCV6-LED', horomActual: 900 }];
const hist = [
  { sigla: 'CN-1', comp: 'Alternador', horomInstalacion: 4000, fechaInst: '2025-01-01' }, // 8.534 h desde, TBO 8.000: vencido
  { sigla: 'CN-1', comp: 'Turbo', horomInstalacion: 11400, fechaInst: '2026-06-01' },     // 1.134 h desde, TBO 8.000: riesgo bajo
  { sigla: 'CN-1', comp: 'Correas', horomInstalacion: 11500, fechaInst: '2026-07-01' }
];
const datos = (extra) => Object.assign({ equipos: eq, compHist: hist, compMayores: [], compras: [], comprasDetalle: [], stk: [], repuestos: [], ordenes: [], hoy }, extra);
const ajustes = (extra) => Object.assign({ tasa: 910, aplic: 'normal', tarifaHH: 25000, costoHoraDet: 122850, hhCambio: 16, horasProg: 8, horasFalla: 24 }, extra);

describe('tboAjustesCosto', () => {
  it('sin nada guardado: US$135 por hora detenida × tasa del programa (910) y los supuestos por defecto', () => {
    const a = L.tboAjustesCosto(() => null, 0, 0);
    expect(L.TBO_COSTO_HORA_DET_USD).toBe(135);
    expect(a).toMatchObject({ tasa: 910, costoHoraDet: 122850, costoDetPorDefecto: true, hhCambio: 16, horasProg: 8, horasFalla: 24, tarifaHH: 25000, aplic: 'normal' });
  });
  it('el costo por defecto sigue a la tasa; un valor en pesos escrito por el usuario manda sobre el predeterminado', () => {
    expect(L.tboAjustesCosto(k => (k === 'tboTasaUSD' ? '1000' : null), 0, 0).costoHoraDet).toBe(135000);
    const a = L.tboAjustesCosto(k => (k === 'tboCostoDet' ? '90000' : null), 0, 0);
    expect(a.costoHoraDet).toBe(90000); expect(a.costoDetPorDefecto).toBe(false);
  });
  it('horas de falla por defecto = mediana de reparaciones de la flota; tarifa HH y aplicación inválida se corrigen', () => {
    const a = L.tboAjustesCosto(k => (k === 'tboAplic' ? 'rara' : null), 37.4, 30000);
    expect(a.horasFalla).toBe(37); expect(a.tarifaHH).toBe(30000); expect(a.aplic).toBe('normal');
    expect(L.tboAjustesCosto(k => (k === 'tboAplic' ? 'severa' : null), 0, 0).aplic).toBe('severa');
  });
});

describe('tboDecisionFicha', () => {
  it('umbrales: ≥35% cambiar ya, ≥15% planificar, ≥5% vigilar, menos al día; cada una con su motivo', () => {
    expect(L.tboDecisionFicha(0.4, 'ok', 'no_urgente', null)).toMatchObject({ codigo: 'cambiar_ya', motivo: expect.stringMatching(/40%/) });
    expect(L.tboDecisionFicha(0.2, 'ok', 'no_urgente', null).codigo).toBe('planificar');
    expect(L.tboDecisionFicha(0.08, 'ok', 'no_urgente', null).codigo).toBe('vigilar');
    expect(L.tboDecisionFicha(0.01, 'ok', 'no_urgente', null).codigo).toBe('al_dia');
  });
  it('un ítem vencido sin política económica, o con "cambio por edad", es "cambiar ya"', () => {
    expect(L.tboDecisionFicha(0.02, 'vencido', 'cubierto', null).codigo).toBe('cambiar_ya');
    expect(L.tboDecisionFicha(0.02, 'vencido', 'cubierto', 'Cambio por edad a T*').codigo).toBe('cambiar_ya');
    expect(L.tboDecisionFicha(0.02, 'vencido', 'cubierto', 'Cambio por edad (con holgura)').codigo).toBe('cambiar_ya');
  });
  it('un ítem vencido cuya política económica es dejar correr pasa a "planificar" y lo explica (no se contradice en la misma ficha)', () => {
    const d = L.tboDecisionFicha(0.02, 'vencido', 'cubierto', 'Dejar correr / oportunista');
    expect(d.codigo).toBe('planificar');
    expect(d.motivo).toMatch(/próxima parada/);
    expect(L.tboDecisionFicha(0.02, 'vencido', 'cubierto', 'Por condición').codigo).toBe('planificar');
  });
  it('el riesgo alto manda sobre la política económica, y un pedido urgente nunca baja de "planificar"', () => {
    expect(L.tboDecisionFicha(0.5, 'vencido', 'cubierto', 'Dejar correr / oportunista').codigo).toBe('cambiar_ya');
    expect(L.tboDecisionFicha(0.01, 'ok', 'pedir_ya', null).codigo).toBe('planificar');
  });
});

describe('tboFichasEquipo', () => {
  it('equipo sin plan TBO o inexistente → null', () => {
    expect(L.tboFichasEquipo('TI-1', datos(), ajustes())).toBeNull();
    expect(L.tboFichasEquipo('NO-EXISTE', datos(), ajustes())).toBeNull();
  });
  it('solo trae componentes con cambio registrado, ordenados por decisión y, dentro de ella, de mayor a menor riesgo; los teóricos se cuentan aparte', () => {
    const r = L.tboFichasEquipo('CN-1', datos(), ajustes());
    expect(r.fichas.every(f => f.conDato)).toBe(true);
    const rango = { cambiar_ya: 0, planificar: 1, vigilar: 2, al_dia: 3 };
    r.fichas.slice(1).forEach((f, i) => {
      const ant = r.fichas[i];
      expect(rango[f.decision] > rango[ant.decision] || (rango[f.decision] === rango[ant.decision] && f.pFalla <= ant.pFalla)).toBe(true);
    });
    expect(r.omitidosTeoricos).toBeGreaterThan(0);
    expect(L.tboFichasEquipo('CN-1', datos(), ajustes({ incluirTeorico: true })).fichas.length).toBeGreaterThan(r.fichas.length);
  });
  it('el riesgo coincide con la función de TBO y con el estado de la flota', () => {
    const r = L.tboFichasEquipo('CN-1', datos(), ajustes({ horizonte: 500 }));
    const est = L.tboEstadoFlota(eq, hist, [], hoy).find(x => x.sigla === 'CN-1' && x.item === 'ALTERNATOR');
    const a = r.fichas.find(f => f.item === 'ALTERNATOR');
    expect(a.pFalla).toBeCloseTo(L.tboRiesgoHorizonte(est.desdeH, est.tbo, 500), 12);
    expect(a.pFalla).toBeCloseTo(est.riesgo500, 12);
    expect(a.criticidad).toBe(5);
  });
  it('la decisión es coherente con la política económica de la misma ficha: vencido + "dejar correr" → planificar; con hora detenida cara → cambiar ya', () => {
    const barata = L.tboFichasEquipo('CN-1', datos(), ajustes()).fichas.find(f => f.item === 'ALTERNATOR');
    expect(barata.nivel).toBe('vencido');
    expect(barata.estrategia.estrategia).toMatch(/Dejar correr/);
    expect(barata.decision).toBe('planificar');
    expect(barata.motivoDecision).toMatch(/próxima parada/);
    const cara = L.tboFichasEquipo('CN-1', datos(), ajustes({ costoHoraDet: 2000000 })).fichas.find(f => f.item === 'ALTERNATOR');
    expect(cara.estrategia.estrategia).toMatch(/^Cambio por edad/);
    expect(cara.decision).toBe('cambiar_ya');
  });
  it('con costo de hora detenida: consecuencia = (horas de falla − programadas) × costo/hora y pérdida esperada = P × consecuencia', () => {
    const a = L.tboFichasEquipo('CN-1', datos(), ajustes()).fichas.find(f => f.item === 'ALTERNATOR');
    expect(a.usaDetencion).toBe(true);
    expect(a.consecuencia).toBe((24 - 8) * 122850);
    expect(a.perdidaEsperada).toBeCloseTo(a.pFalla * a.consecuencia, 6);
    expect(a.Cf - a.Cp).toBeCloseTo((24 - 8) * 122850, 6);
    expect(a.ratio).toBeGreaterThan(1);
  });
  it('sin costo de hora detenida la consecuencia es el precio del repuesto (mismo proxy del presupuesto)', () => {
    const a = L.tboFichasEquipo('CN-1', datos(), ajustes({ costoHoraDet: 0 })).fichas.find(f => f.item === 'ALTERNATOR');
    expect(a.usaDetencion).toBe(false);
    expect(a.consecuencia).toBe(a.costoRep);
    expect(a.perdidaEsperada).toBeCloseTo(a.pFalla * a.costoRep, 6);
  });
  it('trae lo de abastecimiento que calcula el plan de compra (stock, pedidos, plazo) y coincide con él', () => {
    const d = datos({ stk: [{ nParte: '600-861-9122', descripcion: 'Alternador', equipoModelo: 'HD785-7', stockBodega: 1 }] });
    const a = L.tboFichasEquipo('CN-1', d, ajustes()).fichas.find(f => f.item === 'ALTERNATOR');
    expect(a.decisionCompra).toBe('cubierto');
    expect(a.stock.unidades).toBe(1);
    expect(a.lead.dias).toBeGreaterThan(0);
    const plan = L.tboPlanCompras(L.tboEstadoFlota(eq, hist, [], hoy), { hoy, equipos: eq, compras: [], comprasDetalle: [], stk: d.stk, repuestos: [], ordenes: [], tasa: 910 });
    expect(plan.filas.find(f => f.item === 'ALTERNATOR').decision).toBe(a.decisionCompra);
  });
  it('el resumen cuenta componentes con dato, en riesgo y para cambiar ya', () => {
    const r = L.tboFichasEquipo('CN-1', datos(), ajustes());
    expect(r.resumen.conDato).toBe(r.fichas.length);
    expect(r.resumen.cambiarYa).toBe(r.fichas.filter(f => f.decision === 'cambiar_ya').length);
    expect(r.fichas.every(f => typeof f.motivoDecision === 'string' && f.motivoDecision.length > 0)).toBe(true);
    expect(r.resumen.enRiesgo).toBeGreaterThanOrEqual(r.resumen.cambiarYa);
  });
  it('usa la vida medida en la flota (mismo origen) cuando existe; si no, el modelo del fabricante', () => {
    const muchos = [];
    for (let i = 0; i < 6; i++) muchos.push({ sigla: 'CN-1', comp: 'Turbo', horomInstalacion: 1000 + i * 1000, fechaInst: '2020-01-01', origen: 'KOMATSU' });
    const r = L.tboFichasEquipo('CN-1', datos({ compHist: hist.concat(muchos) }), ajustes());
    const t = r.fichas.find(f => f.item.startsWith('TURBO'));
    expect(t.vida.n).toBeGreaterThanOrEqual(5);
    expect(t.parametros.fuente).toMatch(/Weibull ajustado/);
    const sin = L.tboFichasEquipo('CN-1', datos(), ajustes()).fichas.find(f => f.item === 'ALTERNATOR');
    expect(sin.parametros.fuente).toMatch(/fabricante/);
  });
});
