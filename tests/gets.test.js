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
