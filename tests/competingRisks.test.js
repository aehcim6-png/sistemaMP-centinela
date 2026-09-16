import { describe, it, expect } from 'vitest';
const { competingRisks, competingRisksPorEquipo } = require('../logic.js');

describe('competingRisks', () => {
  it('con menos de 5 observaciones, o sin ninguna falla real, devuelve null', () => {
    expect(competingRisks([])).toBeNull();
    expect(competingRisks(undefined)).toBeNull();
    expect(competingRisks([{ tiempo: 1, causa: 'Motor', censurado: false }, { tiempo: 2, causa: 'Motor', censurado: false }])).toBeNull();
    const soloCensurados = [1, 2, 3, 4, 5].map((t) => ({ tiempo: t, censurado: true }));
    expect(competingRisks(soloCensurados)).toBeNull();
  });

  it('caso exacto calculado a mano y verificado con script Python — CIF final y propiedad de conservación (ΣCIF + S = 1)', () => {
    const obs = [
      { tiempo: 100, causa: 'Motor', censurado: false },
      { tiempo: 150, causa: 'Transmision', censurado: false },
      { tiempo: 200, causa: 'Motor', censurado: false },
      { tiempo: 250, causa: null, censurado: true },
      { tiempo: 300, causa: 'Motor', censurado: false },
    ];
    const r = competingRisks(obs);
    expect(r.n).toBe(5);
    expect(r.nFallas).toBe(4);
    expect(r.nCensurados).toBe(1);
    expect(r.cifFinal.Motor).toBeCloseTo(0.8, 3);
    expect(r.cifFinal.Transmision).toBeCloseTo(0.2, 3);
    expect(r.supervivenciaFinal).toBeCloseTo(0, 3);
    // Propiedad de conservación: toda la probabilidad se reparte entre las causas y "sigue vivo".
    const sumaCif = Object.values(r.cifFinal).reduce((a, b) => a + b, 0);
    expect(sumaCif + r.supervivenciaFinal).toBeCloseTo(1, 3);
  });

  it('el ranking queda ordenado de mayor a menor CIF — la causa más probable primero', () => {
    const obs = [
      { tiempo: 100, causa: 'Motor', censurado: false },
      { tiempo: 150, causa: 'Transmision', censurado: false },
      { tiempo: 200, causa: 'Motor', censurado: false },
      { tiempo: 250, causa: null, censurado: true },
      { tiempo: 300, causa: 'Motor', censurado: false },
    ];
    const r = competingRisks(obs);
    expect(r.ranking.map((x) => x.causa)).toEqual(['Motor', 'Transmision']);
    expect(r.ranking[0].cif).toBeGreaterThan(r.ranking[1].cif);
  });

  it('caso con 3 causas y varios equipos, tiempos empatados — verificado también con script Python (CIF: Hidraulico=0.4, Motor=0.4, Transmision=0.2)', () => {
    const obs = [
      { tiempo: 1000, causa: 'Transmision', censurado: false },
      { tiempo: 1500, causa: 'Motor', censurado: false },
      { tiempo: 1500, causa: 'Motor', censurado: false },
      { tiempo: 1500, causa: null, censurado: true },
      { tiempo: 1400, causa: 'Motor', censurado: false },
      { tiempo: 1700, causa: 'Hidraulico', censurado: false },
      { tiempo: 1100, causa: 'Motor', censurado: false },
      { tiempo: 1400, causa: 'Transmision', censurado: false },
      { tiempo: 1500, causa: 'Hidraulico', censurado: false },
      { tiempo: 1500, causa: null, censurado: true },
    ];
    const r = competingRisks(obs);
    expect(r.cifFinal.Hidraulico).toBeCloseTo(0.4, 3);
    expect(r.cifFinal.Motor).toBeCloseTo(0.4, 3);
    expect(r.cifFinal.Transmision).toBeCloseTo(0.2, 3);
    expect(r.supervivenciaFinal).toBeCloseTo(0, 3);
  });

  it('descarta tiempos inválidos (tiempo<=0)', () => {
    const obs = [
      { tiempo: 0, causa: 'Motor', censurado: false },
      { tiempo: -5, causa: 'Motor', censurado: false },
      { tiempo: 100, causa: 'Motor', censurado: false },
      { tiempo: 200, causa: 'Transmision', censurado: false },
      { tiempo: 300, causa: 'Motor', censurado: false },
      { tiempo: 400, causa: 'Hidraulico', censurado: false },
      { tiempo: 500, causa: 'Motor', censurado: false },
    ];
    const r = competingRisks(obs);
    expect(r.n).toBe(5);
  });
});

describe('competingRisksPorEquipo', () => {
  function ev(sigla, componente, horom) {
    return { sigla, componente, horom };
  }

  it('agrupa por EQUIPO (no por componente) — junta todos los componentes de un mismo equipo para comparar causas entre sí', () => {
    const eventos = [
      ev('CN-1', 'Transmision', 1000), ev('CN-1', 'Motor', 2500), ev('CN-1', 'Motor', 3900), ev('CN-1', 'Motor', 5000),
      ev('CN-2', 'Transmision', 800), ev('CN-2', 'Motor', 2200), ev('CN-2', 'Hidraulico', 3900),
      ev('CN-3', 'Motor', 1500), ev('CN-3', 'Motor', 2600), ev('CN-3', 'Transmision', 4000), ev('CN-3', 'Hidraulico', 5500),
    ];
    const eq = [
      { sigla: 'CN-1', horomActual: 6500 },
      { sigla: 'CN-2', horomActual: 3900 },
      { sigla: 'CN-3', horomActual: 7000 },
    ];
    const r = competingRisksPorEquipo(eventos, eq);
    expect(r).not.toBeNull();
    // Motor y Hidraulico deberían aparecer con CIF alta en este set — el
    // ranking exacto ya está verificado a mano en el test de competingRisks;
    // acá solo se confirma que el wrapper arma bien las observaciones.
    expect(r.ranking.length).toBeGreaterThan(1);
    expect(r.nCensurados).toBeGreaterThan(0);
  });

  it('ignora eventos sin sigla/componente/horom válido', () => {
    const eventos = [{ sigla: '', componente: 'Motor', horom: 100 }, { sigla: 'CN-1', componente: '', horom: 100 }, { sigla: 'CN-1', componente: 'Motor', horom: 0 }];
    expect(competingRisksPorEquipo(eventos, [])).toBeNull();
  });

  it('sin dato de equipo (o sin avance de horómetro), no inventa censura', () => {
    const eventos = [
      ev('CN-9', 'Motor', 100), ev('CN-9', 'Transmision', 200), ev('CN-9', 'Motor', 300), ev('CN-9', 'Motor', 450),
      ev('CN-8', 'Hidraulico', 150), ev('CN-8', 'Motor', 350), ev('CN-8', 'Transmision', 600),
    ];
    const r = competingRisksPorEquipo(eventos, []);
    expect(r).not.toBeNull();
    expect(r.nCensurados).toBe(0);
  });
});
