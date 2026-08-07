import { describe, it, expect } from 'vitest';
import { verificarIntegridad } from '../logic.js';

describe('verificarIntegridad', () => {
  it('no reporta nada sobre datos limpios', () => {
    const data = {
      eq: [{ sigla: 'CF-8769', horomActual: 15000, horomProxPM: 15250, hrsRestantes: 250, estado: '🟢 AL DÍA' }],
      reg: [{ equipo: 'CF-8769', fechaEntrada: '2026-01-10', fechaSalida: '2026-01-10' }],
      hist: [
        { sigla: 'CF-8769', fecha: '2026-01-01', horom: 14900 },
        { sigla: 'CF-8769', fecha: '2026-01-10', horom: 15000 },
      ],
      stk: [{ nParte: 'A1', stockBodega: 5, precioUnit: 1000 }],
      repuestos: [{ componente: 'Filtro', stockActual: 3, precioUnit: 500 }],
      lub: [{ nombre: 'Mobil', stock: 10, precio: 200 }],
      ordenes: [{ componente: 'Bomba', costoEstimado: 300 }],
      compMayores: [{ sigla: 'CF-8769', comp: 'Motor', vidaUtil: 20000, esOriginal: true }],
      dispCalc: { 'CF-8769': { '2026-01': 92.5 } },
    };
    expect(verificarIntegridad(data)).toEqual([]);
  });

  it('detecta horómetro que retrocedió en el historial', () => {
    const out = verificarIntegridad({
      hist: [
        { sigla: 'BD-10139', fecha: '2026-01-01', horom: 2000 },
        { sigla: 'BD-10139', fecha: '2026-01-15', horom: 1800 },
      ],
    });
    expect(out.some(h => h.check === 'horometroRetrocedido' && h.severidad === 'alta')).toBe(true);
  });

  it('detecta disponibilidad fuera de 0-100%', () => {
    const out = verificarIntegridad({ dispCalc: { 'CA-5979': { '2026-02': 134 } } });
    expect(out.some(h => h.check === 'disponibilidadFueraDeRango')).toBe(true);
    const out2 = verificarIntegridad({ dispCalc: { 'CA-5979': { '2026-02': -5 } } });
    expect(out2.some(h => h.check === 'disponibilidadFueraDeRango')).toBe(true);
  });

  it('detecta estado desincronizado: horómetro ya alcanzó su propio próximo PM pero no dice VENCIDA', () => {
    const out = verificarIntegridad({
      eq: [{ sigla: 'CF-8769', horomActual: 15518, horomProxPM: 15500, hrsRestantes: 18, estado: '🟢 AL DÍA' }],
    });
    expect(out.some(h => h.check === 'estadoDesincronizado')).toBe(true);
  });

  it('no marca estadoDesincronizado si ya dice vencida o hrsRestantes es negativo', () => {
    const out = verificarIntegridad({
      eq: [{ sigla: 'CF-8769', horomActual: 15518, horomProxPM: 15500, hrsRestantes: -18, estado: '🔴 VENCIDA' }],
    });
    expect(out.some(h => h.check === 'estadoDesincronizado')).toBe(false);
  });

  it('detecta sigla de equipo duplicada', () => {
    const out = verificarIntegridad({ eq: [{ sigla: 'GE-10019' }, { sigla: 'GE-10019' }] });
    expect(out.some(h => h.check === 'siglaDuplicada')).toBe(true);
  });

  it('detecta precios negativos en stk, repuestos, lub y ordenes', () => {
    const out = verificarIntegridad({
      stk: [{ nParte: 'A1', precioUnit: -10 }],
      repuestos: [{ componente: 'X', precioUnit: -5 }],
      lub: [{ nombre: 'Mobil', precio: -1 }],
      ordenes: [{ componente: 'Y', costoEstimado: -100 }],
    });
    const checks = out.filter(h => h.check === 'precioNegativo');
    expect(checks.length).toBe(4);
  });

  it('detecta stock negativo en stk, repuestos y lub', () => {
    const out = verificarIntegridad({
      stk: [{ nParte: 'A1', stockBodega: -2 }],
      repuestos: [{ componente: 'X', stockActual: -1 }],
      lub: [{ nombre: 'Mobil', stock: -3 }],
    });
    const checks = out.filter(h => h.check === 'stockNegativo');
    expect(checks.length).toBe(3);
  });

  it('detecta registro con fecha de salida anterior a la de entrada', () => {
    const out = verificarIntegridad({
      reg: [{ equipo: 'BS-5752', fechaEntrada: '2026-03-10', fechaSalida: '2026-03-05' }],
    });
    expect(out.some(h => h.check === 'fechaSalidaAntesDeEntrada')).toBe(true);
  });

  it('detecta componente mayor con vidaUtil <= 0', () => {
    const out = verificarIntegridad({
      compMayores: [{ sigla: 'MN-5926', comp: 'Motor', vidaUtil: 0 }],
    });
    expect(out.some(h => h.check === 'vidaUtilInvalida')).toBe(true);
  });

  it('detecta componente mayor instalado en un horómetro mayor al actual del equipo', () => {
    const out = verificarIntegridad({
      eq: [{ sigla: 'MN-5926', horomActual: 1000 }],
      compMayores: [{ sigla: 'MN-5926', comp: 'Motor', fechaInst: '2026-01-01', horomComp: 5000, esOriginal: false }],
    });
    expect(out.some(h => h.check === 'horasUsadasNegativas')).toBe(true);
  });

  it('ordena los hallazgos por severidad (alta antes que media)', () => {
    const out = verificarIntegridad({
      eq: [
        { sigla: 'A', horomActual: 100, horomProxPM: 100, hrsRestantes: 0, estado: '🟢 AL DÍA' }, // media: desincronizado
        { sigla: 'A' }, // alta: sigla duplicada (junto con la de arriba)
      ],
    });
    expect(out[0].severidad).toBe('alta');
  });
});
