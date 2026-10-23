// Clasificación asistida del componente con IA (2026-10-24): helpers puros (no llaman a la IA ni escriben nada).
import { describe, it, expect } from 'vitest';
import { limpiarTextoParaIA, pendientesClasificacionComponente, muestraParaAcuerdoIA, resumenAcuerdoIA } from '../logic.js';

describe('limpiarTextoParaIA', () => {
  it('quita el teléfono con que el historial de WhatsApp antepone cada mensaje', () => {
    expect(limpiarTextoParaIA('+56912345678: CN-9500 falla de turbo')).toBe('CN-9500 falla de turbo');
    expect(limpiarTextoParaIA('whatsapp:+56 9 1234 5678: cambio de cuchillas')).toBe('cambio de cuchillas');
  });
  it('quita teléfonos y correos sueltos, colapsa espacios y acota el largo', () => {
    expect(limpiarTextoParaIA('llamar al 56912345678 o a juan.perez@empresa.cl por   la fuga')).toBe('llamar al o a por la fuga');
    expect(limpiarTextoParaIA('x'.repeat(900)).length).toBe(400);
    expect(limpiarTextoParaIA(null)).toBe('');
  });
  it('deja intactos horómetros y códigos de equipo', () => {
    expect(limpiarTextoParaIA('CN-9500 hor 12345 cambio de filtro')).toBe('CN-9500 hor 12345 cambio de filtro');
  });
});

describe('pendientesClasificacionComponente', () => {
  const ot = [
    { _id: 'a', tipo: 'Correctivo', sigla: 'X', sintoma: 'ruido raro al acelerar', solucion: 'se revisa y queda ok' },       // no deducible → pendiente
    { _id: 'b', tipo: 'Correctivo', sigla: 'X', sintoma: 'falla de turbo' },                                                // el diccionario lo deduce → no
    { _id: 'c', tipo: 'Correctivo', sigla: 'X', sintoma: 'ruido raro', componente: 'Motor' },                               // ya tiene → no
    { _id: 'd', tipo: 'Engrase General', sigla: 'X', sintoma: 'cosa rara' },                                                 // no es correctivo → no
    { _id: 'e', tipo: 'Falla Operacional', sigla: 'X', sintoma: '' },                                                        // sin texto → no
  ];
  const hist = [
    { id: 'h1', sistema: '', descripcion: '+56911112222: se cambia turbo' },   // el diccionario lo deduce, igual está pendiente de sistema
    { id: 'h2', sistema: null, descripcion: 'mantención semanal' },
    { id: 'h3', sistema: 'Motor', descripcion: 'algo' },                        // ya tiene sistema → no
    { id: 'h4', sistema: '', descripcion: '   ' },                              // sin texto → no
  ];
  it('formales: sin componente cargado ni deducible, solo correctivos, con el texto limpio', () => {
    const r = pendientesClasificacionComponente(ot, hist);
    expect(r.formales.map((f) => f.id)).toEqual(['a']);
    expect(r.formales[0].texto).toBe('ruido raro al acelerar | se revisa y queda ok');
  });
  it('historial: sin sistema, con lo que deduciría el diccionario para compararlo y sin el teléfono', () => {
    const r = pendientesClasificacionComponente(ot, hist);
    expect(r.historico.map((f) => f.id)).toEqual(['h1', 'h2']);
    expect(r.historico[0].texto).toBe('se cambia turbo');
    expect(r.historico[0].reglas).toBe('Turbo');
    expect(r.historico[1].reglas).toBe('');
  });
  it('tolera entradas vacías', () => {
    expect(pendientesClasificacionComponente(null, undefined)).toEqual({ formales: [], historico: [] });
  });
});

describe('muestraParaAcuerdoIA y resumenAcuerdoIA', () => {
  const hist = Array.from({ length: 100 }, (_, i) => ({ id: 'id' + String(i).padStart(3, '0'), sistema: i % 2 ? 'Motor' : 'Turbo', descripcion: 'texto ' + i }));
  it('la muestra es reproducible, de a lo más n filas y solo de filas ya clasificadas', () => {
    const m1 = muestraParaAcuerdoIA(hist.concat([{ id: 'zz', sistema: '', descripcion: 'sin etiqueta' }]), 10);
    const m2 = muestraParaAcuerdoIA(hist.concat([{ id: 'zz', sistema: '', descripcion: 'sin etiqueta' }]), 10);
    expect(m1).toEqual(m2);
    expect(m1.length).toBe(10);
    expect(m1.every((m) => m.etiqueta)).toBe(true);
  });
  it('acuerdo: cuenta solo sugerencias con componente, por nivel de confianza, y lista los desacuerdos', () => {
    const muestra = [{ id: 'a', texto: 't1', etiqueta: 'Turbo' }, { id: 'b', texto: 't2', etiqueta: 'Motor' }, { id: 'c', texto: 't3', etiqueta: 'Frenos' }, { id: 'd', texto: 't4', etiqueta: 'Asiento' }];
    const sug = [
      { id: 'a', componente: 'Turbo', confianza: 'alta' },
      { id: 'b', componente: 'Transmisión', confianza: 'alta' },
      { id: 'c', componente: 'Frenos', confianza: 'media' },
      { id: 'd', componente: null, confianza: 'baja' },
    ];
    const r = resumenAcuerdoIA(muestra, sug);
    expect(r).toMatchObject({ n: 4, conSugerencia: 3, sinSugerencia: 1, acuerdos: 2, pctAcuerdo: 67, nAlta: 2, pctAlta: 50, nMedia: 1, pctMedia: 100, nBaja: 0, pctBaja: null });
    expect(r.desacuerdos).toEqual([{ texto: 't2', existente: 'Motor', ia: 'Transmisión', confianza: 'alta' }]);
  });
  it('sin sugerencias no inventa un porcentaje', () => {
    expect(resumenAcuerdoIA([{ id: 'a', texto: 't', etiqueta: 'Turbo' }], []).pctAcuerdo).toBeNull();
  });
});
