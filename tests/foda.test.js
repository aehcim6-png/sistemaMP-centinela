import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { fodaCruceDe, fodaCodigos, fodaResumen, fodaEstrategiaError, fodaTasaFallaPorEquipo, fodaSugerencias, FODA_CRUCES, FODA_ESTADOS } = require('../logic.js');

const items = [
  { ref: 'a', tipo: 'F', texto: 'Historial propio', puntaje: 4 },
  { ref: 'b', tipo: 'F', texto: 'Equipo comprometido', puntaje: 5 },
  { ref: 'c', tipo: 'D', texto: 'Rotación del personal', puntaje: 3 },
  { ref: 'd', tipo: 'O', texto: 'Nueva tecnología', puntaje: 2 },
  { ref: 'e', tipo: 'A', texto: 'Nuevos competidores', puntaje: 5 },
];

describe('fodaCruceDe', () => {
  it('interna con externa da el cruce de la plantilla', () => {
    expect(fodaCruceDe('F', 'O')).toBe('FO');
    expect(fodaCruceDe('F', 'A')).toBe('FA');
    expect(fodaCruceDe('D', 'O')).toBe('DO');
    expect(fodaCruceDe('D', 'A')).toBe('DA');
  });
  it('dos internas, dos externas o al revés no se pueden cruzar', () => {
    expect(fodaCruceDe('F', 'D')).toBeNull();
    expect(fodaCruceDe('O', 'A')).toBeNull();
    expect(fodaCruceDe('O', 'F')).toBeNull();
    expect(fodaCruceDe(undefined, 'O')).toBeNull();
  });
  it('los cuatro cruces tienen nombre y pregunta', () => {
    Object.keys(FODA_CRUCES).forEach((k) => {
      expect(FODA_CRUCES[k].nombre).toMatch(/\(/);
      expect(FODA_CRUCES[k].pregunta).toMatch(/\?$/);
    });
  });
});

describe('fodaCodigos', () => {
  it('numera dentro de cada tipo en el orden de la lista', () => {
    expect(fodaCodigos(items)).toEqual({ a: 'F1', b: 'F2', c: 'D1', d: 'O1', e: 'A1' });
  });
  it('ignora lo que no tiene ref o tiene un tipo desconocido', () => {
    expect(fodaCodigos([{ tipo: 'F' }, { ref: 'x', tipo: 'Z' }, null])).toEqual({});
  });
});

describe('fodaResumen', () => {
  it('cuenta, suma puntaje y saca el porcentaje de cada tipo', () => {
    const r = fodaResumen(items, []);
    expect(r.total).toBe(5);
    expect(r.porTipo.F).toEqual({ n: 2, puntos: 9, pct: 40 });
    expect(r.porTipo.D).toEqual({ n: 1, puntos: 3, pct: 20 });
    expect(r.porTipo.O.puntos).toBe(2);
    expect(r.porTipo.A.puntos).toBe(5);
  });
  it('un puntaje fuera de 1 a 5 cuenta como 3 (no rompe el gráfico)', () => {
    expect(fodaResumen([{ ref: 'x', tipo: 'F', puntaje: 99 }, { ref: 'y', tipo: 'F' }], []).porTipo.F.puntos).toBe(6);
  });
  it('sin ítems no divide por cero', () => {
    const r = fodaResumen([], []);
    expect(r.total).toBe(0);
    expect(r.porTipo.F.pct).toBe(0);
  });
  it('cuenta los planes por estado y trata un estado raro como Pendiente', () => {
    const r = fodaResumen(items, [{ refA: 'a', refB: 'd', estado: 'Culminado' }, { refA: 'b', refB: 'e', estado: 'En proceso' }, { refA: 'c', refB: 'e', estado: '???' }]);
    expect(r.planes).toBe(3);
    expect(r.estados).toEqual({ 'Pendiente': 1, 'En proceso': 1, 'Culminado': 1 });
  });
  it('lista los ítems que aún no tienen ninguna estrategia', () => {
    const r = fodaResumen(items, [{ refA: 'a', refB: 'd', estado: 'Pendiente' }]);
    expect(r.sinEstrategia.sort()).toEqual(['b', 'c', 'e']);
  });
});

describe('fodaEstrategiaError', () => {
  const ok = { refA: 'a', refB: 'd', cruce: 'FO', texto: 'Ampliar el uso de telemetría', estado: 'Pendiente' };
  it('una estrategia bien armada no tiene error', () => {
    expect(fodaEstrategiaError(ok, items)).toBe('');
  });
  it('pide los dos ítems y que se puedan cruzar', () => {
    expect(fodaEstrategiaError({ ...ok, refA: 'zzz' }, items)).toMatch(/fortaleza o debilidad/);
    expect(fodaEstrategiaError({ ...ok, refB: 'zzz' }, items)).toMatch(/oportunidad o amenaza/);
    expect(fodaEstrategiaError({ ...ok, refA: 'a', refB: 'b' }, items)).toMatch(/cruzar/);
  });
  it('el cruce declarado debe coincidir con los ítems', () => {
    expect(fodaEstrategiaError({ ...ok, cruce: 'DA' }, items)).toMatch(/no coincide/);
  });
  it('exige texto, estado válido y fecha con formato', () => {
    expect(fodaEstrategiaError({ ...ok, texto: ' ab ' }, items)).toMatch(/Describe/);
    expect(fodaEstrategiaError({ ...ok, estado: 'Listo' }, items)).toMatch(/estado/);
    expect(fodaEstrategiaError({ ...ok, fechaCompromiso: '12/11/2026' }, items)).toMatch(/fecha/);
    expect(fodaEstrategiaError({ ...ok, fechaCompromiso: '2026-11-30' }, items)).toBe('');
  });
  it('los tres estados son los de la plantilla', () => {
    expect(FODA_ESTADOS).toEqual(['Pendiente', 'En proceso', 'Culminado']);
  });
});

describe('fodaTasaFallaPorEquipo', () => {
  const hist = [
    { sigla: 'X', fecha: '2026-01-01', horom: 1000 }, { sigla: 'X', fecha: '2026-06-01', horom: 3000 },
    { sigla: 'Y', fecha: '2026-01-01', horom: 500 }, { sigla: 'Y', fecha: '2026-06-01', horom: 900 },
    { sigla: 'Z', fecha: '2025-01-01', horom: 10 }, { sigla: 'Z', fecha: '2025-02-01', horom: 5000 },
  ];
  const fallas = [{ sigla: 'X', fecha: '2026-02-01' }, { sigla: 'X', fecha: '2026-03-01' }, { sigla: 'Y', fecha: '2026-02-01' }, { sigla: 'X', fecha: '2024-01-01' }];
  it('fallas por 1.000 h en el periodo, ordenado de mayor a menor', () => {
    const r = fodaTasaFallaPorEquipo(fallas, hist, '2026-01-01', '2026-12-31');
    expect(r).toEqual([{ sigla: 'X', fallas: 2, horas: 2000, tasa: 1 }]);
  });
  it('un equipo con menos de 1.000 h en el periodo no entra (la tasa engañaría)', () => {
    expect(fodaTasaFallaPorEquipo(fallas, hist, '2026-01-01', '2026-12-31').some((t) => t.sigla === 'Y')).toBe(false);
    expect(fodaTasaFallaPorEquipo(fallas, hist, '2026-01-01', '2026-12-31', 300).some((t) => t.sigla === 'Y')).toBe(true);
  });
  it('lo que cae fuera del periodo no cuenta', () => {
    expect(fodaTasaFallaPorEquipo(fallas, hist, '2026-01-01', '2026-12-31')[0].fallas).toBe(2);
  });
});

describe('fodaSugerencias', () => {
  // 8 equipos con 1.500 h cada uno en 2026; E1..E3 con muchas fallas, E4..E8 con pocas.
  const hist = [];
  const otHist = [];
  for (let i = 1; i <= 8; i++) {
    hist.push({ sigla: 'E' + i, fecha: '2026-01-01', horom: 1000 }, { sigla: 'E' + i, fecha: '2026-06-01', horom: 2500 });
    const n = i <= 3 ? 12 : 1;
    for (let k = 0; k < n; k++) otHist.push({ sigla: 'E' + i, fecha: '2026-0' + (2 + (k % 5)) + '-10', sistema: i <= 3 ? 'Sistema Eléctrico' : 'Neumáticos', tipoInt: 'Correctiva', claseOT: 'correctiva', descripcion: 'falla' });
  }
  // relleno de rutina marcada «Correctiva» y de historial viejo, para pasar los umbrales de volumen
  for (let k = 0; k < 600; k++) otHist.push({ sigla: 'E1', fecha: '2024-0' + (1 + (k % 9)) + '-05', tipoInt: 'Correctiva', claseOT: 'preventiva', descripcion: 'Control de neumáticos' });
  const sug = fodaSugerencias({ otHist, hist, hoy: '2026-11-08' });
  const claves = sug.map((s) => s.clave);
  it('propone el historial propio como fortaleza, con años y volumen reales', () => {
    const s = sug.find((x) => x.clave === 'historial-propio');
    expect(s.tipo).toBe('F');
    expect(s.texto).toMatch(/2,\d años/);
    expect(s.texto).toContain(otHist.length + ' órdenes de trabajo');
  });
  it('propone como debilidad la rutina marcada como correctiva, con su porcentaje', () => {
    const s = sug.find((x) => x.clave === 'rutina-como-correctivo');
    expect(s.tipo).toBe('D');
    expect(s.texto).toMatch(/\d+ %/);
  });
  it('avisa si los correctivos cargados están desactualizados', () => {
    const s = sug.find((x) => x.clave === 'correctivos-desactualizados');
    expect(s.texto).toContain('hasta el 10-06-2026');
    expect(fodaSugerencias({ otHist, hist, hoy: '2026-06-20' }).some((x) => x.clave === 'correctivos-desactualizados')).toBe(false);
  });
  it('nombra los tres equipos con más fallas por hora y los de pocas fallas', () => {
    const a = sug.find((x) => x.clave === 'equipos-mas-fallas');
    expect(a.texto).toMatch(/E1 .*E2 .*E3/);
    const b = sug.find((x) => x.clave === 'equipos-pocas-fallas');
    expect(b.tipo).toBe('F');
    expect(b.texto).toContain('5 de 8 equipos');
  });
  it('solo propone fortalezas y debilidades (lo externo no sale de los datos)', () => {
    sug.forEach((s) => expect(['F', 'D']).toContain(s.tipo));
    expect(new Set(claves).size).toBe(claves.length);
  });
  it('sin datos suficientes no propone nada', () => {
    expect(fodaSugerencias({})).toEqual([]);
    // con 20 filas y sin horómetros solo se puede decir lo que no necesita volumen: que los datos están viejos
    expect(fodaSugerencias({ otHist: otHist.slice(0, 20), hist: [], hoy: '2026-11-08' }).map((x) => x.clave)).toEqual(['correctivos-desactualizados']);
    expect(fodaSugerencias({ otHist: otHist.slice(0, 20), hist: [], hoy: '2026-06-11' })).toEqual([]);
  });
  it('la fecha de hoy es solo una entrada: no depende del reloj', () => {
    expect(fodaSugerencias({ otHist, hist, hoy: '2026-11-08' })).toEqual(sug);
  });
});
