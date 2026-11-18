import { describe, it, expect } from 'vitest';
import { esFallaMTBF, claseOTVigente, _otHistComoOt, _informesFallaComoOt } from '../logic.js';

// Las OT vigentes «Correctivo» traían rutinas, cambios planificados de desgaste, instalaciones y eventos de operación (solo 65 % de 1.160 eran fallas
// con el criterio de texto del histórico). esFallaMTBF ahora aplica ese mismo criterio a sintoma + solucion. Los textos de abajo son órdenes reales.
const ot = (sintoma, solucion, extra) => Object.assign({ sigla: 'CN-1', tipo: 'Correctivo', fecha: '2026-05-10', sintoma, solucion }, extra || {});

describe('esFallaMTBF: una OT «Correctivo» vigente cuenta solo si es una falla', () => {
  it('fallas reales: fuga, falla eléctrica, suspensión reventada, sin partida', () => {
    expect(esFallaMTBF(ot('Fuga aceite bomba freno'))).toBe(true);
    expect(esFallaMTBF(ot('falla en baterías / flexible hidráulico cilindro inclinación balde'))).toBe(true);
    expect(esFallaMTBF(ot('suspensión posición 3 reventada.'))).toBe(true);
    expect(esFallaMTBF(ot('sin partida'))).toBe(true);
    expect(esFallaMTBF(ot('Sin motivo informado en las fuentes (parada detectada en disponibilidad u horómetros)'))).toBe(true);
  });
  it('rutinas preventivas registradas como correctivo no cuentan (chequeo, retorque, adblue, mantención semanal, presurizado)', () => {
    [['Mantención', 'Chequeo preventivo y engrase general'], ['Control de neumáticos', 'Retorque preventivo posiciones traseras (4)'],
      ['se rellena adblue y se cambia pertiga'], ['se realiza mantencion semanal'], ['presurizado / retorque'],
      ['REVISION DE DISPOSITIVOS INGENIERILES / RE TORQUE DE NEUMATICOS']].forEach(([a, b]) => {
      expect(claseOTVigente(ot(a, b))).toBe('preventiva');
      expect(esFallaMTBF(ot(a, b))).toBe(false);
    });
  });
  it('LÍMITE CONOCIDO: el criterio es por palabras y todavía deja pasar como falla «mantenimiento diario», «Cierre de Backlog» y «Relleno nivel aceite»', () => {
    // Si algún día se amplía el catálogo de rutinas (y su copia en public.clasificar_ot), estas tres deberían pasar a no contar y este test se actualiza.
    expect(esFallaMTBF(ot('mantenimiento diario'))).toBe(true);
    expect(esFallaMTBF(ot('Cierre de Backlog'))).toBe(true);
    expect(esFallaMTBF(ot('Relleno nivel aceite hidraulico'))).toBe(true);
  });
  it('cambio planificado de desgaste: no cuenta (cuchillas, entrecalzas)', () => {
    expect(claseOTVigente(ot('se realiza mantencion diaria y cambio de cuchillas'))).toBe('desgaste');
    expect(esFallaMTBF(ot('se realiza mantencion diaria y cambio de cuchillas'))).toBe(false);
    expect(esFallaMTBF(ot('se cambia una entrecalzas'))).toBe(false);
  });
  it('evento de operación (empantanado): no cuenta', () => {
    expect(claseOTVigente(ot('equipo empantanado'))).toBe('operacional');
    expect(esFallaMTBF(ot('equipo empantanado'))).toBe(false);
  });
  it('una palabra de falla fuerte salva la fila aunque tenga texto de rutina', () => {
    expect(esFallaMTBF(ot('presurizado de neumáticos', 'se encuentra fuga en válvula'))).toBe(true);
  });
  it('mira también la solución: un síntoma de rutina con solución de falla sigue siendo falla', () => {
    expect(esFallaMTBF(ot('se realiza mantencion semanal', 'cambio de bomba por falla'))).toBe(true);
  });
  it('sin texto cuenta como falla (no se descarta nada sin evidencia)', () => {
    expect(esFallaMTBF({ tipo: 'Correctivo' })).toBe(true);
    expect(esFallaMTBF({ tipo: 'Correctivo', sintoma: '', solucion: null })).toBe(true);
    expect(claseOTVigente(null)).toBe('correctiva');
  });
  it('una OT que ya trae claseOT se respeta, sin reclasificar el texto', () => {
    expect(esFallaMTBF(ot('equipo empantanado', null, { claseOT: 'correctiva' }))).toBe(true);
    expect(esFallaMTBF(ot('Fuga aceite bomba freno', null, { claseOT: 'preventiva' }))).toBe(false);
  });
  it('los otros tipos no cambian: Falla Operacional cuenta; Fuera de Servicio solo con Reparación Inmediata', () => {
    expect(esFallaMTBF({ tipo: 'Falla Operacional', sintoma: 'se realiza mantencion semanal' })).toBe(true);
    expect(esFallaMTBF({ tipo: 'Fuera de Servicio', criticidad: 'Reparación Inmediata' })).toBe(true);
    expect(esFallaMTBF({ tipo: 'Fuera de Servicio', criticidad: 'Baja' })).toBe(false);
    expect(esFallaMTBF({ tipo: 'Preventivo' })).toBe(false);
  });
  it('los adaptadores del histórico y de los informes de falla no se vuelven a filtrar por texto', () => {
    // El texto del histórico adaptado es solo el nombre del sistema; los informes de falla catastrófica son fallas por definición.
    const h = _otHistComoOt([{ sigla: 'A', fecha: '2026-01-01', horometro: 100, sistema: 'Eléctrico', claseOT: 'correctiva' }]);
    expect(h).toHaveLength(1);
    expect(esFallaMTBF(h[0])).toBe(true);
    const i = _informesFallaComoOt([{ sigla: 'A', tipoEvento: 'Falla Catastrófica', fecha: '2026-01-01', descripcion: 'equipo empantanado y mantencion semanal', componente: 'Motor' }]);
    expect(esFallaMTBF(i[0])).toBe(true);
  });
});
