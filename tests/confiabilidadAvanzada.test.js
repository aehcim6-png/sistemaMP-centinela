import { describe, it, expect } from 'vitest';
import { tasaFallaPorUbicacion, edadVirtualEquipo } from '../logic.js';

describe('tasaFallaPorUbicacion — comparación simplificada por ubicación (Cox honesto)', () => {
  it('null implícito: sin ubicaciones con el mínimo de fallas, devuelve arreglo vacío', () => {
    const ot = [
      { sigla: 'CN-1', fecha: '2026-01-01', tipo: 'Correctivo', ubicacion: 'Pit' },
      { sigla: 'CN-1', fecha: '2026-02-01', tipo: 'Correctivo', ubicacion: 'Pit' },
    ];
    expect(tasaFallaPorUbicacion(ot)).toEqual([]);
  });

  it('ignora correctivos sin ubicación registrada', () => {
    const ot = Array.from({ length: 6 }, (_, i) => ({
      sigla: 'CN-1', fecha: `2026-01-${String(i * 5 + 1).padStart(2, '0')}`, tipo: 'Correctivo', ubicacion: '',
    }));
    expect(tasaFallaPorUbicacion(ot)).toEqual([]);
  });

  it('ignora correctivos que no cuentan como falla real (esFallaMTBF)', () => {
    // tipo 'Preventivo' no cumple esFallaMTBF (ni Correctivo/Falla Operacional, ni
    // Fuera de Servicio con criticidad Reparación Inmediata) — no debe entrar al conteo.
    const ot = Array.from({ length: 6 }, (_, i) => ({
      sigla: 'CN-1', fecha: `2026-01-${String(i * 5 + 1).padStart(2, '0')}`, tipo: 'Preventivo', ubicacion: 'Pit',
    }));
    expect(tasaFallaPorUbicacion(ot)).toEqual([]);
  });

  it('detecta una ubicación con fallas más frecuentes que el resto (razon < 1)', () => {
    // "Pit": 6 fallas cada 5 días (intervalos cortos, falla seguido).
    // "Planta": 6 fallas cada 30 días (intervalos largos, falla poco).
    const pit = Array.from({ length: 6 }, (_, i) => ({
      sigla: 'CN-1', fecha: `2026-01-${String(i * 5 + 1).padStart(2, '0')}`, tipo: 'Correctivo', ubicacion: 'Pit',
    }));
    const planta = Array.from({ length: 6 }, (_, i) => ({
      sigla: 'CN-2', fecha: `2026-${String(i + 1).padStart(2, '0')}-01`, tipo: 'Correctivo', ubicacion: 'Planta',
    }));
    const r = tasaFallaPorUbicacion([...pit, ...planta]);
    const pitRow = r.find(x => x.ubicacion === 'Pit');
    const plantaRow = r.find(x => x.ubicacion === 'Planta');
    expect(pitRow).toBeTruthy();
    expect(plantaRow).toBeTruthy();
    expect(pitRow.razon).toBeLessThan(plantaRow.razon);
  });

  it('exige el mínimo de fallas por grupo (default 5) antes de comparar', () => {
    const ot = [
      { sigla: 'CN-1', fecha: '2026-01-01', tipo: 'Correctivo', ubicacion: 'Pit' },
      { sigla: 'CN-1', fecha: '2026-01-10', tipo: 'Correctivo', ubicacion: 'Pit' },
      { sigla: 'CN-1', fecha: '2026-01-20', tipo: 'Correctivo', ubicacion: 'Pit' },
      { sigla: 'CN-1', fecha: '2026-01-30', tipo: 'Correctivo', ubicacion: 'Pit' },
    ];
    expect(tasaFallaPorUbicacion(ot)).toEqual([]);
  });
});

describe('edadVirtualEquipo — Kijima simplificado (factor Q)', () => {
  it('null con menos de 6 intervalos (7 fallas)', () => {
    expect(edadVirtualEquipo([1000, 2000, 3000, 4000, 5000, 6000])).toBeNull();
  });

  it('null sin datos / arreglo vacío', () => {
    expect(edadVirtualEquipo([])).toBeNull();
    expect(edadVirtualEquipo(undefined)).toBeNull();
  });

  it('factorQ=0 cuando los intervalos se mantienen o mejoran (reparaciones efectivas)', () => {
    // Intervalos: 1000,1000,1000,1000,1000,1000,1000 (constantes) -> segunda mitad no empeora
    const r = edadVirtualEquipo([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000]);
    expect(r).not.toBeNull();
    expect(r.factorQ).toBe(0);
    expect(r.interpretacion).toMatch(/Sin evidencia/);
  });

  it('factorQ alto cuando los intervalos se acortan con el tiempo (degradación acumulada)', () => {
    // Primeros intervalos largos (1000), luego cada vez más cortos hasta casi 0
    const horoms = [0, 1000, 2000, 3000, 3800, 4400, 4800, 5000];
    const r = edadVirtualEquipo(horoms);
    expect(r).not.toBeNull();
    expect(r.factorQ).toBeGreaterThan(0.5);
    expect(r.interpretacion).toMatch(/Degradación/);
  });

  it('es insensible al orden de entrada', () => {
    const horoms = [0, 1000, 2000, 3000, 3800, 4400, 4800, 5000];
    const ordenado = edadVirtualEquipo(horoms);
    const desordenado = edadVirtualEquipo([5000, 0, 4400, 1000, 4800, 2000, 3000, 3800]);
    expect(desordenado).toEqual(ordenado);
  });

  it('ignora horómetros duplicados (intervalo 0, no cuenta como fallas separadas en los intervalos)', () => {
    // 10 valores crudos, 2 son "0" (inválidos, descartados por h>0) -> 8 horómetros válidos,
    // pero uno de los intervalos entre ellos (1000-1000) da 0 y se descarta -> solo 6 intervalos.
    const r = edadVirtualEquipo([0, 0, 1000, 1000, 2000, 3000, 4000, 5000, 6000, 7000]);
    expect(r).not.toBeNull();
    expect(r.nFallas).toBe(8);
    expect(r.factorQ).toBe(0);
  });
});
