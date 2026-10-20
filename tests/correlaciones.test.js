import { describe, it, expect } from 'vitest';
import { correlacionSpearman, holmAjustarP, correlacionesPares, correlacionesIndicadoresEquipos, correlacionMetalesAceite, correlacionSenalesReemplazo } from '../logic.js';

// Referencias calculadas con un script Python independiente (rangos promedio, t de Student integrada
// numéricamente y enumeración exacta de Fisher), sin usar el código de logic.js.
describe('correlacionSpearman', () => {
  it('reproduce rho y p de un ejemplo clásico (n=10)', () => {
    const r = correlacionSpearman([106, 86, 100, 101, 99, 103, 97, 113, 112, 110], [7, 0, 27, 50, 28, 29, 20, 12, 6, 17]);
    expect(r.rho).toBeCloseTo(-0.176, 3);
    expect(r.n).toBe(10);
    expect(r.p).toBeCloseTo(0.62719, 4);
    expect(r.muestraChica).toBe(false);
  });
  it('maneja empates con rangos promedio', () => {
    const r = correlacionSpearman([1, 2, 2, 3, 4, 5, 6, 7], [2, 1, 3, 3, 5, 4, 8, 7]);
    expect(r.rho).toBeCloseTo(0.898, 3);
    expect(r.p).toBeCloseTo(0.002483, 5);
    expect(r.muestraChica).toBe(true);
  });
  it('no inventa: pocos datos, variable constante o datos faltantes → null / se ignoran', () => {
    expect(correlacionSpearman([1, 2, 3, 4], [1, 2, 3, 4])).toBeNull();
    expect(correlacionSpearman([1, 1, 1, 1, 1, 1], [1, 2, 3, 4, 5, 6])).toBeNull();
    const r = correlacionSpearman([1, 2, 3, 4, 5, 6, null], [2, 4, 6, 8, 10, 12, 99]);
    expect(r.n).toBe(6);
    expect(r.rho).toBe(1);
    expect(r.p).toBe(0);
  });
});

describe('holmAjustarP', () => {
  it('ajusta de menor a mayor, nunca supera 1 y conserva null', () => {
    const aj = holmAjustarP([0.01, 0.04, null, 0.03]);
    expect(aj[0]).toBeCloseTo(0.03, 10);   // 3 × 0.01
    expect(aj[3]).toBeCloseTo(0.06, 10);   // 2 × 0.03
    expect(aj[1]).toBeCloseTo(0.06, 10);   // 1 × 0.04, pero no baja del anterior
    expect(aj[2]).toBeNull();
  });
});

describe('correlacionesPares / indicadores', () => {
  const filas = Array.from({ length: 12 }, (_, i) => ({ a: i, b: i * 2 + (i % 3), c: 12 - i, d: (i * 7) % 5 }));
  it('ordena por |rho| y marca la fuerza', () => {
    const pares = correlacionesPares(filas, ['a', 'b', 'c', 'd'], ['A', 'B', 'C', 'D']);
    expect(pares).toHaveLength(6);
    expect(Math.abs(pares[0].rho)).toBeGreaterThan(0.9);
    expect(pares[0].fuerza).toBe('fuerte');
    expect(pares.find((q) => q.a === 'a' && q.b === 'c').rho).toBe(-1);
    expect(pares[0].significativa).toBe(true);
  });
  it('con menos de 6 equipos no calcula', () => {
    expect(correlacionesIndicadoresEquipos(filas.slice(0, 5), ['a', 'b'], ['A', 'B'])).toBeNull();
    expect(correlacionesIndicadoresEquipos(filas, ['a', 'b'], ['A', 'B']).n).toBe(12);
  });
});

describe('correlacionMetalesAceite', () => {
  const muestra = (i, comp) => ({ componente: comp, descriptor: '', hierro: i * 3 + (i % 2), cobre: i * 2, plomo: (i * 5) % 7, aluminio: 12 - i, silicio: i % 4, cromo: 0 });
  it('agrupa por descriptor o componente y exige un mínimo de muestras', () => {
    const ace = [];
    for (let i = 0; i < 14; i++) ace.push(muestra(i, 'MOTOR'));
    for (let i = 0; i < 4; i++) ace.push(muestra(i, 'TRANSMISION'));
    const r = correlacionMetalesAceite(ace);
    expect(r).toHaveLength(1);
    expect(r[0].grupo).toBe('MOTOR');
    expect(r[0].n).toBe(14);
    const fe_cu = r[0].pares.find((q) => q.a === 'hierro' && q.b === 'cobre');
    expect(fe_cu.rho).toBeGreaterThan(0.9);
    const fe_al = r[0].pares.find((q) => q.a === 'hierro' && q.b === 'aluminio');
    expect(fe_al.rho).toBeLessThan(-0.9);
    // cromo siempre 0 → constante → sin correlación calculable
    expect(r[0].pares.find((q) => q.a === 'hierro' && q.b === 'cromo').rho).toBeNull();
  });
});

describe('correlacionSenalesReemplazo', () => {
  const claves = ['s1', 's2', 's3'];
  const arma = (v) => ({ senales: claves.map((c, i) => ({ clave: c, nombre: c.toUpperCase(), activa: v[i] })) });
  it('detecta señales que se encienden juntas (Fisher exacto) y las marca redundantes', () => {
    const lista = [];
    for (let i = 0; i < 8; i++) lista.push(arma([true, true, i % 2 === 0]));
    for (let i = 0; i < 2; i++) lista.push(arma([true, false, false]));
    for (let i = 0; i < 5; i++) lista.push(arma([false, false, i % 2 === 0]));
    for (let i = 0; i < 5; i++) lista.push(arma([false, false, true]));
    const r = correlacionSenalesReemplazo(lista);
    const q = r.pares.find((p) => p.a === 's1' && p.b === 's2');
    expect([q.ambas, q.soloA, q.soloB, q.ninguna]).toEqual([8, 2, 0, 10]);
    expect(q.phi).toBeGreaterThan(0.7);
    expect(q.p).toBeCloseTo(0.000714, 5);
  });
  it('referencia Fisher: tabla [[8,2],[1,5]] → p=0.03497', () => {
    const lista = [];
    for (let i = 0; i < 8; i++) lista.push(arma([true, true, null]));
    for (let i = 0; i < 2; i++) lista.push(arma([true, false, null]));
    lista.push(arma([false, true, null]));
    for (let i = 0; i < 5; i++) lista.push(arma([false, false, null]));
    const q = correlacionSenalesReemplazo(lista).pares.find((p) => p.a === 's1' && p.b === 's2');
    expect(q.p).toBeCloseTo(0.034965, 5);
    // s3 sin ningún dato → par sin calcular
    expect(correlacionSenalesReemplazo(lista).pares.find((p) => p.b === 's3').phi).toBeNull();
  });
  it('con pocos equipos no calcula', () => {
    expect(correlacionSenalesReemplazo([arma([true, false, true])])).toBeNull();
  });
});
