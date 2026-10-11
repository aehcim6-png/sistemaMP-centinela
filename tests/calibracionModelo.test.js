// Calibración del modelo de riesgo del fabricante contra los tramos de vida observados en la flota.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const TBO = 8000, ETA = TBO / Math.pow(-Math.log(0.95), 1 / 3);
// Vidas simuladas de una Weibull(β=3, η tal que el TBO es el B5): el modelo del fabricante es EXACTAMENTE verdadero.
const simular = (n, seed, factor = 1) => { const r = rng(seed); return Array.from({ length: n }, (_, i) => ({ sigla: 'E' + (i % 8), comp: 'Turbo', fam: 'turbo', tbo: TBO, origen: 'original', L: Math.max(ETA * Math.pow(-Math.log(1 - r()), 1 / 3) * factor, 50), censurado: false })); };

describe('puntos de control (_calibFilas)', () => {
  it('un tramo completo de 1.200 h: puntos a 0, 500 y 1.000 h; el cambio cae en la ventana del último', () => {
    const f = L._calibFilas([{ sigla: 'A', tbo: TBO, L: 1200, censurado: false }], 500, 500);
    expect(f.map(x => x.y)).toEqual([0, 0, 1]);
    expect(f[0].p).toBeCloseTo(L.tboRiesgoHorizonte(0, TBO, 500), 12);
    expect(f[2].p).toBeCloseTo(L.tboRiesgoHorizonte(1000, TBO, 500), 12);
  });
  it('un tramo abierto (censurado) solo aporta puntos cuya ventana ya terminó, todos con y=0', () => {
    const f = L._calibFilas([{ sigla: 'A', tbo: TBO, L: 1200, censurado: true }], 500, 500);
    expect(f.map(x => x.y)).toEqual([0, 0]); // t=1000 queda afuera: 1000+500 > 1200
    expect(L._calibFilas([{ sigla: 'A', tbo: TBO, L: 400, censurado: true }], 500, 500)).toEqual([]);
  });
});

describe('prueba de uniformidad (Kolmogorov)', () => {
  it('p-valor asintótico: D=0 → 1; el valor crítico clásico λ=1,358 da p≈0,05; D grande → p≈0', () => {
    expect(L._ksUniformeP(0, 50)).toBeGreaterThan(0.99);
    const n = 10000, D = 1.358 / (Math.sqrt(n) + 0.12 + 0.11 / Math.sqrt(n));
    expect(L._ksUniformeP(D, n)).toBeCloseTo(0.05, 2);
    expect(L._ksUniformeP(0.6, 50)).toBeLessThan(1e-6);
  });
});

describe('tboCalibrarGrupo', () => {
  it('si el modelo del fabricante es verdadero: compatible, O/E ≈ 1 con el 1 dentro del intervalo y uniformidad no rechazada', () => {
    const g = L.tboCalibrarGrupo(simular(80, 5));
    expect(g.veredicto.codigo).toBe('compatible');
    expect(g.OE).toBeGreaterThan(0.7); expect(g.OE).toBeLessThan(1.4);
    expect(g.OEic[0]).toBeLessThanOrEqual(1); expect(g.OEic[1]).toBeGreaterThanOrEqual(1);
    expect(g.ks.p).toBeGreaterThan(0.05);
    expect(g.mejorFlotaQueFabricante).toBe(false); // ajustar con la flota no mejora a un modelo ya verdadero
  });
  it('si los componentes duran 1/3 de lo esperado: detecta "subestima" (los cambios ocurren antes), rechaza la uniformidad y el modelo ajustado con la flota gana', () => {
    const g = L.tboCalibrarGrupo(simular(80, 5, 1 / 3));
    expect(g.veredicto.codigo).toBe('subestima');
    expect(g.OEic[0]).toBeGreaterThan(1);
    expect(g.ks.p).toBeLessThan(0.001);
    expect(g.antesTBO.frac).toBeGreaterThan(0.3);                 // esperado 5%
    expect(g.mejorFlotaQueFabricante).toBe(true);
  });
  it('si duran 2,5 veces más: detecta "sobreestima" (el modelo es más pesimista que la flota)', () => {
    const g = L.tboCalibrarGrupo(simular(80, 5, 2.5));
    expect(g.veredicto.codigo).toBe('sobreestima');
    expect(g.OEic[1]).toBeLessThan(1);
  });
  it('pocos tramos → "sin datos" y no inventa cifras', () => {
    const g = L.tboCalibrarGrupo(simular(5, 1));
    expect(g.veredicto.codigo).toBe('sin_datos');
    expect(g.OE).toBeUndefined();
  });
  it('reproducible con la misma semilla y distinto con otra', () => {
    const v = simular(60, 9);
    const a = L.tboCalibrarGrupo(v, { semilla: 3 }), b = L.tboCalibrarGrupo(v, { semilla: 3 }), c = L.tboCalibrarGrupo(v, { semilla: 4 });
    expect(a.OEic).toEqual(b.OEic);
    expect(a.OEic).not.toEqual(c.OEic);
  });
  it('los tramos de riesgo traen predicho, observado y un intervalo; lo observado crece con lo predicho cuando el modelo es verdadero', () => {
    const g = L.tboCalibrarGrupo(simular(150, 21));
    const con = g.bins.filter(b => b.n >= 30);
    expect(con.length).toBeGreaterThanOrEqual(2);
    con.forEach(b => { expect(b.ic[0]).toBeLessThanOrEqual(b.obs); expect(b.ic[1]).toBeGreaterThanOrEqual(b.obs); });
    for (let i = 1; i < con.length; i++) expect(con[i].obs).toBeGreaterThanOrEqual(con[i - 1].obs - 0.03);
  });
  it('los tramos censurados no inflan los eventos: agregar tramos abiertos cortos no cambia lo observado', () => {
    const base = simular(60, 5), conAbiertos = base.concat(Array.from({ length: 20 }, (_, i) => ({ sigla: 'E' + (i % 8), comp: 'Turbo', fam: 'turbo', tbo: TBO, origen: 'original', L: 400, censurado: true })));
    expect(L.tboCalibrarGrupo(conAbiertos, { loo: false }).observado).toBe(L.tboCalibrarGrupo(base, { loo: false }).observado);
  });
});

describe('tboVidasObservadas', () => {
  const hoy = new Date('2026-10-10');
  const eq = [{ sigla: 'CN-1', modelo: 'Komatsu HD785-7', horomActual: 12000 }, { sigla: 'TI-1', modelo: 'Doosan LCV6-LED', horomActual: 900 }];
  const ev = (sigla, comp, h, origen) => ({ sigla, comp, horomInstalacion: h, fechaInst: '2024-01-01', origen });
  it('arma los tramos entre cambios y el tramo abierto hasta el horómetro actual, con el TBO del plan', () => {
    const r = L.tboVidasObservadas([ev('CN-1', 'Alternador', 2000), ev('CN-1', 'Alternador', 7000), ev('CN-1', 'Alternador', 10000)], eq, [], 'normal', hoy);
    expect(r.vidas.map(v => [v.L, v.censurado])).toEqual([[5000, false], [3000, false], [2000, true]]);
    expect(r.vidas.every(v => v.tbo === 8000)).toBe(true);
  });
  it('dos registros del mismo cambio a menos de 24 h de horómetro no forman una vida (hallazgo con el historial real: vidas de 1 y 2 h)', () => {
    const r = L.tboVidasObservadas([ev('CN-1', 'Turbo', 5716), ev('CN-1', 'Turbo', 5718), ev('CN-1', 'Turbo', 9000)], eq, [], 'normal', hoy);
    expect(r.vidas.map(v => [v.L, v.censurado])).toEqual([[3282, false], [3000, true]]);
    expect(L.tboVidaPorOrigen([ev('CN-1', 'Turbo', 5716), ev('CN-1', 'Turbo', 5718), ev('CN-1', 'Turbo', 9000)], []).reduce((a, g) => a + g.n, 0)).toBe(1);
    // justo en el límite sí cuenta como cambio distinto
    expect(L.tboVidasObservadas([ev('CN-1', 'Turbo', 5000), ev('CN-1', 'Turbo', 5024), ev('CN-1', 'Turbo', 9000)], eq, [], 'normal', hoy).vidas.map(v => v.L)).toEqual([24, 3976, 3000]);
  });
  it('aplica el factor de aplicación al TBO', () => {
    expect(L.tboVidasObservadas([ev('CN-1', 'Alternador', 2000), ev('CN-1', 'Alternador', 7000)], eq, [], 'severa', hoy).vidas[0].tbo).toBe(6400);
  });
  it('un solo cambio da solo el tramo abierto; sin horómetro válido o equipos sin plan TBO no aportan', () => {
    expect(L.tboVidasObservadas([ev('CN-1', 'Alternador', 2000)], eq, [], 'normal', hoy).vidas).toHaveLength(1);
    expect(L.tboVidasObservadas([ev('CN-1', 'Alternador', 'x')], eq, [], 'normal', hoy).vidas).toHaveLength(0);
    expect(L.tboVidasObservadas([ev('TI-1', 'Alternador', 100), ev('TI-1', 'Alternador', 500)], eq, [], 'normal', hoy).vidas).toHaveLength(0);
    expect(L.tboVidasObservadas([ev('CN-1', 'Asiento', 100), ev('CN-1', 'Asiento', 500)], eq, [], 'normal', hoy).vidas).toHaveLength(0); // componente sin ítem en el plan
  });
  it('el origen sale del registro; sin él queda "sin dato"', () => {
    const r = L.tboVidasObservadas([ev('CN-1', 'Turbo', 1000, 'KOMATSU'), ev('CN-1', 'Turbo', 4000)], eq, [], 'normal', hoy);
    expect(r.vidas[0].origen).toBe('original'); expect(r.vidas[1].origen).toBe('sin dato');
  });
});

describe('tboCalibracionFlota', () => {
  it('separa por origen y por componente, con el total de todos', () => {
    const vidas = simular(40, 2).map((v, i) => Object.assign(v, { origen: i % 2 ? 'alternativo' : 'original' }));
    const hist = [], eq = [];
    // se arma un historial equivalente a esas vidas para pasar por el flujo completo
    vidas.forEach((v, i) => { const sigla = 'CN-' + i; eq.push({ sigla, modelo: 'Komatsu HD785-7', horomActual: 100000 }); hist.push({ sigla, comp: 'Alternador', horomInstalacion: 1000, fechaInst: '2023-01-01', origen: v.origen === 'original' ? 'KOMATSU' : 'alternativo' }, { sigla, comp: 'Alternador', horomInstalacion: 1000 + Math.round(v.L), fechaInst: '2024-01-01', origen: 'KOMATSU' }); });
    const r = L.tboCalibracionFlota({ compHist: hist, equipos: eq, compras: [], hoy: new Date() }, {});
    expect(r.nVidas).toBeGreaterThan(40);
    expect(r.porOrigen.map(x => x.clave).sort()).toEqual(['alternativo', 'original', 'sin dato'].filter(c => r.porOrigen.some(x => x.clave === c)).sort());
    expect(r.todos.nTramos).toBe(r.nVidas);
    expect(r.porComponente[0].fam).toBe('alternador');
  });
});
