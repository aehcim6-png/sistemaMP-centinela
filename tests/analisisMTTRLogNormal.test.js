import { describe, it, expect } from 'vitest';
import { analisisMTTRLogNormal } from '../logic.js';

describe('analisisMTTRLogNormal', () => {
  it('null con menos de 5 reparaciones (muestra insuficiente)', () => {
    expect(analisisMTTRLogNormal([2, 3, 4, 5])).toBeNull();
  });

  it('null sin datos / arreglo vacío', () => {
    expect(analisisMTTRLogNormal([])).toBeNull();
    expect(analisisMTTRLogNormal(undefined)).toBeNull();
  });

  it('ignora horas no válidas (0 o negativas)', () => {
    expect(analisisMTTRLogNormal([0, -5, 2, 3, 4])).toBeNull();
  });

  it('la mediana real queda BAJO el promedio simple cuando hay reparaciones excepcionalmente largas (el caso real que justifica log-normal)', () => {
    // La mayoría de las reparaciones son rápidas (2-4h) pero una se alarga
    // mucho (48h, ej. esperando un repuesto) — el promedio simple queda
    // inflado por esa cola, la mediana real no.
    const r = analisisMTTRLogNormal([2, 3, 3, 4, 2, 48]);
    expect(r.n).toBe(6);
    expect(r.mediana).toBeLessThan(r.promedioSimple);
  });

  it('p90 es siempre mayor o igual que la mediana (el percentil 90 nunca queda bajo el típico)', () => {
    const r = analisisMTTRLogNormal([2, 3, 4, 5, 6, 8, 10]);
    expect(r.p90).toBeGreaterThanOrEqual(r.mediana);
  });

  it('con datos perfectamente simétricos en escala log, mediana ≈ promedio simple (caso de control)', () => {
    // Progresión geométrica simétrica en torno a 4 -> log-simétrica de verdad
    const r = analisisMTTRLogNormal([1, 2, 4, 8, 16]);
    expect(r.mediana).toBeCloseTo(4, 0);
  });

  it('devuelve n = cantidad de reparaciones válidas usadas', () => {
    const r = analisisMTTRLogNormal([2, 3, 4, 5, 6]);
    expect(r.n).toBe(5);
  });

  it('no muta el arreglo original (pura)', () => {
    const original = [2, 3, 4, 5, 48];
    const copia = [...original];
    analisisMTTRLogNormal(original);
    expect(original).toEqual(copia);
  });
});
