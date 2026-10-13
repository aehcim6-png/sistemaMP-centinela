import { describe, it, expect } from 'vitest';
const { matrizJackKnife } = require('../logic.js');

describe('matrizJackKnife — cruza MTBF (confiabilidad) vs MTTR (mantenibilidad) por equipo en 4 cuadrantes, usando la mediana de la flota como línea divisoria', () => {
  it('con menos de 3 equipos con ambos datos válidos, devuelve null (mediana degenerada)', () => {
    expect(matrizJackKnife([])).toBeNull();
    expect(matrizJackKnife([{ sigla: 'A', mtbf: 100, mttr: 4 }])).toBeNull();
    expect(matrizJackKnife([{ sigla: 'A', mtbf: 100, mttr: 4 }, { sigla: 'B', mtbf: 200, mttr: 2 }])).toBeNull();
  });

  it('ignora equipos sin MTBF o sin MTTR válido al contar el mínimo de 3', () => {
    const equipos = [
      { sigla: 'A', mtbf: 100, mttr: 4 },
      { sigla: 'B', mtbf: null, mttr: 2 }, // sin MTBF (<2 fallas) — se descarta
      { sigla: 'C', mtbf: 200, mttr: 0 },  // MTTR=0 (sin reparaciones con duración) — se descarta
    ];
    expect(matrizJackKnife(equipos)).toBeNull(); // solo queda 1 equipo válido
  });

  it('clasifica en los 4 cuadrantes según la mediana de flota de MTBF y MTTR', () => {
    // medianas: MTBF [100,200,300,400,500]->300 ; MTTR [2,4,6,8,10]->6
    const equipos = [
      { sigla: 'MUNDIAL', mtbf: 500, mttr: 2 },  // MTBF alto, MTTR bajo
      { sigla: 'CRONICO', mtbf: 100, mttr: 4 },  // MTBF bajo, MTTR bajo
      { sigla: 'MEDIANA', mtbf: 300, mttr: 6 },  // en la mediana exacta -> cuenta como "alto" en ambos ejes -> agudo
      { sigla: 'AGUDO', mtbf: 400, mttr: 8 },    // MTBF alto, MTTR alto
      { sigla: 'COMPLEJO', mtbf: 200, mttr: 10 },// MTBF bajo, MTTR alto
    ];
    const r = matrizJackKnife(equipos);
    expect(r.medianaMtbf).toBe(300);
    expect(r.medianaMttr).toBe(6);
    const porSigla = {};
    r.puntos.forEach(p => { porSigla[p.sigla] = p.cuadrante; });
    expect(porSigla.MUNDIAL).toBe('mundial');
    expect(porSigla.CRONICO).toBe('cronico');
    expect(porSigla.MEDIANA).toBe('agudo'); // empate en ambas medianas -> "alto" en los dos ejes
    expect(porSigla.AGUDO).toBe('agudo');
    expect(porSigla.COMPLEJO).toBe('complejo');
    expect(r.resumen).toEqual({ mundial: 1, cronico: 1, agudo: 2, complejo: 1 });
  });

  it('descarta equipos con mtbf o mttr <= 0 (datos inválidos, no "cero real")', () => {
    const equipos = [
      { sigla: 'A', mtbf: 100, mttr: 4 },
      { sigla: 'B', mtbf: 200, mttr: 6 },
      { sigla: 'C', mtbf: -50, mttr: 5 }, // inválido
      { sigla: 'D', mtbf: 300, mttr: 8 },
    ];
    const r = matrizJackKnife(equipos);
    expect(r.puntos.length).toBe(3);
    expect(r.puntos.find(p => p.sigla === 'C')).toBeUndefined();
  });
});

describe('matrizJackKnife — horas perdidas por año y qué hacer en cada cuadrante', () => {
  const base = [
    { sigla: 'A', mtbf: 100, mttr: 4, hrsAnio: 5000 },
    { sigla: 'B', mtbf: 200, mttr: 2, hrsAnio: 5000 },
    { sigla: 'C', mtbf: 300, mttr: 8, hrsAnio: 4000 },
    { sigla: 'D', mtbf: 50, mttr: 10 },                    // sin horas de operación: no se inventan fallas/año
  ];
  it('estima fallas por año = horas de operación ÷ MTBF y horas perdidas = fallas × MTTR', () => {
    const r = require('../logic.js').matrizJackKnife(base);
    const A = r.puntos.find(p => p.sigla === 'A');
    expect(A.fallasAnio).toBeCloseTo(50, 6);
    expect(A.horasPerdidasAnio).toBeCloseTo(200, 6);
    const C = r.puntos.find(p => p.sigla === 'C');
    expect(C.horasPerdidasAnio).toBeCloseTo(4000 / 300 * 8, 6);
  });
  it('sin horas de operación el equipo queda en null y no suma al total', () => {
    const r = require('../logic.js').matrizJackKnife(base);
    const D = r.puntos.find(p => p.sigla === 'D');
    expect(D.fallasAnio).toBeNull();
    expect(D.horasPerdidasAnio).toBeNull();
    expect(r.nConHoras).toBe(3);
    expect(r.horasPerdidasAnio).toBeCloseTo(200 + 50 + 4000 / 300 * 8, 6);
  });
  it('la clasificación en cuadrantes no depende de las horas de operación', () => {
    const L = require('../logic.js');
    const con = L.matrizJackKnife(base), sin = L.matrizJackKnife(base.map(e => ({ sigla: e.sigla, mtbf: e.mtbf, mttr: e.mttr })));
    expect(con.puntos.map(p => p.cuadrante)).toEqual(sin.puntos.map(p => p.cuadrante));
    expect(sin.hrsAnioRef).toBeNull();
    expect(sin.horasPerdidasAnio).toBe(0);
  });
  it('trae una recomendación para cada cuadrante y las pérdidas por cuadrante suman el total', () => {
    const r = require('../logic.js').matrizJackKnife(base);
    ['complejo', 'agudo', 'cronico', 'mundial'].forEach(k => expect(r.acciones[k].length).toBeGreaterThan(20));
    const suma = Object.values(r.horasPerdidasPorCuadrante).reduce((a, b) => a + b, 0);
    expect(suma).toBeCloseTo(r.horasPerdidasAnio, 6);
    expect(r.hrsAnioRef).toBe(5000);                        // mediana de [5000, 5000, 4000]
  });
});
