import { describe, it, expect } from 'vitest';
import { matrizTransicionSalud, proyeccionSaludNSemanas } from '../logic.js';

// Helper: arma un historico {sigla: {fecha:valor}} con exactamente 2
// snapshots separados 7 días (dentro de la ventana 4-10 días).
function equiposTransicion(valoresPares) {
  const base = new Date('2026-01-01T00:00:00Z');
  const out = {};
  valoresPares.forEach(([v1, v2], i) => {
    const f1 = base.toISOString().slice(0, 10);
    const f2 = new Date(base.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    out['E' + i] = { [f1]: v1, [f2]: v2 };
  });
  return out;
}

describe('matrizTransicionSalud', () => {
  it('null sin datos, o con filas insuficientes', () => {
    expect(matrizTransicionSalud({})).toBeNull();
    expect(matrizTransicionSalud(null)).toBeNull();
    // Solo 2 equipos (Sano->Sano) -> ninguna fila llega al mínimo (5).
    const pocos = equiposTransicion([[80, 78], [82, 79]]);
    expect(matrizTransicionSalud(pocos)).toBeNull();
  });

  it('ignora pares fuera de la ventana 4-10 días (nunca inventa una transición semanal)', () => {
    // Separación de 2 días -> no cuenta como transición semanal.
    const hist = { E0: { '2026-01-01': 80, '2026-01-03': 40 } };
    expect(matrizTransicionSalud(hist)).toBeNull();
  });

  it('matriz de transición y proyección Chapman-Kolmogorov (verificado independientemente con Python)', () => {
    // Verificado con Python antes de escribir el test — 18 equipos, cada
    // uno con exactamente 1 transición semanal real:
    // 5x Sano->Sano, 3x Sano->Alerta, 2x Alerta->Alerta, 3x Alerta->Crítico,
    // 2x Crítico->Crítico, 3x Crítico->Alerta.
    // Fila Sano: S->S=0.625, S->A=0.375, S->C=0 (total fila=8)
    // Fila Alerta: A->S=0, A->A=0.4, A->C=0.6 (total fila=5)
    // Fila Crítico: C->S=0, C->A=0.6, C->C=0.4 (total fila=5)
    const pares = [
      ...Array(5).fill([80, 78]), // Sano->Sano
      ...Array(3).fill([80, 60]), // Sano->Alerta
      ...Array(2).fill([60, 58]), // Alerta->Alerta
      ...Array(3).fill([60, 50]), // Alerta->Crítico
      ...Array(2).fill([40, 42]), // Crítico->Crítico
      ...Array(3).fill([45, 60]), // Crítico->Alerta
    ];
    const hist = equiposTransicion(pares);
    const r = matrizTransicionSalud(hist);
    expect(r).not.toBeNull();
    expect(r.totalTransiciones).toBe(18);
    expect(r.matriz.Sano.Sano).toBeCloseTo(0.625, 3);
    expect(r.matriz.Sano.Alerta).toBeCloseTo(0.375, 3);
    expect(r.matriz.Sano['Crítico']).toBe(0);
    expect(r.matriz.Alerta.Alerta).toBeCloseTo(0.4, 3);
    expect(r.matriz.Alerta['Crítico']).toBeCloseTo(0.6, 3);
    expect(r.matriz['Crítico'].Alerta).toBeCloseTo(0.6, 3);
    expect(r.matriz['Crítico']['Crítico']).toBeCloseTo(0.4, 3);

    // Proyección 1 semana desde Sano = exactamente la fila de Sano.
    const p1 = proyeccionSaludNSemanas(r, 'Sano', 1);
    expect(p1.Sano).toBeCloseTo(0.625, 3);
    expect(p1.Alerta).toBeCloseTo(0.375, 3);
    expect(p1['Crítico']).toBe(0);

    // Proyección 2 semanas desde Sano (Chapman-Kolmogorov, verificado con Python).
    const p2 = proyeccionSaludNSemanas(r, 'Sano', 2);
    expect(p2.Sano).toBeCloseTo(0.390625, 3);
    expect(p2.Alerta).toBeCloseTo(0.384375, 3);
    expect(p2['Crítico']).toBeCloseTo(0.225, 3);
    // Las probabilidades siempre suman 1.
    expect(p2.Sano + p2.Alerta + p2['Crítico']).toBeCloseTo(1, 6);

    // Proyección 3 semanas desde Alerta (verificado con Python).
    const p3 = proyeccionSaludNSemanas(r, 'Alerta', 3);
    expect(p3.Sano).toBe(0);
    expect(p3.Alerta).toBeCloseTo(0.496, 3);
    expect(p3['Crítico']).toBeCloseTo(0.504, 3);
  });

  it('proyeccionSaludNSemanas: null con estado inválido, semanas inválidas, o matriz nula', () => {
    const hist = equiposTransicion([
      ...Array(5).fill([80, 78]),
      ...Array(5).fill([60, 58]),
      ...Array(5).fill([40, 42]),
    ]);
    const r = matrizTransicionSalud(hist);
    expect(proyeccionSaludNSemanas(null, 'Sano', 1)).toBeNull();
    expect(proyeccionSaludNSemanas(r, 'Inexistente', 1)).toBeNull();
    expect(proyeccionSaludNSemanas(r, 'Sano', 0)).toBeNull();
    expect(proyeccionSaludNSemanas(r, 'Sano', -1)).toBeNull();
  });
});
