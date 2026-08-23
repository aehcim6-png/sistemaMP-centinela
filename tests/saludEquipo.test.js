import { describe, it, expect } from 'vitest';
import { scoreSaludEquipo, motivoPrincipalSalud } from '../logic.js';

describe('scoreSaludEquipo', () => {
  it('devuelve null si no hay ninguna dimensión con dato', () => {
    const r = scoreSaludEquipo({});
    expect(r.valor).toBeNull();
    expect(r.n).toBe(0);
  });

  it('promedia las 4 dimensiones cuando todas tienen dato', () => {
    const r = scoreSaludEquipo({ componentesPct: 100, neumaticosPct: 80, aceitePct: 60, confiabilidadPct: 100 });
    expect(r.valor).toBe(85);
    expect(r.n).toBe(4);
  });

  it('promedia solo las dimensiones disponibles, sin inventar las que faltan', () => {
    // Caso real: equipo sin muestras de aceite y sin 2 fallas registradas
    // (así que no hay MTBF) — solo componentes y neumáticos tienen dato.
    const r = scoreSaludEquipo({ componentesPct: 90, neumaticosPct: 70, aceitePct: null, confiabilidadPct: null });
    expect(r.valor).toBe(80);
    expect(r.n).toBe(2);
  });

  it('el detalle trae las 4 dimensiones con su nombre, tenga dato o no', () => {
    const r = scoreSaludEquipo({ componentesPct: 90 });
    expect(r.detalle.map(c => c.nombre)).toEqual(['Componentes', 'Neumáticos', 'Aceite', 'Confiabilidad']);
    expect(r.detalle.find(c => c.nombre === 'Aceite').valor).toBeNull();
  });

  it('redondea a un decimal', () => {
    const r = scoreSaludEquipo({ componentesPct: 100, neumaticosPct: 66, confiabilidadPct: null, aceitePct: null });
    expect(r.valor).toBe(83);
  });

  it('un equipo perfecto en las 4 dimensiones da 100', () => {
    const r = scoreSaludEquipo({ componentesPct: 100, neumaticosPct: 100, aceitePct: 100, confiabilidadPct: 100 });
    expect(r.valor).toBe(100);
  });

  it('ignora valores no numéricos (undefined, NaN, string) como si faltara el dato', () => {
    const r = scoreSaludEquipo({ componentesPct: 80, neumaticosPct: undefined, aceitePct: NaN, confiabilidadPct: '50' });
    expect(r.valor).toBe(80);
    expect(r.n).toBe(1);
  });
});

describe('motivoPrincipalSalud', () => {
  it('devuelve null si el detalle está vacío', () => {
    expect(motivoPrincipalSalud([])).toBeNull();
  });

  it('devuelve null si ninguna dimensión tiene dato', () => {
    const detalle = [{ nombre: 'Componentes', valor: null }, { nombre: 'Aceite', valor: null }];
    expect(motivoPrincipalSalud(detalle)).toBeNull();
  });

  it('elige la dimensión de valor más bajo entre las que tienen dato', () => {
    const detalle = [
      { nombre: 'Componentes', valor: 40 },
      { nombre: 'Neumáticos', valor: 90 },
      { nombre: 'Aceite', valor: null },
      { nombre: 'Confiabilidad', valor: 70 },
    ];
    expect(motivoPrincipalSalud(detalle)).toEqual({ nombre: 'Componentes', valor: 40 });
  });

  it('ignora las dimensiones sin dato al elegir la peor', () => {
    const detalle = [
      { nombre: 'Componentes', valor: null },
      { nombre: 'Neumáticos', valor: 55 },
      { nombre: 'Aceite', valor: 60 },
    ];
    expect(motivoPrincipalSalud(detalle)?.nombre).toBe('Neumáticos');
  });
});
