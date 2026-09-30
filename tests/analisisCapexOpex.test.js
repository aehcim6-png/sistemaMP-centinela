import { describe, it, expect } from 'vitest';
import { _CLASIFICACIONES_COSTO, analisisCapexOpex } from '../logic.js';

describe('_CLASIFICACIONES_COSTO', () => {
  it('son las 2 clasificaciones contables reales', () => {
    expect(_CLASIFICACIONES_COSTO).toEqual(['CAPEX', 'OPEX']);
  });
});

describe('analisisCapexOpex', () => {
  it('array vacío sin correctivos', () => {
    expect(analisisCapexOpex([])).toEqual([]);
    expect(analisisCapexOpex(undefined)).toEqual([]);
  });

  it('ignora correctivos sin clasificacionCosto', () => {
    const c = [{ costo: 1000 }, { clasificacionCosto: '', costo: 500 }];
    expect(analisisCapexOpex(c)).toEqual([]);
  });

  it('ignora clasificacionCosto que no es CAPEX ni OPEX (nunca inventa una clase)', () => {
    const c = [{ clasificacionCosto: 'Mixto', costo: 1000 }];
    expect(analisisCapexOpex(c)).toEqual([]);
  });

  it('ignora correctivos sin costo o costo 0/negativo', () => {
    const c = [
      { clasificacionCosto: 'OPEX' },
      { clasificacionCosto: 'OPEX', costo: 0 },
      { clasificacionCosto: 'OPEX', costo: -100 },
    ];
    expect(analisisCapexOpex(c)).toEqual([]);
  });

  it('suma costo y cuenta eventos por clasificación', () => {
    const c = [
      { clasificacionCosto: 'OPEX', costo: 1000 },
      { clasificacionCosto: 'OPEX', costo: 2000 },
    ];
    const r = analisisCapexOpex(c);
    expect(r).toHaveLength(1);
    expect(r[0].clasificacion).toBe('OPEX');
    expect(r[0].nEventos).toBe(2);
    expect(r[0].costoTotal).toBe(3000);
    expect(r[0].costoPromedio).toBe(1500);
    expect(r[0].pctDelTotal).toBe(100);
  });

  it('calcula pctDelTotal correctamente entre CAPEX y OPEX', () => {
    const c = [
      { clasificacionCosto: 'CAPEX', costo: 3000 },
      { clasificacionCosto: 'OPEX', costo: 1000 },
    ];
    const r = analisisCapexOpex(c);
    const capex = r.find((x) => x.clasificacion === 'CAPEX');
    const opex = r.find((x) => x.clasificacion === 'OPEX');
    expect(capex.pctDelTotal).toBe(75);
    expect(opex.pctDelTotal).toBe(25);
  });

  it('ordena de mayor a menor costoTotal', () => {
    const c = [
      { clasificacionCosto: 'OPEX', costo: 500 },
      { clasificacionCosto: 'CAPEX', costo: 9000 },
    ];
    const r = analisisCapexOpex(c);
    expect(r.map((x) => x.clasificacion)).toEqual(['CAPEX', 'OPEX']);
  });

  it('redondea costoTotal y costoPromedio a enteros', () => {
    const c = [
      { clasificacionCosto: 'OPEX', costo: 100.6 },
      { clasificacionCosto: 'OPEX', costo: 200.4 },
    ];
    const r = analisisCapexOpex(c);
    expect(Number.isInteger(r[0].costoTotal)).toBe(true);
    expect(Number.isInteger(r[0].costoPromedio)).toBe(true);
  });

  it('no muta el arreglo original (pura)', () => {
    const c = [{ clasificacionCosto: 'CAPEX', costo: 1000 }];
    const copia = c.map((x) => ({ ...x }));
    analisisCapexOpex(c);
    expect(c).toEqual(copia);
  });
});
