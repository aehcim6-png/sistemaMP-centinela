import { describe, it, expect } from 'vitest';
import { cartaControlEWMA } from '../logic.js';

// Serie con deriva lenta y sostenida (nunca un salto brusco entre meses
// consecutivos). Valores de referencia calculados independientemente en
// Python siguiendo la fórmula EXACTA de Montgomery (límites por punto i,
// no la versión asintótica simplificada), con lambda=0.2, L=3,
// sigma=MR̄/1.128 (misma estimación que cartaControlIMR).
const VALORES = [100, 102, 99, 101, 103, 100, 104, 106, 103, 107, 109, 106, 110, 112, 109, 113, 116, 113, 118, 121];
function puntosDesde(vals) {
  return vals.map((v, i) => ({ periodo: '2025-' + String(1 + i).padStart(2, '0'), valor: v }));
}

describe('cartaControlEWMA', () => {
  it('null con menos de 6 periodos', () => {
    expect(cartaControlEWMA(puntosDesde(VALORES.slice(0, 5)))).toBeNull();
    expect(cartaControlEWMA([])).toBeNull();
    expect(cartaControlEWMA(null)).toBeNull();
  });

  it('reusa exactamente la misma estimación de sigma que cartaControlIMR (MR̄/1.128)', () => {
    const r = cartaControlEWMA(puntosDesde(VALORES));
    expect(r.xBarra).toBeCloseTo(107.6, 1);
    expect(r.sigma).toBeCloseTo(2.6596, 2);
  });

  it('usa lambda=0.2 y L=3 por defecto (valores estándar de la literatura)', () => {
    const r = cartaControlEWMA(puntosDesde(VALORES));
    expect(r.lambda).toBe(0.2);
    expect(r.L).toBe(3);
  });

  it('reproduce los valores de referencia verificados en Python punto por punto', () => {
    const r = cartaControlEWMA(puntosDesde(VALORES));
    const esperado = [
      { i: 1, z: 106.08, ucl: 109.2, lcl: 106.0, fuera: false },
      { i: 2, z: 105.26, ucl: 109.64, lcl: 105.56, fuera: true },
      { i: 6, z: 102.66, ucl: 110.17, lcl: 105.03, fuera: true },
      { i: 11, z: 105.12, ucl: 110.25, lcl: 104.95, fuera: false },
      { i: 17, z: 110.21, ucl: 110.26, lcl: 104.94, fuera: false },
      { i: 20, z: 113.97, ucl: 110.26, lcl: 104.94, fuera: true },
    ];
    esperado.forEach(({ i, z, ucl, lcl, fuera }) => {
      const d = r.detalle[i - 1];
      expect(d.z).toBeCloseTo(z, 1);
      expect(d.UCL).toBeCloseTo(ucl, 1);
      expect(d.LCL).toBeCloseTo(lcl, 1);
      expect(d.fueraControl).toBe(fuera);
    });
  });

  it('los límites se angostan al principio de la serie y convergen a un ancho asintótico (fórmula exacta, no simplificada)', () => {
    const r = cartaControlEWMA(puntosDesde(VALORES));
    const anchoInicial = r.detalle[0].UCL - r.xBarra;
    const anchoFinal = r.detalle[r.detalle.length - 1].UCL - r.xBarra;
    expect(anchoInicial).toBeLessThan(anchoFinal);
    // ancho asintótico teórico: L*sigma*sqrt(lambda/(2-lambda))
    const anchoAsintotico = r.L * r.sigma * Math.sqrt(r.lambda / (2 - r.lambda));
    expect(anchoFinal).toBeCloseTo(anchoAsintotico, 1);
  });

  it('serie plana sin deriva: nunca fuera de control', () => {
    const plano = puntosDesde([100, 101, 99, 100, 101, 99, 100, 101]);
    const r = cartaControlEWMA(plano);
    expect(r.puntosFueraControl).toBe(0);
  });

  it('acepta lambda/L personalizados y cae a los valores por defecto si son inválidos', () => {
    const r1 = cartaControlEWMA(puntosDesde(VALORES), 0.3, 2.5);
    expect(r1.lambda).toBe(0.3);
    expect(r1.L).toBe(2.5);
    const r2 = cartaControlEWMA(puntosDesde(VALORES), 0, -1);
    expect(r2.lambda).toBe(0.2);
    expect(r2.L).toBe(3);
  });
});
