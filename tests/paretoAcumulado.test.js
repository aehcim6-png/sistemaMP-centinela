import { describe, it, expect } from 'vitest';
import { paretoAcumulado } from '../logic.js';

// paretoAcumulado (2026-09-11): generalizado desde el cálculo que vivía
// inline en _estTablaModoFalla (modules/renders/estadistica.js, 2026-08-31)
// para que Equipo y Componente reusen el mismo tratamiento Pareto completo
// (% del total, acumulado, "pocos vitales", barra) en vez de duplicarlo.

describe('paretoAcumulado', () => {
  it('ordena descendente por el campo dado, sin mutar la lista original', () => {
    const original = [{ modo: 'A', fallas: 2 }, { modo: 'B', fallas: 10 }, { modo: 'C', fallas: 5 }];
    const copia = original.map((o) => ({ ...o }));
    const r = paretoAcumulado(original);
    expect(r.map((x) => x.modo)).toEqual(['B', 'C', 'A']);
    expect(original).toEqual(copia);
  });

  it('calcula % del total y acumulado correctamente', () => {
    const r = paretoAcumulado([{ modo: 'A', fallas: 50 }, { modo: 'B', fallas: 30 }, { modo: 'C', fallas: 20 }]);
    expect(r[0].pct).toBe(50);
    expect(r[0].acumulado).toBe(50);
    expect(r[1].pct).toBe(30);
    expect(r[1].acumulado).toBe(80);
    expect(r[2].pct).toBe(20);
    expect(r[2].acumulado).toBe(100);
  });

  it('marca vital=true solo mientras el acumulado ANTES de la fila es menor a 80%, incluida la fila que cruza el umbral', () => {
    const r = paretoAcumulado([{ modo: 'A', fallas: 70 }, { modo: 'B', fallas: 20 }, { modo: 'C', fallas: 10 }]);
    // A: acumPrev=0 (<80) -> vital. B: acumPrev=70 (<80) -> vital, cruza a 90.
    // C: acumPrev=90 (>=80) -> no vital.
    expect(r[0].vital).toBe(true);
    expect(r[1].vital).toBe(true);
    expect(r[2].vital).toBe(false);
  });

  it('barPct es relativo al máximo de la lista, 100 para el primero', () => {
    const r = paretoAcumulado([{ modo: 'A', fallas: 8 }, { modo: 'B', fallas: 4 }]);
    expect(r[0].barPct).toBe(100);
    expect(r[1].barPct).toBe(50);
  });

  it('lista vacía da arreglo vacío, sin dividir por cero', () => {
    expect(paretoAcumulado([])).toEqual([]);
    expect(paretoAcumulado(null)).toEqual([]);
  });

  it('acepta un nombre de campo distinto de "fallas"', () => {
    const r = paretoAcumulado([{ sigla: 'AA-1', costo: 100 }, { sigla: 'AA-2', costo: 300 }], 'costo');
    expect(r[0].sigla).toBe('AA-2');
    expect(r[0].pct).toBe(75);
  });

  it('conserva todos los campos originales de cada fila (no descarta datos)', () => {
    const r = paretoAcumulado([{ sigla: 'AA-1', fallas: 5, modelo: 'X' }]);
    expect(r[0].sigla).toBe('AA-1');
    expect(r[0].modelo).toBe('X');
  });

  it('un solo elemento con 100% del total: vital y sin necesidad de más filas', () => {
    const r = paretoAcumulado([{ modo: 'Único', fallas: 7 }]);
    expect(r[0].pct).toBe(100);
    expect(r[0].acumulado).toBe(100);
    expect(r[0].vital).toBe(true);
    expect(r[0].barPct).toBe(100);
  });
});
