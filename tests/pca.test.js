// PCA de la flota: valores/vectores propios, estandarización, atípicos T², estabilidad "dejar uno afuera", variables por equipo con descartes por dato dudoso y comparación con pares (z robusto).
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

// generador determinista
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

describe('pcaAnalisis', () => {
  it('datos casi sobre una recta → PC1 explica casi todo', () => {
    const r = rng(7), X = [];
    for (let i = 0; i < 20; i++) { const t = i; X.push([t, 2 * t + (r() - 0.5) * 0.1, -t + (r() - 0.5) * 0.1]); }
    const p = L.pcaAnalisis(X, ['a', 'b', 'c']);
    expect(p.ok).toBe(true);
    expect(p.varianza[0].pct).toBeGreaterThan(0.99);
    expect(p.nRetenidos).toBe(1);
  });
  it('la suma de autovalores es el número de variables (matriz de correlación)', () => {
    const r = rng(3), X = [];
    for (let i = 0; i < 30; i++) X.push([r() * 5, r() * 100, r() * 0.01, r()]);
    const p = L.pcaAnalisis(X, ['a', 'b', 'c', 'd']);
    expect(p.varianza.reduce((s, v) => s + v.valor, 0)).toBeCloseTo(4, 6);
    expect(p.varianza[3].acumulado).toBeCloseTo(1, 6);
  });
  it('es invariante a la escala de las unidades', () => {
    const r = rng(11), X = [];
    for (let i = 0; i < 25; i++) { const t = r(); X.push([t + r() * 0.3, 2 * t + r() * 0.3, r()]); }
    const Y = X.map((f) => [f[0] * 1000, f[1] / 50, f[2] + 400]);
    const a = L.pcaAnalisis(X, ['a', 'b', 'c']), b = L.pcaAnalisis(Y, ['a', 'b', 'c']);
    a.varianza.forEach((v, k) => expect(v.pct).toBeCloseTo(b.varianza[k].pct, 6));
    a.equipos.forEach((e, i) => expect(Math.abs(e.puntajes[0])).toBeCloseTo(Math.abs(b.equipos[i].puntajes[0]), 6));
  });
  it('los puntajes de componentes distintos no están correlacionados', () => {
    const r = rng(5), X = [];
    for (let i = 0; i < 40; i++) { const t = r(); X.push([t + r() * 0.2, t * 2 + r() * 0.5, r(), t - r() * 0.4]); }
    const p = L.pcaAnalisis(X, ['a', 'b', 'c', 'd']);
    const s = p.equipos.reduce((a, e) => a + e.puntajes[0] * e.puntajes[1], 0);
    expect(Math.abs(s)).toBeLessThan(1e-8);
  });
  it('un equipo con valores extremos queda marcado como lejano (T²) y se informa la variable', () => {
    const r = rng(9), X = [];
    for (let i = 0; i < 20; i++) { const t = r(); X.push([t + r() * 0.1, t + r() * 0.1, r() * 0.1, 5 + r()]); }
    X.push([0.5, 0.5, 0.05, 60]);
    const p = L.pcaAnalisis(X, ['a', 'b', 'c', 'd']);
    const raro = p.equipos.find((e) => e.fila === 20);
    expect(raro.lejos).toBe(true);
    expect(raro.variableMayor).toBe('d');
    expect(raro.zMayor).toBeGreaterThan(3);
  });
  it('excluye filas con datos faltantes y columnas constantes', () => {
    const r = rng(2), X = [];
    for (let i = 0; i < 12; i++) X.push([r(), r() * 3, r() * 9, 7]);
    X.push([1, null, 2, 7]);
    const p = L.pcaAnalisis(X, ['a', 'b', 'c', 'k']);
    expect(p.ok).toBe(true);
    expect(p.excluidas).toEqual([12]);
    expect(p.constantes).toEqual(['k']);
    expect(p.p).toBe(3);
  });
  it('con menos de 8 equipos o menos de 3 variables no calcula y explica por qué', () => {
    const X = [[1, 2, 3], [2, 1, 4], [3, 5, 1], [4, 2, 2]];
    const a = L.pcaAnalisis(X, ['a', 'b', 'c']);
    expect(a.ok).toBe(false);
    expect(a.motivo).toMatch(/al menos 8/);
    const r = rng(1), Y = [];
    for (let i = 0; i < 12; i++) Y.push([r(), r()]);
    expect(L.pcaAnalisis(Y, ['a', 'b']).ok).toBe(false);
  });
  it('el signo de los ejes es determinista', () => {
    const r = rng(4), X = [];
    for (let i = 0; i < 15; i++) { const t = r(); X.push([t, t * 2 + r() * 0.2, r()]); }
    const a = L.pcaAnalisis(X, ['a', 'b', 'c']), b = L.pcaAnalisis(X, ['a', 'b', 'c']);
    expect(a.cargas).toEqual(b.cargas);
    expect(a.vectores[0].reduce((s, x) => s + x, 0)).toBeGreaterThan(0);
  });
  it('estabilidad: eje claro → estable; un solo equipo que lo arrastra → inestable', () => {
    const r = rng(8), X = [];
    for (let i = 0; i < 30; i++) { const t = r() * 10; X.push([t, t * 1.5 + r() * 0.3, -t + r() * 0.3]); }
    expect(L.pcaAnalisis(X, ['a', 'b', 'c']).estabilidadPC1.estable).toBe(true);
    const Y = []; const q = rng(21);
    for (let i = 0; i < 9; i++) Y.push([q(), q(), q(), q()]);
    Y.push([40, 40, -3, 0.5]);
    const p = L.pcaAnalisis(Y, ['a', 'b', 'c', 'd']);
    expect(p.estabilidadPC1.estable).toBe(false);
    expect(p.estabilidadPC1.equipoQueMasLoMueve).toBe(9);
  });
});

describe('_eigenSimetrica', () => {
  it('diagonaliza una matriz conocida', () => {
    const e = L._eigenSimetrica([[2, 1], [1, 2]]);
    expect(e.valores[0]).toBeCloseTo(3, 9);
    expect(e.valores[1]).toBeCloseTo(1, 9);
    expect(Math.abs(e.vectores[0][0])).toBeCloseTo(Math.SQRT1_2, 9);
  });
});

const hist = (sigla, desde, dias, h0, usoDia) => {
  const out = [];
  for (let d = 0; d <= dias; d += 10) {
    const f = new Date(new Date(desde + 'T12:00:00Z').getTime() + d * 86400000).toISOString().slice(0, 10);
    out.push({ sigla, fecha: f, horom: h0 + usoDia * d });
  }
  return out;
};
const reportab = (sigla, desde, n, fs) => {
  const out = [];
  for (let d = 0; d < n; d++) {
    const f = new Date(new Date(desde + 'T12:00:00Z').getTime() + d * 86400000).toISOString().slice(0, 10);
    out.push({ sigla, fecha: f, estatus: d < fs ? 'FS' : 'OP' });
  }
  return out;
};

describe('pcaVariablesEquipos', () => {
  const hoy = '2026-10-11';
  const eq = [
    { sigla: 'CN-1', tipo: 'Camión', modelo: 'HD785-7', horomActual: 30000 },
    { sigla: 'CN-2', tipo: 'Camión', modelo: 'HD785-7', horomActual: 30000 },
    { sigla: 'CN-3', tipo: 'Camión', modelo: 'HD785-7', horomActual: 30000 },
    { sigla: 'CN-4', tipo: 'Camión', modelo: 'HD785-7', horomActual: 30000 },
    { sigla: 'CN-5', tipo: 'Camión', modelo: 'HD785-7', horomActual: 30000 },
    { sigla: 'KM-1', tipo: 'Camioneta', unidad: 'km', horomActual: 9000 },
  ];
  const mk = () => {
    let h = [];
    ['CN-1', 'CN-2', 'CN-3'].forEach((s) => { h = h.concat(hist(s, '2025-12-01', 300, 20000, 15)); });
    h = h.concat(hist('CN-4', '2026-09-01', 30, 100, 15));            // menos de 60 días
    h = h.concat([{ sigla: 'CN-5', fecha: '2026-01-01', horom: 5 }, { sigla: 'CN-5', fecha: '2026-04-11', horom: 3105 }]);   // 30 h/día: dudoso
    return h;
  };
  const eventos = ['CN-1', 'CN-2', 'CN-3', 'CN-5'].flatMap((s) => [0, 1, 2, 3].map((k) => ({ sigla: s, fecha: '2026-0' + (k + 3) + '-10', durH: 8 + k })));
  const rep = ['CN-1', 'CN-2', 'CN-3', 'CN-4', 'CN-5'].flatMap((s) => reportab(s, '2026-01-01', 200, 10));

  it('arma las variables del equipo con lecturas, eventos y reportes completos', () => {
    const r = L.pcaVariablesEquipos({ equipos: eq, eventos, hist: mk(), reportab: rep, hoy }, {});
    const f = r.filas.find((x) => x.sigla === 'CN-1');
    expect(f.vars).not.toBeNull();
    expect(f.vars.uso).toBeCloseTo(15, 3);
    expect(f.vars.mttr).toBeCloseTo(9.5, 6);
    expect(f.vars.fsPct).toBeCloseTo(5, 6);
    expect(f.vars.fallas1000).toBeCloseTo(4 / (15 * 300) * 1000, 6);
  });
  it('descarta con motivo: horómetro dudoso, pocos días y los de km', () => {
    const r = L.pcaVariablesEquipos({ equipos: eq, eventos, hist: mk(), reportab: rep, hoy }, {});
    expect(r.filas.find((x) => x.sigla === 'CN-5').motivo).toMatch(/horómetro dudoso/);
    expect(r.filas.find((x) => x.sigla === 'CN-4').motivo).toMatch(/60 días/);
    expect(r.filas.find((x) => x.sigla === 'KM-1')).toBeUndefined();
  });
  it('sin duraciones registradas no se inventa el MTTR: se descarta', () => {
    const sinDur = eventos.map((e) => ({ sigla: e.sigla, fecha: e.fecha }));
    const r = L.pcaVariablesEquipos({ equipos: eq, eventos: sinDur, hist: mk(), reportab: rep, hoy }, {});
    expect(r.filas.find((x) => x.sigla === 'CN-1').motivo).toMatch(/duración/);
  });
});

describe('paresZRobusto', () => {
  it('el valor que se aleja del grupo tiene |z| alto y la mediana no se deja arrastrar', () => {
    const vals = [10, 11, 12, 13, 12, 11, 50].map((x) => ({ k: x }));
    const z = L.paresZRobusto(vals, ['k']).k;
    expect(z.mediana).toBe(12);
    expect(Math.abs(z.z(50))).toBeGreaterThan(2.5);
    expect(Math.abs(z.z(12))).toBeLessThan(0.1);
  });
  it('con menos de 4 equipos no compara', () => {
    expect(L.paresZRobusto([{ k: 1 }, { k: 2 }, { k: 3 }], ['k']).k).toBeNull();
  });
  it('si más de la mitad coincide con la mediana (MAD 0) igual detecta al que se aleja', () => {
    const z = L.paresZRobusto([{ k: 5 }, { k: 5 }, { k: 5 }, { k: 5 }, { k: 9 }], ['k']).k;
    expect(z.z(9)).toBeGreaterThan(2.5);
    expect(z.z(5)).toBe(0);
  });
  it('si todos son idénticos no genera z infinitos', () => {
    const z = L.paresZRobusto([{ k: 5 }, { k: 5 }, { k: 5 }, { k: 5 }], ['k']).k;
    expect(z.z(5)).toBe(0);
    expect(z.z(6)).toBe(0);
  });
});
