import { describe, it, expect } from 'vitest';
import { ordenUrgentes } from '../logic.js';

// Orden de la tabla "Equipos Urgentes" del Dashboard: criticidad → PM más vencido → salud más baja → sigla.
const u = (sigla, criticidad, diasParaPM) => ({ sigla, criticidad, diasParaPM });

describe('ordenUrgentes', () => {
  it('Crítico antes que Esencial, Esencial antes que General, sin etiqueta al final', () => {
    const r = ordenUrgentes([u('G', 'General', -9), u('S', undefined, -20), u('E', 'Esencial', -5), u('C', 'Crítico', 3)], {});
    expect(r.map((x) => x.sigla)).toEqual(['C', 'E', 'G', 'S']);
  });

  it('dentro de la misma criticidad, el PM más vencido primero', () => {
    const r = ordenUrgentes([u('A', 'Crítico', -2), u('B', 'Crítico', -15), u('C', 'Crítico', 1)], {});
    expect(r.map((x) => x.sigla)).toEqual(['B', 'A', 'C']);
  });

  it('con igual criticidad y días, la salud más baja primero; sin score va después', () => {
    const r = ordenUrgentes([u('A', 'Crítico', -2), u('B', 'Crítico', -2), u('C', 'Crítico', -2)], { A: 80, B: 40, C: null });
    expect(r.map((x) => x.sigla)).toEqual(['B', 'A', 'C']);
  });

  it('desempata por sigla y no modifica el arreglo original', () => {
    const orig = [u('Z', 'General', 0), u('A', 'General', 0)];
    const r = ordenUrgentes(orig, {});
    expect(r.map((x) => x.sigla)).toEqual(['A', 'Z']);
    expect(orig.map((x) => x.sigla)).toEqual(['Z', 'A']);
  });

  it('entradas vacías no fallan', () => {
    expect(ordenUrgentes(null, null)).toEqual([]);
    expect(ordenUrgentes([], {})).toEqual([]);
  });
});
