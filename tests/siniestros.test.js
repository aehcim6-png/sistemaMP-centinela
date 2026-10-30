// Siniestros (IT-AD-003): plazo de 5 días para denunciar, documentos que pide el liquidador según el caso, documentos del equipo a la fecha y bitácora.
import { describe, it, expect } from 'vitest';
import { SINIESTRO_PLAZO_DIAS, siniestroPlazo, siniestroDocumentos, siniestroNombreArchivo, siniestroDocsEquipo, bitacoraMantenimiento, siniestrosResumen } from '../logic.js';

describe('siniestroPlazo (5 días corridos)', () => {
  const s = { fecha: '2026-10-20', estado: 'Por informar' };
  it('el último día es la fecha + 5', () => {
    expect(SINIESTRO_PLAZO_DIAS).toBe(5);
    expect(siniestroPlazo(s, '2026-10-21')).toEqual({ limite: '2026-10-25', diasRestantes: 4, estado: 'a tiempo', aviso: false });
  });
  it('avisa con 2 días o menos, vence hoy el día 5 y después está vencido', () => {
    expect(siniestroPlazo(s, '2026-10-23').aviso).toBe(true);
    expect(siniestroPlazo(s, '2026-10-25').estado).toBe('vence hoy');
    expect(siniestroPlazo(s, '2026-10-27')).toMatchObject({ estado: 'vencido', diasRestantes: -2 });
  });
  it('informado: a tiempo o tarde según la fecha en que se informó', () => {
    expect(siniestroPlazo({ fecha: '2026-10-20', estado: 'Informado', fechaInformado: '2026-10-25' }, '2026-10-30').estado).toBe('informado a tiempo');
    expect(siniestroPlazo({ fecha: '2026-10-20', estado: 'En liquidación', fechaInformado: '2026-10-26' }, '2026-10-30').estado).toBe('informado tarde');
    expect(siniestroPlazo({ fecha: '2026-10-20', estado: 'Informado' }, '2026-10-30').estado).toBe('informado sin fecha');
  });
  it('sin fecha: null', () => {
    expect(siniestroPlazo({ estado: 'Por informar' }, '2026-10-30')).toBeNull();
  });
});

describe('siniestroDocumentos', () => {
  it('un choque sin terceros ni lesionados: los de entrada, sin tercero ni alcoholemia', () => {
    const r = siniestroDocumentos({ tipo: 'Vehículo liviano', documentos: { informe: true, fotos: true } });
    const por = Object.fromEntries(r.items.map((x) => [x.clave, x.estado]));
    expect(r.requeridos).toBe(8);   // informe, constancia, conductor, docsVehiculo, fotos, padron, factura, cotizNuevo
    expect(r.listos).toBe(2);
    expect(por.tercero).toBe('no aplica');
    expect(por.alcoholemia).toBe('no aplica');
    expect(r.faltan).toEqual(['constancia', 'conductor', 'docsVehiculo', 'padron', 'factura', 'cotizNuevo']);
  });
  it('con tercero y lesionados se suman sus documentos; en un robo no se pide el conductor', () => {
    const r = siniestroDocumentos({ tipo: 'Vehículo pesado o maquinaria', terceroInvolucrado: true, lesionados: true });
    expect(r.requeridos).toBe(9);
    expect(r.items.find((x) => x.clave === 'alcoholemia').estado).toBe('falta');
    expect(siniestroDocumentos({ tipo: 'Robo' }).items.find((x) => x.clave === 'conductor').estado).toBe('no aplica');
  });
  it('lo marcado «no aplica» a mano sale de los requeridos', () => {
    const r = siniestroDocumentos({ tipo: 'Vehículo pesado o maquinaria', documentos: { docsVehiculo: 'na' } });
    expect(r.requeridos).toBe(7);
    expect(r.faltan).not.toContain('docsVehiculo');
  });
});

describe('nombre del archivo, documentos del equipo y bitácora', () => {
  it('nombre como lo pide el instructivo', () => {
    expect(siniestroNombreArchivo({ sigla: 'CN-2698', faena: 'Codelco Chuquicamata', fecha: '2019-01-29' })).toBe('CN-2698 Informe de Siniestro faena Codelco Chuquicamata 29-01-2019');
  });
  it('documentos del equipo vigentes o no a la fecha del siniestro', () => {
    const venc = { 'CA-1': { 'Revisión Técnica': { proxima: '2026-11-01' }, 'Permiso Circulación': { proxima: '2026-03-31' } } };
    const r = siniestroDocsEquipo('CA-1', '2026-10-20', venc, 'Camioneta');
    expect(r.find((x) => x.doc === 'Revisión Técnica').vigente).toBe(true);
    expect(r.find((x) => x.doc === 'Permiso Circulación').vigente).toBe(false);
    expect(r.find((x) => x.doc === 'Seguro').vigente).toBeNull();
  });
  it('bitácora: correctivos y PM del equipo en el período, del más reciente al más antiguo', () => {
    const ot = [
      { sigla: 'CA-1', tipo: 'Correctivo', fecha: '2026-10-01', horom: 5000, sintoma: 'Ruido en frenos', solucion: 'Cambio de pastillas' },
      { sigla: 'CA-2', tipo: 'Correctivo', fecha: '2026-10-02' },
      { sigla: 'CA-1', tipo: 'Correctivo', fecha: '2025-01-01' },
    ];
    const reg = [{ equipo: 'CA-1', tipoPM: 'PM2', fechaEntrada: '2026-09-15', horomReal: 4800, duracionH: 4 }];
    const b = bitacoraMantenimiento('CA-1', ot, reg, '2026-01-01', '2026-10-30');
    expect(b.map((x) => [x.fecha, x.origen, x.tipo])).toEqual([['2026-10-01', 'Correctivo', 'Correctivo'], ['2026-09-15', 'PM', 'PM2']]);
    expect(b[0].detalle).toBe('Ruido en frenos · Solución: Cambio de pastillas');
    expect(b[1].duracion).toBe('4h');
  });
});

describe('siniestrosResumen', () => {
  it('cuenta por informar, los que vencen pronto, vencidos e informados a tiempo', () => {
    const r = siniestrosResumen([
      { fecha: '2026-10-29', estado: 'Por informar' },                               // vence el 3-nov: a tiempo, sin aviso
      { fecha: '2026-10-26', estado: 'Por informar' },                               // vence el 31-oct: aviso
      { fecha: '2026-10-20', estado: 'Por informar' },                               // vencido
      { fecha: '2026-10-01', estado: 'Cerrado', fechaInformado: '2026-10-03' },
      { fecha: '2026-09-01', estado: 'En liquidación', fechaInformado: '2026-09-10' },
    ], '2026-10-30');
    expect(r).toEqual({ total: 5, abiertos: 4, porInformar: 3, avisoPronto: 1, vencidos: 1, informadosATiempo: 1, informadosTarde: 1 });
  });
});
