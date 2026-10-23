// Definición de «falla» para MTBF y MTTR: parada de 24 h o más (2026-10-23, decisión del usuario).
import { describe, it, expect } from 'vitest';
import { PARADA_LARGA_H, horasParadaOT, esParadaLarga, resumenParadas, mttrParadasLargas, mtbfFlotaReal, contarParadasLargasMes } from '../logic.js';

const corr = (sigla, horom, duracion, extra) => Object.assign({ sigla, tipo: 'Correctivo', horom, duracion, fecha: '2026-06-01' }, extra);

describe('horasParadaOT', () => {
  it('lee el campo duracion («72h 15min») con minutos', () => {
    expect(horasParadaOT(corr('A', 1, '72h 15min'))).toBe(72.25);
    expect(horasParadaOT(corr('A', 1, '0h 30min'))).toBe(0.5);
    expect(horasParadaOT(corr('A', 1, '5h'))).toBe(5);
  });
  it('sin duracion, calcula con fechas y horas de entrada y salida', () => {
    const o = { sigla: 'A', tipo: 'Correctivo', duracion: '—', fechaEntrada: '2026-06-01', horaEntrada: '08:00', fechaSalida: '2026-06-03', horaSalida: '10:30' };
    expect(horasParadaOT(o)).toBe(50.5);
  });
  it('salida de servicio abierta: horas desde la entrada hasta hoy', () => {
    const o = { sigla: 'A', tipo: 'Fuera de Servicio', criticidad: 'Reparación Inmediata', estatusEq: 'Fuera de Servicio', fechaEntrada: '2026-06-01', horaEntrada: '00:00' };
    expect(horasParadaOT(o, '2026-06-03')).toBeCloseTo(72, 0);   // hasta el final del día de hoy
  });
  it('no inventa: sin duración ni fechas con hora es null', () => {
    expect(horasParadaOT(corr('A', 1, '—'))).toBeNull();
    expect(horasParadaOT({ sigla: 'A', tipo: 'Correctivo', fechaEntrada: '2026-06-01', fechaSalida: '2026-06-02' })).toBeNull();
    expect(horasParadaOT(null)).toBeNull();
  });
});

describe('esParadaLarga', () => {
  it('el umbral es de 24 h, inclusive', () => {
    expect(PARADA_LARGA_H).toBe(24);
    expect(esParadaLarga(corr('A', 1, '23h 59min'))).toBe(false);
    expect(esParadaLarga(corr('A', 1, '24h'))).toBe(true);
    expect(esParadaLarga(corr('A', 1, '100h'))).toBe(true);
  });
  it('solo cuentan las que ya eran falla (no un PM ni un engrase largo)', () => {
    expect(esParadaLarga(corr('A', 1, '48h', { tipo: 'Engrase General' }))).toBe(false);
    expect(esParadaLarga(corr('A', 1, '48h', { tipo: 'Falla Operacional' }))).toBe(true);
  });
  it('sin duración conocida no cuenta', () => {
    expect(esParadaLarga(corr('A', 1, '—'))).toBe(false);
  });
  it('el umbral se puede cambiar por parámetro', () => {
    expect(esParadaLarga(corr('A', 1, '10h'), undefined, 8)).toBe(true);
  });
});

describe('resumenParadas y mttrParadasLargas', () => {
  const ot = [corr('A', 1, '1h'), corr('A', 2, '2h'), corr('A', 3, '30h'), corr('A', 4, '90h'), corr('A', 5, '—'), corr('A', 6, '5h', { tipo: 'Ajustes' })];
  it('cuenta intervenciones, paradas largas, sin duración y qué parte de las horas concentran', () => {
    const r = resumenParadas(ot);
    expect(r.intervenciones).toBe(5);       // 'Ajustes' no es falla
    expect(r.paradasLargas).toBe(2);
    expect(r.sinDuracion).toBe(1);
    expect(r.horasTotal).toBe(123);
    expect(r.horasParadasLargas).toBe(120);
    expect(r.pctHoras).toBe(98);
  });
  it('MTTR de paradas largas: promedio, mediana y p90', () => {
    expect(mttrParadasLargas(ot)).toEqual({ n: 2, promedio: 60, mediana: 30, p90: 90 });
    expect(mttrParadasLargas([corr('A', 1, '2h')])).toBeNull();
  });
});

describe('mtbfFlotaReal con el criterio por defecto (paradas largas)', () => {
  const eq = [{ sigla: 'A' }, { sigla: 'B' }];
  const ot = [
    // A: tres paradas largas a las 1000, 1600 y 2200 h → MTBF 600; entre medio muchas intervenciones menores
    corr('A', 1000, '40h'), corr('A', 1100, '1h'), corr('A', 1200, '2h'), corr('A', 1300, '1h'), corr('A', 1600, '30h'), corr('A', 1900, '1h'), corr('A', 2200, '72h'),
    // B: una sola parada larga → no aporta (no hay intervalo)
    corr('B', 500, '30h'), corr('B', 600, '1h'), corr('B', 700, '1h'),
  ];
  it('mide entre paradas largas, no entre cualquier correctivo', () => {
    expect(mtbfFlotaReal(eq, ot)).toBe(600);
  });
  it('con criterio «intervenciones» da el número de antes (mucho más bajo)', () => {
    const v = mtbfFlotaReal(eq, ot, { criterio: 'intervenciones' });
    expect(v).toBeLessThan(600);
  });
  it('un correctivo sin duración no se usa para el MTBF', () => {
    expect(mtbfFlotaReal([{ sigla: 'A' }], [corr('A', 1000, '—'), corr('A', 2000, '—')])).toBeNull();
  });
});

describe('contarParadasLargasMes', () => {
  it('cuenta solo las paradas largas del mes pedido', () => {
    const ot = [corr('A', 1, '30h', { fecha: '2026-06-10' }), corr('A', 2, '2h', { fecha: '2026-06-11' }), corr('A', 3, '50h', { fecha: '2026-07-01' })];
    expect(contarParadasLargasMes(ot, '2026-06')).toBe(1);
    expect(contarParadasLargasMes(ot, '2026-07')).toBe(1);
    expect(contarParadasLargasMes(ot, '2026-08')).toBe(0);
    expect(contarParadasLargasMes(ot)).toBe(2);
  });
});
