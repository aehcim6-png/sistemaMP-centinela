import { describe, it, expect } from 'vitest';
import { _CATEGORIAS_MTTR, analisisMTTRPorCategoria } from '../logic.js';

describe('_CATEGORIAS_MTTR', () => {
  it('son las 4 categorías reales del diagrama de Predyc sobre Mantenibilidad', () => {
    expect(_CATEGORIAS_MTTR).toEqual(['Acceso', 'Diseño', 'Información', 'Intervención']);
  });
});

describe('analisisMTTRPorCategoria', () => {
  it('array vacío sin correctivos', () => {
    expect(analisisMTTRPorCategoria([])).toEqual([]);
    expect(analisisMTTRPorCategoria(undefined)).toEqual([]);
  });

  it('ignora correctivos sin categoriaMTTR', () => {
    const c = [{ categoriaMTTR: '', duracion: '5h 00min' }, { duracion: '3h' }];
    expect(analisisMTTRPorCategoria(c)).toEqual([]);
  });

  it('ignora correctivos con categoriaMTTR que no es una de las 4 válidas (nunca inventa una categoría)', () => {
    const c = [{ categoriaMTTR: 'Otra', duracion: '5h 00min' }];
    expect(analisisMTTRPorCategoria(c)).toEqual([]);
  });

  it('ignora correctivos sin duración registrada o con duración "—"', () => {
    const c = [
      { categoriaMTTR: 'Acceso' },
      { categoriaMTTR: 'Acceso', duracion: '—' },
      { categoriaMTTR: 'Acceso', duracion: '' },
    ];
    expect(analisisMTTRPorCategoria(c)).toEqual([]);
  });

  it('ignora duración no parseable (sin patrón "Xh")', () => {
    const c = [{ categoriaMTTR: 'Diseño', duracion: 'pendiente' }];
    expect(analisisMTTRPorCategoria(c)).toEqual([]);
  });

  it('suma horas y cuenta eventos por categoría, con el mismo parseo "Xh" que MTTR', () => {
    const c = [
      { categoriaMTTR: 'Acceso', duracion: '4h 30min' },
      { categoriaMTTR: 'Acceso', duracion: '2h 00min' },
    ];
    const r = analisisMTTRPorCategoria(c);
    expect(r).toHaveLength(1);
    expect(r[0].categoria).toBe('Acceso');
    expect(r[0].nEventos).toBe(2);
    expect(r[0].horasTotales).toBe(6);
    expect(r[0].horasPromedio).toBe(3);
  });

  it('redondea horasPromedio a 1 decimal', () => {
    const c = [
      { categoriaMTTR: 'Información', duracion: '1h' },
      { categoriaMTTR: 'Información', duracion: '2h' },
      { categoriaMTTR: 'Información', duracion: '2h' },
    ];
    const r = analisisMTTRPorCategoria(c);
    expect(r[0].horasTotales).toBe(5);
    expect(r[0].horasPromedio).toBeCloseTo(1.7, 1);
  });

  it('separa correctamente varias categorías y ordena de mayor a menor horasTotales', () => {
    const c = [
      { categoriaMTTR: 'Acceso', duracion: '1h' },
      { categoriaMTTR: 'Intervención', duracion: '10h' },
      { categoriaMTTR: 'Intervención', duracion: '5h' },
      { categoriaMTTR: 'Diseño', duracion: '3h' },
    ];
    const r = analisisMTTRPorCategoria(c);
    expect(r.map((x) => x.categoria)).toEqual(['Intervención', 'Diseño', 'Acceso']);
    expect(r[0].horasTotales).toBe(15);
  });

  it('no muta el arreglo original (pura)', () => {
    const c = [{ categoriaMTTR: 'Acceso', duracion: '4h' }];
    const copia = c.map((x) => ({ ...x }));
    analisisMTTRPorCategoria(c);
    expect(c).toEqual(copia);
  });
});
