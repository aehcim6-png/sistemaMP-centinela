import { describe, it, expect } from 'vitest';
import { excelCodigoEstado } from '../logic.js';

// Código para conectar el Excel (2026-11-04): de la respuesta de Supabase Auth decide qué falta.
describe('excelCodigoEstado', () => {
  it('contraseña incorrecta → error claro', () => {
    expect(excelCodigoEstado({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, false))
      .toEqual({ estado: 'error', mensaje: 'La contraseña no es correcta.' });
  });
  it('CAPTCHA vencido → pide completarlo de nuevo', () => {
    const r = excelCodigoEstado({ code: 400, error_code: 'captcha_failed', msg: 'captcha protection' }, false);
    expect(r.estado).toBe('error');
    expect(r.mensaje).toMatch(/verificación de seguridad/);
  });
  it('sin respuesta → error', () => {
    expect(excelCodigoEstado(null, false).estado).toBe('error');
  });
  it('cuenta sin 2 pasos → entrega el refresh_token de la sesión nueva', () => {
    const r = excelCodigoEstado({ access_token: 'a1', refresh_token: 'rt-123', user: { factors: [] } }, false);
    expect(r).toEqual({ estado: 'listo', codigo: 'rt-123' });
  });
  it('cuenta con 2 pasos verificados → pide el código de 6 dígitos (no entrega una sesión aal1)', () => {
    const r = excelCodigoEstado({ access_token: 'aal1', refresh_token: 'rt-aal1',
      user: { factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] } }, false);
    expect(r).toEqual({ estado: 'mfa', factorId: 'f1', tokenAal1: 'aal1' });
  });
  it('factor 2 pasos sin verificar no bloquea', () => {
    const r = excelCodigoEstado({ access_token: 'a', refresh_token: 'rt',
      user: { factors: [{ id: 'f1', factor_type: 'totp', status: 'unverified' }] } }, false);
    expect(r.estado).toBe('listo');
  });
  it('después del segundo paso entrega el código', () => {
    expect(excelCodigoEstado({ access_token: 'aal2', refresh_token: 'rt-aal2', user: { factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] } }, true))
      .toEqual({ estado: 'listo', codigo: 'rt-aal2' });
  });
  it('código de 6 dígitos incorrecto → mensaje propio', () => {
    expect(excelCodigoEstado({ error: 'invalid code' }, true).mensaje).toMatch(/6 dígitos/);
  });
  it('respuesta sin refresh_token → error, no un código vacío', () => {
    expect(excelCodigoEstado({ access_token: 'a' }, false).estado).toBe('error');
  });
});
