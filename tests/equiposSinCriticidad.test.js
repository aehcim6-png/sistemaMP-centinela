import { describe, it, expect } from 'vitest';
import { equiposSinCriticidad } from '../logic.js';

// equiposSinCriticidad (2026-09-11): auditoría 2026-08-27 encontró que
// equipos.criticidad (dropdown Crítico/Esencial/General de Ficha Técnica)
// estaba NULL para los 35 equipos reales de Besalco — el único consumidor
// que lo usa (Backlog Inteligente, pred.js) no tenía ningún efecto real.
// Esta cuenta es la fuente única para avisarle al admin.

describe('equiposSinCriticidad', () => {
  it('cuenta los equipos sin criticidad (null, undefined o string vacío)', () => {
    expect(equiposSinCriticidad([
      { sigla: 'AA-1', criticidad: null },
      { sigla: 'AA-2', criticidad: undefined },
      { sigla: 'AA-3', criticidad: '' },
      { sigla: 'AA-4' },
    ])).toBe(4);
  });

  it('no cuenta los equipos que ya tienen algún valor clasificado', () => {
    expect(equiposSinCriticidad([
      { sigla: 'AA-1', criticidad: 'Crítico' },
      { sigla: 'AA-2', criticidad: 'Esencial' },
      { sigla: 'AA-3', criticidad: 'General' },
    ])).toBe(0);
  });

  it('mezcla de clasificados y sin clasificar', () => {
    expect(equiposSinCriticidad([
      { sigla: 'AA-1', criticidad: 'Crítico' },
      { sigla: 'AA-2', criticidad: null },
      { sigla: 'AA-3' },
    ])).toBe(2);
  });

  it('arreglo vacío o nulo da 0, no revienta', () => {
    expect(equiposSinCriticidad([])).toBe(0);
    expect(equiposSinCriticidad(null)).toBe(0);
    expect(equiposSinCriticidad(undefined)).toBe(0);
  });

  it('ignora entradas nulas dentro del arreglo', () => {
    expect(equiposSinCriticidad([null, { sigla: 'AA-1', criticidad: null }, undefined])).toBe(1);
  });
});
