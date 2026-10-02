import { describe, it, expect } from 'vitest';
import { costoDowntimeMes } from '../logic.js';

describe('costoDowntimeMes — costo financiero real de toneladas perdidas por indisponibilidad × margen/tonelada', () => {
  it('multiplica toneladas perdidas por el margen configurado', () => {
    expect(costoDowntimeMes(300, 15000)).toBe(4500000);
  });

  it('toneladas perdidas = 0 devuelve $0 real (dato real de cero pérdida), no null', () => {
    expect(costoDowntimeMes(0, 15000)).toBe(0);
  });

  it('sin margen configurado (cfg.margenPorTon no definido o 0), devuelve null — nunca inventa un valor de tonelada', () => {
    expect(costoDowntimeMes(300, 0)).toBeNull();
    expect(costoDowntimeMes(300, null)).toBeNull();
    expect(costoDowntimeMes(300, undefined)).toBeNull();
  });

  it('sin dato de toneladas perdidas (null, equipo/mes sin filas), devuelve null aunque haya margen configurado', () => {
    expect(costoDowntimeMes(null, 15000)).toBeNull();
    expect(costoDowntimeMes(undefined, 15000)).toBeNull();
  });

  it('redondea al peso entero más cercano', () => {
    expect(costoDowntimeMes(10.3, 333)).toBe(Math.round(10.3 * 333));
  });
});
