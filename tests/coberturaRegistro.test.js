// Cobertura de registro (etapa 2 de «datos desactualizados», 2026-10-23): un mes sin cargar nada no debe leerse como 100 % disponible.
import { describe, it, expect } from 'vitest';
import { coberturaRegistro, dispCoberturaMes, coberturaFlotaMes, dispDownMap, dispEquipoMes, dispIntrinsecaEquipoMes, DISP_VENTANA_COBERTURA } from '../logic.js';

const dias = (desde, hasta) => {
  const out = [];
  for (let t = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10)); t <= Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10)); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};
const lecturasHasta = (sigla, desde, hasta) => dias(desde, hasta).map((fecha) => ({ sigla, fecha, horom: 1000 }));

describe('coberturaRegistro', () => {
  it('junta lecturas, OT, PM y la última lectura del equipo, sin repetir ni fechas inválidas', () => {
    const c = coberturaRegistro({
      hist: [{ sigla: 'A', fecha: '2026-10-02' }, { sigla: 'A', fecha: '2026-10-02' }, { sigla: 'A', fecha: 'mal' }],
      ot: [{ sigla: 'A', fecha: '2026-10-05', fechaEntrada: '2026-10-05', fechaSalida: '2026-10-06' }],
      reg: [{ equipo: 'A', fechaEntrada: '2026-10-09' }],
      eq: [{ sigla: 'A', horomActual: 500, fechaHorom: '2026-10-12' }, { sigla: 'B', horomActual: 0, fechaHorom: '2026-10-12' }],
    });
    expect(c.A).toEqual(['2026-10-02', '2026-10-05', '2026-10-06', '2026-10-09', '2026-10-12']);
    expect(c.B).toBeUndefined();
  });
  it('tolera entradas vacías', () => {
    expect(coberturaRegistro()).toEqual({});
    expect(coberturaRegistro({ hist: [null], ot: [null], reg: [null], eq: [null] })).toEqual({});
  });
});

describe('Disponibilidad con y sin cobertura', () => {
  const hoy = '2026-10-23';
  const base = (hist, extra) => {
    const cobertura = coberturaRegistro(Object.assign({ hist }, extra));
    return { cobertura, downMap: dispDownMap(extra && extra.reg || [], extra && extra.ot || [], hoy), hrsDia: 12, hoy };
  };

  it('sin pasar cobertura el cálculo es el de siempre (100 % si no hay detenciones)', () => {
    expect(dispEquipoMes('A', '2026-09', { downMap: {}, hrsDia: 12, hoy })).toBe(100);
  });

  it('una semana sin ingresar datos: sigue cubierto (la ventana es de 7 días) y vale 100 % real', () => {
    const o = base(lecturasHasta('A', '2026-08-01', '2026-10-16'));
    expect(dispCoberturaMes('A', '2026-10', o)).toEqual({ pct: 100, conDato: 23, dias: 23 });
    expect(dispEquipoMes('A', '2026-10', o)).toBe(100);
  });

  it('un mes sin ingresar datos: el mes nuevo queda SIN DATO (null), no 100 %', () => {
    const o = base(lecturasHasta('A', '2026-08-01', '2026-09-23'));
    expect(DISP_VENTANA_COBERTURA).toBe(7);
    expect(dispEquipoMes('A', '2026-10', o)).toBeNull();
    expect(dispCoberturaMes('A', '2026-10', o).pct).toBe(0);
    // el mes en que se dejó de cargar queda con cobertura parcial: se promedia solo sobre los días con registro
    expect(dispCoberturaMes('A', '2026-09', o)).toEqual({ pct: 100, conDato: 30, dias: 30 });
  });

  it('dos meses sin ingresar datos: agosto y septiembre → septiembre y octubre sin dato', () => {
    const o = base(lecturasHasta('A', '2026-06-01', '2026-08-24'));
    expect(dispEquipoMes('A', '2026-08', o)).toBe(100);
    expect(dispEquipoMes('A', '2026-09', o)).toBeNull();
    expect(dispEquipoMes('A', '2026-10', o)).toBeNull();
    const c = coberturaFlotaMes([{ sigla: 'A', hrsDia: 12 }], '2026-10', o);
    expect(c).toEqual({ pct: 0, n: 1, sinCobertura: 1 });
  });

  it('una OT también es evidencia: cubre ±7 días, y los días caídos cuentan aunque no haya lectura', () => {
    const ot = [{ sigla: 'A', estatusEq: 'Fuera de Servicio', fechaEntrada: '2026-10-10', fechaSalida: '2026-10-12' }];
    const o = base(lecturasHasta('A', '2026-08-01', '2026-09-30'), { ot });
    // octubre: las lecturas cubren hasta el 7 y la OT (entrada 10, salida 12) cubre del 3 al 19 → días 1 a 19; del 20 al 23 no hay registro
    const d = dispCoberturaMes('A', '2026-10', o);
    expect(d).toEqual({ pct: Math.round(19 / 23 * 100), conDato: 19, dias: 23 });
    // 3 días caídos (10, 11, 12) y 16 buenos sobre los 19 con dato; los 4 sin dato no entran
    expect(dispEquipoMes('A', '2026-10', o)).toBe(Math.round(16 / 19 * 1000) / 10);
  });

  it('un equipo sin ninguna evidencia: sin dato aunque otros equipos tengan', () => {
    const o = base(lecturasHasta('A', '2026-08-01', '2026-10-23'));
    expect(dispEquipoMes('A', '2026-10', o)).toBe(100);
    expect(dispEquipoMes('B', '2026-10', o)).toBeNull();
  });

  it('la Disponibilidad Intrínseca usa la misma cobertura', () => {
    const o = base(lecturasHasta('A', '2026-08-01', '2026-09-23'));
    expect(dispIntrinsecaEquipoMes('A', '2026-10', { downMapCorrectivo: {}, hrsDia: 12, hoy, cobertura: o.cobertura })).toBeNull();
    expect(dispIntrinsecaEquipoMes('A', '2026-10', { downMapCorrectivo: {}, hrsDia: 12, hoy })).toBe(100);
  });

  it('un valor cargado a mano (override) no se toca ni tiene cobertura', () => {
    const o = base([]);
    const op = Object.assign({}, o, { dispCalc: { A: { '2026-10': 88 } } });
    expect(dispEquipoMes('A', '2026-10', op)).toBe(88);
    expect(dispCoberturaMes('A', '2026-10', op)).toBeNull();
  });
});
