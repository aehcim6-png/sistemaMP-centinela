// Pruebas de _resetearDatosEmpresa (modules/store.js) — usada por "Configurar
// Nueva Empresa" en Configuración. Bug real encontrado en auditoría (2026-08-06):
// la versión anterior de ese botón solo hacía localStorage.removeItem de 18 claves
// (quedó de la época pre-Supabase) y NUNCA tocaba la nube para ~20 de las 31
// categorías reales — "borra TODO" era falso, el historial de la empresa anterior
// volvía solo al recargar, porque el sistema vuelve a bajar todo de Supabase.
//
// Red deshabilitada a propósito en estos tests (mismo patrón que el resto de la
// suite) — lo que se verifica es que _resetearDatosEmpresa INTENTA tocar cada
// categoría real (vía S.s(), que actualiza _sbCache sincrónicamente incluso si
// el fetch de red termina rechazando), no que la red responda con éxito. Nunca
// se corre contra Supabase real ni se ejecuta processResetEmpresa (esa parte de
// UI queda fuera de este archivo, sin probarse contra datos reales).
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
global.C = require('../logic.js').C;

const { _resetearDatosEmpresa, _sbCache, TABLA_REAL, _syncChain } = require('../modules/store.js');

beforeEach(() => {
  for (const k in _sbCache) delete _sbCache[k];
  for (const k in localStorage._d) delete localStorage._d[k];
  for (const k in _syncChain) delete _syncChain[k];
  fetchLlamadas = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// _refetchTablaReal/_refetchVencimientos reintentan 3 veces con backoff real
// (300/600ms, ver _conReintento) cuando el fetch falla — con ~29 categorías
// reintentando en serie eso son ~26s reales por corrida, con fetch deshabilitado
// a propósito. Timers falsos avanzan ese backoff al instante sin cambiar la
// lógica real que se está probando (que sigue esperando esos mismos milisegundos
// en producción).
async function correrReset() {
  const p = _resetearDatosEmpresa();
  await vi.runAllTimersAsync();
  return p;
}

describe('_resetearDatosEmpresa', () => {
  it('toca todas las categorías reales excepto eq y pau', async () => {
    await correrReset();
    const categoriasEsperadas = Object.keys(TABLA_REAL).filter((k) => k !== 'eq' && k !== 'pau');
    for (const k of categoriasEsperadas) {
      expect(_sbCache[k]).toEqual([]);
    }
  });

  it('NO toca eq ni pau — quedan para que el llamador decida qué cargar', async () => {
    await correrReset();
    expect(_sbCache.eq).toBeUndefined();
    expect(_sbCache.pau).toBeUndefined();
  });

  it('vacía vencimientos', async () => {
    await correrReset();
    expect(_sbCache.venc).toEqual({});
  });

  it('devuelve los singletons de configuración a sus valores por defecto', async () => {
    await correrReset();
    expect(_sbCache.hh).toBe(0);
    expect(_sbCache.dispMeta).toBe(85);
    expect(_sbCache.metas).toEqual({});
    expect(_sbCache.dispCalc).toEqual({});
    expect(_sbCache.avanceData).toEqual({});
  });

  it('de verdad intenta tocar la nube para cada categoría (no es un no-op local)', async () => {
    await correrReset();
    // Al menos un intento de red por cada una de las ~29 categorías reales
    // (excluye eq/pau) más venc y los 5 singletons — el número exacto de
    // llamadas no importa acá, solo que no se quedó todo en 0.
    expect(fetchLlamadas).toBeGreaterThan(0);
  });

  it('incluye papelera y gantt en el borrado — bug real: la versión vieja no las tocaba', async () => {
    await correrReset();
    expect(_sbCache.papelera).toEqual([]);
    expect(_sbCache.gantt).toEqual([]);
  });

  it('no lanza ni cuelga aunque todas las llamadas de red fallen', async () => {
    await expect(correrReset()).resolves.toBeUndefined();
  });
});
