import { describe, it, expect } from 'vitest';
import {
  probabilidadComponente, probabilidadEquipoSeveridad, probabilidadStockQuiebre,
  probabilidadReincidencia, umbralesImpacto, impactoDeValor, nivelRiesgoPxI
} from '../logic.js';

describe('probabilidadComponente — mapea riesgoNivel del Índice de Riesgo de componentes', () => {
  it('Alto -> 5, Medio -> 3, Revisar -> 2', () => {
    expect(probabilidadComponente('🔴 Alto')).toBe(5);
    expect(probabilidadComponente('🟡 Medio')).toBe(3);
    expect(probabilidadComponente('🟡 Revisar')).toBe(2);
  });
  it('Bajo y Sin datos no entran a la matriz (null)', () => {
    expect(probabilidadComponente('🟢 Bajo')).toBeNull();
    expect(probabilidadComponente('⚪ Sin datos')).toBeNull();
    expect(probabilidadComponente(undefined)).toBeNull();
  });
});

describe('probabilidadEquipoSeveridad — mapea severity de alertaCruzada', () => {
  it('escalones 2/3/5/8', () => {
    expect(probabilidadEquipoSeveridad(1)).toBeNull();
    expect(probabilidadEquipoSeveridad(2)).toBe(2);
    expect(probabilidadEquipoSeveridad(3)).toBe(3);
    expect(probabilidadEquipoSeveridad(4)).toBe(3);
    expect(probabilidadEquipoSeveridad(5)).toBe(4);
    expect(probabilidadEquipoSeveridad(7)).toBe(4);
    expect(probabilidadEquipoSeveridad(8)).toBe(5);
    expect(probabilidadEquipoSeveridad(20)).toBe(5);
  });
  it('sin severity -> null, no undefined/NaN', () => {
    expect(probabilidadEquipoSeveridad(0)).toBeNull();
    expect(probabilidadEquipoSeveridad(undefined)).toBeNull();
  });
});

describe('probabilidadStockQuiebre — mapea la etiqueta de riesgoQuiebre()', () => {
  it('SIN STOCK -> 5, QUIEBRE -> 4, BAJO -> 2', () => {
    expect(probabilidadStockQuiebre('🔴 SIN STOCK')).toBe(5);
    expect(probabilidadStockQuiebre('🔴 QUIEBRE')).toBe(4);
    expect(probabilidadStockQuiebre('🟡 BAJO')).toBe(2);
  });
  it('etiqueta desconocida u OK no entra', () => {
    expect(probabilidadStockQuiebre('✅ OK')).toBeNull();
    expect(probabilidadStockQuiebre('')).toBeNull();
    expect(probabilidadStockQuiebre(undefined)).toBeNull();
  });
});

describe('probabilidadReincidencia — mapea severidad de diagnosticoFlota()', () => {
  it('3 -> 5, 2 -> 3, 0 -> null', () => {
    expect(probabilidadReincidencia(3)).toBe(5);
    expect(probabilidadReincidencia(2)).toBe(3);
    expect(probabilidadReincidencia(0)).toBeNull();
  });
});

describe('umbralesImpacto — quintiles sobre valores $ heterogéneos', () => {
  it('sin valores válidos -> null', () => {
    expect(umbralesImpacto([])).toBeNull();
    expect(umbralesImpacto([0, -5, null, undefined, NaN])).toBeNull();
  });
  it('ignora valores no numéricos/negativos/cero y ordena antes de cortar', () => {
    const u = umbralesImpacto([50, 10, 0, null, 30, 20, 40]);
    expect(u).toHaveLength(4);
    // con [10,20,30,40,50] los cortes de percentil 20/40/60/80 deben ser crecientes
    expect(u[0]).toBeLessThanOrEqual(u[1]);
    expect(u[1]).toBeLessThanOrEqual(u[2]);
    expect(u[2]).toBeLessThanOrEqual(u[3]);
  });
});

describe('impactoDeValor — bin 1-5 contra los umbrales', () => {
  const u = umbralesImpacto([10, 20, 30, 40, 50]); // quintiles sobre 5 valores
  it('valor mínimo -> impacto 1, valor máximo -> impacto 5', () => {
    expect(impactoDeValor(10, u)).toBe(1);
    expect(impactoDeValor(50, u)).toBe(5);
  });
  it('sin valor (null/0/negativo) o sin umbrales -> 3 (ni oculta ni sobre-pondera)', () => {
    expect(impactoDeValor(null, u)).toBe(3);
    expect(impactoDeValor(0, u)).toBe(3);
    expect(impactoDeValor(-5, u)).toBe(3);
    expect(impactoDeValor(100, null)).toBe(3);
  });
});

describe('nivelRiesgoPxI — bandas clásicas de una matriz 5×5', () => {
  it('Bajo: PxI<=4', () => {
    expect(nivelRiesgoPxI(2, 2).nivel).toBe('Bajo');
    expect(nivelRiesgoPxI(2, 2).pxi).toBe(4);
  });
  it('Moderado: PxI 5-9', () => {
    expect(nivelRiesgoPxI(3, 3).nivel).toBe('Moderado'); // 9
    expect(nivelRiesgoPxI(5, 1).nivel).toBe('Moderado'); // 5
  });
  it('Alto: PxI 10-15', () => {
    expect(nivelRiesgoPxI(5, 3).nivel).toBe('Alto'); // 15
    expect(nivelRiesgoPxI(2, 5).nivel).toBe('Alto'); // 10
  });
  it('Extremo: PxI>15', () => {
    expect(nivelRiesgoPxI(5, 5).nivel).toBe('Extremo'); // 25
    expect(nivelRiesgoPxI(4, 5).nivel).toBe('Extremo'); // 20
  });
  it('devuelve un color coherente con el nivel', () => {
    expect(nivelRiesgoPxI(5, 5).color).toBe('var(--danger)');
    expect(nivelRiesgoPxI(2, 2).color).toBe('var(--ok)');
  });
});
