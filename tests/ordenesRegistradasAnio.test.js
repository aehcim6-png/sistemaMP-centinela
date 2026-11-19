import { describe, it, expect } from 'vitest';
import { ordenesRegistradasAnio } from '../logic.js';

// Pestaña Disponibilidad: lista las OT del año — vigentes (traen fecha de salida) más las del histórico (Excel, chat; sin fecha de salida) — sin mezclarlas con las horas detenido.
const ot = [
  { sigla: 'CN-9500', tipo: 'Correctivo', fecha: '2025-03-02', fechaEntrada: '2025-03-02', fechaSalida: '2025-03-03', sintoma: 'Fuga de aceite', componente: 'Motor' },
  { sigla: 'CN-9501', tipo: 'Correctivo', fecha: '2025-03-10', fechaEntrada: '2025-03-10', fechaSalida: null, sintoma: 'Engrase general' },       // rutina: no es falla
  { sigla: 'CN-9502', tipo: 'Correctivo', fecha: '2026-01-05', fechaSalida: '2026-01-05', sintoma: 'Falla de frenos' },       // otro año
];
const hist = [
  { sigla: 'CN-9500', fecha: '2025-03-20', tipoInt: 'Correctiva', sistema: 'Frenos', descripcion: 'Se repara fuga', fuente: 'ordenes_trabajo (Excel 2026-11-05)' },
  { sigla: 'CN-9503', fecha: '2025-03-21', tipoInt: 'Programada', sistema: 'Engrase', descripcion: 'PM1', fuente: 'WhatsApp — BSM_CEN EQUIPOS' },
  { sigla: 'CN-9503', fecha: '2024-12-01', tipoInt: 'Correctiva', sistema: 'Motor', descripcion: 'falla', fuente: 'ordenes_trabajo' },   // otro año
  { sigla: 'CN-9504', fecha: 'sin fecha', tipoInt: 'Correctiva', descripcion: 'falla', fuente: 'x' },                          // fecha inválida: se omite
];

describe('ordenesRegistradasAnio: órdenes del año para Disponibilidad', () => {
  const r = ordenesRegistradasAnio({ ot, otHist: hist }, 2025);
  it('solo cuenta las del año pedido y omite fechas inválidas', () => {
    expect(r.total.total).toBe(4);
    expect(r.meses.map(m => m.mes)).toEqual(['2025-03']);
  });
  it('separa vigentes (con fecha de salida) de histórico (sin horas detenido)', () => {
    expect(r.total).toMatchObject({ vigentes: 2, historicas: 2, conSalida: 1 });
    expect(r.filas.filter(f => f.origen === 'historico').every(f => f.conSalida === false)).toBe(true);
  });
  it('fallas y otras usan la misma definición que Confiabilidad: la rutina y la programada no son falla', () => {
    expect(r.total.fallas).toBe(2);
    expect(r.total.otras).toBe(2);
    expect(r.filas.find(f => f.sigla === 'CN-9501').falla).toBe(false);
    expect(r.filas.find(f => f.sigla === 'CN-9503').falla).toBe(false);
  });
  it('la fuente se muestra sin el paréntesis de carga y las filas salen de la más reciente a la más antigua', () => {
    expect(r.filas.find(f => f.sigla === 'CN-9500' && f.origen === 'historico').fuente).toBe('Excel de órdenes');
    expect(r.filas.map(f => f.fecha)).toEqual([...r.filas.map(f => f.fecha)].sort().reverse());
  });
  it('sin datos devuelve ceros y listas vacías', () => {
    const v = ordenesRegistradasAnio({}, 2025);
    expect(v.total.total).toBe(0);
    expect(v.meses).toEqual([]);
    expect(v.filas).toEqual([]);
  });
});
