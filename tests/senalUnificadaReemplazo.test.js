import { describe, it, expect } from 'vitest';
import { senalUnificadaReemplazo } from '../logic.js';

describe('senalUnificadaReemplazo', () => {
  it('null si ninguna señal tiene dato', () => {
    expect(senalUnificadaReemplazo({ sigla: 'CN-1' })).toBeNull();
    expect(senalUnificadaReemplazo({})).toBeNull();
  });

  it('candidato=true con exactamente 4 de 6 señales encendidas (umbral)', () => {
    const r = senalUnificadaReemplazo({
      sigla: 'CN-1',
      weibullBeta: 2.0, // encendida (>1.5)
      tieneComponenteRiesgoAlto: true, // encendida
      esReincidente: true, // encendida
      alertaCruzadaSeverity: 6, // encendida (>=5)
      edadVirtualFactorQ: 0.2, // apagada (<0.67)
      costoRelativoPct: 3, // apagada (<15)
    });
    expect(r).not.toBeNull();
    expect(r.nEvaluables).toBe(6);
    expect(r.nEncendidas).toBe(4);
    expect(r.candidato).toBe(true);
  });

  it('candidato=false con solo 3 de 6 encendidas (bajo el umbral)', () => {
    const r = senalUnificadaReemplazo({
      sigla: 'CN-2',
      weibullBeta: 2.0,
      tieneComponenteRiesgoAlto: true,
      esReincidente: true,
      alertaCruzadaSeverity: 1,
      edadVirtualFactorQ: 0.1,
      costoRelativoPct: 2,
    });
    expect(r.nEncendidas).toBe(3);
    expect(r.candidato).toBe(false);
  });

  it('una señal en null no cuenta ni a favor ni en contra (no infla el conteo)', () => {
    const r = senalUnificadaReemplazo({
      sigla: 'CN-3',
      weibullBeta: null, // sin dato, no evaluable
      tieneComponenteRiesgoAlto: true,
      esReincidente: true,
      alertaCruzadaSeverity: 6,
      edadVirtualFactorQ: null, // sin dato
      costoRelativoPct: null, // sin dato
    });
    expect(r.nEvaluables).toBe(3);
    expect(r.nEncendidas).toBe(3);
    expect(r.candidato).toBe(false); // 3 < 4, aunque sea el 100% de lo evaluable
  });

  it('umbrales exactos: weibullBeta=1.5 NO enciende (estrictamente mayor)', () => {
    const r = senalUnificadaReemplazo({ sigla: 'CN-4', weibullBeta: 1.5 });
    expect(r.senales.find(s => s.clave === 'weibull').activa).toBe(false);
  });

  it('umbrales exactos: alertaCruzadaSeverity=5 SÍ enciende (mayor o igual)', () => {
    const r = senalUnificadaReemplazo({ sigla: 'CN-5', alertaCruzadaSeverity: 5 });
    expect(r.senales.find(s => s.clave === 'alertaCruzada').activa).toBe(true);
  });

  it('umbrales exactos: edadVirtualFactorQ=0.67 y costoRelativoPct=15 SÍ encienden', () => {
    const r = senalUnificadaReemplazo({ sigla: 'CN-6', edadVirtualFactorQ: 0.67, costoRelativoPct: 15 });
    expect(r.senales.find(s => s.clave === 'edadVirtual').activa).toBe(true);
    expect(r.senales.find(s => s.clave === 'costoRelativo').activa).toBe(true);
  });

  it('candidato=true con las 6 señales encendidas', () => {
    const r = senalUnificadaReemplazo({
      sigla: 'CN-7',
      weibullBeta: 3, tieneComponenteRiesgoAlto: true, esReincidente: true,
      alertaCruzadaSeverity: 8, edadVirtualFactorQ: 0.9, costoRelativoPct: 25,
    });
    expect(r.nEncendidas).toBe(6);
    expect(r.candidato).toBe(true);
    expect(r.encendidasNombres.length).toBe(6);
  });

  it('candidato=false con las 6 señales apagadas (pero todas evaluables)', () => {
    const r = senalUnificadaReemplazo({
      sigla: 'CN-8',
      weibullBeta: 0.8, tieneComponenteRiesgoAlto: false, esReincidente: false,
      alertaCruzadaSeverity: 0, edadVirtualFactorQ: 0, costoRelativoPct: 1,
    });
    expect(r.nEvaluables).toBe(6);
    expect(r.nEncendidas).toBe(0);
    expect(r.candidato).toBe(false);
  });

  it('conserva la sigla en el resultado', () => {
    const r = senalUnificadaReemplazo({ sigla: 'BD-9509', weibullBeta: 2 });
    expect(r.sigla).toBe('BD-9509');
  });
});
