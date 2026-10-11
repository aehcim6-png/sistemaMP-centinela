// Etapa 3 de la ficha de componente: el Score de Salud del equipo incorpora el riesgo de componentes (señal "Riesgo TBO") sin romper lo anterior.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const hoy = new Date('2026-10-10T12:00:00');
const eq = [
  { sigla: 'CN-1', modelo: 'Komatsu HD785-7', horomActual: 12534, hrsDia: 20 },
  { sigla: 'CN-2', modelo: 'Komatsu HD785-7', horomActual: 3000, hrsDia: 20 },
  { sigla: 'TI-1', modelo: 'Doosan LCV6-LED', horomActual: 900 }
];
const hist = [
  { sigla: 'CN-1', comp: 'Alternador', horomInstalacion: 4000, fechaInst: '2025-01-01' },
  { sigla: 'CN-1', comp: 'Correas', horomInstalacion: 11500, fechaInst: '2026-07-01' },
  { sigla: 'CN-2', comp: 'Correas', horomInstalacion: 2500, fechaInst: '2026-07-01' }
];
const d = { equipos: eq, compHist: hist, compMayores: [], compras: [], comprasDetalle: [], stk: [], repuestos: [], ordenes: [], hoy };
const aj = { tasa: 910, aplic: 'normal', tarifaHH: 25000, costoHoraDet: 2000000, hhCambio: 16, horasProg: 8, horasFalla: 24, horizonte: 500 };

describe('scoreSaludEquipo con la señal Riesgo TBO', () => {
  it('sin tboPct se calcula exactamente como antes (4 señales, total 4)', () => {
    const r = L.scoreSaludEquipo({ componentesPct: 100, neumaticosPct: 80, aceitePct: 60, confiabilidadPct: 100 });
    expect(r.valor).toBe(85); expect(r.n).toBe(4); expect(r.total).toBe(4);
    expect(r.detalle.map(x => x.nombre)).toEqual(['Componentes', 'Neumáticos', 'Aceite', 'Confiabilidad']);
  });
  it('con tboPct entra como 5ª señal al promedio', () => {
    const r = L.scoreSaludEquipo({ componentesPct: 100, neumaticosPct: 80, aceitePct: 60, confiabilidadPct: 100, tboPct: 0 });
    expect(r.total).toBe(5); expect(r.n).toBe(5); expect(r.valor).toBe(68);
    expect(r.detalle[4]).toEqual({ nombre: 'Riesgo TBO', valor: 0 });
  });
  it('un equipo con riesgo de componentes baja su score; uno sano lo sube o lo mantiene', () => {
    const base = { componentesPct: 90, neumaticosPct: 90 };
    expect(L.scoreSaludEquipo(Object.assign({ tboPct: 0 }, base)).valor).toBeLessThan(L.scoreSaludEquipo(base).valor);
    expect(L.scoreSaludEquipo(Object.assign({ tboPct: 100 }, base)).valor).toBeGreaterThan(L.scoreSaludEquipo(base).valor);
  });
  it('tboPct nulo o inválido no agrega señal; si solo hay tboPct, el score es ese valor', () => {
    expect(L.scoreSaludEquipo({ componentesPct: 80, tboPct: null }).total).toBe(4);
    expect(L.scoreSaludEquipo({ componentesPct: 80, tboPct: NaN }).total).toBe(4);
    expect(L.scoreSaludEquipo({ tboPct: 40 })).toMatchObject({ valor: 40, n: 1, total: 5 });
  });
  it('el motivo principal puede ser Riesgo TBO y tiene recomendación', () => {
    const r = L.scoreSaludEquipo({ componentesPct: 100, confiabilidadPct: 90, tboPct: 25 });
    expect(L.motivoPrincipalSalud(r.detalle).nombre).toBe('Riesgo TBO');
    expect(L.recomendacionDimensionSalud('Riesgo TBO')).toMatch(/Componentes/);
  });
});

describe('tboPctSano / tboFichasFlota', () => {
  it('equipos sin plan TBO no aparecen; los demás traen conteos', () => {
    const r = L.tboFichasFlota(d, aj);
    expect(Object.keys(r).sort()).toEqual(['CN-1', 'CN-2']);
    expect(r['CN-1'].conDato).toBe(2);
  });
  it('el porcentaje sano cuenta los componentes que no están en riesgo y coincide con la ficha del Buscador', () => {
    const fl = L.tboFichasFlota(d, aj)['CN-1'];
    const f = L.tboFichasEquipo('CN-1', d, aj);
    const sanos = f.fichas.filter(x => x.conDato && !(x.decision === 'cambiar_ya' || x.pFalla >= 0.15)).length;
    expect(fl.pct).toBeCloseTo(sanos / f.resumen.conDato * 100, 1);
    expect(fl.enRiesgo).toBe(f.resumen.enRiesgo);
    expect(fl.cambiarYa).toBe(f.resumen.cambiarYa);
    expect(L.tboPctSano(f)).toBeCloseTo(fl.pct, 6);
  });
  it('con la hora detenida cara el alternador vencido es "cambiar ya": ese equipo queda con menos % sano que el que no tiene nada vencido', () => {
    const fl = L.tboFichasFlota(d, aj);
    expect(fl['CN-1'].cambiarYa).toBeGreaterThan(0);
    expect(fl['CN-1'].pct).toBeLessThan(fl['CN-2'].pct);
    expect(fl['CN-2'].pct).toBe(100);
  });
  it('un equipo sin componentes con dato: pct nulo', () => {
    expect(L.tboPctSano({ resumen: { conDato: 0 }, fichas: [] })).toBeNull();
    expect(L.tboPctSano(null)).toBeNull();
  });
  it('filtrar por siglas calcula solo esas', () => {
    expect(Object.keys(L.tboFichasFlota(d, aj, ['CN-2']))).toEqual(['CN-2']);
  });
});

describe('equiposConSaludFlota con riesgo TBO', () => {
  const eqs = [{ sigla: 'CN-1', tipo: 'Camion', modelo: 'HD785-7', horomActual: 12534, hrsDia: 20 }];
  it('sin el 6º argumento queda igual que antes (compatibilidad)', () => {
    const r = L.equiposConSaludFlota(eqs, [], [], [], []);
    expect(r[0].score.total).toBe(4); expect(r[0].tbo).toBeNull();
  });
  it('con el riesgo TBO del equipo, el score lo incorpora y devuelve el detalle', () => {
    const r = L.equiposConSaludFlota(eqs, [], [], [], [], { 'CN-1': { pct: 50, conDato: 2, enRiesgo: 1, cambiarYa: 1 } });
    expect(r[0].score).toMatchObject({ valor: 50, total: 5, n: 1 });
    expect(r[0].tbo.enRiesgo).toBe(1);
  });
  it('un equipo ausente del mapa no recibe la señal', () => {
    expect(L.equiposConSaludFlota(eqs, [], [], [], [], { 'OTRO': { pct: 0 } })[0].score.total).toBe(4);
  });
});

describe('corte de método en la tendencia (evita avisos falsos por el cambio de fórmula)', () => {
  const desde = L.SALUD_EQUIPO_METODO_DESDE;
  it('el corte es posterior al día del cambio', () => { expect(desde >= '2026-10-12').toBe(true); });
  it('valorPrevioSalud ignora snapshots anteriores al corte', () => {
    const h = { '2026-10-01': 90, '2026-10-10': 88, '2026-10-12': 60, '2026-10-13': 55 };
    expect(L.valorPrevioSalud(h, '2026-10-14')).toBe(55);
    expect(L.valorPrevioSalud(h, '2026-10-14', '2026-10-12')).toBe(55);
    expect(L.valorPrevioSalud(h, '2026-10-12', '2026-10-12')).toBeNull();      // nada de la fórmula nueva antes de hoy: sin "ayer" → no hay cruce
    expect(L.valorPrevioSalud(h, '2026-10-11')).toBe(88);                       // sin corte: comportamiento anterior
  });
  it('la tendencia no compara contra un snapshot de la fórmula anterior', () => {
    const h = { '2026-10-08': 90, '2026-10-12': 60, '2026-10-15': 58 };
    expect(L.tendenciaSaludSemanal(h, '2026-10-15').delta).toBe(-32);                 // sin corte compararía con el viejo (90)
    expect(L.tendenciaSaludSemanal(h, '2026-10-15', '2026-10-12').delta).toBeNull();  // con corte: 3 días no es una semana
    const h2 = { '2026-10-12': 60, '2026-10-19': 50 };
    expect(L.tendenciaSaludSemanal(h2, '2026-10-19', '2026-10-12').delta).toBe(-10);  // semana completa con la fórmula nueva
  });
  it('un cruce a "Salud Baja" nunca se detecta el primer día de la fórmula nueva', () => {
    const h = { '2026-10-10': 85, '2026-10-12': 65 }; // ayer (10-10) con la fórmula vieja; hoy (10-12) ya nueva y <70
    const valorAyer = L.valorPrevioSalud(h, '2026-10-12', desde);
    const cruzo = valorAyer != null && valorAyer >= 70 && 65 < 70;
    expect(cruzo).toBe(false);
  });
});
