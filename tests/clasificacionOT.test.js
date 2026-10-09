import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { clasificacionPendienteOT, resumenClasificacionOT, repararMojibake, patronesOcultosFalla } = require('../logic.js');

// Paso 3 de Calidad de Ejecución (2026-10-09): Tipo de Causa vacío en el 100% de los correctivos
// reales, Sistema vacío en ~23%, y texto mal codificado ("DÃ­a") partiendo grupos en dos.
describe('clasificacionPendienteOT', () => {
  it('un correctivo cerrado sin sistema ni tipo de causa está pendiente en ambos', () => {
    expect(clasificacionPendienteOT({ tipo: 'Correctivo', estadoOT: 'Cerrada', sistema: '', tipoCausa: '' }))
      .toEqual({ enUniverso: true, sinSistema: true, sinTipoCausa: true });
  });
  it('sin estadoOT cuenta como cerrado (mismo criterio que "Cerradas sin solución")', () => {
    expect(clasificacionPendienteOT({ tipo: 'Falla Operacional', sistema: 'Frenos', tipoCausa: 'Humana' }))
      .toEqual({ enUniverso: true, sinSistema: false, sinTipoCausa: false });
  });
  it('espacios en blanco cuentan como vacío', () => {
    expect(clasificacionPendienteOT({ tipo: 'Correctivo', sistema: '   ', tipoCausa: ' ' }))
      .toMatchObject({ sinSistema: true, sinTipoCausa: true });
  });
  it('OT abiertas y otros tipos (neumáticos, inspecciones) quedan fuera del universo', () => {
    expect(clasificacionPendienteOT({ tipo: 'Correctivo', estadoOT: 'Pendiente' }).enUniverso).toBe(false);
    expect(clasificacionPendienteOT({ tipo: 'Cambio de Neumaticos' }).enUniverso).toBe(false);
    expect(clasificacionPendienteOT(null).enUniverso).toBe(false);
  });
});

describe('resumenClasificacionOT', () => {
  const ot = [
    { tipo: 'Correctivo', estadoOT: 'Cerrada', sistema: 'Frenos', tipoCausa: '' },
    { tipo: 'Correctivo', sistema: '', tipoCausa: 'Humana' },
    { tipo: 'Correctivo', sistema: 'Motor diésel', tipoCausa: 'Física' },
    { tipo: 'Correctivo', estadoOT: 'Pendiente', sistema: '' },
    { tipo: 'Cambio de Neumaticos', sistema: '' },
  ];
  it('cuenta solo el universo y por separado cada faltante', () => {
    const r = resumenClasificacionOT(ot);
    expect(r.cerradas).toBe(3);
    expect(r.sinSistema).toBe(1);
    expect(r.sinTipoCausa).toBe(1);
    expect(r.pendientes).toBe(2);
    expect(r.pctSinSistema).toBe(33);
    expect(r.pctSinTipoCausa).toBe(33);
  });
  it('lista vacía → ceros, sin dividir por cero', () => {
    expect(resumenClasificacionOT([])).toMatchObject({ cerradas: 0, pendientes: 0, pctSinSistema: 0, pctSinTipoCausa: 0 });
    expect(resumenClasificacionOT(null).cerradas).toBe(0);
  });
});

describe('repararMojibake', () => {
  it('repara UTF-8 leído como Latin-1 (los casos reales de la base)', () => {
    expect(repararMojibake('DÃ­a')).toBe('Día');
    expect(repararMojibake('ElÃ©ctrico')).toBe('Eléctrico');
    expect(repararMojibake('HidrÃ¡ulico')).toBe('Hidráulico');
    expect(repararMojibake('DirecciÃ³n')).toBe('Dirección');
    expect(repararMojibake('Ruedas y neumÃ¡ticos')).toBe('Ruedas y neumáticos');
  });
  it('el texto que ya está bien no se toca', () => {
    expect(repararMojibake('Día')).toBe('Día');
    expect(repararMojibake('Motor diesel')).toBe('Motor diesel');
    expect(repararMojibake('Eléctrico')).toBe('Eléctrico');
    expect(repararMojibake('Ñandú — 100% ok')).toBe('Ñandú — 100% ok');
  });
  it('una "Ã" suelta que no es un par mal codificado se deja como está', () => {
    expect(repararMojibake('Ã')).toBe('Ã');
    expect(repararMojibake('Ã1')).toBe('Ã1');
  });
  it('null/undefined → texto vacío', () => {
    expect(repararMojibake(null)).toBe('');
    expect(repararMojibake(undefined)).toBe('');
  });
});

describe('patronesOcultosFalla: turno con y sin mala codificación es el MISMO turno', () => {
  const f = (turno, i) => ({ tipo: 'Correctivo', fecha: '2026-03-' + String(i + 1).padStart(2, '0'), turno });
  it('"Día" y "DÃ­a" se cuentan juntos', () => {
    const r = patronesOcultosFalla([f('Día', 0), f('Día', 1), f('DÃ­a', 2), f('DÃ­a', 3), f('DÃ­a', 4), f('Noche', 5)]);
    const cats = r.turno.detalle.map((d) => d.categoria).sort();
    expect(cats).toEqual(['Noche', 'Día'].sort());
    expect(r.turno.detalle.find((d) => d.categoria === 'Día').observado).toBe(5);
  });
});
