import { describe, it, expect } from 'vitest';
const { calcularNPR, prioridadNPR } = require('../logic.js');

describe('calcularNPR — Severidad × Ocurrencia × Detección (FMEA real)', () => {
  it('multiplica las 3 escalas cuando todas son válidas (1-10)', () => {
    expect(calcularNPR(8, 5, 4)).toBe(160);
    expect(calcularNPR(10, 10, 10)).toBe(1000);
    expect(calcularNPR(1, 1, 1)).toBe(1);
  });

  it('devuelve null si falta alguna calificación — nunca inventa un NPR a medio calificar', () => {
    expect(calcularNPR(null, 5, 4)).toBeNull();
    expect(calcularNPR(8, undefined, 4)).toBeNull();
    expect(calcularNPR(8, 5, null)).toBeNull();
  });

  it('devuelve null si alguna calificación está fuera de 1-10', () => {
    expect(calcularNPR(0, 5, 4)).toBeNull();
    expect(calcularNPR(11, 5, 4)).toBeNull();
    expect(calcularNPR(8, -1, 4)).toBeNull();
  });
});

describe('prioridadNPR — banda relativa de prioridad sobre el NPR (no es un umbral de norma certificada)', () => {
  it('clasifica en las 4 bandas documentadas', () => {
    expect(prioridadNPR(250)).toBe('critica');
    expect(prioridadNPR(200)).toBe('critica');
    expect(prioridadNPR(150)).toBe('alta');
    expect(prioridadNPR(100)).toBe('alta');
    expect(prioridadNPR(75)).toBe('media');
    expect(prioridadNPR(50)).toBe('media');
    expect(prioridadNPR(20)).toBe('baja');
  });

  it('devuelve null si el NPR es null (ninguna calificación cargada)', () => {
    expect(prioridadNPR(null)).toBeNull();
  });
});
