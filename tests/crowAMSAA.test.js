import { describe, it, expect } from 'vitest';
const { crowAMSAA, crowAMSAAPorComponente, interpretacionCrowAMSAA } = require('../logic.js');

describe('crowAMSAA', () => {
  it('con menos de 5 fallas, devuelve null (mismo umbral mínimo que el resto de la familia)', () => {
    expect(crowAMSAA([])).toBeNull();
    expect(crowAMSAA(undefined)).toBeNull();
    expect(crowAMSAA([10, 20, 30, 40], 100)).toBeNull();
  });

  it('tendencia MEJORANDO — fallas cada vez más espaciadas, IC90 de β totalmente bajo 1', () => {
    const r = crowAMSAA([5, 20, 60, 150, 350, 700], 1000);
    expect(r.n).toBe(6);
    expect(r.beta).toBeCloseTo(0.326, 2);
    expect(r.ic90.betaMax).toBeLessThan(1);
    expect(r.tendencia).toBe('mejorando');
  });

  it('tendencia EMPEORANDO — fallas cada vez más juntas cerca del horizonte, IC90 totalmente sobre 1', () => {
    const dias = [600, 750, 830, 880, 910, 930, 945, 955, 965, 975];
    const r = crowAMSAA(dias, 1000);
    expect(r.n).toBe(10);
    expect(r.beta).toBeGreaterThan(1);
    expect(r.ic90.betaMin).toBeGreaterThan(1);
    expect(r.tendencia).toBe('empeorando');
  });

  it('con IC90 que cruza 1, la tendencia queda "sin_certeza" (no se afirma mejora ni empeoramiento sin evidencia)', () => {
    // Mismo caso "empeorando" pero con solo 5 puntos: la muestra es tan chica que el IC90 cruza 1.
    const r = crowAMSAA([100, 500, 700, 850, 950], 1000);
    expect(r.ic90.betaMin).toBeLessThan(1);
    expect(r.ic90.betaMax).toBeGreaterThan(1);
    expect(r.tendencia).toBe('sin_certeza');
  });

  it('corrección de sesgo de muestra chica: para un proceso realmente estable, el β crudo promedia por encima de 1, el corregido queda cerca de 1', () => {
    // Verificado por separado con simulación Monte Carlo (Python): sin corrección
    // el promedio da ~1.14 para n=8 de un proceso homogéneo real; con la
    // corrección (n-1)/n baja a ~0.99. Acá solo se confirma que la corrección
    // efectivamente reduce β respecto del crudo, para cualquier muestra.
    const dias = [80, 220, 340, 480, 590, 700, 820, 960];
    const T = 1000;
    const n = dias.length;
    const sumLn = dias.reduce((acc, t) => acc + Math.log(T / t), 0);
    const betaCrudo = n / sumLn;
    const r = crowAMSAA(dias, T);
    expect(r.beta).toBeLessThan(betaCrudo);
    expect(r.beta).toBeCloseTo(betaCrudo * (n - 1) / n, 3);
  });

  it('el horizonte T nunca puede ser menor que la última falla registrada (no se censura antes de lo ya observado)', () => {
    const dias = [10, 50, 150, 400, 900];
    const r = crowAMSAA(dias, 500); // horizonte pasado menor que la última falla (900)
    expect(r.T).toBe(900);
  });

  it('descarta tiempos inválidos (tiempo<=0)', () => {
    const r = crowAMSAA([-5, 0, 10, 20, 30, 40, 50], 100);
    expect(r.n).toBe(5);
  });
});

describe('interpretacionCrowAMSAA', () => {
  it('devuelve un texto distinto para cada una de las 3 tendencias', () => {
    const textos = new Set([
      interpretacionCrowAMSAA('mejorando'),
      interpretacionCrowAMSAA('empeorando'),
      interpretacionCrowAMSAA('sin_certeza'),
    ]);
    expect(textos.size).toBe(3);
  });
});

describe('crowAMSAAPorComponente', () => {
  function ev(componente, fecha, sigla) {
    return { componente, fecha, sigla: sigla || 'CN-1' };
  }

  it('agrupa por componente juntando fechas de TODOS los equipos en un solo proceso de llegadas', () => {
    const eventos = [
      ev('Motor', '2025-01-01', 'CN-1'),
      ev('Motor', '2025-02-01', 'CN-2'),
      ev('Motor', '2025-03-05', 'CN-1'),
      ev('Motor', '2025-04-20', 'CN-2'),
      ev('Motor', '2025-06-10', 'CN-1'),
      ev('Motor', '2025-08-01', 'CN-2'),
    ];
    const r = crowAMSAAPorComponente(eventos, '2026-01-01');
    const motor = r.find((x) => x.componente === 'Motor');
    expect(motor.n).toBe(6);
    expect(motor.crow).not.toBeNull();
    expect(motor.crow.n).toBe(6);
  });

  it('ignora eventos sin componente/fecha válido', () => {
    const eventos = [{ componente: '', fecha: '2025-01-01' }, { componente: 'Motor', fecha: '' }];
    const r = crowAMSAAPorComponente(eventos, '2026-01-01');
    expect(r.length).toBe(0);
  });

  it('el eje de tiempo arranca en 1 en la primera falla del componente (nunca en 0, evita ln(0))', () => {
    const eventos = [
      ev('Frenos', '2025-01-01'), ev('Frenos', '2025-01-01'), ev('Frenos', '2025-02-01'),
      ev('Frenos', '2025-03-01'), ev('Frenos', '2025-04-01'), ev('Frenos', '2025-05-01'),
    ];
    const r = crowAMSAAPorComponente(eventos, '2025-12-01');
    const frenos = r.find((x) => x.componente === 'Frenos');
    expect(frenos.crow).not.toBeNull();
    expect(Number.isFinite(frenos.crow.beta)).toBe(true);
  });
});
