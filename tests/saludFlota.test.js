import { describe, it, expect } from 'vitest';
import { indiceSaludFlota, registrarSnapshotSalud, tendenciaSaludSemanal } from '../logic.js';

describe('indiceSaludFlota', () => {
  it('devuelve null si no hay ninguna dimensión con dato', () => {
    const r = indiceSaludFlota({});
    expect(r.valor).toBeNull();
    expect(r.n).toBe(0);
  });

  it('promedia las 4 dimensiones cuando todas tienen dato', () => {
    const r = indiceSaludFlota({ cumplPM: 100, disponibilidad: 80, stockSano: 60, confiabilidad: 100 });
    expect(r.valor).toBe(85);
    expect(r.n).toBe(4);
  });

  it('promedia solo las dimensiones disponibles, sin inventar las que faltan', () => {
    const r = indiceSaludFlota({ cumplPM: 90, disponibilidad: null, stockSano: 70, confiabilidad: null });
    expect(r.valor).toBe(80);
    expect(r.n).toBe(2);
  });

  it('el detalle trae las 4 dimensiones con su nombre, tenga dato o no', () => {
    const r = indiceSaludFlota({ cumplPM: 90 });
    expect(r.detalle.map(c => c.nombre)).toEqual(['Cumplimiento PM', 'Disponibilidad', 'Stock sano', 'Confiabilidad']);
    expect(r.detalle.find(c => c.nombre === 'Disponibilidad').valor).toBeNull();
  });
});

describe('registrarSnapshotSalud', () => {
  it('agrega el valor de hoy a un histórico vacío', () => {
    const out = registrarSnapshotSalud({}, 85, '2026-08-07');
    expect(out).toEqual({ '2026-08-07': 85 });
  });

  it('no muta el histórico original (pura)', () => {
    const original = { '2026-08-01': 80 };
    registrarSnapshotSalud(original, 85, '2026-08-07');
    expect(original).toEqual({ '2026-08-01': 80 });
  });

  it('sobrescribe si ya había un valor registrado hoy (no duplica)', () => {
    const out = registrarSnapshotSalud({ '2026-08-07': 70 }, 85, '2026-08-07');
    expect(out['2026-08-07']).toBe(85);
    expect(Object.keys(out).length).toBe(1);
  });

  it('descarta snapshots más viejos que SALUD_HIST_DIAS_MAX (120 días)', () => {
    const historico = { '2026-01-01': 50, '2026-08-01': 82 };
    const out = registrarSnapshotSalud(historico, 85, '2026-08-07');
    expect(out['2026-01-01']).toBeUndefined();
    expect(out['2026-08-01']).toBe(82);
  });

  it('no hace nada si valorHoy es null', () => {
    const historico = { '2026-08-01': 80 };
    const out = registrarSnapshotSalud(historico, null, '2026-08-07');
    expect(out).toEqual(historico);
  });
});

describe('tendenciaSaludSemanal', () => {
  it('devuelve null si no hay valor registrado para hoy', () => {
    expect(tendenciaSaludSemanal({}, '2026-08-07')).toBeNull();
  });

  it('calcula el delta contra el snapshot de hace 7 días exactos', () => {
    const historico = { '2026-07-31': 80, '2026-08-07': 88 };
    const r = tendenciaSaludSemanal(historico, '2026-08-07');
    expect(r.delta).toBe(8);
    expect(r.hace7d).toBe(80);
    expect(r.fechaHace7d).toBe('2026-07-31');
  });

  it('usa el snapshot más cercano dentro de la ventana de 4-10 días si no hay uno exacto', () => {
    const historico = { '2026-08-01': 75, '2026-08-07': 90 };
    const r = tendenciaSaludSemanal(historico, '2026-08-07');
    expect(r.delta).toBe(15);
    expect(r.fechaHace7d).toBe('2026-08-01');
  });

  it('no da tendencia si el snapshot más cercano cae fuera de la ventana de 4-10 días', () => {
    const historico = { '2026-08-06': 80, '2026-08-07': 88 };
    const r = tendenciaSaludSemanal(historico, '2026-08-07');
    expect(r.delta).toBeNull();
    expect(r.actual).toBe(88);
  });

  it('delta negativo cuando el índice bajó', () => {
    const historico = { '2026-07-31': 90, '2026-08-07': 82 };
    const r = tendenciaSaludSemanal(historico, '2026-08-07');
    expect(r.delta).toBe(-8);
  });
});
