// Consumo real de lubricantes de los informes mensuales de bodega: por tipo, por equipo, por mes y por fecha (23-nov-2026).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const L = createRequire(import.meta.url)('../logic.js');

const HD30 = 'MOBILTRANS HD 30', GR = 'MOBILGREASE XHP 322 MINE', AD = 'ADBLUE';
const filas = [
  { fecha: '2026-01-10', sigla: 'CN-9500', lubricante: HD30, cantidad: 100, unidad: 'L' },
  { fecha: '2026-01-20', sigla: 'CN-9501', lubricante: HD30, cantidad: 50, unidad: 'L' },
  { fecha: '2026-02-05', sigla: 'CN-9500', lubricante: GR, cantidad: 30, unidad: 'kg' },
  { fecha: '2026-03-01', sigla: 'CN-9500', lubricante: AD, cantidad: 40, unidad: 'L' },
  { fecha: '2026-03-15', sigla: 'CN-9500', lubricante: HD30, cantidad: 10, unidad: 'L' },
  { fecha: '2026-03-16', sigla: 'CN-9500', lubricante: HD30, cantidad: 0, unidad: 'L' },   // sin cantidad: se ignora
];

describe('lubClaseConsumo', () => {
  it('separa aceite, grasa y AdBlue', () => {
    expect(L.lubClaseConsumo(HD30)).toBe('Aceite');
    expect(L.lubClaseConsumo(GR)).toBe('Grasa');
    expect(L.lubClaseConsumo(AD)).toBe('AdBlue');
  });
});

describe('consumoLubricantesResumen', () => {
  const r = L.consumoLubricantesResumen(filas);
  it('no mezcla unidades: aceite en L, grasa en kg y AdBlue aparte', () => {
    expect(r.totales).toEqual({ aceiteL: 160, adblueL: 40, grasaKg: 30 });
  });
  it('ignora las filas sin cantidad y ordena las salidas de la más nueva a la más antigua', () => {
    expect(r.filas.length).toBe(5);
    expect(r.filas[0].fecha).toBe('2026-03-15');
  });
  it('resume por tipo de lubricante con su unidad, salidas, equipos y promedio mensual sobre los meses del período', () => {
    expect(r.nMeses).toBe(3);                                   // enero a marzo
    const hd = r.porLubricante.find(x => x.lubricante === HD30);
    expect(hd).toMatchObject({ total: 160, eventos: 3, nEquipos: 2, unidad: 'L', ultimo: '2026-03-15' });
    expect(hd.promedioMensual).toBeCloseTo(53.3, 1);
    expect(hd.porMes).toEqual({ '2026-01': 150, '2026-03': 10 });  // febrero no aparece: cuenta 0 en el promedio
    expect(r.porLubricante[0].lubricante).toBe(HD30);            // el que más sale, primero
  });
  it('resume por equipo y por mes', () => {
    const e = r.porEquipo.find(x => x.sigla === 'CN-9500');
    expect(e).toMatchObject({ aceiteL: 110, grasaKg: 30, adblueL: 40, eventos: 4 });
    expect(r.meses.map(m => m.mes)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(r.meses[0]).toMatchObject({ aceiteL: 150, grasaKg: 0, eventos: 2 });
  });
  it('filtra por equipo, lubricante y fechas', () => {
    expect(L.consumoLubricantesResumen(filas, { sigla: 'CN-9501' }).totales.aceiteL).toBe(50);
    expect(L.consumoLubricantesResumen(filas, { lubricante: GR }).totales).toEqual({ aceiteL: 0, adblueL: 0, grasaKg: 30 });
    const feb = L.consumoLubricantesResumen(filas, { desde: '2026-02-01', hasta: '2026-02-28' });
    expect(feb.filas.length).toBe(1);
    expect(feb.nMeses).toBe(1);
  });
  it('un período pedido más ancho que los datos promedia sobre los meses pedidos (un mes sin consumo vale 0)', () => {
    const t = L.consumoLubricantesResumen(filas, { desde: '2026-01-01', hasta: '2026-06-30' });
    expect(t.nMeses).toBe(6);
    expect(t.promedioMensual.aceiteL).toBeCloseTo(26.7, 1);
  });
  it('sin datos devuelve ceros, sin fallar', () => {
    const v = L.consumoLubricantesResumen([]);
    expect(v.filas).toEqual([]);
    expect(v.nMeses).toBe(0);
    expect(v.totales).toEqual({ aceiteL: 0, adblueL: 0, grasaKg: 0 });
    expect(L.consumoLubricantesResumen(null).filas).toEqual([]);
  });
});
