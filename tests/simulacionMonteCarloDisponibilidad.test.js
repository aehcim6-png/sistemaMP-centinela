import { describe, it, expect } from 'vitest';
import {
  intervalosFallaFlotaDias,
  duracionesReparacionFlotaHoras,
  simulacionMonteCarloDisponibilidad,
} from '../logic.js';

describe('intervalosFallaFlotaDias', () => {
  it('calcula los días entre fallas sucesivas de TODA la flota, ordenando por fecha', () => {
    const ot = [
      { sigla: 'CN-1', tipo: 'Correctivo', fecha: '2026-01-10' },
      { sigla: 'CN-2', tipo: 'Correctivo', fecha: '2026-01-05' },
      { sigla: 'CN-1', tipo: 'Correctivo', fecha: '2026-01-20' },
    ];
    // ordenado: 01-05, 01-10, 01-20 → gaps: 5, 10
    expect(intervalosFallaFlotaDias(ot)).toEqual([5, 10]);
  });

  it('ignora registros que no son falla real (esFallaMTBF)', () => {
    const ot = [
      { sigla: 'CN-1', tipo: 'Inspección', fecha: '2026-01-01' },
      { sigla: 'CN-1', tipo: 'Correctivo', fecha: '2026-01-05' },
      { sigla: 'CN-1', tipo: 'Correctivo', fecha: '2026-01-15' },
    ];
    expect(intervalosFallaFlotaDias(ot)).toEqual([10]);
  });

  it('usa fechaEntrada si no hay fecha', () => {
    const ot = [
      { sigla: 'CN-1', tipo: 'Correctivo', fechaEntrada: '2026-01-01' },
      { sigla: 'CN-1', tipo: 'Correctivo', fechaEntrada: '2026-01-08' },
    ];
    expect(intervalosFallaFlotaDias(ot)).toEqual([7]);
  });

  it('descarta intervalos de 0 días (varias fallas el mismo día en la flota)', () => {
    const ot = [
      { sigla: 'CN-1', tipo: 'Correctivo', fecha: '2026-01-01' },
      { sigla: 'CN-2', tipo: 'Correctivo', fecha: '2026-01-01' },
      { sigla: 'CN-1', tipo: 'Correctivo', fecha: '2026-01-06' },
    ];
    expect(intervalosFallaFlotaDias(ot)).toEqual([5]);
  });

  it('vacío/undefined da lista vacía', () => {
    expect(intervalosFallaFlotaDias([])).toEqual([]);
    expect(intervalosFallaFlotaDias(undefined)).toEqual([]);
  });
});

describe('duracionesReparacionFlotaHoras', () => {
  it('extrae las horas reales de o.duracion ("Xh") de fallas reales', () => {
    const ot = [
      { tipo: 'Correctivo', duracion: '4h' },
      { tipo: 'Correctivo', duracion: '12h' },
      { tipo: 'Inspección', duracion: '3h' }, // no es falla, se ignora
      { tipo: 'Correctivo', duracion: '—' }, // sin duración real, se ignora
      { tipo: 'Correctivo' }, // sin duración, se ignora
    ];
    expect(duracionesReparacionFlotaHoras(ot)).toEqual([4, 12]);
  });

  it('vacío/undefined da lista vacía', () => {
    expect(duracionesReparacionFlotaHoras([])).toEqual([]);
    expect(duracionesReparacionFlotaHoras(undefined)).toEqual([]);
  });
});

describe('simulacionMonteCarloDisponibilidad', () => {
  it('null si hay menos de 8 intervalos reales', () => {
    const iv = [10, 10, 10, 10, 10, 10, 10]; // 7
    const du = [5, 5, 5, 5, 5];
    expect(simulacionMonteCarloDisponibilidad(iv, du, 30, 100, 200)).toBeNull();
  });

  it('null si hay menos de 5 duraciones reales', () => {
    const iv = [10, 10, 10, 10, 10, 10, 10, 10];
    const du = [5, 5, 5, 5]; // 4
    expect(simulacionMonteCarloDisponibilidad(iv, du, 30, 100, 200)).toBeNull();
  });

  it('null si el horizonte o las horas de flota no son válidas', () => {
    const iv = [10, 10, 10, 10, 10, 10, 10, 10];
    const du = [5, 5, 5, 5, 5];
    expect(simulacionMonteCarloDisponibilidad(iv, du, 0, 100, 200)).toBeNull();
    expect(simulacionMonteCarloDisponibilidad(iv, du, 30, 0, 200)).toBeNull();
  });

  it('con muestras constantes, el resultado es exacto y determinístico (sin depender del azar)', () => {
    // intervalos constantes de 10 días, reparación constante de 5h: cualquier
    // valor de rng() siempre elige el mismo (único) valor de cada lista, así
    // que las 3 mil simulaciones dan EXACTAMENTE el mismo resultado.
    const iv = [10, 10, 10, 10, 10, 10, 10, 10];
    const du = [5, 5, 5, 5, 5];
    const r = simulacionMonteCarloDisponibilidad(iv, du, 30, 100, 300);
    // t=10(falla1,+5h)->15; t=25(falla2,+5h)->30; t=40(>=30, corta) => 2 fallas, 10h de flota
    expect(r.fallasEsperadas).toBe(2);
    expect(r.muestraIntervalos).toBe(8);
    expect(r.muestraDuraciones).toBe(5);
    // disponibilidad = 1 - 10h / (30*100h) = 1 - 10/3000 = 0.99666...
    const esperado = Math.round((1 - 10 / 3000) * 1000) / 10;
    expect(r.dispP10).toBe(esperado);
    expect(r.dispP50).toBe(esperado);
    expect(r.dispP90).toBe(esperado);
  });

  it('a mayor horizonte, más fallas esperadas (mismo patrón real, más tiempo para que ocurran)', () => {
    const iv = [10, 10, 10, 10, 10, 10, 10, 10];
    const du = [5, 5, 5, 5, 5];
    const r30 = simulacionMonteCarloDisponibilidad(iv, du, 30, 100, 100);
    const r60 = simulacionMonteCarloDisponibilidad(iv, du, 60, 100, 100);
    expect(r60.fallasEsperadas).toBeGreaterThan(r30.fallasEsperadas);
    expect(r60.dispP50).toBeLessThanOrEqual(r30.dispP50);
  });

  it('P10 <= P50 <= P90 siempre (el rango de incertidumbre nunca sale invertido)', () => {
    // rng determinístico que cicla una secuencia fija — reproducible, no Math.random.
    const secuencia = [0.05, 0.95, 0.4, 0.6, 0.15, 0.8, 0.3, 0.7, 0.5, 0.02, 0.99];
    let i = 0;
    const rngFijo = () => secuencia[i++ % secuencia.length];
    const iv = [3, 30, 5, 25, 8, 20, 4, 15]; // variedad real de intervalos
    const du = [1, 10, 2, 8, 3];
    const r = simulacionMonteCarloDisponibilidad(iv, du, 90, 200, 500, rngFijo);
    expect(r).not.toBeNull();
    expect(r.dispP10).toBeLessThanOrEqual(r.dispP50);
    expect(r.dispP50).toBeLessThanOrEqual(r.dispP90);
    expect(r.fallasEsperadas).toBeGreaterThan(0);
  });

  it('nSimulaciones no válido cae al default (1000) en vez de romper', () => {
    const iv = [10, 10, 10, 10, 10, 10, 10, 10];
    const du = [5, 5, 5, 5, 5];
    const r = simulacionMonteCarloDisponibilidad(iv, du, 30, 100, 0);
    expect(r.nSimulaciones).toBe(1000);
  });
});
