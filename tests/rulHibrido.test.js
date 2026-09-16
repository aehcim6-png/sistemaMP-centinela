import { describe, it, expect } from 'vitest';
const { rulWeibull, rulHibridoComponente, rulHibridoPorComponente } = require('../logic.js');

describe('rulWeibull', () => {
  it('sin ajuste, edad inválida o p fuera de (0,1), devuelve null', () => {
    expect(rulWeibull(null, 3000, 0.1)).toBeNull();
    expect(rulWeibull({ beta: 2.5, eta: 5000 }, -1, 0.1)).toBeNull();
    expect(rulWeibull({ beta: 2.5, eta: 5000 }, 3000, 0)).toBeNull();
    expect(rulWeibull({ beta: 2.5, eta: 5000 }, 3000, 1)).toBeNull();
    expect(rulWeibull({ beta: 0, eta: 5000 }, 3000, 0.1)).toBeNull();
  });

  it('caso calculado a mano (β=2.5, η=5000h, edad=3000h) — verificado también con script Python', () => {
    const ajuste = { beta: 2.5, eta: 5000 };
    const b10 = rulWeibull(ajuste, 3000, 0.10);
    const b50 = rulWeibull(ajuste, 3000, 0.50);
    expect(b10).toBeCloseTo(410.4, 0);
    expect(b50).toBeCloseTo(1943.5, 0);
    // B10 (conservador) siempre <= B50 (mediana) — falla antes con mayor confianza.
    expect(b10).toBeLessThan(b50);
  });

  it('verificación matemática: R(t+RUL_p)/R(t) = 1-p exactamente (la definición del RUL)', () => {
    const ajuste = { beta: 2.2, eta: 4200 };
    const t = 1800;
    [0.1, 0.3, 0.5].forEach((p) => {
      const rul = rulWeibull(ajuste, t, p);
      const R = (x) => Math.exp(-Math.pow(x / ajuste.eta, ajuste.beta));
      const cond = R(t + rul) / R(t);
      expect(cond).toBeCloseTo(1 - p, 2);
    });
  });

  it('con β=1 (proceso sin memoria/exponencial), el RUL mediana es CONSTANTE sin importar la edad actual — propiedad matemática real de esa distribución', () => {
    const ajuste = { beta: 1, eta: 5000 };
    const r0 = rulWeibull(ajuste, 0, 0.5);
    const r1000 = rulWeibull(ajuste, 1000, 0.5);
    const r4900 = rulWeibull(ajuste, 4900, 0.5);
    expect(r0).toBeCloseTo(r1000, 0);
    expect(r1000).toBeCloseTo(r4900, 0);
  });

  it('con β>1 (desgaste), el RUL mediana DISMINUYE con la edad — a diferencia del caso β=1', () => {
    const ajuste = { beta: 2.5, eta: 5000 };
    const rTemprano = rulWeibull(ajuste, 500, 0.5);
    const rTardio = rulWeibull(ajuste, 4000, 0.5);
    expect(rTardio).toBeLessThan(rTemprano);
  });
});

describe('rulHibridoComponente', () => {
  const ajuste = { beta: 2.5, eta: 5000 };

  it('sin ningún metal con aceleración detectada, el RUL ajustado es igual al base (nunca se inventa un ajuste sin evidencia)', () => {
    const r = rulHibridoComponente(ajuste, 3000, { hierro: { detectado: false } });
    expect(r.ajustadoPorAceite).toBe(false);
    expect(r.b10Ajustado).toBe(r.b10);
    expect(r.b50Ajustado).toBe(r.b50);
    expect(r.factorAceleracion).toBe(0);
  });

  it('sin ningún dato de aceite (cusumPorMetal vacío/undefined), igual al base', () => {
    const r = rulHibridoComponente(ajuste, 3000, undefined);
    expect(r.ajustadoPorAceite).toBe(false);
    expect(r.b10Ajustado).toBe(r.b10);
  });

  it('con aceleración real detectada (factor=0.787, caso verificado a mano con script Python), reduce el RUL de forma consistente', () => {
    const r = rulHibridoComponente(ajuste, 3000, { hierro: { detectado: true, factorAceleracion: 0.787 } });
    expect(r.ajustadoPorAceite).toBe(true);
    expect(r.metalCausante).toBe('hierro');
    expect(r.b10Ajustado).toBeCloseTo(185.0, 0);
    expect(r.b50Ajustado).toBeCloseTo(1080.1, 0);
    // El ajustado siempre es <= el base (la aceleración real nunca puede alargar la vida).
    expect(r.b10Ajustado).toBeLessThanOrEqual(r.b10);
    expect(r.b50Ajustado).toBeLessThanOrEqual(r.b50);
  });

  it('con varios metales, usa el de MAYOR factor de aceleración (el peor caso manda, nunca se promedia hacia abajo una alerta real)', () => {
    const r = rulHibridoComponente(ajuste, 3000, {
      hierro: { detectado: true, factorAceleracion: 0.3 },
      cobre: { detectado: true, factorAceleracion: 0.7 },
      plomo: { detectado: false },
    });
    expect(r.metalCausante).toBe('cobre');
    expect(r.factorAceleracion).toBe(0.7);
  });
});

describe('rulHibridoPorComponente', () => {
  function ev(sigla, componente, horom) {
    return { sigla, componente, horom };
  }

  it('arma RUL por instancia equipo+componente, solo para las que tienen Weibull suficiente Y horómetro actual real', () => {
    // Motor: 6 fallas en CN-1 (5 intervalos ≥5, exige ≥5 en analisisVidaUtilCorrectivosPorComponente)
    const eventos = [
      ev('CN-1', 'Motor', 1000), ev('CN-1', 'Motor', 1800), ev('CN-1', 'Motor', 2900),
      ev('CN-1', 'Motor', 4300), ev('CN-1', 'Motor', 6000), ev('CN-1', 'Motor', 8000),
    ];
    const eq = [{ sigla: 'CN-1', horomActual: 9500 }];
    const r = rulHibridoPorComponente(eventos, eq, []);
    const motorCN1 = r.find((x) => x.sigla === 'CN-1' && x.componente === 'Motor');
    expect(motorCN1).toBeDefined();
    expect(motorCN1.edadActual).toBe(1500); // 9500 - 8000
    expect(motorCN1.b10).not.toBeNull();
    expect(motorCN1.ajustadoPorAceite).toBe(false); // sin datos de aceite
  });

  it('sin horómetro actual del equipo, esa instancia se omite (nunca se inventa una edad)', () => {
    const eventos = [
      ev('CN-2', 'Motor', 1000), ev('CN-2', 'Motor', 1800), ev('CN-2', 'Motor', 2900),
      ev('CN-2', 'Motor', 4300), ev('CN-2', 'Motor', 6000), ev('CN-2', 'Motor', 8000),
    ];
    const r = rulHibridoPorComponente(eventos, [], []);
    expect(r.find((x) => x.sigla === 'CN-2')).toBeUndefined();
  });

  it('sin Weibull suficiente para esa categoría de componente (menos de 5 intervalos), se omite', () => {
    const eventos = [ev('CN-3', 'Frenos', 1000), ev('CN-3', 'Frenos', 1800)];
    const eq = [{ sigla: 'CN-3', horomActual: 5000 }];
    const r = rulHibridoPorComponente(eventos, eq, []);
    expect(r.find((x) => x.sigla === 'CN-3')).toBeUndefined();
  });

  it('ordena de menor a mayor RUL ajustado (el más urgente primero)', () => {
    const eventos = [
      ev('CN-1', 'Motor', 1000), ev('CN-1', 'Motor', 1800), ev('CN-1', 'Motor', 2900),
      ev('CN-1', 'Motor', 4300), ev('CN-1', 'Motor', 6000), ev('CN-1', 'Motor', 8000),
      ev('CN-4', 'Motor', 500), ev('CN-4', 'Motor', 1300), ev('CN-4', 'Motor', 2400),
      ev('CN-4', 'Motor', 3800), ev('CN-4', 'Motor', 5500), ev('CN-4', 'Motor', 7500),
    ];
    // CN-1 con edad actual chica (poco desgastado) vs CN-4 con edad actual mucho mayor.
    const eq = [{ sigla: 'CN-1', horomActual: 8500 }, { sigla: 'CN-4', horomActual: 12000 }];
    const r = rulHibridoPorComponente(eventos, eq, []);
    for (let i = 1; i < r.length; i++) {
      const prev = r[i - 1].b10Ajustado != null ? r[i - 1].b10Ajustado : r[i - 1].b10;
      const cur = r[i].b10Ajustado != null ? r[i].b10Ajustado : r[i].b10;
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  });
});
