// Frescura de la lectura de horómetro (C.frescuraLectura / C.resumenFrescura / C.recalc, 2026-10-23): un equipo con la lectura vieja no debe verse como urgente, próximo ni al día.
import { describe, it, expect } from 'vitest';
const { C } = require('../logic.js');

const HOY = '2026-10-23';
const eq = (horomActual, fechaHorom, extra) => Object.assign({ sigla: 'X-1', tipo: 'Camion', horomActual, fechaHorom, frecPM: 250, hrsDia: 12 }, extra);
const hoyReal = () => new Date().toISOString().slice(0, 10);
const haceDias = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

describe('C.frescuraLectura', () => {
  it('vigente hasta 7 días (inclusive)', () => {
    expect(C.frescuraLectura(eq(1000, '2026-10-23'), HOY)).toEqual({ nivel: 'vigente', dias: 0 });
    expect(C.frescuraLectura(eq(1000, '2026-10-16'), HOY)).toEqual({ nivel: 'vigente', dias: 7 });
  });
  it('atrasada de 8 a 30 días (inclusive)', () => {
    expect(C.frescuraLectura(eq(1000, '2026-10-15'), HOY)).toEqual({ nivel: 'atrasada', dias: 8 });
    expect(C.frescuraLectura(eq(1000, '2026-09-23'), HOY)).toEqual({ nivel: 'atrasada', dias: 30 });
  });
  it('sin lectura a partir de 31 días', () => {
    expect(C.frescuraLectura(eq(1000, '2026-09-22'), HOY)).toEqual({ nivel: 'sin_lectura', dias: 31 });
    expect(C.frescuraLectura(eq(19203, '2026-08-25'), HOY)).toEqual({ nivel: 'sin_lectura', dias: 59 });
  });
  it('sin dato si el horómetro es 0, vacío o no numérico (equipo nuevo sin cargar)', () => {
    [0, null, undefined, '', 'abc', -5].forEach((h) => expect(C.frescuraLectura(eq(h, '2026-10-22'), HOY).nivel).toBe('sin_dato'));
  });
  it('con horómetro pero sin fecha válida: sin lectura (no se puede asegurar que sea reciente)', () => {
    ['', null, undefined, 'ayer', '2026-13'].forEach((f) => expect(C.frescuraLectura(eq(500, f), HOY)).toEqual({ nivel: 'sin_lectura', dias: null }));
  });
  it('una fecha futura no da días negativos', () => {
    expect(C.frescuraLectura(eq(500, '2026-10-30'), HOY)).toEqual({ nivel: 'vigente', dias: 0 });
  });
  it('acepta fecha con hora (ISO completo)', () => {
    expect(C.frescuraLectura(eq(500, '2026-10-20T14:00:00Z'), HOY).dias).toBe(3);
  });
});

describe('C.resumenFrescura', () => {
  it('cuenta cada nivel y da la lectura más reciente sin contar fechas futuras', () => {
    const lista = [eq(1, '2026-10-22', { sigla: 'A' }), eq(1, '2026-10-10', { sigla: 'B' }), eq(1, '2026-08-24', { sigla: 'C' }), eq(0, '2026-10-11', { sigla: 'D' }), eq(1, '2026-12-01', { sigla: 'E' }), { tipo: 'sin sigla' }];
    const r = C.resumenFrescura(lista, HOY);
    expect(r.total).toBe(5);
    expect(r.vigente.map((x) => x.sigla)).toEqual(['A', 'E']);
    expect(r.atrasada.map((x) => x.sigla)).toEqual(['B']);
    expect(r.sin_lectura.map((x) => x.sigla)).toEqual(['C']);
    expect(r.sin_dato.map((x) => x.sigla)).toEqual(['D']);
    expect(r.ultimaLectura).toBe('2026-10-22');
  });
  it('lista vacía o nula no revienta', () => {
    expect(C.resumenFrescura(null, HOY).total).toBe(0);
    expect(C.resumenFrescura([], HOY).ultimaLectura).toBeNull();
  });
});

describe('C.recalc con lectura vieja', () => {
  it('lectura de hoy: calcula estado y fecha de PM como siempre', () => {
    const e = eq(19203, hoyReal(), { hrsDia: 16, frecPM: 250 });
    C.recalc(e, 10);
    expect(e.estado).toBe('🔴 URGENTE');
    expect(e.diasParaPM).toBe(5);
    expect(e.fechaProxPM).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(e.lecturaNivel).toBe('vigente');
  });
  it('lectura de hace 59 días: sin estado de PM, sin fecha, 999 como «no se puede calcular»; conserva el próximo hito al último dato', () => {
    const e = eq(19203, haceDias(59), { hrsDia: 16, frecPM: 250 });
    C.recalc(e, 10);
    expect(e.estado).toBe('⚪ SIN LECTURA');
    expect(e.diasParaPM).toBe(999);
    expect(e.fechaProxPM).toBe('');
    expect(e.horomProxPM).toBe(19250);
    expect(e.hrsRestantes).toBe(47);
    expect(e.lecturaNivel).toBe('sin_lectura');
    expect(e.lecturaDias).toBe(59);
  });
  it('la fecha del próximo PM ya no se corre sola con el tiempo cuando no hay lectura nueva', () => {
    const e = eq(19203, haceDias(40), { hrsDia: 16, frecPM: 250 });
    C.recalc(e, 10);
    expect(e.fechaProxPM).toBe('');
  });
  it('equipo nuevo con horómetro 0: SIN DATO, nunca urgente', () => {
    const e = eq(0, hoyReal(), { hrsDia: 0 });
    C.recalc(e, 0);
    expect(e.estado).toBe('⚪ SIN DATO');
    expect(e.diasParaPM).toBe(999);
  });
  it('lectura atrasada (20 días): conserva el estado calculado y lo marca', () => {
    const e = eq(19203, haceDias(20), { hrsDia: 16, frecPM: 250 });
    C.recalc(e, 10);
    expect(e.estado).toBe('🔴 URGENTE');
    expect(e.lecturaNivel).toBe('atrasada');
  });
  it('actualizar el horómetro lo devuelve a la normalidad', () => {
    const e = eq(19203, haceDias(59), { hrsDia: 16 });
    C.recalc(e, 10);
    expect(e.estado).toBe('⚪ SIN LECTURA');
    e.horomActual = 19400; e.fechaHorom = hoyReal();
    C.recalc(e, 10);
    expect(e.estado).not.toMatch(/SIN /);
    expect(e.fechaProxPM).not.toBe('');
  });
});

describe('verificador de integridad', () => {
  const { verificarIntegridad } = require('../logic.js');
  it('no marca «estado desincronizado» a un equipo sin dato ni a uno sin lectura reciente', () => {
    const out = verificarIntegridad({
      eq: [
        { sigla: 'N-1', horomActual: 0, horomProxPM: 0, hrsRestantes: 0, estado: '⚪ SIN DATO' },
        { sigla: 'V-1', horomActual: 15518, horomProxPM: 15500, hrsRestantes: 18, estado: '⚪ SIN LECTURA' },
      ],
    });
    expect(out.some((h) => h.check === 'estadoDesincronizado')).toBe(false);
  });
  it('sigue marcando el caso real: horómetro vigente que ya alcanzó su PM y dice «al día»', () => {
    const out = verificarIntegridad({ eq: [{ sigla: 'CF-8769', horomActual: 15518, horomProxPM: 15500, hrsRestantes: 18, estado: '🟢 AL DÍA' }] });
    expect(out.some((h) => h.check === 'estadoDesincronizado')).toBe(true);
  });
});

describe('alerta-pm (edge function) usa los mismos umbrales que logic.js', () => {
  it('DIAS_LECTURA_VIGENTE / DIAS_LECTURA_MAX coinciden', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require('path').join(__dirname, '../supabase/functions/alerta-pm/index.ts'), 'utf8');
    expect(+src.match(/DIAS_LECTURA_VIGENTE = (\d+)/)[1]).toBe(C.DIAS_LECTURA_VIGENTE);
    expect(+src.match(/DIAS_LECTURA_MAX = (\d+)/)[1]).toBe(C.DIAS_LECTURA_MAX);
  });
});
