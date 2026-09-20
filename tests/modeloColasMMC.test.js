import { describe, it, expect } from 'vitest';
import { modeloColasMMC } from '../logic.js';

describe('modeloColasMMC', () => {
  it('null con parámetros inválidos', () => {
    expect(modeloColasMMC(0, 5, 1)).toBeNull();
    expect(modeloColasMMC(3, 0, 1)).toBeNull();
    expect(modeloColasMMC(3, 5, 0)).toBeNull();
    expect(modeloColasMMC(null, 5, 1)).toBeNull();
  });

  it('sistema inestable (ρ≥1): null, nunca un tiempo de espera infinito', () => {
    // λ=20, μ=2, c=6 -> a=10, ρ=1.667 (excede la capacidad del taller).
    expect(modeloColasMMC(20, 2, 6)).toBeNull();
    // Caso límite exacto ρ=1.
    expect(modeloColasMMC(10, 2, 5)).toBeNull();
  });

  it('caso c=1: se reduce exactamente a la fórmula clásica de M/M/1 (verificado algebraicamente)', () => {
    // M/M/1: C(1,a)=ρ, Wq=ρ/(μ-λ). λ=3, μ=5 -> a=ρ=0.6, Wq=0.6/2=0.3.
    const r = modeloColasMMC(3, 5, 1);
    expect(r).not.toBeNull();
    expect(r.a).toBeCloseTo(0.6, 2);
    expect(r.rho).toBeCloseTo(0.6, 2);
    expect(r.probEspera).toBeCloseTo(0.6, 2);
    expect(r.tiempoEsperaHoras).toBeCloseTo(0.3, 2);
    expect(r.saturado).toBe(false);
  });

  it('caso c=6: coincide con la recursión de Erlang B (algoritmo independiente, verificado con Python)', () => {
    // Verificado independientemente con Python antes de escribir el test,
    // con DOS algoritmos distintos: cálculo directo (términos por razón
    // sucesiva) y la recursión clásica de Erlang B->C
    // (b(0)=1, b(n)=a·b(n-1)/(n+a·b(n-1)), C=c·b(c)/(c-a·(1-b(c)))) —
    // coinciden a 10+ decimales. λ=10, μ=2, c=6 -> a=5, ρ≈0.8333,
    // C≈0.587516, Wq≈0.293758h, Lq≈2.937582, Ws≈0.793758h, Ls≈7.937582.
    const r = modeloColasMMC(10, 2, 6);
    expect(r).not.toBeNull();
    expect(r.a).toBeCloseTo(5, 2);
    expect(r.rho).toBeCloseTo(0.833, 2);
    expect(r.probEspera).toBeCloseTo(0.588, 2);
    expect(r.tiempoEsperaHoras).toBeCloseTo(0.294, 2);
    expect(r.numeroEnCola).toBeCloseTo(2.938, 1);
    expect(r.tiempoTotalHoras).toBeCloseTo(0.794, 2);
    expect(r.numeroEnSistema).toBeCloseTo(7.938, 1);
    expect(r.saturado).toBe(false);
  });

  it('saturado: true cuando ρ>0.85 (regla de bolsillo estándar de teoría de colas)', () => {
    // λ=9, μ=2, c=5 -> a=4.5, ρ=0.9.
    const r = modeloColasMMC(9, 2, 5);
    expect(r).not.toBeNull();
    expect(r.rho).toBeCloseTo(0.9, 2);
    expect(r.saturado).toBe(true);
  });

  it('c decimal se redondea (dotación siempre es un número entero de personas)', () => {
    const r1 = modeloColasMMC(3, 5, 1);
    const r2 = modeloColasMMC(3, 5, 1.4);
    expect(r2).toEqual(r1);
  });
});
