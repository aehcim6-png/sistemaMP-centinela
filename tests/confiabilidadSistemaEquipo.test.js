import { describe, it, expect } from 'vitest';
import { confiabilidadSistemaEquipo } from '../logic.js';

describe('confiabilidadSistemaEquipo', () => {
  it('null sin componentes, sin horasPeriodo válido', () => {
    expect(confiabilidadSistemaEquipo([], { motor: { beta: 2, eta: 4000 } }, 5000, 500)).toBeNull();
    expect(confiabilidadSistemaEquipo(null, {}, 5000, 500)).toBeNull();
    expect(confiabilidadSistemaEquipo([{ comp: 'motor', horomComp: 1000 }], {}, 5000, -10)).toBeNull();
  });

  it('excluye componentes sin ajuste Weibull real para su tipo (nunca inventa β/η)', () => {
    const componentes = [{ comp: 'motor', horomComp: 3500 }, { comp: 'sinDatos', horomComp: 1000 }];
    const ajustes = { motor: { beta: 2, eta: 4000 } };
    const r = confiabilidadSistemaEquipo(componentes, ajustes, 5000, 500);
    expect(r).not.toBeNull();
    expect(r.componentesUsados).toBe(1);
    expect(r.componentesTotal).toBe(2);
    expect(r.detalle.length).toBe(1);
    expect(r.detalle[0].comp).toBe('motor');
  });

  it('sistema de 3 componentes: producto de confiabilidades condicionales (verificado independientemente con Python)', () => {
    // Verificado independientemente antes de escribir el test (Python, misma
    // fórmula: R_cond=R(edad+horas)/R(edad), R_sistema=producto):
    // motor:   beta=2.1 eta=4000 edad=1500 -> R_cond≈0.899630 (90.0%)
    // transm.: beta=1.0 eta=8000 edad=3000 -> R_cond≈0.939413 (93.9%)
    // frenos:  beta=3.5 eta=2500 edad=2000 -> R_cond≈0.581553 (58.2%)
    // R_sistema ≈ 0.491485 (49.1%) — el más débil (frenos) domina el producto.
    const horomActual = 0; // se resta directo con 'edad' vía horomComp negativo, ver abajo
    const componentes = [
      { comp: 'motor', horomComp: -1500 },
      { comp: 'transmision', horomComp: -3000 },
      { comp: 'frenos', horomComp: -2000 },
    ];
    const ajustes = {
      motor: { beta: 2.1, eta: 4000 },
      transmision: { beta: 1.0, eta: 8000 },
      frenos: { beta: 3.5, eta: 2500 },
    };
    const r = confiabilidadSistemaEquipo(componentes, ajustes, horomActual, 500);
    expect(r).not.toBeNull();
    expect(r.componentesUsados).toBe(3);
    expect(r.rSistema).toBeCloseTo(49.1, 1);
    // El componente más débil (menor R condicional) queda primero.
    expect(r.detalle[0].comp).toBe('frenos');
    expect(r.detalle[0].r).toBeCloseTo(58.2, 1);
    expect(r.detalle[2].comp).toBe('transmision');
    expect(r.detalle[2].r).toBeCloseTo(93.9, 1);
  });

  it('componentes ya vencidos (edad negativa por horomComp>horomActual) se acotan a edad 0, nunca negativa', () => {
    const componentes = [{ comp: 'motor', horomComp: 6000 }]; // instalado DESPUÉS del horómetro actual (error de dato)
    const ajustes = { motor: { beta: 2, eta: 4000 } };
    const r = confiabilidadSistemaEquipo(componentes, ajustes, 5000, 500);
    expect(r).not.toBeNull();
    expect(r.detalle[0].edadActual).toBe(0);
  });

  it('un solo componente con edad 0 (equipo/instalación nueva): R_sistema = R(horasPeriodo) directo', () => {
    // Sin uso previo (edad=0), la condicional se reduce a la confiabilidad
    // simple desde 0 — mismo valor que confiabilidadWeibull(ajuste,500).
    const componentes = [{ comp: 'motor', horomComp: 5000 }];
    const ajustes = { motor: { beta: 2, eta: 4000 } };
    const r = confiabilidadSistemaEquipo(componentes, ajustes, 5000, 500);
    // R(500) = exp(-(500/4000)^2) = exp(-0.015625) ≈ 0.984496 -> 98.4%/98.5%
    expect(r.rSistema).toBeCloseTo(98.4, 0);
  });
});
