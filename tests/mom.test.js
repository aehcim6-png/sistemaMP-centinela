import { describe, it, expect } from 'vitest';
import { momRaciBaseFilas, momRaciMatriz, momRaciValidar, momEntrenamientoEstado, momEntrenamientoError, momEntrenamientoResumen, MOM_RACI_BASE, MOM_TAREA_ACTIVIDAD_BASE, momRaciDeActividad, tareaRaci, tareaEscalaA, TAREAS_ORIGENES } from '../logic.js';

describe('matriz RACI del MOM', () => {
  it('la propuesta base cumple la regla RACI: cada actividad con una sola A y al menos una R', () => {
    const m = momRaciMatriz(momRaciBaseFilas());
    expect(m.actividades).toHaveLength(MOM_RACI_BASE.actividades.length);
    expect(m.roles.map((r) => r.nombre)).toHaveLength(MOM_RACI_BASE.roles.length);
    expect(momRaciValidar(m)).toEqual([]);
  });
  it('arma la matriz respetando el orden y la audiencia de cada rol', () => {
    const m = momRaciMatriz([
      { actividad: 'B', actOrden: 2, rol: 'Y', rolOrden: 2, audienciaRol: 'Operacional', letra: 'R' },
      { actividad: 'A', actOrden: 1, rol: 'X', rolOrden: 1, audienciaRol: 'Ejecutivo', letra: 'A' },
      { actividad: 'A', actOrden: 1, rol: 'Y', rolOrden: 2, audienciaRol: 'Operacional', letra: null },
    ]);
    expect(m.actividades).toEqual(['A', 'B']);
    expect(m.roles).toEqual([{ nombre: 'X', audiencia: 'Ejecutivo' }, { nombre: 'Y', audiencia: 'Operacional' }]);
    expect(m.celda.A).toEqual({ X: 'A', Y: null });
  });
  it('detecta actividades sin A, con varias A o sin R', () => {
    const m = momRaciMatriz([
      { actividad: 'sinA', actOrden: 1, rol: 'X', rolOrden: 1, letra: 'R' },
      { actividad: 'dosA', actOrden: 2, rol: 'X', rolOrden: 1, letra: 'A' }, { actividad: 'dosA', actOrden: 2, rol: 'Y', rolOrden: 2, letra: 'A' },
      { actividad: 'sinR', actOrden: 3, rol: 'X', rolOrden: 1, letra: 'A' },
    ]);
    const v = momRaciValidar(m);
    expect(v.find((x) => x.actividad === 'sinA').tipo).toBe('sinA');
    expect(v.find((x) => x.actividad === 'dosA' && x.tipo === 'variasA')).toBeTruthy();
    expect(v.find((x) => x.actividad === 'sinR').tipo).toBe('sinR');
    expect(momRaciValidar(null)).toEqual([]);
  });
});

describe('plan de entrenamientos del MOM', () => {
  const hoy = '2026-11-09';
  it('un planificado o reprogramado con fecha pasada figura Atrasado; un ejecutado o cancelado no', () => {
    expect(momEntrenamientoEstado({ estado: 'Planificado', fechaPlan: '2026-11-01' }, hoy)).toBe('Atrasado');
    expect(momEntrenamientoEstado({ estado: 'Reprogramado', fechaPlan: '2026-11-08' }, hoy)).toBe('Atrasado');
    expect(momEntrenamientoEstado({ estado: 'Planificado', fechaPlan: '2026-11-09' }, hoy)).toBe('Planificado');
    expect(momEntrenamientoEstado({ estado: 'Ejecutado', fechaPlan: '2026-11-01' }, hoy)).toBe('Ejecutado');
    expect(momEntrenamientoEstado({ estado: 'Cancelado', fechaPlan: '2026-11-01' }, hoy)).toBe('Cancelado');
  });
  it('valida un entrenamiento', () => {
    const ok = { tema: 'Lectura del plan de mantenimiento', audiencia: 'Operacional', estado: 'Planificado', fechaPlan: '2026-12-01' };
    expect(momEntrenamientoError(ok)).toBeNull();
    expect(momEntrenamientoError({ ...ok, tema: 'ab' })).toMatch(/tema/);
    expect(momEntrenamientoError({ ...ok, audiencia: 'Otro' })).toMatch(/audiencia/);
    expect(momEntrenamientoError({ ...ok, fechaPlan: '' })).toMatch(/fecha planificada/);
    expect(momEntrenamientoError({ ...ok, estado: 'Ejecutado' })).toMatch(/fecha real/);
    expect(momEntrenamientoError({ ...ok, estado: 'Ejecutado', fechaReal: '2026-12-02' })).toBeNull();
    expect(momEntrenamientoError({ ...ok, duracionH: 0 })).toMatch(/duración/);
    expect(momEntrenamientoError({ ...ok, asistentesReal: -1 })).toMatch(/asistencia/);
    expect(momEntrenamientoError({ ...ok, asistentesPlan: 2.5 })).toMatch(/asistencia/);
  });
  it('cumplimiento = ejecutados ÷ (ejecutados + atrasados); los que están a tiempo y los cancelados no cuentan en contra', () => {
    const l = [
      { audiencia: 'Ejecutivo', estado: 'Ejecutado', fechaPlan: '2026-10-01', fechaReal: '2026-10-01', duracionH: 2, asistentesPlan: 4, asistentesReal: 3 },
      { audiencia: 'Operacional', estado: 'Ejecutado', fechaPlan: '2026-10-05', fechaReal: '2026-10-06', duracionH: 1.5, asistentesPlan: 10, asistentesReal: 9 },
      { audiencia: 'Operacional', estado: 'Planificado', fechaPlan: '2026-10-20' },
      { audiencia: 'Operacional', estado: 'Planificado', fechaPlan: '2026-11-20' },
      { audiencia: 'Ejecutivo', estado: 'Cancelado', fechaPlan: '2026-10-10' },
    ];
    const r = momEntrenamientoResumen(l, hoy);
    expect(r.total).toBe(5);
    expect(r.porEstado).toMatchObject({ Ejecutado: 2, Atrasado: 1, Planificado: 1, Cancelado: 1 });
    expect(r.cumplimiento).toBe(67);
    expect(r.porAudiencia.Ejecutivo.cumplimiento).toBe(100);
    expect(r.porAudiencia.Operacional.cumplimiento).toBe(50);
    expect(r.horas).toBe(3.5);
    expect(r.asistencia).toBe(86);
    expect(r.proximos).toBe(1);
  });
  it('sin entrenamientos no inventa porcentajes', () => {
    const r = momEntrenamientoResumen([], hoy);
    expect(r).toMatchObject({ total: 0, cumplimiento: null, asistencia: null, horas: 0 });
  });
});

describe('matriz RACI × Tareas', () => {
  const filas = momRaciBaseFilas();
  it('cada origen de Tarea (salvo «manual») tiene en la propuesta base una actividad que existe en la matriz', () => {
    const m = momRaciMatriz(filas);
    Object.keys(TAREAS_ORIGENES).filter((o) => o !== 'manual').forEach((o) => {
      expect(MOM_TAREA_ACTIVIDAD_BASE[o], o).toBeTruthy();
      expect(m.actividades).toContain(MOM_TAREA_ACTIVIDAD_BASE[o]);
    });
  });
  it('momRaciDeActividad lista los roles por letra', () => {
    const r = momRaciDeActividad(filas, MOM_TAREA_ACTIVIDAD_BASE.pedir_ya);
    expect(r.R).toEqual(['Comprador']);
    expect(r.A).toEqual(['Jefe de Mantenimiento']);
    expect(r.I).toEqual(['Gerente / Administrador de contrato']);
    expect(momRaciDeActividad(filas, 'no existe')).toBeNull();
  });
  it('tareaRaci usa el vínculo del origen y devuelve null si falta matriz, vínculo o actividad', () => {
    const t = { origen: 'pedir_ya', responsable: 'Comprador' };
    expect(tareaRaci(t, filas, MOM_TAREA_ACTIVIDAD_BASE)).toMatchObject({ actividad: MOM_TAREA_ACTIVIDAD_BASE.pedir_ya, A: ['Jefe de Mantenimiento'] });
    expect(tareaRaci(t, [], MOM_TAREA_ACTIVIDAD_BASE)).toBeNull();
    expect(tareaRaci(t, filas, {})).toBeNull();
    expect(tareaRaci(t, filas, undefined)).toBeNull();
    expect(tareaRaci({ origen: 'manual' }, filas, MOM_TAREA_ACTIVIDAD_BASE)).toBeNull();
    expect(tareaRaci(t, filas, { pedir_ya: 'actividad borrada' })).toBeNull();
  });
  it('la escalación va al rol A de la matriz; sin matriz sigue la regla de siempre (jefe de taller)', () => {
    const t = { origen: 'falla_repetida', responsable: 'Carlos Trigo' };
    expect(tareaEscalaA(t)).toBe('José Yáñez');
    expect(tareaEscalaA(t, tareaRaci(t, filas, MOM_TAREA_ACTIVIDAD_BASE))).toBe('Jefe de Mantenimiento');
    expect(tareaEscalaA(t, null)).toBe('José Yáñez');
  });
});
