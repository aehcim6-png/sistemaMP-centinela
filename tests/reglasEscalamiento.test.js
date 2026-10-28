// Paso 3 «reglas que fuerzan y escalan» (29-oct-2026): tareas con fecha, vencidas y escaladas; pedir ya → tarea; PM incompleto → backlog; falla repetida exige acción.
import { describe, it, expect } from 'vitest';
import { tareaEstado, tareaEscalaA, tareasResumen, tareasDePedirYa, backlogDePMSinDuplicar, otFallaRepetida, otFallaRepetidaFaltantes, tareaDeFallaRepetida, TAREAS_ESCALA_DIAS, TAREAS_PLAZO_PEDIR_YA_DIAS } from '../logic.js';

const HOY = '2026-10-29';
const tarea = (extra) => ({ clave: 'x', origen: 'manual', estado: 'Abierta', fechaLimite: '2026-11-05', responsable: 'Comprador', ...extra });

describe('tareaEstado: vencida y escalada', () => {
  it('abierta hasta su fecha límite; vencida al día siguiente; escalada con 3 días o más de atraso', () => {
    expect(tareaEstado(tarea({ fechaLimite: '2026-10-29' }), HOY)).toBe('Abierta');
    expect(tareaEstado(tarea({ fechaLimite: '2026-10-28' }), HOY)).toBe('Vencida');
    expect(tareaEstado(tarea({ fechaLimite: '2026-10-27' }), HOY)).toBe('Vencida');
    expect(tareaEstado(tarea({ fechaLimite: '2026-10-26' }), HOY)).toBe('Escalada');
    expect(TAREAS_ESCALA_DIAS).toBe(3);
  });
  it('lo cerrado no se vence ni se escala, y sin fecha no vence', () => {
    for (const e of ['Hecha', 'Descartada', 'Resuelta sola']) expect(tareaEstado(tarea({ estado: e, fechaLimite: '2026-01-01' }), HOY)).toBe(e);
    expect(tareaEstado(tarea({ fechaLimite: null }), HOY)).toBe('Abierta');
    expect(tareaEstado(null, HOY)).toBe('Abierta');
  });
  it('se escala al jefe de taller de la cuadrilla del responsable; si no se conoce, a la jefatura', () => {
    expect(tareaEscalaA({ responsable: 'Carlos Trigo' })).toBe('José Yáñez');
    expect(tareaEscalaA({ responsable: 'Camilo Santander' })).toBe('Javier Cárdenas');
    expect(tareaEscalaA({ responsable: 'Comprador' })).toBe('Jefatura de taller');
    expect(tareaEscalaA({})).toBe('Jefatura de taller');
  });
  it('el resumen cuenta abiertas, vencidas, escaladas y cerradas', () => {
    const r = tareasResumen([tarea({ fechaLimite: '2026-11-01' }), tarea({ fechaLimite: '2026-10-28', origen: 'pedir_ya' }), tarea({ fechaLimite: '2026-10-20' }), tarea({ estado: 'Hecha' })], HOY);
    expect(r).toMatchObject({ abiertas: 1, vencidas: 1, escaladas: 1, cerradas: 1, sinCerrar: 3 });
    expect(r.porOrigen).toEqual({ manual: 2, pedir_ya: 1 });
  });
});

describe('regla 1: todo «pedir ya» es una tarea', () => {
  const fila = (item, sigla, decision) => ({ item, sigla, decision, fechaProx: '2026-11-20', lead: { dias: 30 }, stock: { unidades: 0 }, costoEst: 1500000 });
  it('crea una tarea por cada pedir ya, con responsable y 3 días de plazo; no por los otros', () => {
    const r = tareasDePedirYa([fila('ALTERNATOR', 'CN-1', 'pedir_ya'), fila('STARTER', 'CN-1', 'planificar'), fila('TURBO', 'CN-2', 'cubierto')], HOY, []);
    expect(r.nuevas).toHaveLength(1);
    expect(r.nuevas[0]).toMatchObject({ clave: 'pedir|CN-1|ALTERNATOR', origen: 'pedir_ya', responsable: 'Comprador', fechaLimite: '2026-11-01', estado: 'Abierta' });
    expect(r.nuevas[0].detalle).toMatch(/plazo de entrega habitual: 30 días/);
    expect(TAREAS_PLAZO_PEDIR_YA_DIAS).toBe(3);
  });
  it('no duplica: si ya existe (abierta o cerrada) no se crea otra', () => {
    const ex = [{ clave: 'pedir|CN-1|ALTERNATOR', origen: 'pedir_ya', estado: 'Hecha' }];
    expect(tareasDePedirYa([fila('ALTERNATOR', 'CN-1', 'pedir_ya')], HOY, ex).nuevas).toHaveLength(0);
  });
  it('si la condición deja de darse, la tarea abierta queda «Resuelta sola»; una cerrada o de otro origen no se toca', () => {
    const ex = [{ _id: 'a', clave: 'pedir|CN-1|ALTERNATOR', origen: 'pedir_ya', estado: 'Abierta' }, { _id: 'b', clave: 'pedir|CN-2|TURBO', origen: 'pedir_ya', estado: 'Hecha' }, { _id: 'c', clave: 'm', origen: 'manual', estado: 'Abierta' }];
    const r = tareasDePedirYa([fila('ALTERNATOR', 'CN-1', 'en_camino')], HOY, ex);
    expect(r.resueltas.map((x) => x.id)).toEqual(['a']);
    expect(r.resueltas[0]).toMatchObject({ estado: 'Resuelta sola', fechaCierre: HOY });
  });
});

describe('regla 2: un hallazgo de PM entra al backlog, sin duplicarse', () => {
  const pm = (extra) => ({ _id: 'p1', equipo: 'CN-1', tipoPM: 'PM2', nReg: 7, fechaEntrada: '2026-10-28', horomReal: 5120, pmCompleto: false, queFalto: 'No se cambió el filtro de aire', ...extra });
  it('un PM incompleto con lo que faltó crea una tarea de backlog', () => {
    const b = backlogDePMSinDuplicar(pm(), []);
    expect(b).toMatchObject({ sigla: 'CN-1', fecha: '2026-10-28', horomBacklog: 5120, tarea: 'No se cambió el filtro de aire', fechaCierre: null });
    expect(b.observacion).toMatch(/PM2/);
  });
  it('al volver a guardar el mismo PM no se duplica; completo, sin dato o sin «qué faltó» no crean nada', () => {
    const b = backlogDePMSinDuplicar(pm(), []);
    expect(backlogDePMSinDuplicar(pm(), [b])).toBeNull();
    expect(backlogDePMSinDuplicar(pm({ queFalto: 'Otra cosa' }), [b])).not.toBeNull();
    expect(backlogDePMSinDuplicar(pm({ pmCompleto: true }), [])).toBeNull();
    expect(backlogDePMSinDuplicar(pm({ pmCompleto: null }), [])).toBeNull();
    expect(backlogDePMSinDuplicar(pm({ queFalto: '  ' }), [])).toBeNull();
    expect(backlogDePMSinDuplicar(null, [])).toBeNull();
  });
});

describe('regla 3: una falla repetida exige acción con fecha', () => {
  const c = (extra) => ({ _id: 'o' + Math.random(), sigla: 'CN-1', tipo: 'Correctivo', estadoOT: 'Cerrada', fechaEntrada: '2026-10-20', sintoma: 'Fuga de aceite', componente: 'Motor', ...extra });
  const actual = c({ _id: 'actual', fechaEntrada: '2026-10-28' });
  it('mismo equipo y componente en los 90 días anteriores es repetida', () => {
    const r = otFallaRepetida(actual, [c({ fechaEntrada: '2026-09-10' }), actual], 90);
    expect(r.repetida).toBe(true);
    expect(r.previas).toHaveLength(1);
    expect(r.componente).toBe('Motor');
  });
  it('no es repetida si es otro equipo, otro componente, más de 90 días atrás o posterior', () => {
    expect(otFallaRepetida(actual, [c({ sigla: 'CN-2' })]).repetida).toBe(false);
    expect(otFallaRepetida(actual, [c({ componente: 'Frenos', sintoma: 'Frenos sin presión' })]).repetida).toBe(false);
    expect(otFallaRepetida(actual, [c({ fechaEntrada: '2026-06-01' })]).repetida).toBe(false);
    expect(otFallaRepetida(actual, [c({ fechaEntrada: '2026-10-29' })]).repetida).toBe(false);
    expect(otFallaRepetida(actual, [c({ tipo: 'Preventivo' })]).repetida).toBe(false);
  });
  it('sin componente anotado usa el que sale del síntoma', () => {
    const a = c({ _id: 'a2', componente: '', sintoma: 'Falla del turbo, pérdida de potencia', fechaEntrada: '2026-10-28' });
    const r = otFallaRepetida(a, [c({ componente: '', sintoma: 'Turbo con humo', fechaEntrada: '2026-10-01' })]);
    expect(r.componente).not.toBe('');
    expect(r.repetida).toBe(true);
  });
  it('para cerrar pide causa raíz, acción, responsable y fecha', () => {
    expect(otFallaRepetidaFaltantes({ causaRaiz: '' }, {})).toEqual(['causa raíz', 'acción', 'responsable', 'fecha']);
    expect(otFallaRepetidaFaltantes({ causaRaiz: 'desgaste' }, { texto: 'Cambiar sello', responsable: 'Carlos Trigo', fechaLimite: '2026-11-05' })).toEqual([]);
    expect(otFallaRepetidaFaltantes({ causaRaiz: '' }, { causaRaiz: 'mala lubricación', texto: 'x', responsable: 'y', fechaLimite: '2026/11/05' })).toEqual(['fecha']);
  });
  it('la tarea de falla repetida lleva la acción, el responsable, la fecha y una clave única por OT', () => {
    const rep = otFallaRepetida(actual, [c({ fechaEntrada: '2026-09-10' })]);
    const t = tareaDeFallaRepetida(actual, rep, { texto: 'Cambiar el sello del cárter', responsable: 'Carlos Trigo', fechaLimite: '2026-11-05', causaRaiz: 'sello vencido' }, HOY);
    expect(t).toMatchObject({ clave: 'repetida|actual', origen: 'falla_repetida', sigla: 'CN-1', responsable: 'Carlos Trigo', fechaLimite: '2026-11-05', estado: 'Abierta' });
    expect(t.titulo).toMatch(/Falla repetida de Motor en CN-1: Cambiar el sello/);
    expect(t.detalle).toMatch(/1 anterior\(es\) en 90 días/);
  });
});
