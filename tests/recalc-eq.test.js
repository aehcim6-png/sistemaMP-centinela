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
});
