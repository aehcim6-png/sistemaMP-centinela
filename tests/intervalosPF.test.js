import { describe, it, expect } from 'vitest';
import { intervalosPF, _normalizarComponente } from '../logic.js';

function grupo(sigla, componente, porMetal) {
  return { sigla, componente, porMetal };
}

describe('_normalizarComponente', () => {
  it('sube a mayúsculas y quita tildes/ñ para que formatos distintos crucen', () => {
    expect(_normalizarComponente('Transmisión')).toBe('TRANSMISION');
    expect(_normalizarComponente('TRANSMISION')).toBe('TRANSMISION');
    expect(_normalizarComponente('  Motor  ')).toBe('MOTOR');
    expect(_normalizarComponente('Dirección')).toBe('DIRECCION');
    expect(_normalizarComponente('Compresor A/C')).toBe('COMPRESOR A/C');
    expect(_normalizarComponente(null)).toBe('');
    expect(_normalizarComponente(undefined)).toBe('');
  });
});

describe('intervalosPF', () => {
  it('array vacío sin grupos ni correctivos', () => {
    expect(intervalosPF([], [])).toEqual([]);
    expect(intervalosPF(undefined, undefined)).toEqual([]);
  });

  it('ignora grupos sin ningún metal detectado', () => {
    const grupos = [grupo('CN-9501', 'Motor', { Fe: { detectado: false } })];
    const ot = [{ sigla: 'CN-9501', componente: 'Motor', fecha: '2024-02-01' }];
    expect(intervalosPF(grupos, ot)).toEqual([]);
  });

  it('ignora grupos detectados sin fechaAlerta', () => {
    const grupos = [grupo('CN-9501', 'Motor', { Fe: { detectado: true, fechaAlerta: null } })];
    const ot = [{ sigla: 'CN-9501', componente: 'Motor', fecha: '2024-02-01' }];
    expect(intervalosPF(grupos, ot)).toEqual([]);
  });

  it('sin correctivo posterior real, el componente no aparece (nunca inventa un P-F)', () => {
    const grupos = [grupo('CN-9501', 'Motor', { Fe: { detectado: true, fechaAlerta: '2024-01-01' } })];
    expect(intervalosPF(grupos, [])).toEqual([]);
    // correctivo existe pero es ANTES de la alerta -> no cuenta
    const ot = [{ sigla: 'CN-9501', componente: 'Motor', fecha: '2023-12-01' }];
    expect(intervalosPF(grupos, ot)).toEqual([]);
  });

  it('ignora correctivos de otro componente o de otro equipo', () => {
    const grupos = [grupo('CN-9501', 'Motor', { Fe: { detectado: true, fechaAlerta: '2024-01-01' } })];
    const ot = [
      { sigla: 'CN-9501', componente: 'Transmisión', fecha: '2024-01-10' },
      { sigla: 'CN-9502', componente: 'Motor', fecha: '2024-01-10' },
    ];
    expect(intervalosPF(grupos, ot)).toEqual([]);
  });

  it('calcula el P-F real y recomienda la mitad como intervalo de inspección', () => {
    const grupos = [grupo('CN-9501', 'Motor', { Fe: { detectado: true, fechaAlerta: '2024-01-01' } })];
    const ot = [{ sigla: 'CN-9501', componente: 'Motor', fecha: '2024-01-21' }]; // 20 días después
    const r = intervalosPF(grupos, ot);
    expect(r).toHaveLength(1);
    expect(r[0].componente).toBe('Motor');
    expect(r[0].nEventos).toBe(1);
    expect(r[0].pfMediana).toBe(20);
    expect(r[0].intervaloInspeccionRecomendado).toBe(10);
  });

  it('toma el correctivo MÁS CERCANO después de la alerta, no cualquiera', () => {
    const grupos = [grupo('CN-9501', 'Motor', { Fe: { detectado: true, fechaAlerta: '2024-01-01' } })];
    const ot = [
      { sigla: 'CN-9501', componente: 'Motor', fecha: '2024-03-01' }, // más lejano
      { sigla: 'CN-9501', componente: 'Motor', fecha: '2024-01-11' }, // 10 días, el correcto
    ];
    const r = intervalosPF(grupos, ot);
    expect(r[0].pfMediana).toBe(10);
  });

  it('descarta un P-F fuera de la ventana máxima (correctivo probablemente no relacionado)', () => {
    const grupos = [grupo('CN-9501', 'Motor', { Fe: { detectado: true, fechaAlerta: '2024-01-01' } })];
    const ot = [{ sigla: 'CN-9501', componente: 'Motor', fecha: '2025-06-01' }]; // >365 días
    expect(intervalosPF(grupos, ot)).toEqual([]);
    expect(intervalosPF(grupos, ot, 1000)).toHaveLength(1); // con ventana más ancha, sí cuenta
  });

  it('agrupa por componente entre varios equipos y promedia', () => {
    const grupos = [
      grupo('CN-9501', 'Motor', { Fe: { detectado: true, fechaAlerta: '2024-01-01' } }),
      grupo('CN-9502', 'Motor', { Fe: { detectado: true, fechaAlerta: '2024-02-01' } }),
    ];
    const ot = [
      { sigla: 'CN-9501', componente: 'Motor', fecha: '2024-01-11' }, // 10 días
      { sigla: 'CN-9502', componente: 'Motor', fecha: '2024-02-21' }, // 20 días
    ];
    const r = intervalosPF(grupos, ot);
    expect(r[0].nEventos).toBe(2);
    expect(r[0].pfMediana).toBe(15);
    expect(r[0].pfPromedio).toBe(15);
  });

  it('separa componentes distintos y ordena por menor intervalo recomendado primero', () => {
    const grupos = [
      grupo('CN-9501', 'Motor', { Fe: { detectado: true, fechaAlerta: '2024-01-01' } }),
      grupo('CN-9502', 'Transmisión', { Fe: { detectado: true, fechaAlerta: '2024-01-01' } }),
    ];
    const ot = [
      { sigla: 'CN-9501', componente: 'Motor', fecha: '2024-01-31' }, // 30 días -> recom 15
      { sigla: 'CN-9502', componente: 'Transmisión', fecha: '2024-01-11' }, // 10 días -> recom 5
    ];
    const r = intervalosPF(grupos, ot);
    expect(r.map((x) => x.componente)).toEqual(['Transmisión', 'Motor']);
  });

  it('cruza componentes con formato distinto entre analisis_aceite y correctivos (mayúsculas/tildes)', () => {
    // Caso real: analisis_aceite guarda "TRANSMISION" (mayúsculas, sin tilde);
    // correctivos guarda "Transmisión" (como lo eligió la persona en el
    // selector). Sin normalizar, esto nunca cruza aunque sea el mismo
    // componente real.
    const grupos = [grupo('CN-9501', 'TRANSMISION', { Fe: { detectado: true, fechaAlerta: '2024-01-01' } })];
    const ot = [{ sigla: 'CN-9501', componente: 'Transmisión', fecha: '2024-01-11' }];
    const r = intervalosPF(grupos, ot);
    expect(r).toHaveLength(1);
    expect(r[0].pfMediana).toBe(10);
  });

  it('no muta los arreglos originales (pura)', () => {
    const grupos = [grupo('CN-9501', 'Motor', { Fe: { detectado: true, fechaAlerta: '2024-01-01' } })];
    const ot = [{ sigla: 'CN-9501', componente: 'Motor', fecha: '2024-01-11' }];
    const gruposCopia = JSON.parse(JSON.stringify(grupos));
    const otCopia = JSON.parse(JSON.stringify(ot));
    intervalosPF(grupos, ot);
    expect(grupos).toEqual(gruposCopia);
    expect(ot).toEqual(otCopia);
  });
});
