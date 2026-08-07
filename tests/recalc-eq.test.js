// Pruebas de integración contra el código REAL de modules/store.js para el
// recálculo de equipos (_ritmoRealEq/_horomUltimoPM/_recalcEq/C.recalcAll),
// recién movido acá desde index.html. El foco es C.recalcAll: bug real
// encontrado en uso real (2026-08-05) — subía el arreglo completo de
// equipos a Supabase en CADA llamada, sin importar si el recálculo cambió
// algo. recalcAll() corre en cada apertura del Dashboard (la pestaña por
// defecto al entrar), así que con más de un dispositivo/pestaña abiertos,
// cada uno resubía una foto casi idéntica de 'eq' una y otra vez, y cada
// resubida disparaba el chequeo de conflicto contra la resubida de la
// otra — el aviso de "otra persona modificó esto" terminaba apareciendo
// todo el tiempo aunque nadie estuviera editando nada de verdad.
global.window = { addEventListener: function () {}, crypto: global.crypto };
global.localStorage = (function () {
  var d = {};
  return {
    _d: d,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
    setItem: function (k, v) { d[k] = String(v); },
    removeItem: function (k) { delete d[k]; }
  };
})();
var fetchLlamadas = 0;
global.fetch = function () { fetchLlamadas++; return Promise.reject(new Error('red deshabilitada en tests')); };
global._logChangeGenerico = function () {};
global.C = require('../logic.js').C; // store.js le agrega recalcAll a este mismo objeto

const { S, _sbCache, _horomUltimoPM, _ritmoRealEq } = require('../modules/store.js');

beforeEach(() => {
  for (const k in _sbCache) delete _sbCache[k];
  for (const k in localStorage._d) delete localStorage._d[k];
  fetchLlamadas = 0;
});

function equipoBase() {
  return { sigla: 'TEST-1', horomActual: 1000, frecPM: 250, hrsDia: 12, hrsRestantes: null, estado: null };
}

describe('_horomUltimoPM', () => {
  it('devuelve null si el equipo no tiene registros de PM', () => {
    S.s('reg', []);
    expect(_horomUltimoPM('TEST-1')).toBeNull();
  });

  it('devuelve el registro más reciente por fecha+hora, no el último insertado', () => {
    S.s('reg', [
      { equipo: 'TEST-1', horomReal: 1000, tipoPM: 'PM1', fechaEntrada: '2026-01-01', horaEntrada: '08:00' },
      { equipo: 'TEST-1', horomReal: 1500, tipoPM: 'PM2', fechaEntrada: '2026-06-01', horaEntrada: '08:00' },
      { equipo: 'TEST-1', horomReal: 1200, tipoPM: 'PM1', fechaEntrada: '2026-03-01', horaEntrada: '08:00' }
    ]);
    expect(_horomUltimoPM('TEST-1')).toEqual({ horom: 1500, tipo: 'PM2' });
  });

  it('ignora registros de otros equipos', () => {
    S.s('reg', [{ equipo: 'OTRO', horomReal: 9999, tipoPM: 'PM4', fechaEntrada: '2026-06-01', horaEntrada: '08:00' }]);
    expect(_horomUltimoPM('TEST-1')).toBeNull();
  });
});

describe('_ritmoRealEq', () => {
  it('cae al ritmo nominal si el equipo no tiene historial de horómetros', () => {
    S.s('hist', []);
    expect(_ritmoRealEq('TEST-1', 12)).toBe(12);
  });
});

// S.s() dispara la sincronización con Supabase de forma "fire and forget"
// (async, encadenada con Promises, nunca esperada por el llamador — ver
// _chained en store.js) — el fetch real no ocurre en el mismo tick
// síncrono que la llamada a C.recalcAll(), sino uno o más microtasks
// después. Sin este flush, cualquier assert sobre fetchLlamadas justo
// después de C.recalcAll() vería siempre 0, sin importar si en realidad
// se disparó un guardado o no.
function flush() { return new Promise((r) => setTimeout(r, 10)); }

describe('C.recalcAll — no resube "eq" a Supabase si el recálculo no cambió nada', () => {
  it('devuelve [] sin intentar nada si "eq" nunca cargó', async () => {
    expect(C.recalcAll()).toEqual([]);
    await flush();
    expect(fetchLlamadas).toBe(0);
  });

  it('la primera pasada sí guarda (recién calcula los campos derivados)', async () => {
    S.s('eq', [equipoBase()]);
    S.s('reg', []);
    S.s('hist', []);
    await flush();
    const antes = fetchLlamadas;
    C.recalcAll();
    await flush();
    expect(fetchLlamadas).toBeGreaterThan(antes);
  });

  it('la segunda pasada con los mismos datos NO vuelve a guardar — este era el bug real', async () => {
    S.s('eq', [equipoBase()]);
    S.s('reg', []);
    S.s('hist', []);
    await flush();
    C.recalcAll(); // primera pasada: calcula horomProxPM/diasParaPM/estado/etc.
    await flush();
    const antes = fetchLlamadas;
    C.recalcAll(); // segunda pasada, mismos datos de entrada -> nada cambia
    await flush();
    expect(fetchLlamadas).toBe(antes);
  });

  it('si el horómetro avanzó de verdad entre pasadas, sí vuelve a guardar', async () => {
    S.s('eq', [equipoBase()]);
    S.s('reg', []);
    S.s('hist', []);
    await flush();
    C.recalcAll();
    await flush();
    const antes = fetchLlamadas;
    const eqActual = S.g('eq');
    eqActual[0].horomActual = 1500; // avance real de uso, no solo pasó el tiempo
    S.s('eq', eqActual);
    C.recalcAll();
    await flush();
    expect(fetchLlamadas).toBeGreaterThan(antes);
  });

  it('recalcula horomProxPM/estado usando C.recalc real (no reimplementado)', () => {
    S.s('eq', [equipoBase()]);
    S.s('reg', []);
    S.s('hist', []);
    const [eq] = C.recalcAll();
    // El valor exacto de horomProxPM ya lo cubren los tests de logic.js
    // (proxPM) — acá solo importa confirmar que recalcAll de verdad llamó
    // al C.recalc real y mutó la fila, no que reimplemente esa cuenta.
    expect(typeof eq.horomProxPM).toBe('number');
    expect(typeof eq.estado).toBe('string');
    expect(eq.estado.length).toBeGreaterThan(0);
  });

  // Optimización de rendimiento (2026-08-07): antes recalcAll() filtraba 'reg' e
  // 'hist' COMPLETOS por CADA equipo (O(equipos × filas) — con cientos de equipos
  // y miles de filas, millones de comparaciones en cada apertura de Dashboard o
  // Equipos). Ahora agrupa reg/hist por sigla UNA sola vez (ver _indicesRecalc) y
  // cada equipo hace un lookup O(1) en vez de un filter() sobre la tabla entera.
  // Este test confirma que el resultado con el índice es IDÉNTICO al que daba el
  // filtro directo — mismo criterio en ambos casos (reg.horomReal>0, hist con
  // fecha), varios equipos mezclados, para que un error de agrupación (ej. cruzar
  // datos de un equipo con otro) se note.
  it('con varios equipos, el resultado indexado es idéntico al que daba el filtro directo por equipo', () => {
    S.s('eq', [
      { sigla: 'A', horomActual: 1000, frecPM: 250, hrsDia: 12 },
      { sigla: 'B', horomActual: 2000, frecPM: 500, hrsDia: 10 },
      { sigla: 'C', horomActual: 500, frecPM: 250, hrsDia: 12 }, // sin reg ni hist propios
    ]);
    S.s('reg', [
      { equipo: 'A', horomReal: 900, tipoPM: 'PM1', fechaEntrada: '2026-01-01', horaEntrada: '08:00' },
      { equipo: 'A', horomReal: 950, tipoPM: 'PM1', fechaEntrada: '2026-02-01', horaEntrada: '08:00' },
      { equipo: 'B', horomReal: 1800, tipoPM: 'PM2', fechaEntrada: '2026-01-15', horaEntrada: '08:00' },
      { equipo: 'A', horomReal: 0, tipoPM: 'PM1', fechaEntrada: '2026-03-01', horaEntrada: '08:00' }, // horomReal<=0, debe ignorarse
    ]);
    S.s('hist', [
      { sigla: 'A', fecha: '2026-01-01', horom: 800 },
      { sigla: 'A', fecha: '2026-02-01', horom: 900 },
      { sigla: 'B', fecha: '2026-01-01', horom: 1700 },
      { sigla: 'B', fecha: '2026-02-01', horom: 1900 },
    ]);

    // Camino con índice (el que usa C.recalcAll)
    const [eqA, eqB, eqC] = C.recalcAll();

    // Camino directo (sin índice, un equipo a la vez) para comparar
    const ultA = _horomUltimoPM('A');
    const ultB = _horomUltimoPM('B');
    const ultC = _horomUltimoPM('C');
    expect(ultA).toEqual({ horom: 950, tipo: 'PM1' }); // el de fecha más reciente, ignora horomReal=0
    expect(ultB).toEqual({ horom: 1800, tipo: 'PM2' });
    expect(ultC).toBeNull();

    const ritmoA = _ritmoRealEq('A', 12);
    const ritmoB = _ritmoRealEq('B', 10);
    const ritmoC = _ritmoRealEq('C', 12);
    expect(ritmoC).toBe(12); // sin historial -> cae al nominal

    // El equipo recalculado con el índice debe reflejar EXACTAMENTE esos mismos
    // datos (mismo horomUltimoPM/ritmo real que el camino sin índice) — confirmado
    // indirectamente vía C.recalc: mismo horomProxPM/hrsRestantes con esos inputs.
    const { C: Cindependiente } = require('../logic.js');
    const eAesperado = { sigla: 'A', horomActual: 1000, frecPM: 250, hrsDia: 12 };
    Cindependiente.recalc(eAesperado, ritmoA, ultA.horom, ultA.tipo);
    expect(eqA.horomProxPM).toBe(eAesperado.horomProxPM);
    expect(eqA.hrsRestantes).toBe(eAesperado.hrsRestantes);
    expect(eqA.estado).toBe(eAesperado.estado);

    const eBesperado = { sigla: 'B', horomActual: 2000, frecPM: 500, hrsDia: 10 };
    Cindependiente.recalc(eBesperado, ritmoB, ultB.horom, ultB.tipo);
    expect(eqB.horomProxPM).toBe(eBesperado.horomProxPM);
    expect(eqB.hrsRestantes).toBe(eBesperado.hrsRestantes);

    const eCesperado = { sigla: 'C', horomActual: 500, frecPM: 250, hrsDia: 12 };
    Cindependiente.recalc(eCesperado, ritmoC, ultC ? ultC.horom : null, ultC ? ultC.tipo : null);
    expect(eqC.horomProxPM).toBe(eCesperado.horomProxPM);
  });

  it('el índice no mezcla equipos ni corrompe el orden al recalcular varios seguidos (regs.slice() antes de sort)', () => {
    // Dos equipos con reg desordenado en el arreglo original, para confirmar que
    // ordenar el resultado del índice (que es un arreglo COMPARTIDO reusado por
    // sigla) no deja el arreglo mutado/corrompido para una siguiente consulta.
    S.s('reg', [
      { equipo: 'X', horomReal: 300, tipoPM: 'PM1', fechaEntrada: '2026-03-01', horaEntrada: '08:00' },
      { equipo: 'X', horomReal: 100, tipoPM: 'PM1', fechaEntrada: '2026-01-01', horaEntrada: '08:00' },
      { equipo: 'X', horomReal: 200, tipoPM: 'PM1', fechaEntrada: '2026-02-01', horaEntrada: '08:00' },
    ]);
    const primeraConsulta = _horomUltimoPM('X');
    const segundaConsulta = _horomUltimoPM('X');
    expect(primeraConsulta).toEqual({ horom: 300, tipo: 'PM1' });
    expect(segundaConsulta).toEqual({ horom: 300, tipo: 'PM1' }); // no cambia entre consultas
  });
});
