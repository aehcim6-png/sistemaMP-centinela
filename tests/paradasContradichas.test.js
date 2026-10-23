// Paradas largas que el horómetro contradice (24-oct-2026): un equipo detenido no suma horas. Casos reales de la base: MN-5926 (OT de ampolletas con 696 h mientras el horómetro avanzaba).
import { describe, it, expect } from 'vitest';
import { paradasContradichasPorHorometro, mtbfFlotaAgrupado, MTBF_OT_MIN_MES } from '../logic.js';

const ot = (o) => Object.assign({ tipo: 'Correctivo', estadoOT: 'Cerrada', criticidad: 'Alta' }, o);
const lect = (sigla, texto) => texto.split(',').map((t, i) => { const [f, v] = t.split(':'); return { _id: sigla + i, sigla, fecha: `2025-${f.slice(0, 2)}-${f.slice(2)}`, horomFin: Number(v), horom: Number(v) }; });
const EQ = [{ sigla: 'MN-5926', hrsDia: 11 }, { sigla: 'ZZ-1', hrsDia: 12 }];

describe('paradasContradichasPorHorometro', () => {
  const ampolletas = ot({ sigla: 'MN-5926', fecha: '2025-11-12', fechaEntrada: '2025-11-12', fechaSalida: '2025-12-12', duracion: '696h 55min', horom: 8744, sintoma: 'ampolleta foco frontal' });
  // horómetro anotado en otras OT del mismo equipo dentro de la parada (así se midió en la base real)
  const otras = [
    ot({ sigla: 'MN-5926', fecha: '2025-11-13', fechaEntrada: '2025-11-13', fechaSalida: '2025-11-13', duracion: '8h 00min', horom: 8764 }),
    ot({ sigla: 'MN-5926', fecha: '2025-11-23', fechaEntrada: '2025-11-23', fechaSalida: '2025-11-23', duracion: '0h 55min', horom: 8880 }),
    ot({ sigla: 'MN-5926', fecha: '2025-12-03', fechaEntrada: '2025-12-03', fechaSalida: '2025-12-03', duracion: '2h 00min', horom: 8947 }),
  ];
  it('una parada de 696 h durante la cual el horómetro avanzó 183 h se marca como error de digitación probable', () => {
    const r = paradasContradichasPorHorometro([ampolletas, ...otras], [], EQ, '2026-10-23');
    expect(r.length).toBe(1);
    expect(r[0].sigla).toBe('MN-5926');
    expect(r[0].abierta).toBe(false);
    expect(r[0].avance).toBe(183);
    expect(r[0].pctUso).toBeGreaterThan(40);
    expect(r[0].motivo).toMatch(/error de digitación/);
  });
  it('también usa las lecturas del historial de horómetros', () => {
    const hist = lect('MN-5926', '1115:8776,1125:8890,1205:8960');
    const r = paradasContradichasPorHorometro([ampolletas], hist, EQ, '2026-10-23');
    expect(r.length).toBe(1);
    expect(r[0].avance).toBe(184);
  });
  it('una parada real (horómetro quieto) no se marca', () => {
    const real = ot({ sigla: 'MN-5926', fecha: '2025-12-03', fechaEntrada: '2025-12-03', fechaSalida: '2025-12-16', duracion: '311h 34min', horom: 8967 });
    const hist = lect('MN-5926', '1205:8967,1210:8967,1214:8967');
    expect(paradasContradichasPorHorometro([real], hist, EQ, '2026-10-23')).toEqual([]);
  });
  it('sin al menos dos lecturas dentro de la parada no hay evidencia: no se marca', () => {
    const hist = lect('MN-5926', '1125:8890');
    expect(paradasContradichasPorHorometro([ampolletas], hist, EQ, '2026-10-23')).toEqual([]);
  });
  it('las paradas de menos de 24 h no se revisan', () => {
    const corta = ot({ sigla: 'MN-5926', fecha: '2025-11-12', fechaEntrada: '2025-11-12', fechaSalida: '2025-11-12', duracion: '3h 00min' });
    expect(paradasContradichasPorHorometro([corta, ...otras], lect('MN-5926', '1115:8776,1125:8890'), EQ, '2026-10-23')).toEqual([]);
  });
  it('una salida de servicio abierta cuyo horómetro sigue avanzando se marca: el equipo parece haber vuelto', () => {
    const abierta = ot({ sigla: 'ZZ-1', tipo: 'Fuera de Servicio', estatusEq: 'Fuera de Servicio', estadoOT: 'Pendiente', fecha: '2025-12-04', fechaEntrada: '2025-12-04', fechaSalida: null, criticidad: 'Reparación Inmediata' });
    const hist = lect('ZZ-1', '1210:100,1215:112').concat([{ _id: 'x', sigla: 'ZZ-1', fecha: '2026-08-10', horomFin: 150, horom: 150 }, { _id: 'y', sigla: 'ZZ-1', fecha: '2026-08-12', horomFin: 175, horom: 175 }]);
    const r = paradasContradichasPorHorometro([abierta], hist, EQ, '2026-10-23');
    expect(r.length).toBe(1);
    expect(r[0].abierta).toBe(true);
    expect(r[0].fechaSalida).toBeNull();
    expect(r[0].primeraLectura).toBe('2025-12-10');
    expect(r[0].primerMovimiento).toBe('2025-12-15');   // 100 → 112: primer día en que el horómetro se movió
    expect(r[0].motivo).toMatch(/sigue abierta/);
  });
  it('una salida de servicio abierta con el horómetro quieto no se marca', () => {
    const abierta = ot({ sigla: 'ZZ-1', tipo: 'Fuera de Servicio', estatusEq: 'Fuera de Servicio', estadoOT: 'Pendiente', fecha: '2025-12-04', fechaEntrada: '2025-12-04', fechaSalida: null, criticidad: 'Reparación Inmediata' });
    expect(paradasContradichasPorHorometro([abierta], lect('ZZ-1', '1210:100,1215:100,1220:100'), EQ, '2026-10-23')).toEqual([]);
  });
  it('entradas vacías no fallan', () => {
    expect(paradasContradichasPorHorometro(null, null, null)).toEqual([]);
  });
});

describe('mtbfFlotaAgrupado avisa cuántas paradas del cálculo son dudosas', () => {
  it('cuenta la parada que el horómetro contradice, sin descartarla sola', () => {
    const relleno = Array.from({ length: MTBF_OT_MIN_MES }, (_, i) => ot({ sigla: 'ZZ-1', tipo: 'Engrase General', fecha: `2025-11-${String(i + 1).padStart(2, '0')}` }))
      .concat(Array.from({ length: MTBF_OT_MIN_MES }, (_, i) => ot({ sigla: 'ZZ-1', tipo: 'Engrase General', fecha: `2025-12-${String(i + 1).padStart(2, '0')}` })));
    const dias = Array.from({ length: 60 }, (_, d) => { const f = new Date(Date.UTC(2025, 10, 1) + d * 864e5).toISOString().slice(0, 10); return { _id: 'h' + d, sigla: 'ZZ-1', fecha: f, horomFin: 1000 + d * 10, horom: 1000 + d * 10 }; });
    const dudosa = ot({ sigla: 'ZZ-1', fecha: '2025-11-12', fechaEntrada: '2025-11-12', fechaSalida: '2025-12-12', duracion: '696h 00min', horom: 1110 });
    const r = mtbfFlotaAgrupado([{ sigla: 'ZZ-1', hrsDia: 12 }], relleno.concat([dudosa]), dias, { hoy: '2026-10-23' });
    expect(r.paradas).toBe(1);
    expect(r.paradasDudosas).toBe(1);
  });
});
