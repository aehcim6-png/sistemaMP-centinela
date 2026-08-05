// Prueba de regresión de un bug real (2026-08-05): S.init() sembraba y
// SUBÍA datos de fábrica (INIT.equipos, etc.) a las tablas reales de
// Supabase cada vez que alguna categoría no llegaba a cargar en el arranque
// — sin importar si la nube estaba bien configurada. Encontrado en
// producción: una PWA recién instalada (almacenamiento vacío) sufrió un
// fetch fallido de 'eq' durante la carga paralela; _sbLoadHeavy() igual
// devolvió éxito general (solo revisa el primer fetch a 'kv'), así que
// nunca se activó el modo offline, y S.init() vio "eq vacío" y subió el
// set de fábrica (viejo) encima de datos de flota reales y compartidos.
// No llegó a perderse nada (un guardado normal poco después restauró los
// valores correctos), pero la ventana de riesgo era real — de ahí esta
// prueba, para que no pueda volver a pasar en silencio.
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
global.fetch = function () { return Promise.reject(new Error('red deshabilitada en tests')); };
global._logChangeGenerico = function () {};
// INIT vive en index.html (no en store.js) — se stubea acá con datos falsos
// mínimos, suficientes para probar que S.init() los usa (o no) sin
// depender de la flota real de INIT.equipos.
global.INIT = {
  equipos: [{ sigla: 'FAKE-1', horomActual: 1 }],
  registros: [],
  lubricantes: [],
  filtrosMaestro: [],
  stockFiltros: [],
  alertas: [],
  programa: [],
  tarifaHH: 1,
  neumaticos: [],
  pautas: []
};

const { S, _sbCache } = require('../modules/store.js');

beforeEach(() => {
  for (const k in _sbCache) delete _sbCache[k];
  for (const k in localStorage._d) delete localStorage._d[k];
});

describe('S.init() con Supabase configurado (caso real de producción)', () => {
  it('NO siembra "eq" aunque esté vacío — este era exactamente el bug', () => {
    expect(S.g('eq')).toBeNull();
    S.init();
    expect(S.g('eq')).toBeNull();
  });

  it('tampoco pisa "cfg" (nombre de empresa/faena) si nunca llegó a cargar', () => {
    expect(S.g('cfg')).toBeNull();
    S.init();
    expect(S.g('cfg')).toBeNull();
  });

  it('tampoco siembra "neu" (neumáticos) con datos de fábrica', () => {
    expect(S.g('neu')).toBeNull();
    S.init();
    expect(S.g('neu')).toBeNull();
  });

  it('sí sigue poniendo defaults LOCALES vacíos e inofensivos (para que el resto de la app no se rompa)', () => {
    // 'destrabe'/'metas' (a diferencia de 'ot', que ya trae su propio
    // default [] incorporado en S.g()) solo quedan definidos si S.init()
    // corrió — confirma que esa parte de init() no se cortó de más.
    expect(S.g('destrabe')).toBeNull();
    expect(S.g('metas')).toBeNull();
    S.init();
    // Esto es intencional y seguro: un arreglo/objeto vacío no borra ni
    // sobrescribe nada real en la nube (ver _syncTablaGenericaInner) —
    // solo evita un ".forEach()" sobre null en el resto de la app mientras
    // la categoría todavía no cargó de verdad.
    expect(S.g('destrabe')).toEqual([]);
    expect(S.g('metas')).toEqual({});
  });
});

describe('S.init() sin Supabase configurado (demo/pruebas locales — comportamiento preservado)', () => {
  it('sigue sembrando "eq" desde INIT.equipos cuando no hay una URL de Supabase válida', () => {
    localStorage.setItem('smp10_cfg', JSON.stringify({ sbUrl: 'no-es-una-url', sbKey: 'no-es-una-clave' }));
    expect(S.g('eq')).toBeNull();
    S.init();
    expect(S.g('eq')).toEqual(global.INIT.equipos);
  });
});
