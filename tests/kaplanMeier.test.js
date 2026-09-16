import { describe, it, expect } from 'vitest';
const { kaplanMeier, kaplanMeierCorrectivosPorComponente } = require('../logic.js');

describe('kaplanMeier', () => {
  it('sin observaciones, o menos de 5, devuelve null (mismo umbral mínimo que Weibull)', () => {
    expect(kaplanMeier([])).toBeNull();
    expect(kaplanMeier(undefined)).toBeNull();
    expect(kaplanMeier([{ tiempo: 1 }, { tiempo: 2 }, { tiempo: 3 }, { tiempo: 4 }])).toBeNull();
  });

  it('con puros censurados (ninguna falla real), devuelve null — no hay ninguna caída que estimar', () => {
    const obs = [1, 2, 3, 4, 5].map((t) => ({ tiempo: t, censurado: true }));
    expect(kaplanMeier(obs)).toBeNull();
  });

  it('5 fallas sin censura, tiempos distintos — curva exacta calculada a mano', () => {
    const obs = [1, 2, 3, 4, 5].map((t) => ({ tiempo: t, censurado: false }));
    const r = kaplanMeier(obs);
    expect(r.n).toBe(5);
    expect(r.nFallas).toBe(5);
    expect(r.nCensurados).toBe(0);
    // S(1)=1*(1-1/5)=0.8, S(2)=0.8*(1-1/4)=0.6, S(3)=0.6*(1-1/3)=0.4,
    // S(4)=0.4*(1-1/2)=0.2, S(5)=0.2*(1-1/1)=0
    expect(r.curva.map((p) => p.supervivencia)).toEqual([0.8, 0.6, 0.4, 0.2, 0]);
    expect(r.curva.map((p) => p.enRiesgo)).toEqual([5, 4, 3, 2, 1]);
    // Mediana: primer tiempo donde S<=0.5 -> t=3 (S=0.4)
    expect(r.medianaSupervivencia).toBe(3);
  });

  it('con censura en el último tiempo, la curva NO llega a 0 (diferencia real vs. sin censura)', () => {
    const obs = [
      { tiempo: 1, censurado: false },
      { tiempo: 2, censurado: false },
      { tiempo: 3, censurado: false },
      { tiempo: 4, censurado: false },
      { tiempo: 5, censurado: true },
    ];
    const r = kaplanMeier(obs);
    expect(r.nFallas).toBe(4);
    expect(r.nCensurados).toBe(1);
    // Mismos primeros 4 pasos que el caso sin censura, pero nunca llega a 0
    // porque el tiempo 5 es censurado (no es una falla).
    expect(r.curva.map((p) => p.supervivencia)).toEqual([0.8, 0.6, 0.4, 0.2]);
    expect(r.curva[r.curva.length - 1].supervivencia).toBeGreaterThan(0);
  });

  it('fallas empatadas en el mismo tiempo (todo el grupo en riesgo falla junto) no produce NaN/Infinity', () => {
    const obs = [1, 1, 1, 1, 1].map((t) => ({ tiempo: t, censurado: false }));
    const r = kaplanMeier(obs);
    expect(r.curva.length).toBe(1);
    expect(r.curva[0].fallas).toBe(5);
    expect(r.curva[0].enRiesgo).toBe(5);
    expect(r.curva[0].supervivencia).toBe(0);
    expect(Number.isFinite(r.curva[0].ic90Min)).toBe(true);
    expect(Number.isFinite(r.curva[0].ic90Max)).toBe(true);
  });

  it('mediana queda null cuando la curva nunca cae a <=0.5 (la única falla es temprana con mucho en riesgo)', () => {
    const obs = [
      { tiempo: 5, censurado: false },
      { tiempo: 10, censurado: true },
      { tiempo: 20, censurado: true },
      { tiempo: 30, censurado: true },
      { tiempo: 40, censurado: true },
    ];
    const r = kaplanMeier(obs);
    // S(5) = 1*(1-1/5) = 0.8, sin más fallas después -> nunca cae a 0.5
    expect(r.curva[0].supervivencia).toBe(0.8);
    expect(r.medianaSupervivencia).toBeNull();
  });

  it('el intervalo de confianza 90% (Greenwood) contiene siempre el punto estimado y respeta [0,1]', () => {
    const obs = [1, 3, 3, 6, 8, 10].map((t) => ({ tiempo: t, censurado: false }));
    const r = kaplanMeier(obs);
    r.curva.forEach((p) => {
      expect(p.ic90Min).toBeLessThanOrEqual(p.supervivencia);
      expect(p.ic90Max).toBeGreaterThanOrEqual(p.supervivencia);
      expect(p.ic90Min).toBeGreaterThanOrEqual(0);
      expect(p.ic90Max).toBeLessThanOrEqual(1);
    });
  });

  it('descarta observaciones con tiempo<=0 (dato inválido)', () => {
    const obs = [
      { tiempo: 0, censurado: false },
      { tiempo: -5, censurado: false },
      { tiempo: 1, censurado: false },
      { tiempo: 2, censurado: false },
      { tiempo: 3, censurado: false },
      { tiempo: 4, censurado: false },
      { tiempo: 5, censurado: false },
    ];
    const r = kaplanMeier(obs);
    expect(r.n).toBe(5);
  });
});

describe('kaplanMeierCorrectivosPorComponente', () => {
  function ev(sigla, componente, horom) {
    return { sigla, componente, horom };
  }

  it('agrupa por componente a nivel flota, sumando el tramo censurado de cada equipo que sigue en servicio', () => {
    // Motor en CN-1: fallas a 1000, 2000, 3000 (2 intervalos de 1000 c/u) + censurado
    // desde la última falla (3000) hasta el horómetro actual (3800) = 800.
    const eventos = [
      ev('CN-1', 'Motor', 1000), ev('CN-1', 'Motor', 2000), ev('CN-1', 'Motor', 3000),
      // Motor en CN-2: fallas a 500, 1600, 2500 (2 intervalos: 1100, 900) + censurado
      // desde 2500 hasta 2500 (mismo horómetro actual, sin uso adicional -> sin censura).
      ev('CN-2', 'Motor', 500), ev('CN-2', 'Motor', 1600), ev('CN-2', 'Motor', 2500),
    ];
    const eq = [
      { sigla: 'CN-1', horomActual: 3800 },
      { sigla: 'CN-2', horomActual: 2500 },
    ];
    const r = kaplanMeierCorrectivosPorComponente(eventos, eq);
    const motor = r.find((x) => x.componente === 'Motor');
    // 2 intervalos de CN-1 + 1 censurado de CN-1 + 2 intervalos de CN-2 (CN-2 sin censura, horomActual==última falla)
    expect(motor.n).toBe(5);
    expect(motor.km).not.toBeNull();
    expect(motor.km.nCensurados).toBe(1);
    expect(motor.km.nFallas).toBe(4);
  });

  it('sin equipo en la lista (o sin avance de horómetro), no inventa censura', () => {
    const eventos = [ev('CN-9', 'Frenos', 100), ev('CN-9', 'Frenos', 200)];
    const r = kaplanMeierCorrectivosPorComponente(eventos, []);
    const frenos = r.find((x) => x.componente === 'Frenos');
    expect(frenos.n).toBe(1); // solo el intervalo 100->200, sin censura (no hay dato del equipo)
  });

  it('ignora eventos sin sigla/componente/horom válido', () => {
    const eventos = [{ sigla: '', componente: 'Motor', horom: 100 }, { sigla: 'CN-1', componente: '', horom: 100 }, { sigla: 'CN-1', componente: 'Motor', horom: 0 }];
    const r = kaplanMeierCorrectivosPorComponente(eventos, []);
    expect(r.length).toBe(0);
  });
});
