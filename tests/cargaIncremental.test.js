// Carga incremental al entrar (11-nov-2026): la copia del navegador + solo lo modificado desde la última visita, con salidas a la carga completa ante cualquier duda.
global.window = { addEventListener: function () {}, crypto: global.crypto };
global.localStorage = (function () {
  var d = {};
  return { _d: d, getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; }, setItem: function (k, v) { d[k] = String(v); }, removeItem: function (k) { delete d[k]; } };
})();
global._logChangeGenerico = function () {};
global.C = require('../logic.js').C;
const { _refetchTablaIncremental, _cargarTablaInicial, _cacheTablasUsar, _incMezclar, TABLA_REAL } = require('../modules/store.js');

const tokenDe = (sub) => 'h.' + Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64') + '.s';
const TABLA = 'historial_horometros';   // grande y en la lista de la carga incremental
const cfg = TABLA_REAL.hist;
const base = Date.parse('2026-11-10T12:00:00Z');
const mk = (i, upd) => ({ id: 'id' + i, sigla: 'CF-' + (i % 5), fecha: '2026-11-01', horom: 1000 + i, horomIni: null, horomFin: 1000 + i, origen: 'x', foto: null, created_at: new Date(base + i * 60000).toISOString(), updated_at: upd || new Date(base + i * 60000).toISOString().replace('Z', '+00:00') });

function memoria() { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), set: async (k, v) => { m.set(k, v); }, clear: async () => m.clear() }; }
// Servidor de mentira con una tabla; `estado.filas` es lo que hay en la base.
function servidor(estado, opts = {}) {
  const est = { urls: [], reqs: 0 };
  global.fetch = async (url, init) => {
    est.reqs++; est.urls.push(url);
    const u = new URL(url);
    if (opts.falla400 && /updated_at/.test(u.searchParams.get('select') || '')) return { ok: false, status: 400, headers: { get: () => null }, json: async () => ({}) };
    if (opts.falla503 && u.searchParams.get('updated_at')) return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) };
    let filas = estado.filas.slice();
    const gt = u.searchParams.get('updated_at');
    if (gt) { const t = Date.parse(gt.replace(/^gt\./, '')); filas = filas.filter((f) => Date.parse(f.updated_at) > t); filas.sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1)); }
    const off = +u.searchParams.get('offset') || 0, lim = +u.searchParams.get('limit') || 1000;
    const parte = filas.slice(off, off + lim);
    const cont = /count=exact/.test((init.headers || {}).Prefer || '');
    return { ok: true, status: 200, headers: { get: (h) => (h.toLowerCase() === 'content-range' && cont ? (parte.length ? off + '-' + (off + parte.length - 1) : '*') + '/' + filas.length : null) }, json: async () => parte };
  };
  return est;
}
const N = 1200;
const tabla = () => ({ filas: Array.from({ length: N }, (_, i) => mk(i)) });

let mem;
beforeEach(() => { mem = memoria(); _cacheTablasUsar(mem); localStorage.setItem('smp_access_token', tokenDe('persona-1')); });

describe('carga incremental', () => {
  it('la primera vez baja todo (con updated_at) y deja la copia', async () => {
    const est = servidor(tabla());
    const r = await _refetchTablaIncremental('hist');
    expect(r).toHaveLength(N);
    expect(r[0]).toMatchObject({ _id: 'id0', sigla: 'CF-0', horom: 1000 });
    expect(est.urls[0]).toContain('updated_at');
    expect(mem.m.get('hist').rows).toHaveLength(N);
    expect(mem.m.get('hist').uid).toBe('persona-1');
  });

  it('la segunda vez pide solo lo modificado y verifica el total: 2 peticiones en vez de 3', async () => {
    const est = servidor(tabla());
    await _refetchTablaIncremental('hist');
    const pri = est.reqs; est.reqs = 0; est.urls = [];
    const antes = base + N * 60000;
    // cambió una fila y llegó una nueva, hace poco (después de la última copia)
    const estado = { filas: tabla().filas };
    estado.filas[5] = { ...estado.filas[5], horom: 9999, updated_at: new Date(antes + 3600e3).toISOString().replace('Z', '+00:00') };
    estado.filas.push(mk(N, new Date(antes + 3700e3).toISOString().replace('Z', '+00:00')));
    const est2 = servidor(estado);
    const r = await _refetchTablaIncremental('hist');
    expect(pri).toBe(3);                       // 1ª vez: 1200 filas = 3 páginas
    expect(est2.reqs).toBe(2);                 // delta + conteo
    expect(est2.urls[0]).toMatch(/updated_at=gt\./);
    expect(r).toHaveLength(N + 1);
    expect(r[5].horom).toBe(9999);             // la fila modificada reemplaza a la guardada y conserva su lugar
    expect(r[N]._id).toBe('id' + N);           // la nueva va al final
    expect(r[0]._id).toBe('id0');
    expect(mem.m.get('hist').rows).toHaveLength(N + 1);
  });

  it('si el total del servidor no cuadra (hubo un borrado) descarta la copia y devuelve null para bajar completo', async () => {
    servidor(tabla());
    await _refetchTablaIncremental('hist');
    const e = tabla(); e.filas.splice(10, 1);          // alguien borró una fila
    servidor(e);
    expect(await _refetchTablaIncremental('hist')).toBeNull();
    expect(mem.m.get('hist')).toBeNull();
    // y la carga inicial cae a la vía completa de siempre y trae lo que hay
    const est = servidor(e);
    const r = await _cargarTablaInicial('hist');
    expect(r).toHaveLength(N - 1);
  });

  it('la copia de otra persona no se usa', async () => {
    servidor(tabla());
    await _refetchTablaIncremental('hist');
    localStorage.setItem('smp_access_token', tokenDe('persona-2'));
    const est = servidor(tabla());
    const r = await _refetchTablaIncremental('hist');
    expect(r).toHaveLength(N);
    expect(est.reqs).toBe(3);                          // bajó completo
    expect(mem.m.get('hist').uid).toBe('persona-2');
  });

  it('una copia de más de 12 horas se reemplaza con una carga completa', async () => {
    servidor(tabla());
    await _refetchTablaIncremental('hist');
    const c = mem.m.get('hist'); c.fullAt = Date.now() - 13 * 3600e3;
    const est = servidor(tabla());
    await _refetchTablaIncremental('hist');
    expect(est.reqs).toBe(3);
    expect(Date.now() - mem.m.get('hist').fullAt).toBeLessThan(5000);
  });

  it('si el servidor responde error al pedir lo modificado devuelve null (carga completa)', async () => {
    servidor(tabla());
    await _refetchTablaIncremental('hist');
    servidor(tabla(), { falla503: true });
    expect(await _refetchTablaIncremental('hist')).toBeNull();
  }, 10000);

  it('sin updated_at en la tabla (migración sin aplicar) devuelve null y no insiste con las demás tablas', async () => {
    const est = servidor(tabla(), { falla400: true });
    expect(await _refetchTablaIncremental('hist')).toBeNull();
    const antes = est.reqs;
    expect(await _refetchTablaIncremental('ot')).toBeNull();      // 'correctivos' también está en la lista, pero se espera un rato
    expect(est.reqs).toBe(antes);
  });

  it('las tablas chicas no pasan por aquí: ninguna petición', async () => {
    const est = servidor(tabla());
    expect(await _refetchTablaIncremental('lub')).toBeNull();
    expect(est.reqs).toBe(0);
  });

  it('sin sesión (sin token) o sin almacenamiento no hace nada', async () => {
    const est = servidor(tabla());
    localStorage.removeItem('smp_access_token');
    expect(await _refetchTablaIncremental('hist')).toBeNull();
    expect(est.reqs).toBe(0);
    localStorage.setItem('smp_access_token', tokenDe('persona-1'));
    _cacheTablasUsar(null);   // en node no hay indexedDB
    expect(await _refetchTablaIncremental('hist')).toBeNull();
  });

  it('_incMezclar: reemplaza por clave, conserva el orden y agrega las nuevas al final', () => {
    const r = _incMezclar([{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }], [{ id: 'b', v: 2 }, { id: 'd', v: 1 }], 'id');
    expect(r).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 1 }, { id: 'd', v: 1 }]);
  });
});
