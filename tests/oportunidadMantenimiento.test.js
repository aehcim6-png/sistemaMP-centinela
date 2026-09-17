import { describe, it, expect } from 'vitest';
const { oportunidadMantenimiento, oportunidadesMantenimientoFlota } = require('../logic.js');

describe('oportunidadMantenimiento', () => {
  function comp(componente, b10, b10Ajustado) {
    return b10Ajustado != null ? { componente, b10, b10Ajustado } : { componente, b10 };
  }

  it('con menos de 2 componentes con RUL real, devuelve null (nada que agrupar)', () => {
    expect(oportunidadMantenimiento([comp('Motor', 1500)], 250, 100000)).toBeNull();
    expect(oportunidadMantenimiento([], 250, 100000)).toBeNull();
    expect(oportunidadMantenimiento(null, 250, 100000)).toBeNull();
  });

  it('sin horizonte real (>0), devuelve null', () => {
    const comps = [comp('Motor', 1500), comp('Frenos', 1600)];
    expect(oportunidadMantenimiento(comps, 0, 100000)).toBeNull();
    expect(oportunidadMantenimiento(comps, null, 100000)).toBeNull();
  });

  it('caso calculado a mano: Motor(1500) dispara, Frenos(1620, diff=120<=250) entra, Neumático(3000, diff=1500) NO entra', () => {
    const comps = [comp('Motor', 1500), comp('Frenos', 1620), comp('Neumático', 3000)];
    const r = oportunidadMantenimiento(comps, 250, 150000);
    expect(r.disparador).toEqual({ componente: 'Motor', rul: 1500 });
    expect(r.nCandidatos).toBe(1);
    expect(r.candidatos).toEqual([{ componente: 'Frenos', rul: 1620, diferenciaHoras: 120 }]);
    expect(r.ahorroEstimado).toBe(150000); // 1 candidato × 150000 por parada evitada
  });

  it('varios candidatos dentro del horizonte suman el ahorro (1 por cada uno)', () => {
    const comps = [comp('Motor', 1000), comp('Frenos', 1100), comp('Hidráulico', 1200), comp('Neumático', 5000)];
    const r = oportunidadMantenimiento(comps, 250, 80000);
    expect(r.nCandidatos).toBe(2);
    expect(r.ahorroEstimado).toBe(160000);
  });

  it('usa el RUL AJUSTADO por aceite cuando está disponible, no el RUL base', () => {
    // Motor: b10 base=2000 pero ajustado por aceite a 900 (aceleración real
    // detectada) -> pasa a ser el disparador aunque su b10 "de libro" fuera mayor.
    const comps = [comp('Motor', 2000, 900), comp('Frenos', 1000)];
    const r = oportunidadMantenimiento(comps, 250, 100000);
    expect(r.disparador.componente).toBe('Motor');
    expect(r.disparador.rul).toBe(900);
  });

  it('si ninguno entra dentro del horizonte, devuelve null', () => {
    const comps = [comp('Motor', 500), comp('Frenos', 5000)];
    expect(oportunidadMantenimiento(comps, 250, 100000)).toBeNull();
  });
});

describe('oportunidadesMantenimientoFlota', () => {
  function rul(sigla, componente, b10) {
    return { sigla, componente, b10 };
  }

  it('sin duración real de intervención o sin tarifa configurada, devuelve []', () => {
    const rulLista = [rul('CN-1', 'Motor', 1500), rul('CN-1', 'Frenos', 1600)];
    const eq = [{ sigla: 'CN-1', frecPM: 250 }];
    expect(oportunidadesMantenimientoFlota(rulLista, eq, [], 25000)).toEqual([]); // sin OT -> sin duración mediana
    expect(oportunidadesMantenimientoFlota(rulLista, eq, [{ tipo: 'Correctivo', duracion: '6h' }], 0)).toEqual([]); // tarifa 0
  });

  it('equipos sin frecPM real se omiten (sin horizonte de planificación real)', () => {
    const rulLista = [rul('CN-1', 'Motor', 1500), rul('CN-1', 'Frenos', 1600)];
    const eq = [{ sigla: 'CN-1' }]; // sin frecPM
    const ot = [{ tipo: 'Correctivo', duracion: '6h' }, { tipo: 'Correctivo', duracion: '8h' }];
    expect(oportunidadesMantenimientoFlota(rulLista, eq, ot, 25000)).toEqual([]);
  });

  it('caso end-to-end calculado a mano: duración mediana real 7h × tarifa 25000 = 175000 por parada evitada', () => {
    const rulLista = [
      rul('CN-1', 'Motor', 1500),
      rul('CN-1', 'Frenos', 1620), // diff=120<=250 -> candidato
      rul('CN-1', 'Neumático', 3000), // diff=1500 -> no entra
      rul('CN-2', 'Motor', 800), // solo 1 componente en CN-2 -> sin oportunidad
    ];
    const eq = [{ sigla: 'CN-1', frecPM: 250 }, { sigla: 'CN-2', frecPM: 250 }];
    // duraciones reales: 6h,7h,8h -> mediana=7h
    const ot = [
      { tipo: 'Correctivo', duracion: '6h' },
      { tipo: 'Correctivo', duracion: '7h' },
      { tipo: 'Correctivo', duracion: '8h' },
    ];
    const r = oportunidadesMantenimientoFlota(rulLista, eq, ot, 25000);
    expect(r.length).toBe(1);
    expect(r[0].sigla).toBe('CN-1');
    expect(r[0].nCandidatos).toBe(1);
    expect(r[0].ahorroEstimado).toBe(175000);
  });

  it('ordena de mayor a menor cantidad de candidatos agrupables', () => {
    const rulLista = [
      rul('CN-1', 'Motor', 1000), rul('CN-1', 'Frenos', 1100), // 1 candidato
      rul('CN-2', 'Motor', 1000), rul('CN-2', 'Frenos', 1050), rul('CN-2', 'Hidráulico', 1100), // 2 candidatos
    ];
    const eq = [{ sigla: 'CN-1', frecPM: 250 }, { sigla: 'CN-2', frecPM: 250 }];
    const ot = [{ tipo: 'Correctivo', duracion: '6h' }, { tipo: 'Correctivo', duracion: '6h' }];
    const r = oportunidadesMantenimientoFlota(rulLista, eq, ot, 25000);
    expect(r[0].sigla).toBe('CN-2');
    expect(r[0].nCandidatos).toBe(2);
    expect(r[1].sigla).toBe('CN-1');
    expect(r[1].nCandidatos).toBe(1);
  });
});
