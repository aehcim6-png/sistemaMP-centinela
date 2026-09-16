import { describe, it, expect } from 'vitest';
import { _informesFallaComoOt, esFallaMTBF } from '../logic.js';

function inf(sigla, tipoEvento, fecha, horometroActual, componente, descripcion) {
  return { sigla, tipoEvento, fecha, horometroActual, componente, descripcion };
}

describe('_informesFallaComoOt', () => {
  it('array vacío/undefined da arreglo vacío', () => {
    expect(_informesFallaComoOt([])).toEqual([]);
    expect(_informesFallaComoOt(undefined)).toEqual([]);
  });

  it('solo incluye tipoEvento Falla Catastrófica, descarta Cambio Componente Mayor', () => {
    const r = _informesFallaComoOt([
      inf('CF-100', 'Falla Catastrófica', '2026-09-01', 5000, 'Motor', 'Motor fundido'),
      inf('CF-100', 'Cambio Componente Mayor', '2026-09-05', 5010, 'Transmisión', 'Cambio preventivo'),
    ]);
    expect(r.length).toBe(1);
    expect(r[0].sigla).toBe('CF-100');
  });

  it('adapta al mismo shape que espera esFallaMTBF (tipo Correctivo, estadoOT Cerrada)', () => {
    const r = _informesFallaComoOt([inf('CF-100', 'Falla Catastrófica', '2026-09-01', 5000, 'Motor', 'Motor fundido')]);
    expect(r[0]).toEqual({
      sigla: 'CF-100', fecha: '2026-09-01', horom: 5000, tipo: 'Correctivo',
      componente: 'Motor', sintoma: 'Motor fundido', estadoOT: 'Cerrada',
    });
    expect(esFallaMTBF(r[0])).toBe(true);
  });

  it('ignora entradas sin sigla', () => {
    const r = _informesFallaComoOt([{ tipoEvento: 'Falla Catastrófica', fecha: '2026-09-01' }]);
    expect(r.length).toBe(0);
  });
});
