// M4 (ABC × VED) y M6 (prioridad de OT) que leen la criticidad de equipos.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const equipos = [
  { sigla: 'CN-9500', modelo: 'Komatsu HD785-7', tipo: 'Camion' },
  { sigla: 'CF-9510', modelo: 'Komatsu WA900-8R', tipo: 'Cargador Frontal' },
  { sigla: 'MC-4922', modelo: 'JCB 250', tipo: 'Minicargador' },
  { sigla: 'BD-10139', modelo: 'Komatsu D65EX-18E0', tipo: 'Bulldozer' },
  { sigla: 'TI-5141', modelo: 'Doosan LCV6-LED', tipo: 'Torre Iluminacion' },
  { sigla: 'CN-5133', modelo: 'Mercedes Benz Arocs 3340', tipo: 'Camión Aljibe' },
];

describe('bandaCriticidadEquipo — peor caso entre el nivel calculado y la etiqueta manual', () => {
  it('toma el mayor y dice de dónde viene', () => {
    expect(L.bandaCriticidadEquipo('Alta', 'General')).toEqual({ banda: 5, fuente: 'calculada' });
    expect(L.bandaCriticidadEquipo('Baja', 'Crítico')).toEqual({ banda: 5, fuente: 'manual' });
    expect(L.bandaCriticidadEquipo('Media', 'Esencial')).toEqual({ banda: 3, fuente: 'ambas' });
  });
  it('con una sola señal usa esa; con ninguna devuelve null', () => {
    expect(L.bandaCriticidadEquipo(null, 'Esencial')).toEqual({ banda: 3, fuente: 'manual' });
    expect(L.bandaCriticidadEquipo('Baja', null)).toEqual({ banda: 1, fuente: 'calculada' });
    expect(L.bandaCriticidadEquipo(null, null)).toBeNull();
  });
});

describe('equiposDeRepuesto — el texto libre "equipoModelo" se busca en modelo, sigla y tipo', () => {
  it('reconoce modelos con barras, siglas, tipos y marcas del equipo', () => {
    expect(L.equiposDeRepuesto('HD785-7/WA900/D375', equipos).sort()).toEqual(['CF-9510', 'CN-9500']);
    expect(L.equiposDeRepuesto('BD-10139 Bulldozer', equipos)).toEqual(['BD-10139']);
    expect(L.equiposDeRepuesto('BD-10139 Bulldozer', equipos.concat([{ sigla: 'BD-9509', modelo: 'Komatsu D375A-6R', tipo: 'Bulldozer' }]))).toEqual(['BD-10139']);   // la sigla manda sobre el tipo
    expect(L.equiposDeRepuesto('Cargador Frontal', equipos)).toEqual(['CF-9510']);   // no confunde con "Minicargador"
    expect(L.equiposDeRepuesto('AROCS', equipos)).toEqual(['CN-5133']);
    expect(L.equiposDeRepuesto('DOOSAN', equipos)).toEqual(['TI-5141']);
    expect(L.equiposDeRepuesto('Mercedez Benz', equipos)).toEqual(['CN-5133']);
  });
  it('una marca de filtro, texto vacío o palabras genéricas no se asocian a ningún equipo', () => {
    expect(L.equiposDeRepuesto('Fleetguard', equipos)).toEqual([]);
    expect(L.equiposDeRepuesto('Donalson ', equipos)).toEqual([]);
    expect(L.equiposDeRepuesto('', equipos)).toEqual([]);
    expect(L.equiposDeRepuesto('filtro aceite', equipos)).toEqual([]);
    expect(L.equiposDeRepuesto('D6', equipos)).toEqual([]);       // menos de 3 caracteres (después de limpiar) no cuenta
  });
});

describe('VED y matriz ABC × VED', () => {
  const banda = { 'CN-9500': 5, 'CF-9510': 5, 'MC-4922': 1, 'BD-10139': 3, 'TI-5141': 1, 'CN-5133': 3 };
  it('el VED sale del equipo más crítico que usa el repuesto', () => {
    const r = L.vedRepuestos([
      { nParte: 'A', claseABC: 'A', equipoModelo: 'HD785-7/JCB' },     // camión (5) y minicargador (1) → Vital
      { nParte: 'B', claseABC: 'B', equipoModelo: 'MC-4922 Minicargador' },   // solo minicargador (1) → Deseable
      { nParte: 'C', claseABC: 'C', equipoModelo: 'AROCS' },           // aljibe (3) → Esencial
      { nParte: 'D', claseABC: 'A', equipoModelo: 'Fleetguard' },      // sin equipo → sin dato
    ], equipos, banda);
    expect(r.map((x) => x.ved)).toEqual(['V', 'D', 'E', null]);
    expect(r[0].nivelServicio).toBe(0.99);
    expect(r[1].nivelServicio).toBe(0.90);
    expect(r[3].nivelServicio).toBeNull();
    expect(r[3].categoria).toBeNull();
  });
  it('categorías de control: AV, AE y BV = I; AD, BE y CV = II; BD, CE y CD = III', () => {
    const c = L.ABCVED_CATEGORIA;
    expect(['AV', 'AE', 'BV'].map((k) => c[k])).toEqual(['I', 'I', 'I']);
    expect(['AD', 'BE', 'CV'].map((k) => c[k])).toEqual(['II', 'II', 'II']);
    expect(['BD', 'CE', 'CD'].map((k) => c[k])).toEqual(['III', 'III', 'III']);
  });
  it('la matriz cuenta cada repuesto en su celda y aparta los sin dato', () => {
    const items = L.vedRepuestos([
      { nParte: 'A', claseABC: 'A', equipoModelo: 'HD785-7' }, { nParte: 'B', claseABC: 'B', equipoModelo: 'HD785-7' },
      { nParte: 'C', claseABC: 'C', equipoModelo: 'MC-4922' }, { nParte: 'D', claseABC: 'A', equipoModelo: 'Fleetguard' },
    ], equipos, banda);
    const m = L.matrizABCVED(items);
    expect(m.celdas.A.V.length).toBe(1);
    expect(m.celdas.B.V.length).toBe(1);
    expect(m.celdas.C.D.length).toBe(1);
    expect(m.sinDato.length).toBe(1);
    expect(m.resumen).toEqual({ I: 2, II: 0, III: 1, sinDato: 1 });
  });
  it('el nivel de servicio por repuesto cambia el stock de seguridad (Vital > Deseable)', () => {
    const itemsABC = [{ nParte: 'X1', claseABC: 'A', claseXYZ: 'Y', consumoMensualProm: 100, cv: 1 }];
    const stk = [{ nParte: 'X1', stockBodega: 5, pendiente: 0, leadTime: 60, precioUnit: 1000 }];
    const vital = L.puntosReordenRepuestos(itemsABC, stk, 0.95, { X1: 0.99 })[0];
    const deseable = L.puntosReordenRepuestos(itemsABC, stk, 0.95, { X1: 0.90 })[0];
    const base = L.puntosReordenRepuestos(itemsABC, stk, 0.95)[0];
    expect(vital.rop).toBeGreaterThan(base.rop);
    expect(L.VED_NIVEL_SERVICIO.V).toBe(0.99);
    expect(vital.nivelServicio).toBe(0.99);
    expect(deseable.rop).toBeLessThan(base.rop);
  });
});

describe('prioridadOT (M6) — urgencia × impacto', () => {
  const banda = { 'CN-9500': { banda: 5, fuente: 'ambas' }, 'TI-5141': { banda: 1, fuente: 'calculada' } };
  it('un equipo crítico con días pendientes sube a P1 y uno de apoyo con pocos días queda en P4', () => {
    const r = L.prioridadOT([
      { sigla: 'CN-9500', dias: 8, origen: 'Correctivo' },     // urgencia 4 × impacto 5 = 20
      { sigla: 'TI-5141', dias: 1, origen: 'Correctivo' },     // 1 × 1 = 1
    ], banda);
    expect(r[0].sigla).toBe('CN-9500');
    expect(r[0].puntaje).toBe(20);
    expect(r[0].nivel).toBe('P1');
    expect(r[1].nivel).toBe('P4');
  });
  it('la escala de urgencia por días', () => {
    expect([0, 1, 2, 3, 5, 7, 10, 14, 30].map(L.urgenciaPorDias)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });
  it('fuera de servicio sube impacto y urgencia a 4 como mínimo; un PM vencido cuenta urgencia 3 como mínimo', () => {
    const r = L.prioridadOT([
      { sigla: 'TI-5141', dias: 0, origen: 'Correctivo', fueraDeServicio: true },
      { sigla: 'TI-5141', dias: 0, origen: 'Preventivo' },
    ], banda);
    const fs = r.find((x) => x.origen === 'Correctivo'), pm = r.find((x) => x.origen === 'Preventivo');
    expect(fs.impacto).toBe(4); expect(fs.urgencia).toBe(4); expect(fs.puntaje).toBe(16); expect(fs.nivel).toBe('P1');
    expect(fs.impactoFuente).toMatch(/fuera de servicio/);
    expect(pm.urgencia).toBe(3); expect(pm.puntaje).toBe(3);
  });
  it('sin criticidad conocida usa impacto 3 y lo dice; los niveles respetan los cortes 15 / 8 / 4', () => {
    const r = L.prioridadOT([{ sigla: 'DESCONOCIDO', dias: 4, origen: 'Correctivo' }], banda)[0];
    expect(r.impacto).toBe(3); expect(r.impactoFuente).toMatch(/sin criticidad/); expect(r.puntaje).toBe(9); expect(r.nivel).toBe('P2');
    const nv = (pt) => L.prioridadOT([{ sigla: 'S', dias: 0, origen: 'Correctivo' }], { S: { banda: pt, fuente: 'x' } })[0].nivel;
    expect([nv(1), nv(3), nv(5)]).toEqual(['P4', 'P4', 'P3']);   // urgencia 1 × banda
  });
  it('desempata por días pendientes', () => {
    const r = L.prioridadOT([{ sigla: 'TI-5141', dias: 5, origen: 'Correctivo' }, { sigla: 'TI-5141', dias: 7, origen: 'Correctivo' }], banda);
    expect(r[0].dias).toBe(7);
  });
});
