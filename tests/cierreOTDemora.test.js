// Cierre de OT con motivo de demora y tipo de reparación, y dotación leída de la programación diaria (27-oct-2026).
import { describe, it, expect } from 'vitest';
import { OT_MOTIVOS_DEMORA, OT_MOTIVO_SIN_INFORMAR, otMotivoGrupo, otMotivoRequerido, otCierreFaltantes, otBacklogDeProvisoria, cargoEspecialidad, dotacionProgramada } from '../logic.js';

const HOY = '2026-10-27';
const base = { sigla: 'CN-9502', tipo: 'Correctivo', sintoma: 'Fuga de aceite en cilindro de levante', componente: 'Hidráulico', causaRaiz: 'Sello gastado', costo: 100000, horom: 12345, sistema: 'Hidráulico' };

describe('motivos de demora', () => {
  it('cada motivo tiene su grupo y «Sin informar» el suyo; uno desconocido no tiene', () => {
    expect(otMotivoGrupo('Compra o aprobación interna lenta')).toBe('repuesto_compra');
    expect(otMotivoGrupo('Proveedor sin stock o con demora')).toBe('repuesto_proveedor');
    expect(otMotivoGrupo('Repuesto sin stock en bodega (no se anticipó)')).toBe('repuesto_propio');
    expect(otMotivoGrupo(OT_MOTIVO_SIN_INFORMAR)).toBe('sin_informar');
    expect(otMotivoGrupo('inventado')).toBeNull();
    expect(new Set(OT_MOTIVOS_DEMORA.map(m => m.id)).size).toBe(OT_MOTIVOS_DEMORA.length);
  });
  it('el motivo se exige con 8 horas o más, o si no se sabe cuánto duró; con menos no', () => {
    expect(otMotivoRequerido({ ...base, duracion: '3h' }, HOY)).toBe(false);
    expect(otMotivoRequerido({ ...base, duracion: '8h' }, HOY)).toBe(true);
    expect(otMotivoRequerido({ ...base, duracion: '30h 15min' }, HOY)).toBe(true);
    expect(otMotivoRequerido({ ...base }, HOY)).toBe(true);
  });
});

describe('otCierreFaltantes', () => {
  it('pide la reparación siempre y el motivo solo cuando corresponde', () => {
    expect(otCierreFaltantes({ ...base, duracion: '3h' }, HOY)).toEqual(['reparacion']);
    expect(otCierreFaltantes({ ...base, duracion: '20h' }, HOY)).toEqual(['motivoDemora', 'reparacion']);
    expect(otCierreFaltantes({ ...base, duracion: '20h', motivoDemora: 'Diagnóstico difícil', reparacion: 'Definitiva' }, HOY)).toEqual([]);
  });
  it('«Sin informar» cuenta como registrado: es una laguna anotada, no un descuido', () => {
    expect(otCierreFaltantes({ ...base, duracion: '20h', motivoDemora: OT_MOTIVO_SIN_INFORMAR, reparacion: 'Sin informar' }, HOY)).toEqual([]);
  });
  it('mantiene lo de antes: componente, causa raíz y costo', () => {
    expect(otCierreFaltantes({ sigla: 'A', duracion: '2h' }, HOY)).toEqual(['componente', 'causaRaiz', 'costo', 'reparacion']);
  });
});

describe('otBacklogDeProvisoria', () => {
  const ot = { ...base, _id: 'ot1', fechaEntrada: '2026-10-20', reparacion: 'Provisoria', motivoDemora: 'Compra o aprobación interna lenta' };
  it('una reparación provisoria crea la tarea pendiente con el equipo, el síntoma y si falta un insumo', () => {
    const b = otBacklogDeProvisoria(ot, HOY, []);
    expect(b).toMatchObject({ sigla: 'CN-9502', fecha: HOY, horomBacklog: 12345, conInsumo: true, fechaCierre: null, sistema: 'Hidráulico' });
    expect(b.tarea).toBe('Reparación definitiva pendiente: Fuga de aceite en cilindro de levante');
    expect(b.observacion).toContain('OT ot1');
  });
  it('si el motivo no es de repuesto, la tarea no queda marcada como con insumo', () => {
    expect(otBacklogDeProvisoria({ ...ot, motivoDemora: 'Diagnóstico difícil' }, HOY, []).conInsumo).toBe(false);
  });
  it('no duplica: si ya hay una tarea de esa OT, devuelve null', () => {
    const b = otBacklogDeProvisoria(ot, HOY, []);
    expect(otBacklogDeProvisoria(ot, HOY, [b])).toBeNull();
  });
  it('una reparación definitiva, o sin informar, no crea nada', () => {
    expect(otBacklogDeProvisoria({ ...ot, reparacion: 'Definitiva' }, HOY, [])).toBeNull();
    expect(otBacklogDeProvisoria({ ...ot, reparacion: 'Sin informar' }, HOY, [])).toBeNull();
  });
  it('sin _id usa equipo, fecha y síntoma como clave y también evita duplicar', () => {
    const sinId = { ...ot, _id: undefined };
    const b = otBacklogDeProvisoria(sinId, HOY, []);
    expect(b.observacion).toContain('CN-9502|2026-10-20');
    expect(otBacklogDeProvisoria(sinId, HOY, [b])).toBeNull();
  });
});

describe('cargoEspecialidad', () => {
  it('lleva las distintas formas de escribir un cargo a su especialidad', () => {
    expect(cargoEspecialidad('Mecánico Lider')).toBe('Mecánico líder');
    expect(cargoEspecialidad('Mecánico lider')).toBe('Mecánico líder');
    expect(cargoEspecialidad('Mecanico')).toBe('Mecánico');
    expect(cargoEspecialidad('Mecánico')).toBe('Mecánico');
    expect(cargoEspecialidad('Eelctro Mecanico')).toBe('Electromecánico');
    expect(cargoEspecialidad('Electromecánico')).toBe('Electromecánico');
    expect(cargoEspecialidad('Op. Pluma')).toBe('Operador de pluma');
    expect(cargoEspecialidad('Soldador')).toBe('Soldador');
    expect(cargoEspecialidad('Vulcanizador')).toBe('Vulcanizador');
    expect(cargoEspecialidad('Jefe de taller')).toBe('Otro');
    expect(cargoEspecialidad('')).toBe('Otro');
  });
});

describe('dotacionProgramada', () => {
  const p = (fecha, turno, nombre, cargo) => ({ fecha, turno, nombre, cargo });
  const prog = [p('2026-07-14', 'Día', 'A', 'Mecánico'), p('2026-07-14', 'Día', 'B', 'Mecánico Lider'), p('2026-07-14', 'Día', 'C', 'Electromecánico'), p('2026-07-14', 'Día', 'D', 'Soldador'), p('2026-07-14', 'Día', 'A', 'Mecánico'),
    p('2026-07-14', 'Noche', 'E', 'Mecánico'), p('2026-07-14', 'Noche', 'F', 'Mecánico lider'),
    p('2026-07-17', 'Día', 'A', 'Mecanico'), p('2026-07-17', 'Día', 'G', 'Eelctro Mecanico'), p('2026-07-17', 'Día', 'H', 'Supervisor general')];
  const d = dotacionProgramada(prog);
  it('cuenta personas distintas por día y turno, con sus mecánicos totales (con y sin líder)', () => {
    const dia14 = d.dias.find(x => x.fecha === '2026-07-14' && x.turno === 'Día');
    expect(dia14).toMatchObject({ total: 4, mecanicosTotal: 2 });
    expect(dia14.porEspecialidad).toMatchObject({ 'Mecánico': 1, 'Mecánico líder': 1, 'Electromecánico': 1, Soldador: 1 });
    expect(d.dias.find(x => x.turno === 'Noche')).toMatchObject({ total: 2, mecanicosTotal: 2 });
    expect(d.nDias).toBe(2);
  });
  it('promedios por turno y los cargos que no pudo clasificar', () => {
    const dia = d.promedios.find(x => x.turno === 'Día');
    expect(dia.dias).toBe(2);
    expect(dia.promedioMecanicos).toBe(1.5);                 // 2 el 14 y 1 el 17
    expect(dia.promedioPorEspecialidad.Electromecánico).toBe(1);
    expect(d.cargosSinClasificar).toEqual(['Supervisor general']);
  });
  it('sin datos no inventa nada', () => {
    expect(dotacionProgramada([])).toEqual({ dias: [], promedios: [], nDias: 0, cargosSinClasificar: [] });
  });
});
