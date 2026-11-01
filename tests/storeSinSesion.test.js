// Caso real (Sentry, 23-30 oct 2026): 497 avisos «Guardado fallido en Supabase» de 5 tablas (metas, avance_data, disponibilidad_calculada, salud_flota_historico,
// meta_disponibilidad), todos SIN usuario: S.init() guardaba los valores por defecto aunque nadie hubiera iniciado sesión, y la base (RLS) rechazaba la clave pública.
// Sin sesión no se intenta ninguna escritura a la nube; con sesión, todo sigue igual.
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
global._logChangeGenerico = function () {};
global.C = require('../logic.js').C;
const { S, _sbCache } = require('../modules/store.js');

let escrituras;
beforeEach(() => {
  for (const k in _sbCache) delete _sbCache[k];
  for (const k in localStorage._d) delete localStorage._d[k];
  escrituras = [];
  global.fetch = (url, init) => { if (init && init.method === 'POST') escrituras.push(url); return Promise.resolve({ status: 200, ok: true, json: async () => [], text: async () => '' }); };
  global._avisarErrorGuardado = undefined;
});
const esperar = () => new Promise((r) => setTimeout(r, 30));

describe('arranque sin sesión iniciada', () => {
  it('S.init() no escribe nada en la nube, pero deja los valores por defecto en memoria', async () => {
    S.init();
    await esperar();
    expect(escrituras).toEqual([]);
    expect(S.g('dispMeta')).toBe(85);
    expect(S.g('metas')).toEqual({});
    expect(S.g('avanceData')).toEqual({});
  });

  it('con sesión iniciada, guardar una de esas categorías sí llega a la nube', async () => {
    localStorage.setItem('smp_access_token', 'h.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64') + '.s');
    S.s('dispMeta', 90);
    await esperar();
    expect(escrituras.some((u) => u.indexOf('/meta_disponibilidad') >= 0)).toBe(true);
  });
});
