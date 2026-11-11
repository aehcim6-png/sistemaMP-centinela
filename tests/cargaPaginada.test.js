// Carga liviana al entrar (11-nov-2026): tope de lecturas simultáneas, reintentos con espera y sin recarga secuencial cuando la base está saturada.
// Contexto: la prueba de carga con 100 usuarios mostró ~180 peticiones a la vez por ingreso y 36.728 recargas secuenciales de tablas enteras con 300 ingresos juntos.
global.window = { addEventListener: function () {}, crypto: global.crypto };
global.localStorage = (function () {
  var d = {};
  return { _d: d, getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; }, setItem: function (k, v) { d[k] = String(v); }, removeItem: function (k) { delete d[k]; } };
})();
global._logChangeGenerico = function () {};
global.C = require('../logic.js').C;
const { _fetchPaginado, _pedirPagina, _MAX_PETICIONES_CARGA } = require('../modules/store.js');

const filasDe = (desde, n) => Array.from({ length: n }, (_, i) => ({ id: 'f' + (desde + i) }));
// Servidor de mentira: una tabla de `total` filas; `falla(req)` decide si una petición responde error; guarda el máximo de peticiones simultáneas.
function servidor(total, opts = {}) {
  const est = { peticiones: 0, enVuelo: 0, maxEnVuelo: 0, urls: [], sinConteo: !!opts.sinConteo };
  global.fetch = async (url, init) => {
    est.peticiones++; est.urls.push(url); est.enVuelo++; est.maxEnVuelo = Math.max(est.maxEnVuelo, est.enVuelo);
    try {
      await new Promise((r) => setTimeout(r, opts.ms || 5));
      const n = est.peticiones;
      const code = opts.falla ? opts.falla({ url, n }) : 0;
      if (code) return { ok: false, status: code, headers: { get: () => null }, json: async () => ({}) };
      const m = url.match(/offset=(\d+)&limit=(\d+)/); const off = +m[1], lim = +m[2];
      const parte = filasDe(off, Math.max(0, Math.min(lim, total - off)));
      const cont = /count=exact/.test((init.headers || {}).Prefer || '');
      return { ok: true, status: 200, headers: { get: (h) => (h.toLowerCase() === 'content-range' && cont && !opts.sinConteo ? (parte.length ? off + '-' + (off + parte.length - 1) : '*') + '/' + total : null) }, json: async () => parte };
    } finally { est.enVuelo--; }
  };
  return est;
}

beforeEach(() => { localStorage.setItem('smp_access_token', 'tok'); });

describe('carga paginada liviana', () => {
  it('trae todas las filas en el orden de las páginas', async () => {
    const est = servidor(1234);
    const filas = await _fetchPaginado('https://x.supabase.co/rest/v1/t?select=id&order=id.asc');
    expect(filas).toHaveLength(1234);
    expect(filas[0].id).toBe('f0'); expect(filas[1233].id).toBe('f1233');
    expect(est.peticiones).toBe(3);
  });

  it('nunca hay más de _MAX_PETICIONES_CARGA lecturas en vuelo, aunque se carguen varias tablas a la vez', async () => {
    const est = servidor(500 * 40);   // 40 páginas
    const r = await Promise.all([1, 2, 3].map(() => _fetchPaginado('https://x.supabase.co/rest/v1/t?select=id&order=id.asc')));
    r.forEach((x) => expect(x).toHaveLength(20000));
    expect(est.peticiones).toBe(120);
    expect(est.maxEnVuelo).toBeLessThanOrEqual(_MAX_PETICIONES_CARGA);
    expect(est.maxEnVuelo).toBeGreaterThan(1);
  });

  it('una página que falla una vez con 503 se reintenta y la carga termina bien', async () => {
    let fallo = false;
    const est = servidor(1500, { falla: ({ url }) => (!fallo && /offset=500/.test(url) ? ((fallo = true), 503) : 0) });
    const filas = await _fetchPaginado('https://x.supabase.co/rest/v1/t?select=id&order=id.asc');
    expect(filas).toHaveLength(1500);
    expect(est.peticiones).toBe(4);   // 3 páginas + 1 reintento
  }, 10000);

  it('con la base saturada (503 siempre) devuelve null y NO recarga la tabla página por página', async () => {
    const est = servidor(1500, { falla: ({ url }) => (/offset=500/.test(url) ? 503 : 0) });
    const filas = await _fetchPaginado('https://x.supabase.co/rest/v1/t?select=id&order=id.asc');
    expect(filas).toBeNull();
    // 1ª página + página fallida con sus 3 intentos + la 3ª página; ninguna recarga secuencial desde offset=0 (que repetiría offset=0 sin 'count')
    expect(est.urls.filter((u) => /offset=500/.test(u))).toHaveLength(3);
    expect(est.urls.filter((u) => /offset=0/.test(u))).toHaveLength(1);
    expect(est.peticiones).toBe(5);
  }, 10000);

  it('si la primera página no responde tras los reintentos, devuelve null sin más peticiones', async () => {
    const est = servidor(1500, { falla: () => 503 });
    expect(await _fetchPaginado('https://x.supabase.co/rest/v1/t?select=id&order=id.asc')).toBeNull();
    expect(est.peticiones).toBe(3);
  }, 10000);

  it('un error de pedido (400) no se reintenta y se resuelve por la vía secuencial de siempre', async () => {
    const est = servidor(700, { falla: ({ url }) => (/count/.test('') ? 0 : 0) });
    const antes = global.fetch;
    let primera = true;
    global.fetch = async (url, init) => { if (primera && (init.headers || {}).Prefer) { primera = false; est.peticiones++; return { ok: false, status: 400, headers: { get: () => null }, json: async () => ({}) }; } return antes(url, init); };
    const filas = await _fetchPaginado('https://x.supabase.co/rest/v1/t?select=id&order=id.asc');
    expect(filas).toHaveLength(700);   // la vía secuencial trae todo
    expect(est.peticiones).toBe(3);    // 400 (sin reintento) + 2 páginas secuenciales
  });

  it('sin Content-Range cae a la carga secuencial y trae todo', async () => {
    const est = servidor(1100, { sinConteo: true });
    const filas = await _fetchPaginado('https://x.supabase.co/rest/v1/t?select=id&order=id.asc');
    expect(filas).toHaveLength(1100);
    expect(est.peticiones).toBe(1 + 3);   // la 1ª con conteo + 3 páginas secuenciales
  });

  it('_pedirPagina devuelve null tras 3 intentos con 429 o con error de red', async () => {
    let n = 0;
    global.fetch = async () => { n++; return { ok: false, status: 429, headers: { get: () => null }, json: async () => ({}) }; };
    expect(await _pedirPagina('https://x/rest/v1/t?offset=0&limit=500', {})).toBeNull();
    expect(n).toBe(3);
    n = 0;
    global.fetch = async () => { n++; throw new Error('red'); };
    expect(await _pedirPagina('https://x/rest/v1/t?offset=0&limit=500', {})).toBeNull();
    expect(n).toBe(3);
  }, 10000);
});
