import { describe, it, expect } from 'vitest';
const { mcf, mcfCorrectivosPorComponente } = require('../logic.js');

describe('mcf', () => {
  it('con menos de 5 fallas totales, devuelve null (mismo umbral mínimo que Weibull/Kaplan-Meier)', () => {
    expect(mcf([])).toBeNull();
    expect(mcf(undefined)).toBeNull();
    expect(mcf([{ fin: 100, eventos: [10, 20, 30, 40] }])).toBeNull();
  });

  it('sistemas sin ningún evento, devuelve null — no hay ninguna falla que acumular', () => {
    const sistemas = [1, 2, 3, 4, 5].map((i) => ({ fin: 100, eventos: [] }));
    expect(mcf(sistemas)).toBeNull();
  });

  it('curva exacta calculada a mano — 5 sistemas, fallas recurrentes y censura escalonada', () => {
    // A y B: 2 fallas c/u (20 y 60/80). C: 1 falla (40). D: 0 fallas, sigue hasta el final.
    // E: 0 fallas, pero sale de observación en 50 (censurado antes de 60/80).
    const sistemas = [
      { fin: 100, eventos: [20, 60] },
      { fin: 100, eventos: [20, 80] },
      { fin: 100, eventos: [40] },
      { fin: 100, eventos: [] },
      { fin: 50, eventos: [] },
    ];
    const r = mcf(sistemas);
    expect(r.nSistemas).toBe(5);
    expect(r.nFallas).toBe(5);
    // t=20: n=5 (los 5 siguen bajo observación), d=2 (A y B) -> M=0.4
    // t=40: n=5, d=1 (C) -> M=0.6
    // t=60: n=4 (E ya salió, fin=50<60), d=1 (A) -> M=0.85
    // t=80: n=4, d=1 (B) -> M=1.1
    expect(r.curva.map((p) => p.tiempo)).toEqual([20, 40, 60, 80]);
    expect(r.curva.map((p) => p.enEstudio)).toEqual([5, 5, 4, 4]);
    expect(r.curva.map((p) => p.mcf)).toEqual([0.4, 0.6, 0.85, 1.1]);
    expect(r.mcfFinal).toBe(1.1);
  });

  it('la curva de MCF es siempre no decreciente (nunca "cura" una falla)', () => {
    const sistemas = [
      { fin: 500, eventos: [50, 120, 300] },
      { fin: 500, eventos: [80, 200] },
      { fin: 500, eventos: [90] },
      { fin: 500, eventos: [150, 400] },
      { fin: 500, eventos: [250] },
    ];
    const r = mcf(sistemas);
    for (let i = 1; i < r.curva.length; i++) {
      expect(r.curva[i].mcf).toBeGreaterThanOrEqual(r.curva[i - 1].mcf);
    }
  });

  it('el intervalo de confianza 90% (Nelson) contiene siempre el punto estimado y nunca es negativo', () => {
    const sistemas = [
      { fin: 300, eventos: [10, 50, 120] },
      { fin: 300, eventos: [30, 90] },
      { fin: 300, eventos: [60] },
      { fin: 300, eventos: [20, 200] },
      { fin: 200, eventos: [15] },
    ];
    const r = mcf(sistemas);
    r.curva.forEach((p) => {
      expect(p.ic90Min).toBeLessThanOrEqual(p.mcf);
      expect(p.ic90Max).toBeGreaterThanOrEqual(p.mcf);
      expect(p.ic90Min).toBeGreaterThanOrEqual(0);
    });
  });

  it('descarta eventos fuera de la ventana de observación del sistema (tiempo<=0 o tiempo>fin)', () => {
    const sistemas = [
      { fin: 100, eventos: [10, 20, 150, -5, 0] },
      { fin: 100, eventos: [30] },
      { fin: 100, eventos: [40] },
      { fin: 100, eventos: [50] },
    ];
    // Solo cuentan 10,20 (de A) + 30 + 40 + 50 = 5 eventos válidos
    const r = mcf(sistemas);
    expect(r.nFallas).toBe(5);
  });

  it('fallas empatadas en el mismo tiempo, en distintos sistemas, no producen NaN/Infinity', () => {
    const sistemas = [
      { fin: 100, eventos: [50] },
      { fin: 100, eventos: [50] },
      { fin: 100, eventos: [50] },
      { fin: 100, eventos: [50] },
      { fin: 100, eventos: [50] },
    ];
    const r = mcf(sistemas);
    expect(r.curva.length).toBe(1);
    expect(r.curva[0].fallas).toBe(5);
    expect(r.curva[0].mcf).toBe(1);
    expect(Number.isFinite(r.curva[0].ic90Min)).toBe(true);
    expect(Number.isFinite(r.curva[0].ic90Max)).toBe(true);
  });
});

describe('mcfCorrectivosPorComponente', () => {
  function ev(sigla, componente, horom) {
    return { sigla, componente, horom };
  }

  it('agrupa por componente a nivel flota, usando TODAS las fallas de cada equipo (no solo intervalos)', () => {
    const eventos = [
      // CN-1 Motor: 3 fallas recurrentes (a diferencia de Weibull/KM, las 3 cuentan, no solo intervalos)
      ev('CN-1', 'Motor', 1000), ev('CN-1', 'Motor', 2000), ev('CN-1', 'Motor', 3000),
      ev('CN-2', 'Motor', 500), ev('CN-2', 'Motor', 1600),
    ];
    const eq = [
      { sigla: 'CN-1', horomActual: 3800 },
      { sigla: 'CN-2', horomActual: 1600 },
    ];
    const r = mcfCorrectivosPorComponente(eventos, eq);
    const motor = r.find((x) => x.componente === 'Motor');
    expect(motor.nEquipos).toBe(2);
    expect(motor.mcf).not.toBeNull();
    expect(motor.mcf.nFallas).toBe(5);
  });

  it('sin dato de equipo, el fin de observación es la última falla registrada (no inventa censura extra)', () => {
    const eventos = [ev('CN-9', 'Frenos', 100), ev('CN-9', 'Frenos', 200), ev('CN-9', 'Frenos', 300), ev('CN-8', 'Frenos', 50), ev('CN-8', 'Frenos', 150)];
    const r = mcfCorrectivosPorComponente(eventos, []);
    const frenos = r.find((x) => x.componente === 'Frenos');
    expect(frenos.mcf.nFallas).toBe(5);
    // CN-9 sin dato de equipo -> fin=300 (su última falla), no se extiende más.
  });

  it('ignora eventos sin sigla/componente/horom válido', () => {
    const eventos = [{ sigla: '', componente: 'Motor', horom: 100 }, { sigla: 'CN-1', componente: '', horom: 100 }, { sigla: 'CN-1', componente: 'Motor', horom: 0 }];
    const r = mcfCorrectivosPorComponente(eventos, []);
    expect(r.length).toBe(0);
  });
});
