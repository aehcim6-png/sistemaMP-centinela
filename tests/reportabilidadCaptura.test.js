// Carga de la reportabilidad desde una CAPTURA (24-oct-2026): lo que lee la IA se limpia, se cruza con la flota y pasa por el mismo armado de lote que un Excel.
import { describe, it, expect } from 'vitest';
import { reportabilidadSiglaDeCaptura, reportabilidadDeCaptura, reportabilidadHojaDeCaptura, reportabilidadArmarLote, reportabilidadFusionar } from '../logic.js';

const PROG = ['CF-9510', 'CF-10162', 'CF-8769', 'CN-9503', 'CN-9501', 'CN-9500', 'CN-9502', 'CN-9507', 'CN-10159', 'CN-10160', 'CN-10155', 'BD-9533', 'BD-9509', 'BD-10139', 'MN-6112', 'MN-5926', 'CN-5131', 'CN-5133', 'TI-5141', 'TI-5142', 'TI-5146', 'BS-5752'];

describe('reportabilidadSiglaDeCaptura', () => {
  it('arregla espacios y ceros: «TI 5142», «CN9502», «CF-0162»', () => {
    expect(reportabilidadSiglaDeCaptura('TI 5142', PROG)).toEqual({ sigla: 'TI-5142', original: null });
    expect(reportabilidadSiglaDeCaptura('CN9502', PROG)).toEqual({ sigla: 'CN-9502', original: null });
    expect(reportabilidadSiglaDeCaptura('CF-0162', PROG)).toEqual({ sigla: 'CF-10162', original: null });
    expect(reportabilidadSiglaDeCaptura('CE-87', PROG)).toEqual({ sigla: 'CN-9500', original: null });
  });
  it('un dígito mal leído con una sola sigla del programa a un carácter se corrige y se avisa', () => {
    expect(reportabilidadSiglaDeCaptura('CF-3510', PROG)).toEqual({ sigla: 'CF-9510', original: 'CF-3510' });
  });
  it('un equipo ajeno al programa no se «corrige» a otro (CN-7578 / SXDG-73)', () => {
    expect(reportabilidadSiglaDeCaptura('CN-7578', PROG).sigla).toBe('CN-7578');
    expect(reportabilidadSiglaDeCaptura('SXDG-73', PROG).original).toBeNull();
  });
  it('si hay dos candidatas a un carácter no adivina', () => {
    expect(reportabilidadSiglaDeCaptura('CN-9505', ['CN-9503', 'CN-9507']).original).toBeNull();
  });
});

describe('reportabilidadDeCaptura', () => {
  const datos = {
    legible: true, formato: 'estatus', fecha: '23-11-2026', supervisor: 'MAICOL OROSTEGUI',
    filas: [
      { sigla: 'CF-9510', estatus: 'FS', fechaFS: '03-10-2026', comentario: 'FUGA REFRIGERANTE MOTOR', incierto: false },
      { sigla: 'CF-8769', estatus: 'OP', fechaFS: null, comentario: null, incierto: false },
      { sigla: 'CN-9503', estatus: 'FS', fechaFS: '23-10-2026', comentario: 'MANTENCION NO PROGRAMADA', incierto: false },
      { sigla: 'TI 5142', estatus: 'FS', fechaFS: '14-10-2026', comentario: 'PIOLA CORTADA', incierto: false },
      { sigla: 'CN-5131', estatus: 'OP', fechaFS: null, comentario: null, incierto: true },
      { sigla: 'CN-5131', estatus: 'FS', fechaFS: '22-10-2026', comentario: 'duplicada', incierto: false },
    ],
  };
  const r = reportabilidadDeCaptura(datos, { hoy: '2026-10-23', siglasPrograma: PROG, archivo: 'captura.jpg' });
  it('detecta una fecha de encabezado en el futuro y sugiere la del mes anterior que calza con las fechas de detención', () => {
    expect(r.fechaLeida).toBe('2026-11-23');
    expect(r.fechaFutura).toBe(true);
    expect(r.fechaSugerida).toBe('2026-10-23');
  });
  it('cuenta OP y FS, avisa duplicados e inciertas, y lista los equipos del programa que no salen en la captura', () => {
    expect(r.nFS).toBe(3);
    expect(r.nOP).toBe(2);
    expect(r.duplicadas).toEqual(['CN-5131']);
    expect(r.inciertas).toBe(1);
    expect(r.faltan).toContain('BS-5752');
    expect(r.faltan).not.toContain('CF-9510');
    expect(r.filas.find((f) => f.sigla === 'TI-5142').fechaDetencion).toBe('2026-10-14');
  });
  it('una fecha normal no se marca como futura', () => {
    const ok = reportabilidadDeCaptura({ legible: true, fecha: '24-09-2026', filas: [{ sigla: 'CF-9510', estatus: 'OP', incierto: false }] }, { hoy: '2026-10-23', siglasPrograma: PROG });
    expect(ok.fechaFutura).toBe(false);
    expect(ok.fechaSugerida).toBeNull();
  });
  it('entradas vacías no fallan', () => {
    const v = reportabilidadDeCaptura(null, { siglasPrograma: PROG });
    expect(v.filas).toEqual([]);
    expect(v.faltan.length).toBe(PROG.length);
  });
});

describe('hoja de captura + armado de lote (mismo camino que un Excel)', () => {
  const cap = reportabilidadDeCaptura({
    legible: true, fecha: '23-11-2026', filas: [
      { sigla: 'CF-9510', estatus: 'FS', fechaFS: '03-10-2026', comentario: 'FUGA', incierto: false },
      { sigla: 'CF-8769', estatus: 'OP', incierto: false },
      { sigla: 'CN-7578', estatus: 'OP', incierto: false },
      { sigla: 'CN-9500', estatus: null, incierto: true },
    ],
  }, { hoy: '2026-10-23', siglasPrograma: PROG, archivo: 'c.jpg' });
  it('usa la fecha confirmada por la persona, no la leída', () => {
    const hoja = reportabilidadHojaDeCaptura(cap, '2026-10-23');
    expect(hoja.nombre).toBe('23-10-2026');
    const lote = reportabilidadArmarLote([hoja], { anio: 2026, siglasPrograma: PROG });
    expect(lote.filas.map((f) => f.fecha)).toEqual(['2026-10-23', '2026-10-23']);
    expect(lote.filas.find((f) => f.sigla === 'CF-9510')).toMatchObject({ estatus: 'FS', fechaDetencion: '2026-10-03', observacion: 'FUGA' });
  });
  it('un equipo fuera del programa no se carga, y una fila sin estatus legible tampoco', () => {
    const lote = reportabilidadArmarLote([reportabilidadHojaDeCaptura(cap, '2026-10-23')], { anio: 2026, siglasPrograma: PROG });
    expect(Object.keys(lote.desconocidas)).toEqual(['CN-7578']);
    expect(lote.filas.find((f) => f.sigla === 'CN-9500')).toBeUndefined();
  });
  it('cargar de nuevo lo mismo no cambia nada (clave fecha+sigla)', () => {
    const lote = reportabilidadArmarLote([reportabilidadHojaDeCaptura(cap, '2026-10-23')], { anio: 2026, siglasPrograma: PROG });
    const guardadas = lote.filas.map((f, i) => Object.assign({ _id: 'x' + i }, f));
    const fus = reportabilidadFusionar(guardadas, lote.filas);
    expect(fus.insertar.length).toBe(0);
    expect(fus.actualizar.length).toBe(0);
    expect(fus.iguales).toBe(2);
  });
  it('sin fecha no hay hoja', () => {
    expect(reportabilidadHojaDeCaptura(reportabilidadDeCaptura({ legible: true, filas: [] }, {}), null)).toBeNull();
  });
});
