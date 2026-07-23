import { describe, it, expect } from 'vitest';
import { compEstado } from '../logic.js';

describe('compEstado — estado de vida útil de componentes mayores', () => {
  it('sin fecha de instalación → no inventa %, marca "falta instalación"', () => {
    const st = compEstado({ horomComp: 20000, vidaUtil: 15000 }, 21000, 12);
    expect(st.conDato).toBe(false);
    expect(st.pctVida).toBeNull();
    expect(st.hrsRest).toBeNull();
    expect(st.estado).toContain('Falta instalación');
  });

  it('con fecha de instalación calcula uso, % y horas restantes', () => {
    const st = compEstado({ horomComp: 10000, vidaUtil: 15000, fechaInst: '2024-01-10' }, 13000, 12);
    expect(st.conDato).toBe(true);
    expect(st.hrsUsadas).toBe(3000);   // 13000 - 10000
    expect(st.hrsRest).toBe(12000);    // 15000 - 3000
    expect(st.pctVida).toBe(20);       // 3000/15000
    expect(st.estado).toContain('OK');
  });

  it('componente pasado de su vida útil → VENCIDO, hrsRest no baja de 0', () => {
    const st = compEstado({ horomComp: 5000, vidaUtil: 10000, fechaInst: '2020-01-01' }, 20000, 16);
    expect(st.hrsUsadas).toBe(15000);
    expect(st.hrsRest).toBe(0);
    expect(st.estado).toContain('VENCIDO');
  });

  it('horómetro de instalación mayor al actual (error de dato) → 0 usadas, NO el horómetro completo', () => {
    // Antes esto ponía hrsUsadas = horómetro completo y marcaba VENCIDO falsamente.
    const st = compEstado({ horomComp: 25000, vidaUtil: 15000, fechaInst: '2025-06-01' }, 21000, 12);
    expect(st.hrsUsadas).toBe(0);
    expect(st.hrsRest).toBe(15000);
    expect(st.estado).toContain('OK');
  });

  it('umbral PLANIFICAR (<1000h restantes)', () => {
    const st = compEstado({ horomComp: 0, vidaUtil: 10000, fechaInst: '2021-01-01' }, 9500, 12);
    expect(st.hrsRest).toBe(500);
    expect(st.estado).toContain('PLANIFICAR');
  });

  it('umbral MONITOREAR (entre 1000 y 2000h restantes)', () => {
    const st = compEstado({ horomComp: 0, vidaUtil: 10000, fechaInst: '2021-01-01' }, 8500, 12);
    expect(st.hrsRest).toBe(1500);
    expect(st.estado).toContain('MONITOREAR');
  });

  it('original: horas usadas = horómetro completo, sin necesidad de fecha', () => {
    const st = compEstado({ esOriginal: true, vidaUtil: 15000 }, 21000, 16);
    expect(st.conDato).toBe(true);
    expect(st.hrsUsadas).toBe(21000);
    expect(st.hrsRest).toBe(0);       // 21000 > 15000 → vencido
    expect(st.estado).toContain('VENCIDO');
  });

  it('no original y con fecha pero sin horómetro resuelto → falta instalación', () => {
    const st = compEstado({ fechaInst: '2023-01-01', vidaUtil: 15000 }, 21000, 16);
    expect(st.conDato).toBe(false);
  });
});
