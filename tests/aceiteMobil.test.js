import { describe, it, expect } from 'vitest';
import { aceiteMobilEsFormato, aceiteMobilCodigo } from '../logic.js';

const SIGLAS = ['CN-9503', 'CN-9501', 'CN-9500', 'CN-9502', 'CN-9507', 'CN-10155', 'CN-10159', 'CN-10160', 'CN-5131', 'CN-5133',
  'CF-9510', 'CF-8769', 'CF-10162', 'BD-9533', 'BD-9509', 'BD-10139', 'MN-6112', 'GE-10019', 'MC-4922', 'BS-5752'];

describe('aceiteMobilEsFormato', () => {
  it('reconoce el export de Mobil Assistance y no el CSV del laboratorio COPEC', () => {
    expect(aceiteMobilEsFormato(['NOMBRE_CLIENTE', 'N_MUESTRA', 'EQUIPO', 'MARCA_EQUIPO', 'MODELO_EQUIPO', 'EQUIPO_ID', 'COMPONENTE', 'HIERRO', 'ESTADO'])).toBe(true);
    expect(aceiteMobilEsFormato(['NOMBRE_CLIENTE', 'N_MUESTRA', 'EQUIPO', 'HIERRO', 'ESTADO'])).toBe(false);
    expect(aceiteMobilEsFormato([])).toBe(false);
  });
});

describe('aceiteMobilCodigo: código del componente → sigla del sistema y nombre del componente', () => {
  const c = (cod, extra) => aceiteMobilCodigo(cod, SIGLAS, extra);
  it('los CAEX («CE-xx») se traducen a su sigla CN', () => {
    expect(c('CE-86MFD')).toMatchObject({ sigla: 'CN-9501', componente: 'MANDO FINAL DERECHO' });
    expect(c('CE-85MT')).toMatchObject({ sigla: 'CN-9503', componente: 'MOTOR' });
    expect(c('CE-87TR')).toMatchObject({ sigla: 'CN-9500', componente: 'TRANSMISION' });
    expect(c('CE-89SH')).toMatchObject({ sigla: 'CN-9507', componente: 'HIDRAULICO' });
  });
  it('con espacios, guiones y nombres largos', () => {
    expect(c('CE-155 MDI')).toMatchObject({ sigla: 'CN-10155', componente: 'MANDO FINAL IZQ' });
    expect(c('CE-160 MANDO FINAL DER')).toMatchObject({ sigla: 'CN-10160', componente: 'MANDO FINAL DERECHO' });
    expect(c('CE-155 FR')).toMatchObject({ sigla: 'CN-10155', componente: 'DIRECCION Y FRENOS' });
    expect(c('BD-139 MC')).toMatchObject({ sigla: 'BD-10139', componente: 'MOTOR' });
    expect(c('CN5131TR')).toMatchObject({ sigla: 'CN-5131', componente: 'TRANSMISION' });
    expect(c('MC4922 - MOTOR COMBUSTION')).toMatchObject({ sigla: 'MC-4922', componente: 'MOTOR' });
  });
  it('diferencial trasero y delantero, tándem y cubo', () => {
    expect(c('CF-510DT')).toMatchObject({ sigla: 'CF-9510', componente: 'DIFERENCIAL TRASERO' });
    expect(c('CF-769DD')).toMatchObject({ sigla: 'CF-8769', componente: 'DIFERENCIAL DELANTERO' });
    expect(c('CE-87DT')).toMatchObject({ sigla: 'CN-9500', componente: 'DIFERENCIAL TRASERO' });
    expect(c('MN-12TANI')).toMatchObject({ sigla: 'MN-6112', componente: 'TANDEN IZQ' });
    expect(c('MN-12MDG')).toMatchObject({ sigla: 'MN-6112', componente: 'CUBO' });
  });
  it('equipos que ya no están en la flota se traducen igual, pero quedan marcados sin ficha', () => {
    expect(c('CE-113MT')).toMatchObject({ sigla: 'CN-6113', componente: 'MOTOR', sinFicha: true });
    expect(c('CE-56MFI')).toMatchObject({ sigla: 'CN-4656', componente: 'MANDO FINAL IZQ', sinFicha: true });
    expect(c('CF-511REF')).toMatchObject({ sigla: 'CF-9511', componente: 'REFRIGERANTE', sinFicha: true });
    expect(c('CN-3475-MT')).toMatchObject({ sigla: 'CN-3475', componente: 'MOTOR', sinFicha: true });
    expect(c('CE-85MT').sinFicha).toBe(false);
  });
  it('sin sufijo, el aceite dice qué componente es', () => {
    expect(c('CE-155', { lubricante: 'MOBIL DELVAC MODERN 15W-40 FULL PROTECTION' })).toMatchObject({ sigla: 'CN-10155', componente: 'MOTOR' });
    expect(c('CF-769', { lubricante: 'MOBILTRANS HD 30' })).toMatchObject({ sigla: 'CF-8769', componente: 'TRANSMISION' });
    expect(c('CF-769', { lubricante: 'MOBIL DELVAC EXTENDED LIFE C 50%' }).componente).toBe('REFRIGERANTE');
  });
  it('lo que no se puede saber no se adivina: da sigla null y el motivo', () => {
    for (const cod of ['MT', 'TM', 'MDFI', 'MDFD', 'CO-PH17M', '']) {
      const r = c(cod, { lubricante: 'MOBILTRANS HD 30' });
      expect(r.sigla).toBeNull();
      expect(r.motivo).not.toBe('');
    }
    expect(c('CE-85XYZ').sigla).toBeNull();
  });
});
