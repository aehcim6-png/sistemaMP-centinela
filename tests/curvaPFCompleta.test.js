import { describe, it, expect } from 'vitest';
import { curvaPFCompleta } from '../logic.js';

// Escenario determinista: 6 equipos con motor, muestras cada 30 días desde 2025-01-01, estado NORMAL hasta la muestra 3, 4 o 5
// (0-based) y luego ALERTA/PRECAUCION; cada equipo falla 20, 27, ... 55 días después del aviso y otra vez más adelante.
// Referencias de un script Python independiente (mismas reglas, escritas aparte): horas al detectar P, días P→F, control.
const plus = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const mk = () => {
  const ace = [], fal = [];
  for (let e = 0; e < 6; e++) {
    const sg = 'E' + e, pi = 3 + (e % 3);
    for (let i = 0; i < 10; i++) {
      ace.push({ _sigla: sg, componente: 'MOTOR', fecha: plus('2025-01-01', 30 * i), estado: i < pi ? 'NORMAL' : (i % 2 === 0 ? 'ALERTA' : 'PRECAUCION'), hrsComp: 1000 * (e + 1) + 250 * i });
    }
    fal.push({ sigla: sg, componente: 'Motor', fecha: plus(plus('2025-01-01', 30 * pi), 20 + 7 * e) });
    fal.push({ sigla: sg, componente: 'Motor', fecha: plus('2025-01-01', 200 + 11 * e) });
  }
  return { ace, fal };
};

describe('curvaPFCompleta', () => {
  it('lado izquierdo (horas al detectar P), derecho (P→F) y control, contra el cálculo independiente', () => {
    const { ace, fal } = mk();
    const r = curvaPFCompleta(ace, fal);
    expect(r.laboratorio).toHaveLength(1);
    const m = r.laboratorio[0];
    expect(m.componente).toBe('MOTOR');
    expect(m.casosP).toBe(6);
    expect(m.izquierdo).toEqual({ n: 6, medianaHoras: 4500, minHoras: 1750, maxHoras: 7250 });
    expect(m.derecho.n).toBe(6);
    expect(m.derecho.medianaDias).toBe(38);          // mediana 37,5 redondeada
    expect(m.derecho.nControl).toBe(24);
    expect(m.derecho.medianaControl).toBe(113);      // mediana 112,5 redondeada
    expect(m.derecho.veredicto).toBe('el aviso anticipa');
    expect(m.recomendacion).toEqual({ vigilarDesdeHoras: 1750, inspeccionCadaDias: 19 });
  });
  it('no da recomendación con menos de 5 casos y no marca como P a quien ya estaba en alerta desde el inicio', () => {
    const { ace, fal } = mk();
    const pocos = ace.filter((a) => a._sigla === 'E0' || a._sigla === 'E1');
    const r = curvaPFCompleta(pocos, fal.filter((f) => f.sigla === 'E0' || f.sigla === 'E1'));
    expect(r.laboratorio[0].casosP).toBe(2);
    expect(r.laboratorio[0].recomendacion).toBeNull();
    // un equipo siempre en alerta desde la primera muestra: no se sabe cuándo empezó el desgaste → sin P
    const siempre = Array.from({ length: 8 }, (_, i) => ({ _sigla: 'X', componente: 'MOTOR', fecha: plus('2025-01-01', 30 * i), estado: 'ALERTA', hrsComp: 100 * i }));
    expect(curvaPFCompleta(siempre, []).laboratorio[0].casosP).toBe(0);
  });
  it('sin muestras o sin horas no inventa nada', () => {
    expect(curvaPFCompleta([], []).laboratorio).toEqual([]);
    const { ace, fal } = mk();
    const sinHoras = ace.map((a) => Object.assign({}, a, { hrsComp: 0 }));
    const m = curvaPFCompleta(sinHoras, fal).laboratorio[0];
    expect(m.izquierdo.n).toBe(0);
    expect(m.izquierdo.medianaHoras).toBeNull();
  });
});
