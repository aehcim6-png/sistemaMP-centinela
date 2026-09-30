import { describe, it, expect } from 'vitest';
import { trazabilidadAvisoOrden, resumenTrazabilidadAvisoOrden } from '../logic.js';

describe('trazabilidadAvisoOrden', () => {
  it('array vacío sin informes de falla', () => {
    expect(trazabilidadAvisoOrden([], [])).toEqual([]);
    expect(trazabilidadAvisoOrden(undefined, undefined)).toEqual([]);
  });

  it('ignora informes sin sigla o sin fecha', () => {
    const inf = [{ fecha: '2026-01-01' }, { sigla: 'CN-9501' }];
    expect(trazabilidadAvisoOrden(inf, [])).toEqual([]);
  });

  it('marca vinculada=true si hay una OT del mismo sigla dentro de la ventana (default 3 días)', () => {
    const inf = [{ id: '1', sigla: 'CN-9501', fecha: '2026-01-10', tipoEvento: 'Falla Catastrófica' }];
    const ot = [{ sigla: 'CN-9501', fecha: '2026-01-12' }];
    const r = trazabilidadAvisoOrden(inf, ot);
    expect(r[0].vinculada).toBe(true);
  });

  it('marca vinculada=false si la OT está fuera de la ventana', () => {
    const inf = [{ id: '1', sigla: 'CN-9501', fecha: '2026-01-10' }];
    const ot = [{ sigla: 'CN-9501', fecha: '2026-01-20' }];
    const r = trazabilidadAvisoOrden(inf, ot);
    expect(r[0].vinculada).toBe(false);
  });

  it('marca vinculada=false si la OT es de otro sigla, aunque la fecha coincida', () => {
    const inf = [{ id: '1', sigla: 'CN-9501', fecha: '2026-01-10' }];
    const ot = [{ sigla: 'CN-5131', fecha: '2026-01-10' }];
    const r = trazabilidadAvisoOrden(inf, ot);
    expect(r[0].vinculada).toBe(false);
  });

  it('respeta el parámetro ventanaDias explícito', () => {
    const inf = [{ id: '1', sigla: 'CN-9501', fecha: '2026-01-10' }];
    const ot = [{ sigla: 'CN-9501', fecha: '2026-01-16' }]; // 6 días después
    expect(trazabilidadAvisoOrden(inf, ot, 3)[0].vinculada).toBe(false);
    expect(trazabilidadAvisoOrden(inf, ot, 7)[0].vinculada).toBe(true);
  });

  it('la ventana es simétrica (OT antes del aviso también cuenta)', () => {
    const inf = [{ id: '1', sigla: 'CN-9501', fecha: '2026-01-10' }];
    const ot = [{ sigla: 'CN-9501', fecha: '2026-01-08' }];
    expect(trazabilidadAvisoOrden(inf, ot, 3)[0].vinculada).toBe(true);
  });

  it('no muta los arreglos originales (pura)', () => {
    const inf = [{ id: '1', sigla: 'CN-9501', fecha: '2026-01-10' }];
    const ot = [{ sigla: 'CN-9501', fecha: '2026-01-10' }];
    const infCopia = inf.map((x) => ({ ...x }));
    const otCopia = ot.map((x) => ({ ...x }));
    trazabilidadAvisoOrden(inf, ot);
    expect(inf).toEqual(infCopia);
    expect(ot).toEqual(otCopia);
  });
});

describe('resumenTrazabilidadAvisoOrden', () => {
  it('sin datos: total 0, pctSinVincular null', () => {
    const r = resumenTrazabilidadAvisoOrden([]);
    expect(r.total).toBe(0);
    expect(r.pctSinVincular).toBeNull();
    expect(r.listaSinVincular).toEqual([]);
  });

  it('cuenta vinculados y sin vincular correctamente', () => {
    const t = [
      { id: '1', sigla: 'A', fecha: '2026-01-01', vinculada: true },
      { id: '2', sigla: 'B', fecha: '2026-01-02', vinculada: false },
      { id: '3', sigla: 'C', fecha: '2026-01-03', vinculada: false },
    ];
    const r = resumenTrazabilidadAvisoOrden(t);
    expect(r.total).toBe(3);
    expect(r.vinculados).toBe(1);
    expect(r.sinVincular).toBe(2);
    expect(r.pctSinVincular).toBeCloseTo(66.7, 1);
  });

  it('listaSinVincular queda ordenada por fecha más reciente primero', () => {
    const t = [
      { id: '1', sigla: 'A', fecha: '2026-01-01', vinculada: false },
      { id: '2', sigla: 'B', fecha: '2026-03-01', vinculada: false },
      { id: '3', sigla: 'C', fecha: '2026-02-01', vinculada: false },
    ];
    const r = resumenTrazabilidadAvisoOrden(t);
    expect(r.listaSinVincular.map((x) => x.id)).toEqual(['2', '3', '1']);
  });

  it('no muta el arreglo original (pura)', () => {
    const t = [{ id: '1', sigla: 'A', fecha: '2026-01-01', vinculada: false }];
    const copia = t.map((x) => ({ ...x }));
    resumenTrazabilidadAvisoOrden(t);
    expect(t).toEqual(copia);
  });
});
