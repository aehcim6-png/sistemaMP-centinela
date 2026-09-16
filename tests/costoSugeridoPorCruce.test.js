import { describe, it, expect } from 'vitest';
import { costoSugeridoPorCruce } from '../logic.js';

describe('costoSugeridoPorCruce', () => {
  it('caso real verificado: CF-9510, falla eléctrica/cambio de alternador cruza con OC truncada "Alter"', () => {
    const correctivo = {
      sigla: 'CF-9510', fecha: '2026-03-15',
      sintoma: 'Falla eléctrica',
      solucion: 'Reparacion eléctrica, cambio de alternador y relleno deposito grasa',
    };
    const ocHist = [
      { sigla: 'CF-9510', fecha: '2026-03-15', detalle: 'Servicio Reparacion Alter', costo: 550000, proveedor: 'REPARACIONES INDUSTRIALES JM LDTA' },
      { sigla: 'CF-9510', fecha: '2026-03-24', detalle: 'Servicio Reparacion Alter', costo: 600000, proveedor: 'REPARACIONES INDUSTRIALES JM LDTA' },
      { sigla: 'CF-9510', fecha: '2026-03-02', detalle: 'Kg Mobilgrease Xhp 322 Mi', costo: 1064823, proveedor: 'COMPANIA PETROLEO DE CHILE S.A.' },
    ];
    const r = costoSugeridoPorCruce(correctivo, ocHist);
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].detalle).toBe('Servicio Reparacion Alter');
    expect(r[0].costo).toBe(550000);
    expect(r[0].diffDias).toBe(0); // el candidato del mismo día va primero
  });

  it('arreglo vacío sin sigla o fecha en el correctivo', () => {
    expect(costoSugeridoPorCruce({ fecha: '2026-01-01' }, [])).toEqual([]);
    expect(costoSugeridoPorCruce({ sigla: 'CF-9510' }, [])).toEqual([]);
    expect(costoSugeridoPorCruce(null, [])).toEqual([]);
  });

  it('arreglo vacío sin texto (sintoma/solucion/componente todos vacíos)', () => {
    const correctivo = { sigla: 'CN-1', fecha: '2026-01-01' };
    const ocHist = [{ sigla: 'CN-1', fecha: '2026-01-01', detalle: 'Filtro Aceite', costo: 5000 }];
    expect(costoSugeridoPorCruce(correctivo, ocHist)).toEqual([]);
  });

  it('ignora OC de otro equipo aunque el texto coincida perfecto', () => {
    const correctivo = { sigla: 'CN-1', fecha: '2026-01-01', sintoma: 'cambio de alternador' };
    const ocHist = [{ sigla: 'CN-2', fecha: '2026-01-01', detalle: 'Servicio Reparacion Alter', costo: 500000 }];
    expect(costoSugeridoPorCruce(correctivo, ocHist)).toEqual([]);
  });

  it('ignora OC fuera de la ventana de días (default 15)', () => {
    const correctivo = { sigla: 'CN-1', fecha: '2026-01-01', solucion: 'Reparacion electrica, cambio de alternador' };
    const ocHist = [{ sigla: 'CN-1', fecha: '2026-02-01', detalle: 'Servicio Reparacion Alter', costo: 500000 }]; // 31 días después
    expect(costoSugeridoPorCruce(correctivo, ocHist)).toEqual([]);
    expect(costoSugeridoPorCruce(correctivo, ocHist, { ventanaDias: 35 }).length).toBe(1);
  });

  it('ignora OC sin costo real (0 o null)', () => {
    const correctivo = { sigla: 'CN-1', fecha: '2026-01-01', sintoma: 'cambio de alternador' };
    const ocHist = [
      { sigla: 'CN-1', fecha: '2026-01-01', detalle: 'Servicio Reparacion Alter', costo: 0 },
      { sigla: 'CN-1', fecha: '2026-01-01', detalle: 'Servicio Reparacion Alter', costo: null },
    ];
    expect(costoSugeridoPorCruce(correctivo, ocHist)).toEqual([]);
  });

  it('no matchea por coincidencia de palabras cortas genéricas (<4 caracteres)', () => {
    // "de" y "la" son tokens genéricos de 2 letras, no deberían bastar para un match
    const correctivo = { sigla: 'CN-1', fecha: '2026-01-01', sintoma: 'revision de la unidad' };
    const ocHist = [{ sigla: 'CN-1', fecha: '2026-01-01', detalle: 'De La Fuente Repuestos', costo: 10000 }];
    expect(costoSugeridoPorCruce(correctivo, ocHist)).toEqual([]);
  });

  it('respeta un umbral personalizado vía opts', () => {
    const correctivo = { sigla: 'CN-1', fecha: '2026-01-01', sintoma: 'cambio filtro aceite motor completo revision' };
    const ocHist = [{ sigla: 'CN-1', fecha: '2026-01-01', detalle: 'Filtro Aceite Motor Grande Extra', costo: 5000 }];
    // "grande" y "extra" no están en el texto de la OT -> score < 1, puede caer bajo un umbral alto
    expect(costoSugeridoPorCruce(correctivo, ocHist, { umbral: 0.95 })).toEqual([]);
    expect(costoSugeridoPorCruce(correctivo, ocHist, { umbral: 0.5 }).length).toBe(1);
  });

  it('ordena por score descendente y luego por cercanía de fecha', () => {
    const correctivo = { sigla: 'CN-1', fecha: '2026-01-10', solucion: 'Reparacion electrica, cambio de alternador' };
    const ocHist = [
      { sigla: 'CN-1', fecha: '2026-01-05', detalle: 'Servicio Reparacion Alter', costo: 100000 }, // score alto, 5 días
      { sigla: 'CN-1', fecha: '2026-01-10', detalle: 'Servicio Reparacion Alter', costo: 200000 }, // score alto, 0 días -> primero
    ];
    const r = costoSugeridoPorCruce(correctivo, ocHist);
    expect(r[0].costo).toBe(200000);
    expect(r[1].costo).toBe(100000);
  });
});
