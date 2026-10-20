import { describe, it, expect } from 'vitest';
import { auditoriaDiff, auditoriaFinalizar, auditoriaReferencia, AUDIT_CAMPOS_DERIVADOS } from '../logic.js';

// Auditoría campo por campo: qué cambió entre la foto de antes y la de después de un guardado.
const cfgEq = { tabla: 'equipos', clave: 'sigla', claveDb: 'sigla', cols: ['sigla', 'tipo', 'modelo', 'hrsDia', 'horomActual', 'estado', 'tipoPM', 'horomProxPM', 'hrsRestantes', 'diasParaPM', 'fechaProxPM', 'valorCompra'] };
const cfgOt = { tabla: 'correctivos', clave: '_id', claveDb: 'id', cols: ['sigla', 'sintoma', 'solucion', 'estadoOT'] };
const eq = (o) => Object.assign({ sigla: 'CN-1', tipo: 'Camion', modelo: 'HD785', hrsDia: 12, horomActual: 1000, estado: 'AL DÍA', tipoPM: 'PM1', horomProxPM: 1250, hrsRestantes: 250, diasParaPM: 20, fechaProxPM: '2026-11-01', valorCompra: null }, o);

describe('auditoriaDiff', () => {
  it('un campo editado deja una fila con valor antes y después', () => {
    const r = auditoriaDiff('eq', cfgEq, [eq()], [eq({ hrsDia: 14 })]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ accion: 'editar', registro: 'CN-1', campo: 'hrsDia', valor_antes: '12', valor_despues: '14', referencia: 'CN-1' });
  });

  it('los campos calculados por el sistema no se registran, pero el campo real que los provocó sí', () => {
    const r = auditoriaDiff('eq', cfgEq, [eq()], [eq({ horomActual: 1100, estado: 'URGENTE', horomProxPM: 1500, hrsRestantes: 150, diasParaPM: 5, fechaProxPM: '2026-10-20', tipoPM: 'PM2' })]);
    expect(r.map((x) => x.campo)).toEqual(['horomActual']);
    AUDIT_CAMPOS_DERIVADOS.eq.forEach((c) => expect(r.some((x) => x.campo === c)).toBe(false));
  });

  it('vacío, null y undefined son lo mismo; 10 y "10" también', () => {
    const r = auditoriaDiff('eq', cfgEq, [eq({ valorCompra: null, hrsDia: 10 })], [eq({ valorCompra: '', hrsDia: '10' })]);
    expect(r).toEqual([]);
  });

  it('filas nuevas y borradas, con su clave y referencia', () => {
    const a = [{ _id: 'a', sigla: 'CN-1', sintoma: 'x' }, { _id: 'b', sigla: 'CN-2', sintoma: 'y' }];
    const d = [{ _id: 'a', sigla: 'CN-1', sintoma: 'x' }, { _id: 'c', sigla: 'CN-3', sintoma: 'z' }];
    const r = auditoriaDiff('ot', cfgOt, a, d);
    const crear = r.find((x) => x.accion === 'crear'), borrar = r.find((x) => x.accion === 'eliminar');
    expect(crear).toMatchObject({ registro: 'c', referencia: 'CN-3' });
    expect(borrar).toMatchObject({ registro: 'b', referencia: 'CN-2' });
  });

  it('una fila nueva sin id todavía queda como alta y el id se completa al finalizar', () => {
    const nueva = { sigla: 'CN-9', sintoma: 'ruido' };
    const regs = auditoriaDiff('ot', cfgOt, [], [nueva]);
    expect(regs).toHaveLength(1);
    expect(regs[0].registro).toBeNull();
    nueva._id = 'uuid-asignado-al-guardar';
    const fin = auditoriaFinalizar(regs, cfgOt, { usuario_nombre: 'Ana', rol: 'operador', pestana: 'Correctivos', lote: 'L1' });
    expect(fin[0]).toMatchObject({ tabla: 'correctivos', registro: 'uuid-asignado-al-guardar', accion: 'crear', usuario_nombre: 'Ana', rol: 'operador', pestana: 'Correctivos', lote: 'L1' });
  });

  it('una importación masiva queda en una sola fila resumen', () => {
    const muchas = Array.from({ length: 50 }, (_, i) => ({ _id: 'n' + i, sigla: 'X' + i }));
    const r = auditoriaDiff('ot', cfgOt, [], muchas);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ accion: 'crear', campo: 'filas', valor_despues: '+50', referencia: '50 filas' });
  });

  it('un guardado con demasiados campos cambiados se corta con una fila "(más cambios)"', () => {
    const a = Array.from({ length: 200 }, (_, i) => ({ _id: 'i' + i, sigla: 'S' + i, sintoma: 'a', solucion: 'a', estadoOT: 'a' }));
    const d = a.map((o) => Object.assign({}, o, { sintoma: 'b', solucion: 'b', estadoOT: 'b' }));
    const r = auditoriaDiff('ot', cfgOt, a, d);
    expect(r.length).toBeLessThanOrEqual(300);
    expect(r[r.length - 1].campo).toBe('(más cambios)');
  });

  it('tablas que no son datos de trabajo no se auditan, y los valores largos se acortan', () => {
    expect(auditoriaDiff('changelog', { clave: '_id', cols: ['accion'] }, [], [{ _id: 1, accion: 'x' }])).toEqual([]);
    expect(auditoriaDiff('al', { clave: '_id', cols: ['sigla'] }, [{ _id: 1, sigla: 'a' }], [{ _id: 1, sigla: 'b' }])).toEqual([]);
    const largo = 'x'.repeat(2000);
    const r = auditoriaDiff('ot', cfgOt, [{ _id: 'a', sintoma: 'corto' }], [{ _id: 'a', sintoma: largo }]);
    expect(r[0].valor_despues.length).toBeLessThanOrEqual(501);
  });

  it('entradas inválidas no fallan', () => {
    expect(auditoriaDiff('eq', cfgEq, null, [])).toEqual([]);
    expect(auditoriaDiff('eq', null, [], [])).toEqual([]);
    expect(auditoriaReferencia(null)).toBeNull();
  });

  it('finalizar entrega siempre las mismas columnas en todas las filas (el servidor lo exige)', () => {
    const regs = [{ accion: 'editar', registro: 'a', referencia: null, campo: 'x', valor_antes: '1', valor_despues: '2', _fila: null }, { accion: 'crear', registro: null, referencia: 'z', campo: null, valor_antes: null, valor_despues: null, _fila: { _id: 'q' } }];
    const fin = auditoriaFinalizar(regs, cfgOt, { pestana: 'Equipos' });
    expect(Object.keys(fin[0]).sort()).toEqual(Object.keys(fin[1]).sort());
    expect(fin[1].registro).toBe('q');
  });
});
