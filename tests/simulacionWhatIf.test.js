import { describe, it, expect } from 'vitest';
const { simulacionWhatIf, compararEscenariosMantenimiento } = require('../logic.js');

// Mismo patrón de "muestra constante" que ya usa
// simulacionMonteCarloDisponibilidad.test.js — con intervalos y duraciones
// constantes, el resultado es exacto y determinístico, sin depender del
// azar, así que se puede calcular a mano.
const IV = [10, 10, 10, 10, 10, 10, 10, 10]; // 8 intervalos constantes de 10 días
const DU = [5, 5, 5, 5, 5]; // 5 duraciones constantes de 5h

describe('simulacionWhatIf', () => {
  it('con factores 1 (o sin factores), coincide EXACTO con simulacionMonteCarloDisponibilidad', () => {
    const r = simulacionWhatIf(IV, DU, 30, 100, 300, 1, 1);
    // t=10(falla+5h)->15; t=25(falla+5h)->30; t=40(>=30, corta) => 2 fallas, 10h de flota
    expect(r.fallasEsperadas).toBe(2);
    const esperado = Math.round((1 - 10 / 3000) * 1000) / 10;
    expect(r.dispP50).toBe(esperado);
    expect(r.factorIntervalo).toBe(1);
    expect(r.factorDuracion).toBe(1);
  });

  it('factorIntervalo=2 (fallas al doble de espaciadas) reduce las fallas y sube la disponibilidad — calculado a mano', () => {
    // intervalos escalados: 20,20,...  t=20(falla+5h)->25; t=45(>=30,corta) => 1 falla, 5h
    const r = simulacionWhatIf(IV, DU, 30, 100, 300, 2, 1);
    expect(r.fallasEsperadas).toBe(1);
    const esperado = Math.round((1 - 5 / 3000) * 1000) / 10;
    expect(r.dispP50).toBe(esperado);
  });

  it('factorDuracion=0.5 (reparaciones al doble de rápidas) mantiene las mismas fallas pero baja el downtime — calculado a mano', () => {
    // duraciones escaladas: 2.5h c/u. t=10(falla+2.5)->12.5; t=25(falla+2.5)->27.5; t=40(corta) => 2 fallas, 5h
    const r = simulacionWhatIf(IV, DU, 30, 100, 300, 1, 0.5);
    expect(r.fallasEsperadas).toBe(2);
    const esperado = Math.round((1 - 5 / 3000) * 1000) / 10;
    expect(r.dispP50).toBe(esperado);
  });

  it('combinando ambos factores (confiabilidad ×2 y reparación ×0.5) — calculado a mano', () => {
    // intervalos 20, duraciones 2.5h. t=20(falla+2.5)->22.5; t=45(corta) => 1 falla, 2.5h
    const r = simulacionWhatIf(IV, DU, 30, 100, 300, 2, 0.5);
    expect(r.fallasEsperadas).toBe(1);
    const esperado = Math.round((1 - 2.5 / 3000) * 1000) / 10;
    expect(r.dispP50).toBe(esperado);
  });

  it('factores inválidos (<=0) caen a 1 en vez de romper la simulación', () => {
    const r = simulacionWhatIf(IV, DU, 30, 100, 300, -1, 0);
    expect(r.factorIntervalo).toBe(1);
    expect(r.factorDuracion).toBe(1);
    const base = simulacionWhatIf(IV, DU, 30, 100, 300, 1, 1);
    expect(r.dispP50).toBe(base.dispP50);
  });

  it('sin muestra suficiente, devuelve null igual que el núcleo', () => {
    expect(simulacionWhatIf([1, 2, 3], DU, 30, 100, 300, 1, 1)).toBeNull();
  });
});

describe('compararEscenariosMantenimiento', () => {
  it('calcula el delta real entre el escenario base y el what-if — caso a mano', () => {
    const r = compararEscenariosMantenimiento(IV, DU, 30, 100, 300, 2, 1);
    // base disp=1-10/3000; escenario disp=1-5/3000 -> delta=+0.2 puntos (16.7 en dispP50 ya redondeado a 1 decimal ×10... ver cálculo real abajo)
    const dispBase = Math.round((1 - 10 / 3000) * 1000) / 10;
    const dispEsc = Math.round((1 - 5 / 3000) * 1000) / 10;
    expect(r.base.dispP50).toBe(dispBase);
    expect(r.escenario.dispP50).toBe(dispEsc);
    expect(r.deltaDispP50).toBe(Math.round((dispEsc - dispBase) * 10) / 10);
    expect(r.deltaFallasEsperadas).toBe(-1); // de 2 a 1 falla esperada
  });

  it('sin cambios (factores 1), el delta es exactamente 0', () => {
    const r = compararEscenariosMantenimiento(IV, DU, 30, 100, 300, 1, 1);
    expect(r.deltaDispP50).toBe(0);
    expect(r.deltaFallasEsperadas).toBe(0);
  });

  it('sin muestra suficiente en el escenario base, devuelve null', () => {
    expect(compararEscenariosMantenimiento([1, 2], DU, 30, 100, 300, 2, 1)).toBeNull();
  });
});
