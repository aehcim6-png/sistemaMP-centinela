import { describe, it, expect } from 'vitest';
const { criticidadDinamicaComponente, matrizCriticidadDinamica } = require('../logic.js');

describe('criticidadDinamicaComponente', () => {
  it('sin Probabilidad estática (riesgoNivel no reconocido), devuelve null — no hay nada que ajustar', () => {
    expect(criticidadDinamicaComponente(null, 'empeorando')).toBeNull();
  });

  it('tendencia "empeorando" sube 1 nivel, con tope en 5', () => {
    expect(criticidadDinamicaComponente(3, 'empeorando')).toBe(4);
    expect(criticidadDinamicaComponente(5, 'empeorando')).toBe(5);
  });

  it('tendencia "mejorando" baja 1 nivel, con piso en 1', () => {
    expect(criticidadDinamicaComponente(3, 'mejorando')).toBe(2);
    expect(criticidadDinamicaComponente(1, 'mejorando')).toBe(1);
  });

  it('sin tendencia, o "sin_certeza", no ajusta nada — nunca se cambia la criticidad sin evidencia real', () => {
    expect(criticidadDinamicaComponente(3, null)).toBe(3);
    expect(criticidadDinamicaComponente(3, undefined)).toBe(3);
    expect(criticidadDinamicaComponente(3, 'sin_certeza')).toBe(3);
  });
});

describe('matrizCriticidadDinamica', () => {
  // Caso calculado a mano (ver docs/arquitectura.md sección 41): 5 instancias de
  // componentes mayores, 2 tipos con tendencia real conocida (Motor empeorando,
  // Frenos mejorando) y 2 sin dato de tendencia (Transmisión, Hidráulico).
  const compMayores = [
    { sigla: 'CN-1', comp: 'Motor', riesgoNivel: '🟡 Medio', costoRef: 5000000, riesgoTip: 'motor CN-1' },
    { sigla: 'CN-2', comp: 'Motor', riesgoNivel: '🟡 Medio', costoRef: 4500000, riesgoTip: 'motor CN-2' },
    { sigla: 'CN-3', comp: 'Frenos', riesgoNivel: '🟡 Revisar', costoRef: 800000, riesgoTip: 'frenos CN-3' },
    { sigla: 'CN-4', comp: 'Transmisión', riesgoNivel: '🔴 Alto', costoRef: 12000000, riesgoTip: 'transmisión CN-4' },
    { sigla: 'CN-5', comp: 'Hidráulico', riesgoNivel: '🟡 Medio', costoRef: 2000000, riesgoTip: 'hidráulico CN-5' },
  ];
  const crowPorComponente = [
    { componente: 'Motor', crow: { tendencia: 'empeorando' } },
    { componente: 'Frenos', crow: { tendencia: 'mejorando' } },
  ];

  it('ajusta la Probabilidad de cada instancia según la tendencia real de SU tipo de componente', () => {
    const r = matrizCriticidadDinamica(compMayores, crowPorComponente);
    const cn1 = r.find((x) => x.sigla === 'CN-1');
    const cn3 = r.find((x) => x.sigla === 'CN-3');
    const cn4 = r.find((x) => x.sigla === 'CN-4');
    expect(cn1.probEstatica).toBe(3);
    expect(cn1.probDinamica).toBe(4); // Motor empeorando: 3+1
    expect(cn3.probEstatica).toBe(2);
    expect(cn3.probDinamica).toBe(1); // Frenos mejorando: 2-1
    expect(cn4.probEstatica).toBe(5);
    expect(cn4.probDinamica).toBe(5); // Transmisión sin dato de tendencia: sin cambio
  });

  it('el Impacto usa los mismos umbralesImpacto/impactoDeValor de la Matriz de Riesgo estática (quintiles sobre costoRef)', () => {
    const r = matrizCriticidadDinamica(compMayores, crowPorComponente);
    const porSigla = Object.fromEntries(r.map((x) => [x.sigla, x]));
    // Umbrales de [800k,2M,4.5M,5M,12M]: [800k, 2M, 4.5M, 5M]
    expect(porSigla['CN-3'].impacto).toBe(1); // 800k <= 800k
    expect(porSigla['CN-5'].impacto).toBe(2); // 2M <= 2M
    expect(porSigla['CN-2'].impacto).toBe(3); // 4.5M <= 4.5M
    expect(porSigla['CN-1'].impacto).toBe(4); // 5M <= 5M
    expect(porSigla['CN-4'].impacto).toBe(5); // 12M > 5M
  });

  it('"escalada" marca solo las filas donde la tendencia real efectivamente CAMBIA la banda de riesgo', () => {
    const r = matrizCriticidadDinamica(compMayores, crowPorComponente);
    const porSigla = Object.fromEntries(r.map((x) => [x.sigla, x]));
    // CN-1: prob3×imp4=12 (Alto) -> prob4×imp4=16 (Extremo): escalada real
    expect(porSigla['CN-1'].nivelEstatico).toBe('Alto');
    expect(porSigla['CN-1'].nivelDinamico).toBe('Extremo');
    expect(porSigla['CN-1'].cambioNivel).toBe('escalada');
    // CN-2: prob3×imp3=9 (Moderado) -> prob4×imp3=12 (Alto): escalada real
    expect(porSigla['CN-2'].cambioNivel).toBe('escalada');
    // CN-3: prob2×imp1=2 (Bajo) -> prob1×imp1=1 (Bajo): el PxI baja pero la
    // BANDA sigue siendo "Bajo" en ambos casos -> no se marca cambio de nivel
    expect(porSigla['CN-3'].nivelEstatico).toBe('Bajo');
    expect(porSigla['CN-3'].nivelDinamico).toBe('Bajo');
    expect(porSigla['CN-3'].cambioNivel).toBeNull();
    // CN-4/CN-5: sin dato de tendencia, prob no cambia -> nunca hay cambioNivel
    expect(porSigla['CN-4'].cambioNivel).toBeNull();
    expect(porSigla['CN-5'].cambioNivel).toBeNull();
  });

  it('ordena de mayor a menor PxI dinámico', () => {
    const r = matrizCriticidadDinamica(compMayores, crowPorComponente);
    expect(r.map((x) => x.sigla)).toEqual(['CN-4', 'CN-1', 'CN-2', 'CN-5', 'CN-3']);
  });

  it('componentes sin Índice de Riesgo reconocido (riesgoNivel vacío/desconocido) quedan excluidos, igual que en la Matriz de Riesgo estática', () => {
    const conUnoInvalido = compMayores.concat([{ sigla: 'CN-6', comp: 'Motor', riesgoNivel: '🟢 Bajo', costoRef: 100000 }]);
    const r = matrizCriticidadDinamica(conUnoInvalido, crowPorComponente);
    expect(r.find((x) => x.sigla === 'CN-6')).toBeUndefined();
  });

  it('con menos de 5 valores de costoRef, el Impacto queda neutral (3) para todos — no inventa quintiles con poca muestra', () => {
    const pocos = compMayores.slice(0, 3);
    const r = matrizCriticidadDinamica(pocos, crowPorComponente);
    r.forEach((x) => expect(x.impacto).toBe(3));
  });

  it('sin ningún componente mayor, o sin ninguna tendencia real, devuelve solo Probabilidad estática sin ajustar', () => {
    expect(matrizCriticidadDinamica([], [])).toEqual([]);
    const r = matrizCriticidadDinamica(compMayores, []);
    r.forEach((x) => expect(x.probDinamica).toBe(x.probEstatica));
  });
});
