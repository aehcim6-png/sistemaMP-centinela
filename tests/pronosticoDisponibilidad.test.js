// Pronóstico de disponibilidad por equipo (PM calendarizado + fallas por equipo + eventos abiertos) y su backtest.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const mkRng = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// Flota sintética: 10 camiones, fallas Poisson conocidas (por día), duración 4–24 h, 540 días de historia.
function flota(seed, opts) {
  const o = Object.assign({ dias: 540, hoy: '2026-10-01', tasas: [0.02, 0.02, 0.03, 0.03, 0.04, 0.04, 0.05, 0.05, 0.07, 0.09], pm: true }, opts);
  const rng = mkRng(seed), base = new Date(o.hoy + 'T12:00:00').getTime() - o.dias * 86400000;
  const eq = [], ot = [], reg = [];
  o.tasas.forEach((rate, i) => {
    eq.push({ sigla: 'CN-' + i, modelo: 'HD785', tipo: 'Camion', hrsDia: 16, frecPM: 250, horomActual: 5000 + i * 100, horomProxPM: 5250, unidad: 'hr' });
    for (let d = 0; d < o.dias; d++) {
      const f = iso(base + d * 86400000);
      if (rng() < rate) ot.push({ sigla: 'CN-' + i, fecha: f, fechaEntrada: f, duracion: Math.round(4 + rng() * 20) + 'h' });
      if (o.pm && d % 15 === 3) reg.push({ equipo: 'CN-' + i, fechaEntrada: f, duracionH: 6 });
    }
  });
  return { eq, ot, reg, hoy: o.hoy };
}

// Flota HD785-7 sintética con turbos que SÍ se desgastan (Weibull β=3, η=3.000 h); un camión con turbos muy pasados de vida y otro con turbos recién cambiados.
function conTurbos(seed) {
  const f = flota(seed); f.eq.forEach((e) => { e.modelo = 'Komatsu HD785-7'; });
  const rng = mkRng(seed + 1000), compHist = [];
  const edad = (i) => (i === 0 ? 6000 : i === 1 ? 50 : 1500);
  f.eq.forEach((e, i) => {
    let h = 500;
    for (let k = 0; k < 6; k++) {
      compHist.push({ sigla: e.sigla, comp: 'Turbo', fechaInst: iso(new Date('2022-01-01T12:00:00').getTime() + (i * 6 + k) * 86400000 * 30), horomInstalacion: Math.round(h), origen: 'TURBODAL' });
      h += 3000 * Math.pow(-Math.log(1 - rng()), 1 / 3);
    }
    compHist[compHist.length - 1].horomInstalacion = Math.round(h);
    e.horomActual = Math.round(h + edad(i)); e.horomProxPM = e.horomActual + 100;
  });
  return Object.assign(f, { compHist });
}

describe('pronosticoDisponibilidadEquipos', () => {
  it('sin historial suficiente devuelve null (no inventa un pronóstico)', () => {
    expect(L.pronosticoDisponibilidadEquipos([], { reg: [], ot: [], hoy: '2026-10-01' })).toBeNull();
    const e = [{ sigla: 'A', hrsDia: 12, frecPM: 250, horomActual: 100, horomProxPM: 250 }];
    expect(L.pronosticoDisponibilidadEquipos(e, { reg: [], ot: [{ sigla: 'A', fecha: '2026-09-01', duracion: '2h' }], hoy: '2026-10-01' }, { rng: mkRng(1) })).toBeNull();
  });
  it('recupera el nivel de disponibilidad de una flota sintética con tasas conocidas', () => {
    const f = flota(11);
    const r = L.pronosticoDisponibilidadEquipos(f.eq, { reg: f.reg, ot: f.ot, hoy: f.hoy }, { horizonteDias: 30, meta: 85, nSim: 1500, rng: mkRng(5) });
    // pérdida esperada ≈ fallas (tasa media 0,044/día × 30 d × 14 h) / 480 h + PM (2 × 6 h / 480 h) ≈ 4,0 % + 2,5 % → ~93,5 %
    expect(r.flota.p50).toBeGreaterThan(92); expect(r.flota.p50).toBeLessThan(95.5);
    expect(r.flota.p10).toBeLessThanOrEqual(r.flota.p50); expect(r.flota.p50).toBeLessThanOrEqual(r.flota.p90);
    expect(r.flota.intrinseca.p50).toBeGreaterThan(r.flota.p50);          // sin PM siempre mejor
    expect(r.flota.probMeta).toBe(100);
    expect(r.equipos).toHaveLength(10);
    const masFallas = r.equipos.slice().sort((a, b) => b.fallasHist - a.fallasHist)[0].sigla;
    expect(r.equipos.slice(0, 3).map((e) => e.sigla)).toContain(masFallas);   // el de más fallas está entre los que más restan
    for (let i = 1; i < r.equipos.length; i++) expect(r.equipos[i - 1].perdidaPuntosFlota).toBeGreaterThanOrEqual(r.equipos[i].perdidaPuntosFlota);
    expect(r.equipos[0].fallasEsperadas).toBeGreaterThan(r.equipos[9].fallasEsperadas);
  });
  it('un equipo con poca historia se acerca al promedio (estabilización Gamma-Poisson)', () => {
    const f = flota(21);
    const r = L.pronosticoDisponibilidadEquipos(f.eq, { reg: f.reg, ot: f.ot, hoy: f.hoy }, { nSim: 800, rng: mkRng(2) });
    const crudo = (s) => f.ot.filter((o) => o.sigla === s).length;
    const prom = f.ot.length / 10;
    const alto = r.equipos.find((e) => e.sigla === 'CN-9');
    expect(alto.fallasEsperadas).toBeLessThan(crudo('CN-9') / 540 * 30 + 0.3);   // no sube más que lo observado
    expect(alto.fallasEsperadas).toBeGreaterThan(prom / 540 * 30 - 0.1);          // y queda sobre el promedio
  });
  it('un fuera de servicio abierto y prolongado se asume que sigue fuera todo el horizonte, y se informa la cifra si se cierra', () => {
    const f = flota(31);
    const abierto = f.ot.concat([{ sigla: 'CN-0', fecha: '2026-03-01', fechaEntrada: '2026-03-01', estatusEq: 'Fuera de Servicio', criticidad: 'Reparación Inmediata' }]);
    const r = L.pronosticoDisponibilidadEquipos(f.eq, { reg: f.reg, ot: abierto, hoy: f.hoy }, { nSim: 800, rng: mkRng(3) });
    const base = L.pronosticoDisponibilidadEquipos(f.eq, { reg: f.reg, ot: f.ot, hoy: f.hoy }, { nSim: 800, rng: mkRng(3) });
    expect(r.prolongados.map((p) => p.sigla)).toEqual(['CN-0']);
    expect(r.prolongados[0].dias).toBeGreaterThan(150);
    expect(r.equipos.find((e) => e.sigla === 'CN-0').dispP50).toBe(0);
    expect(r.flota.p50).toBeLessThan(base.flota.p50 - 7);                    // 1 de 10 equipos fuera ≈ −10 puntos
    expect(r.flota.sinProlongados.p50).toBeGreaterThan(r.flota.p50 + 7);
    expect(base.prolongados).toEqual([]); expect(base.flota.sinProlongados).toBeNull();
  });
  it('un evento abierto reciente (menos que lo habitual) solo suma lo que falta, no todo el horizonte', () => {
    const f = flota(41);
    const ot = f.ot.concat([{ sigla: 'CN-1', fecha: '2026-09-30', fechaEntrada: '2026-09-30', estatusEq: 'Fuera de Servicio', criticidad: 'Reparación Inmediata' }]);
    const r = L.pronosticoDisponibilidadEquipos(f.eq, { reg: f.reg, ot, hoy: f.hoy }, { nSim: 600, rng: mkRng(4) });
    expect(r.prolongados).toEqual([]);
    expect(r.equipos.find((e) => e.sigla === 'CN-1').enCurso).toBe(true);
  });
  it('si el último registro es más viejo que 14 días, la historia termina ahí (los días sin carga no son días sin fallas)', () => {
    const f = flota(51, { hoy: '2026-06-01' });
    const r = L.pronosticoDisponibilidadEquipos(f.eq, { reg: f.reg, ot: f.ot, hoy: '2026-10-01' }, { nSim: 400, rng: mkRng(6) });
    expect(r.diasSinCarga).toBeGreaterThan(100);
    expect(r.datosHasta <= '2026-06-01').toBe(true);
    const sinCorte = L.pronosticoDisponibilidadEquipos(f.eq, { reg: f.reg, ot: f.ot, hoy: '2026-06-01' }, { nSim: 400, rng: mkRng(6) });
    expect(Math.abs(r.eventosHist - sinCorte.eventosHist)).toBeLessThanOrEqual(10);   // misma historia (la ventana de 365 días se corre unos días)
  });
  it('los PM calendarizados restan: más PM en el horizonte, menos disponibilidad operacional pero igual intrínseca', () => {
    const f = flota(61, { pm: false });
    const poco = f.eq.map((e) => Object.assign({}, e, { horomProxPM: 5250 + 4000 }));            // ningún PM en 30 días
    const mucho = f.eq.map((e) => Object.assign({}, e, { frecPM: 100, horomProxPM: 5100 }));      // varios PM en 30 días
    const a = L.pronosticoDisponibilidadEquipos(poco, { reg: [], ot: f.ot, hoy: f.hoy }, { nSim: 600, rng: mkRng(7) });
    const b = L.pronosticoDisponibilidadEquipos(mucho, { reg: [], ot: f.ot, hoy: f.hoy }, { nSim: 600, rng: mkRng(7) });
    expect(b.equipos[0].pmProgramados).toBeGreaterThan(a.equipos[0].pmProgramados);
    expect(b.flota.p50).toBeLessThan(a.flota.p50);
    expect(Math.abs(b.flota.intrinseca.p50 - a.flota.intrinseca.p50)).toBeLessThan(0.5);
  });
  it('excluye los equipos medidos en km', () => {
    const f = flota(71);
    const eq = f.eq.concat([{ sigla: 'CA-1', modelo: 'Hilux', hrsDia: 200, frecPM: 10000, horomActual: 1, horomProxPM: 10000, unidad: 'km' }]);
    expect(L.pronosticoDisponibilidadEquipos(eq, { reg: f.reg, ot: f.ot, hoy: f.hoy }, { nSim: 200, rng: mkRng(8) }).nEquipos).toBe(10);
  });
});


describe('pronóstico con la edad de los componentes', () => {
  it('con componentes que se desgastan: el camión con turbos pasados de vida suma fallas, el de turbos nuevos resta, y la flota baja', () => {
    const f = conTurbos(3);
    const d = { reg: f.reg, ot: f.ot, hoy: f.hoy, compHist: f.compHist, compras: [] };
    const con = L.pronosticoDisponibilidadEquipos(f.eq, d, { nSim: 800, rng: mkRng(2) });
    const g = con.componentes.gruposModelados[0];
    expect(g.fam).toBe('turbo'); expect(g.beta).toBeGreaterThan(2); expect(g.beta).toBeLessThan(4.2);
    const viejo = con.equipos.find((e) => e.sigla === 'CN-0'), nuevo = con.equipos.find((e) => e.sigla === 'CN-1');
    expect(viejo.ajusteComponentes).toBeGreaterThan(0.5); expect(nuevo.ajusteComponentes).toBeLessThan(0);
    expect(viejo.componentes[0].desdeH).toBeGreaterThan(5000);
    expect(viejo.fallasEsperadas).toBeGreaterThan(nuevo.fallasEsperadas);
    // el ajuste redistribuye el riesgo entre equipos (unos suben, otros bajan): el total de la flota casi no se mueve
    expect(con.componentes.equiposAjustados).toBe(10);
    expect(Math.abs(con.componentes.fallasExtra)).toBeLessThan(0.5);
    expect(Math.abs(con.flota.p50 - con.componentes.sinAjuste.p50)).toBeLessThan(1);
  });
  it('el ajuste está acotado: no suma más de 3 fallas por equipo ni quita más de la mitad de su tasa base', () => {
    const f = conTurbos(4);
    const r = L.pronosticoDisponibilidadEquipos(f.eq, { reg: f.reg, ot: f.ot, hoy: f.hoy, compHist: f.compHist, compras: [] }, { nSim: 300, rng: mkRng(3) });
    r.equipos.forEach((e) => { expect(e.ajusteComponentes).toBeLessThanOrEqual(3.0001); });
    const nuevo = r.equipos.find((e) => e.sigla === 'CN-1');
    expect(nuevo.fallasEsperadas).toBeGreaterThanOrEqual(0.5 * nuevo.fallasHist / 540 * 30 - 0.15);
  });
  it('sin historial de componentes, o con componentes:false, el pronóstico no cambia (no hay ajuste)', () => {
    const f = conTurbos(5);
    const base = L.pronosticoDisponibilidadEquipos(f.eq, { reg: f.reg, ot: f.ot, hoy: f.hoy }, { nSim: 400, rng: mkRng(9) });
    const apagado = L.pronosticoDisponibilidadEquipos(f.eq, { reg: f.reg, ot: f.ot, hoy: f.hoy, compHist: f.compHist, compras: [] }, { nSim: 400, rng: mkRng(9), componentes: false });
    expect(base.componentes.gruposModelados).toEqual([]); expect(base.componentes.equiposAjustados).toBe(0);
    expect(apagado.flota.p50).toBe(base.flota.p50);
  });
  it('un componente con menos de 5 vidas completas medidas no se modela (el TBO del fabricante es una política, no una tasa de falla)', () => {
    const f = conTurbos(6);
    const pocas = f.compHist.filter((r) => r.sigla === 'CN-0').slice(0, 4);   // 3 vidas completas + 1 en curso
    const r = L.pronosticoDisponibilidadEquipos(f.eq, { reg: f.reg, ot: f.ot, hoy: f.hoy, compHist: pocas, compras: [] }, { nSim: 300, rng: mkRng(4) });
    expect(r.componentes.gruposModelados).toEqual([]);
  });
});

describe('backtestPronosticoDisponibilidad', () => {
  it('repite el pronóstico desde meses pasados y compara con lo ocurrido: en datos sintéticos el rango acierta la mayoría de las veces', () => {
    const f = flota(81);
    const b = L.backtestPronosticoDisponibilidad(f.eq, { reg: f.reg, ot: f.ot, hoy: f.hoy }, { horizonteDias: 30, origenes: 6, nSim: 600, rng: mkRng(9) });
    expect(b.origenes.length).toBeGreaterThanOrEqual(5);
    expect(b.cobertura).toBeGreaterThanOrEqual(60);
    expect(b.errorMedioAbs).toBeLessThan(2.5);
    b.origenes.forEach((x) => { expect(x.fin <= f.hoy).toBe(true); expect(x.p10).toBeLessThanOrEqual(x.p90); });
  });
  it('con historial de componentes y de horómetros reconstruye el estado al origen y compara con y sin el ajuste por edad', () => {
    const f = conTurbos(7);
    const hist = f.eq.map((e) => ({ sigla: e.sigla, fecha: '2025-01-01', horom: e.horomActual - 2000 }));
    const b = L.backtestPronosticoDisponibilidad(f.eq, { reg: f.reg, ot: f.ot, hoy: f.hoy, compHist: f.compHist, hist, compras: [] }, { origenes: 3, nSim: 300, rng: mkRng(11) });
    expect(b.componentes).toBe(true);
    expect(b.sinComponentes.errorMedioAbs).toBeGreaterThanOrEqual(0);
    b.origenes.forEach((x) => { expect(typeof x.ajusteComp).toBe('number'); expect(x.sinComp.p10).toBeLessThanOrEqual(x.sinComp.p90); });
    const sin = L.backtestPronosticoDisponibilidad(f.eq, { reg: f.reg, ot: f.ot, hoy: f.hoy }, { origenes: 2, nSim: 200, rng: mkRng(11) });
    expect(sin.componentes).toBe(false);
  });
  it('no usa lo que pasó después del origen: una caída masiva posterior no cambia el pronóstico de esa fecha', () => {
    const f = flota(91);
    const choque = f.eq.map((e) => ({ sigla: e.sigla, fecha: '2026-09-10', fechaEntrada: '2026-09-10', fechaSalida: '2026-09-30', estatusEq: 'Fuera de Servicio', criticidad: 'Reparación Inmediata' }));
    const b0 = L.backtestPronosticoDisponibilidad(f.eq, { reg: f.reg, ot: f.ot, hoy: f.hoy }, { origenes: 3, nSim: 500, rng: mkRng(10) });
    const b1 = L.backtestPronosticoDisponibilidad(f.eq, { reg: f.reg, ot: f.ot.concat(choque), hoy: f.hoy }, { origenes: 3, nSim: 500, rng: mkRng(10) });
    expect(b1.origenes[0].p50).toBe(b0.origenes[0].p50);                    // origen 2026-07-03: antes del choque
    expect(b1.origenes[2].real).toBeLessThan(b0.origenes[2].real - 30);    // pero lo real del último mes sí lo refleja
  });
});
