import { describe, it, expect } from 'vitest';
import { getsPiezaDe, getsProyeccion, getsCalidad, getsCambioError, GETS_PIEZAS } from '../logic.js';

describe('elementos de desgaste (GETS)', () => {
  it('clasifica la pieza por el texto; si menciona varias, por la primera de la lista', () => {
    expect(getsPiezaDe('Cambio de cuchillas')).toBe('Cuchillas');
    expect(getsPiezaDe('Cuchillas de moto')).toBe('Cuchillas');
    expect(getsPiezaDe('Cambio de cuchillas y cantoneras')).toBe('Cuchillas');
    expect(getsPiezaDe('Punta')).toBe('Puntas');
    expect(getsPiezaDe('Cambio de puntas de ripper')).toBe('Puntas');
    expect(getsPiezaDe('Entrecalza')).toBe('Entredientes');
    expect(getsPiezaDe('Cambio de calzas ripper')).toBe('Calzas');
    expect(getsPiezaDe('Cambio de elementos de desgaste completo')).toBe('Elementos de desgaste (juego completo)');
    expect(getsPiezaDe('Rodados en uso')).toBe('Rodados');
    expect(getsPiezaDe('Gets Balde')).toBe('Balde');
    expect(getsPiezaDe('')).toBe('Otro');
    GETS_PIEZAS.forEach((p) => expect(typeof p).toBe('string'));
  });

  const mk = (fecha, horometro, extra = {}) => ({ sigla: 'MN-5926', descripcion: 'Cambio de cuchillas', fecha, horometro, ...extra });
  it('intervalo típico = mediana de los días entre cambios; el próximo = último + intervalo; estado según la fecha de hoy', () => {
    const c = [mk('2026-09-01', 1000), mk('2026-09-15', 1150), mk('2026-09-29', 1300), mk('2026-10-13', 1440)];
    const [r] = getsProyeccion(c, '2026-10-20');
    expect(r).toMatchObject({ sigla: 'MN-5926', pieza: 'Cuchillas', nCambios: 4, intervaloDias: 14, ultimoCambio: '2026-10-13', proximoCambio: '2026-10-27', diasParaProximo: 7, estado: 'Próximo' });
    expect(r.intervaloHoras).toBe(150);
    expect(getsProyeccion(c, '2026-10-30')[0].estado).toBe('Vencido');
    expect(getsProyeccion(c, '2026-10-14')[0].estado).toBe('Al día');
  });
  it('varias filas el mismo día son un solo cambio', () => {
    const c = [mk('2026-09-01'), mk('2026-09-01', null, { descripcion: 'Punta' }), mk('2026-09-15'), mk('2026-09-29')];
    const r = getsProyeccion(c, '2026-10-01');
    const cuch = r.find((x) => x.pieza === 'Cuchillas');
    expect(cuch.nCambios).toBe(3);
    expect(r.find((x) => x.pieza === 'Puntas').estado).toBe('Pocos datos');
  });
  it('un último cambio muy antiguo es «Sin registros recientes»: no afirma qué cambio toca', () => {
    const c = [mk('2024-04-01'), mk('2024-04-15'), mk('2024-05-01'), mk('2024-06-12')];
    const r = getsProyeccion(c, '2026-11-10')[0];
    expect(r.estado).toBe('Sin registros recientes');
    expect(r.proximoCambio).toBeNull();
    expect(r.intervaloDias).toBeGreaterThan(0);
  });
  it('con menos de 3 cambios no estima el próximo', () => {
    const r = getsProyeccion([mk('2026-10-01'), mk('2026-10-15')], '2026-10-20')[0];
    expect(r).toMatchObject({ estado: 'Pocos datos', proximoCambio: null, intervaloDias: 14 });
  });
  it('el horómetro dudoso no entra en las horas pero la fecha sí cuenta', () => {
    const c = [mk('2026-09-01', 1000), mk('2026-09-15', 900, { horometroDudoso: true }), mk('2026-09-29', 1300)];
    const r = getsProyeccion(c, '2026-10-01')[0];
    expect(r.intervaloDias).toBe(14);
    expect(r.intervaloHoras).toBeNull();  // los dos tramos tocan el cambio dudoso: no se mezclan dos vidas en un solo intervalo
    const r2 = getsProyeccion([...c, mk('2026-10-13', 1450)], '2026-10-14')[0];
    expect(r2.intervaloHoras).toBe(150);  // el tramo 1300 → 1450 sí es fiable
  });
  it('calidad del registro: último registro, faltantes y horómetros dudosos', () => {
    const q = getsCalidad([mk('2024-06-12', 100, { nParte: 'X', cantidad: 2, responsable: 'A' }), mk('2024-06-01', null, { horometroDudoso: true })], '2026-11-10');
    expect(q).toMatchObject({ total: 2, equipos: 1, ultimoRegistro: '2024-06-12', equiposConCambioReciente: 0, sinNParte: 1, sinCantidad: 1, horometroDudoso: 1, sinResponsable: 1 });
    expect(q.diasDesdeUltimo).toBeGreaterThan(800);
  });
  it('valida un cambio nuevo', () => {
    const ok = { sigla: 'CF-9510', fecha: '2026-11-10', descripcion: 'Cambio de entredientes' };
    expect(getsCambioError(ok)).toBeNull();
    expect(getsCambioError({ ...ok, sigla: '' })).toMatch(/equipo/);
    expect(getsCambioError({ ...ok, fecha: '' })).toMatch(/fecha/);
    expect(getsCambioError({ ...ok, descripcion: ' ' })).toMatch(/qué se cambió/);
    expect(getsCambioError({ ...ok, horometro: 0 })).toMatch(/horómetro/);
    expect(getsCambioError({ ...ok, cantidad: 1.5 })).toMatch(/cantidad/);
  });
});

import { getsEventosDesdeOT, getsUnir, getsTextoEsCambio } from '../logic.js';
describe('GETS sin repetir lo que ya está en las OT', () => {
  const planilla = [
    { sigla: 'MN-5926', fecha: '2024-06-08', descripcion: 'Cambio de cuchillas', pieza: 'Cuchillas', cantidad: 2, nParte: null },
    { sigla: 'MN-5926', fecha: '2024-06-08', descripcion: 'Cambio de puntas ripper', pieza: 'Puntas', cantidad: 5 },
    { sigla: 'CF-9510', fecha: '2024-01-06', descripcion: 'Cambio de elementos de desgaste completo', pieza: 'Elementos de desgaste (juego completo)' },
  ];
  const otHist = [
    { sigla: 'MN-5926', fecha: '2024-06-09', descripcion: 'Cambio de cuchillas motoniveladora', claseOT: 'desgaste', responsable: 'J. Yáñez' },   // mismo cambio con 1 día de diferencia
    { sigla: 'MN-5926', fecha: '2026-09-01', descripcion: 'Cambio de cuchillas', claseOT: 'desgaste' },                                       // posterior a la planilla
    { sigla: 'MN-5926', fecha: '2026-09-02', descripcion: 'Falla hidráulica', claseOT: 'correctiva' },                                       // no es desgaste
    { sigla: 'CF-9510', fecha: '2024-01-06', descripcion: 'Cambio de elementos de desgaste', claseOT: 'desgaste' },
  ];
  it('toma de las OT solo las clasificadas como desgaste', () => {
    const e = getsEventosDesdeOT(otHist, [{ sigla: 'BD-9509', fecha: '2026-10-01', sintoma: 'Cambio de cuchillas y cantoneras', tipoInt: 'Correctiva' }, { sigla: 'BD-9509', fecha: '2026-10-02', sintoma: 'Fuga de aceite hidráulico' }]);
    expect(e.map((x) => x.sigla + x.fecha)).toEqual(['MN-59262024-06-09', 'MN-59262026-09-01', 'CF-95102024-01-06', 'BD-95092026-10-01']);
    expect(e.every((x) => x.origen === 'OT')).toBe(true);
    expect(e[0].pieza).toBe('Cuchillas');
  });
  it('una OT del mismo equipo, ±1 día y misma pieza es el mismo cambio: no se cuenta dos veces', () => {
    const u = getsUnir(planilla, getsEventosDesdeOT(otHist, []));
    expect(u.filter((x) => x.sigla === 'MN-5926' && x.fecha === '2024-06-08')).toHaveLength(2);
    expect(u.find((x) => x.pieza === 'Cuchillas' && x.fecha === '2024-06-08').origen).toBe('GETS+OT');
    expect(u.find((x) => x.pieza === 'Puntas').origen).toBe('GETS');
    expect(u.find((x) => x.sigla === 'CF-9510').origen).toBe('GETS+OT');
    const soloOT = u.filter((x) => x.origen === 'OT');
    expect(soloOT.map((x) => x.fecha)).toEqual(['2026-09-01']);   // lo único nuevo: el cambio de 2026
    expect(u).toHaveLength(4);                                      // 3 de la planilla + 1 solo de OT
  });
  it('no mezcla piezas distintas del mismo día', () => {
    const ot = [{ sigla: 'MN-5926', fecha: '2024-06-08', descripcion: 'Cambio de calzas', claseOT: 'desgaste' }];
    const u = getsUnir(planilla, getsEventosDesdeOT(ot, []));
    expect(u.filter((x) => x.origen === 'OT')).toHaveLength(1);
  });
  it('la proyección con la unión usa los cambios recientes de las OT y no repite los de la planilla', () => {
    const ot = [];
    for (const f of ['2024-06-08', '2026-09-01', '2026-09-15', '2026-09-29', '2026-10-13']) ot.push({ sigla: 'MN-5926', fecha: f, descripcion: 'Cambio de cuchillas', claseOT: 'desgaste' });
    const u = getsUnir(planilla, getsEventosDesdeOT(ot, []));
    const r = getsProyeccion(u, '2026-10-20').find((x) => x.pieza === 'Cuchillas');
    expect(r.nCambios).toBe(5);                  // 06-2024 (planilla + OT = uno) y los 4 de 2026
    expect(r.estado).toBe('Próximo');
    expect(r.ultimoCambio).toBe('2026-10-13');
  });
  it('los faltantes de la planilla no cuentan las OT; sí cuentan para el último registro', () => {
    const q = getsCalidad(getsUnir(planilla, getsEventosDesdeOT(otHist, [])), '2026-09-10');
    expect(q).toMatchObject({ planilla: 3, soloOT: 1, enAmbos: 2, sinNParte: 3, ultimoRegistro: '2026-09-01' });
  });
});

describe('GETS: texto libre de las OT', () => {
  it('la pieza es la primera mencionada y reconoce singular y plural', () => {
    expect(getsPiezaDe('Se realiza cambio de entredientes y puntas de ripper')).toBe('Entredientes');
    expect(getsPiezaDe('Se realiza reemplazo de entrediente (usado)')).toBe('Entredientes');
    expect(getsPiezaDe('Cambio de pernos de entrediente y relleno de engrase')).toBe('Entredientes');
    expect(getsPiezaDe('Cambio de cuchillas y cantoneras')).toBe('Cuchillas');
    expect(getsPiezaDe('Cambio elementos de desgaste (cuchillas y cantoneras)')).toBe('Elementos de desgaste (juego completo)');
    expect(getsPiezaDe('Se cambia cantonera izq por desgaste')).toBe('Cantoneras');
  });
  it('una OT solo cuenta como cambio si dice que se cambió o repuso algo', () => {
    expect(getsTextoEsCambio('Se realiza cambio de juego completo de elementos de desgaste')).toBe(true);
    expect(getsTextoEsCambio('Reposición de entredientes')).toBe(true);
    expect(getsTextoEsCambio('Se realiza instalación de entrediente')).toBe(true);
    expect(getsTextoEsCambio('Inspección de calzas y balde')).toBe(false);
    expect(getsTextoEsCambio('Equipo fuera de servicio por rodado')).toBe(false);
    expect(getsTextoEsCambio('Se rellena el tanque de engrase automático')).toBe(false);
    expect(getsTextoEsCambio('Se cambia filtro de aire')).toBe(false);   // hay verbo pero no es una pieza de desgaste
  });
  it('de las OT solo entran las que además dicen que se cambió', () => {
    const e = getsEventosDesdeOT([
      { sigla: 'CF-9510', fecha: '2026-08-01', descripcion: 'Cambio de entredientes', claseOT: 'desgaste' },
      { sigla: 'CF-9510', fecha: '2026-08-02', descripcion: 'Inspección de calzas y balde', claseOT: 'desgaste' },
    ], []);
    expect(e.map((x) => x.fecha)).toEqual(['2026-08-01']);
  });
});
