// Cuadre entre pestañas (23-nov-2026): cruza horómetros, OT, PM, historial de componentes y compras sin escribir nada.
import { describe, it, expect } from 'vitest';
import { cuadreEntrePestanas } from '../logic.js';

const EQ = [{ sigla: 'CN-9503', horomActual: 23000 }, { sigla: 'CF-9510', horomActual: 16000 }];
const base = (extra) => Object.assign({ equipos: EQ, hoyISO: '2026-11-23', hist: [], ot: [], reg: [], compHist: [], compras: [] }, extra || {});
const ctl = (r, id) => r.find((c) => c.id === id);

describe('cuadreEntrePestanas', () => {
  it('sin datos todo cuadra', () => {
    const r = cuadreEntrePestanas(base());
    expect(r.map((c) => c.total)).toEqual([0, 0, 0, 0]);
  });
  it('compra de un cinturón sin cambio comprobado; con OT que dice instalación ya no aparece', () => {
    const compra = { pedido: '1', sigla: 'CN-9503', fecha: '2026-08-01', detalle: 'Seat Belt 5615781410', cant: 1, costo: 986921, estado: 'Recepcion Bodega', fechaEstado: '2026-08-05' };
    const sin = ctl(cuadreEntrePestanas(base({ compras: [compra] })), 'comprasSinCambio');
    expect(sin.total).toBe(1);
    expect(sin.filas[0]).toMatchObject({ sigla: 'CN-9503', fecha: '2026-08-05' });
    const con = ctl(cuadreEntrePestanas(base({ compras: [compra], ot: [{ sigla: 'CN-9503', fecha: '2026-08-06', sintoma: 'Se instala cinturón de seguridad nuevo' }] })), 'comprasSinCambio');
    expect(con.total).toBe(0);
  });
  it('no mira compras viejas ni líneas por firmar', () => {
    const vieja = { pedido: '1', sigla: 'CN-9503', fecha: '2024-01-01', detalle: 'Alternador', cant: 1, costo: 1, estado: 'Recepcion Bodega', fechaEstado: '2024-01-10' };
    const porFirmar = { pedido: '2', sigla: 'CN-9503', fecha: '2026-11-01', detalle: 'Alternador', cant: 1, costo: 1, estado: 'Por firmar' };
    expect(ctl(cuadreEntrePestanas(base({ compras: [vieja, porFirmar] })), 'comprasSinCambio').total).toBe(0);
  });
  it('OT de fuera de servicio sin lectura de horómetro ese día', () => {
    const ot = [{ sigla: 'CN-9503', fechaEntrada: '2026-11-10', estatusEq: 'Fuera de Servicio', sintoma: 'sin arranque' }];
    expect(ctl(cuadreEntrePestanas(base({ ot })), 'otSinHorometro').total).toBe(1);
    const hist = [{ sigla: 'CN-9503', fecha: '2026-11-11', horom: 22900 }];
    expect(ctl(cuadreEntrePestanas(base({ ot, hist })), 'otSinHorometro').total).toBe(0);
  });
  it('horómetro de la ficha distinto de la última lectura', () => {
    const hist = [{ sigla: 'CN-9503', fecha: '2026-11-20', horom: 22800 }];
    const c = ctl(cuadreEntrePestanas(base({ hist })), 'horomFichaVsHistorial');
    expect(c.total).toBe(1);
    expect(c.filas[0].texto).toMatch(/23000/);
    expect(ctl(cuadreEntrePestanas(base({ hist: [{ sigla: 'CN-9503', fecha: '2026-11-20', horom: 23010 }] })), 'horomFichaVsHistorial').total).toBe(0);
  });
  it('PM sin lectura cerca y límite de filas', () => {
    const reg = Array.from({ length: 20 }, (_, i) => ({ equipo: 'CF-9510', tipoPM: 'PM1', fechaEntrada: '2026-10-' + String(i + 1).padStart(2, '0') }));
    const c = ctl(cuadreEntrePestanas(base({ reg, limite: 5 })), 'pmSinHorometro');
    expect(c.total).toBe(20);
    expect(c.filas.length).toBe(5);
    expect(c.filas[0].fecha).toBe('2026-10-20');
  });
});
