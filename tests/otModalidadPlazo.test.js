// Modalidad y plazo comprometido de la reparación (PRO-MAN-002): estado del plazo de cada OT, informe mensual de cumplimiento y aviso de garantía por horómetro.
import { describe, it, expect } from 'vitest';
import { OT_MODALIDADES, otEquipoEnGarantia, otFechaTermino, otEstadoPlazo, cumplimientoPlazosReparacion } from '../logic.js';

const HOY = '2026-10-30';

describe('otFechaTermino', () => {
  it('cerrada: la fecha de salida manda; sin ella, la fecha de cierre', () => {
    expect(otFechaTermino({ estadoOT: 'Cerrada', fechaSalida: '2026-10-05', fechaCierre: '2026-10-09' })).toBe('2026-10-05');
    expect(otFechaTermino({ estadoOT: 'Cerrada', fechaCierre: '2026-10-09' })).toBe('2026-10-09');
    expect(otFechaTermino({ fechaSalida: '2026-10-05' })).toBe('2026-10-05');   // sin estadoOT = cerrada (dato antiguo)
  });
  it('abierta o sin ninguna fecha: null', () => {
    expect(otFechaTermino({ estadoOT: 'Pendiente', fechaSalida: '2026-10-05' })).toBeNull();
    expect(otFechaTermino({ estadoOT: 'Cerrada' })).toBeNull();
  });
});

describe('otEstadoPlazo', () => {
  it('sin plazo: null', () => {
    expect(otEstadoPlazo({ estadoOT: 'Cerrada' }, HOY)).toBeNull();
    expect(otEstadoPlazo({ plazoComprometido: 'mañana' }, HOY)).toBeNull();
  });
  it('cerrada el mismo día del plazo cuenta como cumplida', () => {
    expect(otEstadoPlazo({ estadoOT: 'Cerrada', plazoComprometido: '2026-10-10', fechaSalida: '2026-10-10' }, HOY).estado).toBe('cumplida');
  });
  it('cerrada después del plazo: atrasada con sus días', () => {
    const r = otEstadoPlazo({ estadoOT: 'Cerrada', plazoComprometido: '2026-10-10', fechaSalida: '2026-10-13' }, HOY);
    expect(r).toMatchObject({ estado: 'atrasada', diasAtraso: 3, termino: '2026-10-13' });
  });
  it('abierta: vencida si ya pasó el plazo, en plazo si no', () => {
    expect(otEstadoPlazo({ estadoOT: 'En Ejecución', plazoComprometido: '2026-10-25' }, HOY)).toMatchObject({ estado: 'vencida', diasAtraso: 5 });
    expect(otEstadoPlazo({ estadoOT: 'Pendiente', plazoComprometido: '2026-10-30' }, HOY).estado).toBe('en plazo');
  });
  it('cerrada sin fecha de salida ni de cierre: no se puede evaluar', () => {
    expect(otEstadoPlazo({ estadoOT: 'Cerrada', plazoComprometido: '2026-10-10' }, HOY).estado).toBe('sin término');
  });
});

describe('cumplimientoPlazosReparacion', () => {
  const ot = [
    { sigla: 'A', estadoOT: 'Cerrada', modalidadReparacion: 'Taller faena', fechaEntrada: '2026-10-01', plazoComprometido: '2026-10-05', fechaSalida: '2026-10-04' },
    { sigla: 'B', estadoOT: 'Cerrada', modalidadReparacion: 'Taller faena', fechaEntrada: '2026-10-02', plazoComprometido: '2026-10-06', fechaCierre: '2026-10-10' },
    { sigla: 'C', estadoOT: 'Pendiente', modalidadReparacion: 'Garantía', fechaEntrada: '2026-10-03', plazoComprometido: '2026-10-20' },
    { sigla: 'D', estadoOT: 'En Ejecución', modalidadReparacion: 'Garantía', fechaEntrada: '2026-10-20', plazoComprometido: '2026-10-31' },
    { sigla: 'E', estadoOT: 'Cerrada', fechaEntrada: '2026-10-07', plazoComprometido: '2026-10-08' },
    { sigla: 'F', estadoOT: 'Cerrada', fechaEntrada: '2026-10-08' },                                                          // sin plazo
    { sigla: 'G', estadoOT: 'Cerrada', fechaEntrada: '2026-09-01', plazoComprometido: '2026-09-05', fechaSalida: '2026-09-09' }, // vence otro mes
    { sigla: 'H', fromReg: true, plazoComprometido: '2026-10-05' },                                                            // viene de Registro PM
  ];
  const r = cumplimientoPlazosReparacion(ot, '2026-10-01', '2026-10-31', HOY);

  it('% = a tiempo ÷ (a tiempo + atrasadas + vencidas); en plazo y sin término no entran', () => {
    expect(r.cumplidas).toBe(1);
    expect(r.atrasadas).toBe(1);
    expect(r.vencidas).toBe(1);
    expect(r.enPlazo).toBe(1);
    expect(r.sinTermino).toBe(1);
    expect(r.evaluables).toBe(3);
    expect(r.pct).toBe(33);
    expect(r.diasAtrasoProm).toBe(7);   // B: 4 días; C: 10 días
  });
  it('cuenta las OT del mes sin plazo, ignora otros meses y las filas de Registro PM', () => {
    expect(r.sinPlazo).toBe(1);
    expect(r.incumplidas.map((x) => x.sigla)).toEqual(['C', 'B']);   // de más a menos atraso
  });
  it('desglose por modalidad', () => {
    const taller = r.porModalidad.find((x) => x.modalidad === 'Taller faena');
    const garantia = r.porModalidad.find((x) => x.modalidad === 'Garantía');
    expect(taller).toMatchObject({ evaluables: 2, cumplidas: 1, pct: 50 });
    expect(garantia).toMatchObject({ evaluables: 1, cumplidas: 0, pct: 0 });
  });
  it('sin OT con plazo: % vacío, no 0', () => {
    expect(cumplimientoPlazosReparacion([], '2026-10-01', '2026-10-31', HOY).pct).toBeNull();
  });
});

describe('otEquipoEnGarantia (garantía en horas de horómetro)', () => {
  it('avisa mientras el horómetro no llegue a las horas de garantía', () => {
    expect(otEquipoEnGarantia({ horom: 1200 }, { garantiaHasta: 2000 })).toEqual({ hastaH: 2000, horom: 1200, restantesH: 800 });
  });
  it('sin horómetro en la OT usa el actual del equipo', () => {
    expect(otEquipoEnGarantia({}, { garantiaHasta: 2000, horomActual: 1500 }).restantesH).toBe(500);
  });
  it('garantía superada, sin cargar o sin horómetro: null', () => {
    expect(otEquipoEnGarantia({ horom: 2500 }, { garantiaHasta: 2000 })).toBeNull();
    expect(otEquipoEnGarantia({ horom: 100 }, { garantiaHasta: 0 })).toBeNull();
    expect(otEquipoEnGarantia({}, { garantiaHasta: 2000 })).toBeNull();
  });
  it('las modalidades son las cinco del procedimiento', () => {
    expect(OT_MODALIDADES).toEqual(['Taller faena', 'Terreno', 'Tercero por contrato', 'Tercero por cotización', 'Garantía']);
  });
});
