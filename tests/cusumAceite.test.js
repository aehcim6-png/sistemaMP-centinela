import { describe, it, expect } from 'vitest';
const { cusumAceite, cusumAceitePorComponente } = require('../logic.js');

describe('cusumAceite', () => {
  it('con menos de 6 muestras, devuelve null (necesita historial mínimo para estimar sigma)', () => {
    expect(cusumAceite([])).toBeNull();
    expect(cusumAceite(undefined)).toBeNull();
    expect(cusumAceite([10, 20, 30, 40, 50])).toBeNull();
  });

  it('serie constante (sigma=0), devuelve null — no hay variación real que evaluar', () => {
    expect(cusumAceite([20, 20, 20, 20, 20, 20, 20])).toBeNull();
  });

  it('detecta una aceleración real: serie estable seguida de una subida sostenida — verificado a mano con script Python', () => {
    const r = cusumAceite([18, 20, 19, 21, 20, 26, 32, 40, 50]);
    expect(r.n).toBe(9);
    expect(r.mu0).toBe(21); // mediana de toda la serie
    expect(r.sigma).toBeCloseTo(3.99, 1);
    expect(r.k).toBeCloseTo(1.99, 1);
    expect(r.h).toBeCloseTo(15.96, 1);
    expect(r.curva.map((p) => p.cusum)).toEqual([0, 0, 0, 0, 0, 3.01, 12.01, 29.02, 56.02]);
    expect(r.indiceAlerta).toBe(7);
    expect(r.detectado).toBe(true);
  });

  it('serie estable con ruido normal (sin tendencia real), NO dispara alerta', () => {
    const r = cusumAceite([20, 22, 19, 21, 20, 18, 23, 19]);
    expect(r.detectado).toBe(false);
    expect(r.indiceAlerta).toBeNull();
  });

  it('sigma se estima con el rango móvil, no con la varianza de toda la serie — la varianza simple se infla con la propia aceleración y pierde sensibilidad', () => {
    // Mismo caso "accel" de arriba: con varianza muestral simple, sigma daría ~11.19
    // (la propia subida infla su propio umbral) y JAMÁS detectaría nada — confirmado
    // con el mismo script Python. Con rango móvil, sigma=3.99 y sí detecta en i=7.
    const r = cusumAceite([18, 20, 19, 21, 20, 26, 32, 40, 50]);
    expect(r.sigma).toBeLessThan(10);
    expect(r.detectado).toBe(true);
  });

  it('descarta valores inválidos (<=0)', () => {
    const r = cusumAceite([18, 20, 0, -5, 19, 21, 20, 26, 32]);
    expect(r.n).toBe(7);
  });

  it('la curva CUSUM nunca es negativa (es un máximo acumulado de un solo lado)', () => {
    const r = cusumAceite([30, 10, 5, 8, 12, 9, 11, 7]);
    r.curva.forEach((p) => expect(p.cusum).toBeGreaterThanOrEqual(0));
  });
});

describe('cusumAceitePorComponente', () => {
  function m(sigla, componente, fecha, valores) {
    return { _sigla: sigla, componente, fecha, hierro: valores.hierro, cobre: valores.cobre };
  }

  it('agrupa por sigla+componente (mismo criterio que "alertas persistentes" de ace.js), ordena por fecha antes de correr CUSUM', () => {
    const ace = [
      m('CN-1', 'Motor', '2026-05-01', { hierro: 40 }),
      m('CN-1', 'Motor', '2026-01-01', { hierro: 18 }),
      m('CN-1', 'Motor', '2026-02-01', { hierro: 20 }),
      m('CN-1', 'Motor', '2026-03-01', { hierro: 19 }),
      m('CN-1', 'Motor', '2026-04-01', { hierro: 21 }),
      m('CN-1', 'Motor', '2026-04-20', { hierro: 20 }),
      m('CN-1', 'Motor', '2026-05-15', { hierro: 32 }),
      m('CN-1', 'Motor', '2026-06-01', { hierro: 26 }),
      m('CN-1', 'Motor', '2026-06-15', { hierro: 50 }),
    ];
    const r = cusumAceitePorComponente(ace);
    const grupo = r.find((x) => x.sigla === 'CN-1' && x.componente === 'Motor');
    expect(grupo).toBeDefined();
    // Orden cronológico correcto (18,20,19,21,20,32,26,40,50 -> el mismo patrón
    // de aceleración de arriba, aunque los valores lleguen desordenados).
    expect(grupo.porMetal.hierro.detectado).toBe(true);
    expect(grupo.porMetal.hierro.fechaAlerta).toBeTruthy();
  });

  it('ignora muestras sin sigla/componente/fecha', () => {
    const ace = [
      { _sigla: '', componente: 'Motor', fecha: '2026-01-01', hierro: 20 },
      { _sigla: 'CN-1', componente: '', fecha: '2026-01-01', hierro: 20 },
      { _sigla: 'CN-1', componente: 'Motor', fecha: '', hierro: 20 },
    ];
    expect(cusumAceitePorComponente(ace)).toEqual([]);
  });

  it('un grupo sin ningún metal con historial suficiente (< 6 muestras) queda excluido del resultado', () => {
    const ace = [1, 2, 3].map((i) => m('CN-9', 'Frenos', `2026-0${i}-01`, { hierro: 20 + i }));
    expect(cusumAceitePorComponente(ace)).toEqual([]);
  });

  it('cada metal se evalúa por separado — un metal sin historial suficiente no bloquea a otro del mismo grupo que sí lo tiene', () => {
    const ace = [
      m('CN-2', 'Diferencial', '2026-01-01', { hierro: 18, cobre: 10 }),
      m('CN-2', 'Diferencial', '2026-02-01', { hierro: 20, cobre: 11 }),
      m('CN-2', 'Diferencial', '2026-03-01', { hierro: 19 }), // sin cobre esta vez
      m('CN-2', 'Diferencial', '2026-04-01', { hierro: 21, cobre: 12 }),
      m('CN-2', 'Diferencial', '2026-05-01', { hierro: 20, cobre: 11 }),
      m('CN-2', 'Diferencial', '2026-06-01', { hierro: 22, cobre: 10 }),
    ];
    const r = cusumAceitePorComponente(ace);
    const grupo = r.find((x) => x.sigla === 'CN-2');
    expect(grupo.porMetal.hierro).not.toBeNull(); // 6 muestras válidas
    expect(grupo.porMetal.cobre).toBeNull(); // solo 5 muestras válidas de cobre
  });
});
