import { describe, it, expect } from 'vitest';
import { otCumpleFiltrosColumna, OT_FILTRO_VACIO } from '../logic.js';

// Filtros por columna de la tabla de Correctivos: se combinan y se aplican a todas las órdenes (antes de paginar).
const o = { sigla: 'CN-9500', fechaEntrada: '2025-03-05', sintoma: 'Cambio neumático', causaRaiz: '', componente: 'Neumático', solucion: 'Se cambia pos 3', tecnico: 'J. Yañez', tipoCausa: 'Física', categoriaMTTR: '', sistema: 'Ruedas y neumáticos', clasificacionCosto: '', estadoOT: undefined };

describe('otCumpleFiltrosColumna', () => {
  it('sin filtros, todo pasa', () => {
    expect(otCumpleFiltrosColumna(o, {})).toBe(true);
    expect(otCumpleFiltrosColumna(o, null)).toBe(true);
  });
  it('texto libre: contiene, sin importar mayúsculas ni espacios al borde', () => {
    expect(otCumpleFiltrosColumna(o, { sintoma: ' NEUMÁTICO ' })).toBe(true);
    expect(otCumpleFiltrosColumna(o, { sintoma: 'fuga' })).toBe(false);
    expect(otCumpleFiltrosColumna(o, { tecnico: 'yañez' })).toBe(true);
  });
  it('listas: valor exacto; «sin dato» pide las filas vacías', () => {
    expect(otCumpleFiltrosColumna(o, { tipoCausa: 'Física' })).toBe(true);
    expect(otCumpleFiltrosColumna(o, { tipoCausa: 'Humana' })).toBe(false);
    expect(otCumpleFiltrosColumna(o, { categoriaMTTR: OT_FILTRO_VACIO })).toBe(true);
    expect(otCumpleFiltrosColumna(o, { tipoCausa: OT_FILTRO_VACIO })).toBe(false);
  });
  it('sin estado la orden cuenta como «Cerrada», igual que la tabla', () => {
    expect(otCumpleFiltrosColumna(o, { estadoOT: 'Cerrada' })).toBe(true);
    expect(otCumpleFiltrosColumna(o, { estadoOT: 'Pendiente' })).toBe(false);
  });
  it('fecha: por año o por mes, sobre la fecha de entrada (o la fecha si falta)', () => {
    expect(otCumpleFiltrosColumna(o, { fecha: '2025' })).toBe(true);
    expect(otCumpleFiltrosColumna(o, { fecha: '2025-03' })).toBe(true);
    expect(otCumpleFiltrosColumna(o, { fecha: '2025-04' })).toBe(false);
    expect(otCumpleFiltrosColumna({ fecha: '2024-12-01' }, { fecha: '2024-12' })).toBe(true);
    expect(otCumpleFiltrosColumna({}, { fecha: '2025' })).toBe(false);
  });
  it('los filtros se combinan: todos deben cumplirse', () => {
    expect(otCumpleFiltrosColumna(o, { fecha: '2025-03', sistema: 'Ruedas y neumáticos', sintoma: 'cambio' })).toBe(true);
    expect(otCumpleFiltrosColumna(o, { fecha: '2025-03', sistema: 'Frenos' })).toBe(false);
  });
});
