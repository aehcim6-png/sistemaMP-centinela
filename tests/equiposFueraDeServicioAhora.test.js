import { describe, it, expect } from 'vitest';
import { equiposFueraDeServicioAhora } from '../logic.js';

describe('equiposFueraDeServicioAhora', () => {
  it('devuelve vacío sin OT', () => {
    expect(equiposFueraDeServicioAhora([])).toEqual([]);
    expect(equiposFueraDeServicioAhora(undefined)).toEqual([]);
  });

  it('incluye una OT Fuera de Servicio con fechaEntrada y sin fechaSalida', () => {
    const ot = [{ sigla: 'CF-8769', estatusEq: 'Fuera de Servicio', fechaEntrada: '2026-08-01', fechaSalida: '' }];
    const out = equiposFueraDeServicioAhora(ot);
    expect(out.length).toBe(1);
    expect(out[0].o.sigla).toBe('CF-8769');
    expect(out[0].i).toBe(0);
  });

  it('excluye una OT Fuera de Servicio ya cerrada (con fechaSalida)', () => {
    const ot = [{ sigla: 'CF-8769', estatusEq: 'Fuera de Servicio', fechaEntrada: '2026-08-01', fechaSalida: '2026-08-03' }];
    expect(equiposFueraDeServicioAhora(ot)).toEqual([]);
  });

  it('excluye equipos Operativos', () => {
    const ot = [{ sigla: 'CF-8769', estatusEq: 'Operativo', fechaEntrada: '2026-08-01', fechaSalida: '' }];
    expect(equiposFueraDeServicioAhora(ot)).toEqual([]);
  });

  it('excluye una OT sin fechaEntrada (dato incompleto)', () => {
    const ot = [{ sigla: 'CF-8769', estatusEq: 'Fuera de Servicio', fechaEntrada: '', fechaSalida: '' }];
    expect(equiposFueraDeServicioAhora(ot)).toEqual([]);
  });

  it('conserva el índice original de cada equipo dentro del arreglo completo', () => {
    const ot = [
      { sigla: 'A', estatusEq: 'Operativo', fechaEntrada: '2026-08-01', fechaSalida: '' },
      { sigla: 'B', estatusEq: 'Fuera de Servicio', fechaEntrada: '2026-08-01', fechaSalida: '' },
      { sigla: 'C', estatusEq: 'Fuera de Servicio', fechaEntrada: '2026-08-02', fechaSalida: '' },
    ];
    const out = equiposFueraDeServicioAhora(ot);
    expect(out.map(x => x.i)).toEqual([1, 2]);
    expect(out.map(x => x.o.sigla)).toEqual(['B', 'C']);
  });
});
