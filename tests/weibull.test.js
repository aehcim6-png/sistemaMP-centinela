import { describe, it, expect } from 'vitest';
import { ajusteWeibull, ajusteWeibullVidas, analisisVidaUtilPorGrupo, analisisVidaUtilCorrectivosPorComponente, confiabilidadWeibull, interpretacionFormaWeibull } from '../logic.js';

describe('ajusteWeibull', () => {
  it('null con menos de 5 intervalos (4 intervalos = 5 fallas, bajo el mínimo)', () => {
    expect(ajusteWeibull([1000, 1800, 2500, 3100, 3600])).toBeNull();
  });

  it('null sin datos / arreglo vacío', () => {
    expect(ajusteWeibull([])).toBeNull();
    expect(ajusteWeibull(undefined)).toBeNull();
  });

  it('ignora horómetros no válidos (0 o negativos)', () => {
    expect(ajusteWeibull([0, 0, 1000, 1800, 2500, 3100])).toBeNull();
  });

  it('ignora intervalos de largo 0 (horómetro duplicado) y sigue exigiendo el mínimo sobre los válidos', () => {
    // 7 valores crudos, uno duplicado -> 6 intervalos crudos, 1 de largo 0 -> 5 válidos (justo el mínimo)
    const r = ajusteWeibull([1000, 1000, 1800, 2500, 3100, 3600, 4000]);
    expect(r).not.toBeNull();
    expect(r.n).toBe(5);
  });

  it('devuelve beta/eta/n con datos suficientes (7 fallas, forma de desgaste)', () => {
    const r = ajusteWeibull([1000, 1800, 2500, 3100, 3600, 4000, 4300]);
    expect(r).toEqual({ beta: 2.9, eta: 620, n: 6, ic90: { betaMin: 2.7, betaMax: 3.09, etaMin: 604, etaMax: 636 } });
  });

  it('es insensible al orden de entrada (no depende de que vengan ya ordenadas)', () => {
    const ordenado = ajusteWeibull([1000, 1800, 2500, 3100, 3600, 4000, 4300]);
    const desordenado = ajusteWeibull([4300, 1000, 3600, 1800, 4000, 2500, 3100]);
    expect(desordenado).toEqual(ordenado);
  });

  it('null cuando los intervalos son todos iguales (varianza 0, pendiente indefinida)', () => {
    // Caso degenerado real: sin variación en los intervalos no hay pendiente que
    // ajustar (división por cero en la regresión) — se devuelve null en vez de
    // NaN/Infinity, nunca un número inventado.
    expect(ajusteWeibull([1000, 2000, 3000, 4000, 5000, 6000])).toBeNull();
  });

  it('no muta el arreglo original (pura)', () => {
    const original = [1000, 1800, 2500, 3100, 3600, 4000, 4300];
    const copia = [...original];
    ajusteWeibull(original);
    expect(original).toEqual(copia);
  });
});

describe('intervalo de confianza (ic90) del ajuste Weibull', () => {
  it('con datos que se ajustan casi perfecto a la recta, el intervalo es angosto', () => {
    // Intervalos muy regulares (800,700,600,500,400,300) -> la regresión
    // explica casi toda la variación -> error estándar chico -> ic90 angosto.
    const r = ajusteWeibull([1000, 1800, 2500, 3100, 3600, 4000, 4300]);
    expect(r.ic90.betaMin).toBeLessThan(r.beta);
    expect(r.ic90.betaMax).toBeGreaterThan(r.beta);
    expect(r.ic90.etaMin).toBeLessThan(r.eta);
    expect(r.ic90.etaMax).toBeGreaterThan(r.eta);
    // Angosto: menos de medio punto de beta de margen a cada lado.
    expect(r.ic90.betaMax - r.ic90.betaMin).toBeLessThan(1);
  });

  it('con pocos datos reales y ruidosos (correctivos pooled de 2 equipos), el intervalo es amplio y puede cruzar zonas de interpretación distintas', () => {
    // Mismo caso que analisisVidaUtilCorrectivosPorComponente en producción
    // (ver ese describe): 6 intervalos pooled de Motor entre 2 equipos,
    // beta puntual=1.13 ("Desgaste"), pero el ic90 real cruza tanto <0.9
    // (tempranas) como >1.1 (desgaste) — la muestra es chica, no hay certeza
    // real de la forma. Se prueba acá vía ajusteWeibullVidas directamente
    // sobre los mismos intervalos ya pooled (misma matemática que usa
    // analisisVidaUtilCorrectivosPorComponente internamente).
    const pooled = ajusteWeibullVidas([800, 700, 600, 800, 600, 100]);
    expect(pooled.beta).toBe(1.13);
    expect(pooled.ic90.betaMin).toBeLessThan(0.9);
    expect(pooled.ic90.betaMax).toBeGreaterThan(1.1);
  });

  it('null cuando df<1 (n=5, el mínimo posible, sigue dando ic90 — df=3)', () => {
    const r = ajusteWeibullVidas([2200, 2450, 2600, 2750, 2900]);
    expect(r).not.toBeNull();
    expect(r.ic90).not.toBeNull();
  });

  it('betaMin nunca es negativo (se acota a un mínimo positivo, un beta<=0 no es interpretable)', () => {
    const r = ajusteWeibullVidas([100, 5000, 200, 8000, 50]);
    expect(r.ic90.betaMin).toBeGreaterThan(0);
  });
});

describe('confiabilidadWeibull', () => {
  it('null si no hay ajuste', () => {
    expect(confiabilidadWeibull(null, 1000)).toBeNull();
  });

  it('null si no hay horasPeriodo válido', () => {
    expect(confiabilidadWeibull({ beta: 1, eta: 1000 }, null)).toBeNull();
    expect(confiabilidadWeibull({ beta: 1, eta: 1000 }, -5)).toBeNull();
  });

  it('R(0) = 100% sin importar beta/eta', () => {
    expect(confiabilidadWeibull({ beta: 2, eta: 1000 }, 0)).toBe(100);
  });

  it('con beta=1 (equivalente a la exponencial de siempre) coincide con e^(-t/eta)', () => {
    // e^(-1000/1000) = e^-1 = 0.36788...
    expect(confiabilidadWeibull({ beta: 1, eta: 1000 }, 1000)).toBe(36.8);
  });

  it('con beta=2 (forma de desgaste) da un resultado distinto a la exponencial para el mismo t/eta', () => {
    // (500/1000)^2 = 0.25 -> e^-0.25 = 0.7788...
    expect(confiabilidadWeibull({ beta: 2, eta: 1000 }, 500)).toBe(77.9);
  });
});

describe('ajusteWeibullVidas', () => {
  it('ajusta directamente sobre vidas completas (no calcula intervalos, a diferencia de ajusteWeibull)', () => {
    const r = ajusteWeibullVidas([2200, 2450, 2600, 2750, 2900, 3100, 3300]);
    expect(r).toEqual({ beta: 7.71, eta: 2921, n: 7, ic90: { betaMin: 7.1, betaMax: 8.31, etaMin: 2888, etaMax: 2954 } });
  });

  it('null con menos de 5 vidas', () => {
    expect(ajusteWeibullVidas([2200, 2450, 2600, 2750])).toBeNull();
  });

  it('null sin datos', () => {
    expect(ajusteWeibullVidas([])).toBeNull();
    expect(ajusteWeibullVidas(undefined)).toBeNull();
  });
});

describe('analisisVidaUtilPorGrupo', () => {
  const items = [
    { grupo: 'Michelin 24.00R35', vida: 2200 },
    { grupo: 'Michelin 24.00R35', vida: 2450 },
    { grupo: 'Michelin 24.00R35', vida: 2600 },
    { grupo: 'Michelin 24.00R35', vida: 2750 },
    { grupo: 'Michelin 24.00R35', vida: 2900 },
    { grupo: 'Michelin 24.00R35', vida: 3100 },
    { grupo: 'Michelin 24.00R35', vida: 3300 },
    { grupo: 'Bridgestone 24.00R35', vida: 1800 },
    { grupo: 'Bridgestone 24.00R35', vida: 2000 },
    { grupo: 'Bridgestone 24.00R35', vida: 2100 },
  ];

  it('agrupa por "grupo" y ajusta cada grupo por separado (no mezcla marcas distintas)', () => {
    const r = analisisVidaUtilPorGrupo(items);
    expect(r).toEqual([
      { grupo: 'Bridgestone 24.00R35', n: 3, ajuste: null },
      { grupo: 'Michelin 24.00R35', n: 7, ajuste: { beta: 7.71, eta: 2921, n: 7, ic90: { betaMin: 7.1, betaMax: 8.31, etaMin: 2888, etaMax: 2954 } } },
    ]);
  });

  it('grupo con menos de 5 vidas trae ajuste null pero igual aparece listado con su n real', () => {
    const r = analisisVidaUtilPorGrupo(items).find(g => g.grupo === 'Bridgestone 24.00R35');
    expect(r.n).toBe(3);
    expect(r.ajuste).toBeNull();
  });

  it('ignora ítems sin grupo o sin vida válida (>0)', () => {
    const conInvalidos = [...items, { grupo: 'X', vida: 0 }, { grupo: null, vida: 5000 }, { grupo: 'Y' }];
    const r = analisisVidaUtilPorGrupo(conInvalidos);
    expect(r.find(g => g.grupo === 'X')).toBeUndefined();
    expect(r.find(g => g.grupo === 'Y')).toBeUndefined();
  });

  it('array vacío sin ítems', () => {
    expect(analisisVidaUtilPorGrupo([])).toEqual([]);
  });
});

describe('analisisVidaUtilCorrectivosPorComponente', () => {
  const eventosBase = () => [
    { sigla: 'CN-1', componente: 'Motor', horom: 1000 },
    { sigla: 'CN-1', componente: 'Motor', horom: 1800 },
    { sigla: 'CN-1', componente: 'Motor', horom: 2500 },
    { sigla: 'CN-1', componente: 'Motor', horom: 3100 },
    { sigla: 'CN-2', componente: 'Motor', horom: 500 },
    { sigla: 'CN-2', componente: 'Motor', horom: 1300 },
    { sigla: 'CN-2', componente: 'Motor', horom: 1900 },
    { sigla: 'CN-2', componente: 'Motor', horom: 2000 },
    { sigla: 'CN-3', componente: 'Frenos', horom: 800 },
    { sigla: 'CN-3', componente: 'Frenos', horom: 1200 },
  ];

  it('agrupa primero por sigla+componente (no mezcla horómetros de equipos distintos) y luego junta los intervalos por componente', () => {
    const r = analisisVidaUtilCorrectivosPorComponente(eventosBase());
    const motor = r.find(g => g.grupo === 'Motor');
    // CN-1 aporta 3 intervalos (1000->1800->2500->3100), CN-2 aporta 3 (500->1300->1900->2000) = 6 pooled
    expect(motor.n).toBe(6);
    expect(motor.ajuste).not.toBeNull();
  });

  it('un componente con solo 1 intervalo queda listado con ajuste null (bajo el mínimo de 5)', () => {
    const r = analisisVidaUtilCorrectivosPorComponente(eventosBase());
    const frenos = r.find(g => g.grupo === 'Frenos');
    expect(frenos.n).toBe(1);
    expect(frenos.ajuste).toBeNull();
  });

  it('ignora eventos sin componente, sin sigla o con horómetro inválido', () => {
    const conInvalidos = [
      ...eventosBase(),
      { sigla: 'CN-1', componente: '', horom: 5000 },
      { sigla: '', componente: 'Motor', horom: 9000 },
      { sigla: 'CN-4', componente: 'Motor', horom: 0 },
    ];
    const r = analisisVidaUtilCorrectivosPorComponente(conInvalidos);
    const motor = r.find(g => g.grupo === 'Motor');
    expect(motor.n).toBe(6); // no cambia respecto al caso base
  });

  it('array vacío sin eventos', () => {
    expect(analisisVidaUtilCorrectivosPorComponente([])).toEqual([]);
    expect(analisisVidaUtilCorrectivosPorComponente(undefined)).toEqual([]);
  });

  it('no muta el arreglo de eventos original (pura)', () => {
    const eventos = eventosBase();
    const copia = eventos.map(e => ({ ...e }));
    analisisVidaUtilCorrectivosPorComponente(eventos);
    expect(eventos).toEqual(copia);
  });
});

describe('interpretacionFormaWeibull', () => {
  it('null sin beta', () => {
    expect(interpretacionFormaWeibull(null)).toBeNull();
  });

  it('fallas tempranas cuando beta < 0.9', () => {
    expect(interpretacionFormaWeibull(0.5)).toMatch(/tempranas/i);
  });

  it('fallas aleatorias cuando beta está cerca de 1', () => {
    expect(interpretacionFormaWeibull(1)).toMatch(/aleatorias/i);
  });

  it('desgaste cuando beta > 1.1', () => {
    expect(interpretacionFormaWeibull(2.9)).toMatch(/desgaste/i);
  });
});
