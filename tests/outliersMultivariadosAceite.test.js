import { describe, it, expect } from 'vitest';
import { outliersMultivariadosAceite } from '../logic.js';

// Dataset determinístico verificado independientemente con Python/numpy
// (media, covarianza muestral n-1, inversión de matriz, generado con
// semilla fija para reproducibilidad exacta) antes de escribir el test:
// 24 muestras "normales" (con correlación real entre metales, no
// independientes) + 1 muestra con una combinación inusual — ningún metal
// de la muestra 25 cruza el umbral FIJO de aceiteOutliers (2× el umbral
// de _ACEITE_UMBRAL_METAL: hierro>100, cobre>60, etc. — acá el máximo es
// hierro=27), así que aceiteOutliers jamás la marcaría. La Distancia de
// Mahalanobis sí: D²≈19.65, muy por encima del umbral χ²95%,gl=6≈12.592
// (_CHI2_CRITICO_95[6], ya usado en el sistema). El máximo D² real entre
// las 24 muestras normales es ≈9.85 — ninguna lo cruza (sin falsos
// positivos).
const METALES = ['hierro', 'cobre', 'plomo', 'aluminio', 'silicio', 'cromo'];
const FILAS = [
  [22.13, 13.03, 5.60, 9.31, 11.33, 2.26],
  [24.71, 12.91, 5.55, 11.58, 13.31, 3.92],
  [17.79, 8.07, 7.57, 6.43, 12.12, 2.51],
  [20.30, 7.67, 3.50, 7.78, 10.86, 1.79],
  [22.11, 12.01, 5.63, 10.58, 13.00, 4.62],
  [20.19, 10.31, 6.37, 7.19, 16.45, 4.60],
  [21.39, 10.63, 3.45, 6.83, 11.49, 4.42],
  [21.96, 9.83, 7.84, 7.85, 11.01, 4.00],
  [19.13, 10.82, 6.32, 5.03, 8.88, 4.39],
  [22.57, 8.01, 6.37, 7.64, 10.08, 2.76],
  [21.72, 11.83, 7.39, 8.68, 11.08, 3.57],
  [21.01, 10.08, 5.14, 6.51, 12.71, 4.34],
  [19.27, 8.42, 3.72, 4.99, 13.86, 3.33],
  [21.65, 9.84, 7.78, 10.39, 13.77, 3.94],
  [20.46, 10.72, 7.83, 7.68, 13.63, 4.54],
  [19.35, 7.19, 4.26, 7.63, 13.09, 2.41],
  [22.40, 10.59, 5.84, 9.58, 13.92, 5.71],
  [20.48, 10.16, 4.18, 6.51, 8.10, 4.46],
  [20.63, 8.18, 3.92, 7.58, 14.21, 2.86],
  [19.07, 9.30, 6.17, 5.34, 11.32, 5.62],
  [21.96, 8.88, 6.62, 7.87, 12.58, 4.31],
  [19.22, 9.85, 3.47, 8.28, 10.75, 3.84],
  [22.67, 10.53, 5.11, 9.25, 11.84, 1.93],
  [18.23, 8.06, 5.82, 5.90, 11.90, 3.49],
];
const OUTLIER = [27.0, 6.0, 8.0, 4.0, 17.0, 1.5];

function muestraDesde(fila, i, descriptor) {
  const m = { descriptor: descriptor || 'Motor', fecha: '2026-01-' + String(1 + (i % 28)).padStart(2, '0'), _sigla: 'EQ-' + i };
  METALES.forEach((met, j) => { m[met] = fila[j]; });
  return m;
}

describe('outliersMultivariadosAceite', () => {
  it('vacío sin datos, o con menos del mínimo de muestras', () => {
    expect(outliersMultivariadosAceite([])).toEqual([]);
    expect(outliersMultivariadosAceite(null)).toEqual([]);
    const pocas = FILAS.slice(0, 10).map((f, i) => muestraDesde(f, i));
    expect(outliersMultivariadosAceite(pocas)).toEqual([]);
  });

  it('descarta muestras con algún metal faltante (nunca completa un dato)', () => {
    const conFaltante = FILAS.map((f, i) => muestraDesde(f, i));
    delete conFaltante[0].cromo;
    // 23 de 24 muestras completas -> sigue arriba del mínimo (15).
    const r = outliersMultivariadosAceite(conFaltante);
    expect(r.length).toBe(1);
    expect(r[0].n).toBe(23);
  });

  it('detecta el outlier combinado inyectado, sin falsos positivos (verificado con Python/numpy)', () => {
    const muestras = FILAS.map((f, i) => muestraDesde(f, i)).concat([muestraDesde(OUTLIER, 24)]);
    const r = outliersMultivariadosAceite(muestras);
    expect(r.length).toBe(1);
    expect(r[0].descriptor).toBe('Motor');
    expect(r[0].n).toBe(25);
    expect(r[0].umbralChi2).toBeCloseTo(12.592, 2);
    expect(r[0].outliers.length).toBe(1);
    expect(r[0].outliers[0].muestra._sigla).toBe('EQ-24');
    expect(r[0].outliers[0].d2).toBeCloseTo(19.65, 0);
  });

  it('ningún metal de la muestra inyectada cruza el umbral fijo que ya usa aceiteOutliers (confirma que es un hueco real, no redundante)', () => {
    // _ACEITE_UMBRAL_METAL: hierro:50, cobre:30, plomo:20, aluminio:20,
    // silicio:25, cromo:10 — aceiteOutliers exige > 2x ese umbral.
    const umbrales = { hierro: 50, cobre: 30, plomo: 20, aluminio: 20, silicio: 25, cromo: 10 };
    METALES.forEach((met, j) => {
      expect(OUTLIER[j]).toBeLessThan(2 * umbrales[met]);
    });
  });

  it('agrupa por descriptor (tipo de componente) de forma independiente', () => {
    const motor = FILAS.map((f, i) => muestraDesde(f, i, 'Motor'));
    const transmision = FILAS.map((f, i) => muestraDesde(f, i, 'Transmision'));
    const r = outliersMultivariadosAceite(motor.concat(transmision));
    expect(r.length).toBe(2);
    expect(r.map((g) => g.descriptor).sort()).toEqual(['Motor', 'Transmision']);
    // Sin outliers inyectados en ninguno de los dos grupos.
    r.forEach((g) => expect(g.outliers.length).toBe(0));
  });
});
