// _fetchSb: las escrituras a Supabase renuevan la sesión ANTES de enviar si el token está por vencer, y reintentan una vez ante un 401.
// Caso real (Sentry 2026-10-08): 5 guardados automáticos salieron con el token vencido, recibieron 401 y la renovación llegó 5 s después sin reintento.
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
const { _fetchSb, _tokenPorVencer } = require('../modules/store.js');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (expSeg) => 'h.' + b64({ exp: expSeg }) + '.s';
const ahora = () => Math.floor(Date.now() / 1000);
const resp = (status) => ({ status, ok: status >= 200 && status < 300 });

let llamadas, respuestas, refrescos, refrescoOk;
beforeEach(() => {
  for (const k in localStorage._d) delete localStorage._d[k];
  llamadas = []; respuestas = []; refrescos = 0; refrescoOk = true;
  global.fetch = (url, init) => { llamadas.push({ url, auth: init.headers.Authorization }); return Promise.resolve(respuestas.shift() || resp(200)); };
  global._sbAuthRefresh = async () => { refrescos++; if (refrescoOk) localStorage.setItem('smp_access_token', jwt(ahora() + 3600)); return refrescoOk; };
});
afterEach(() => { delete global._sbAuthRefresh; });

describe('_tokenPorVencer', () => {
  it('sin token → false (no hay sesión que renovar)', () => { expect(_tokenPorVencer()).toBe(false); });
  it('vencido o a menos de 30 s → true; vigente → false', () => {
    localStorage.setItem('smp_access_token', jwt(ahora() - 5)); expect(_tokenPorVencer()).toBe(true);
    localStorage.setItem('smp_access_token', jwt(ahora() + 10)); expect(_tokenPorVencer()).toBe(true);
    localStorage.setItem('smp_access_token', jwt(ahora() + 600)); expect(_tokenPorVencer()).toBe(false);
  });
  it('un token ilegible no revienta', () => { localStorage.setItem('smp_access_token', 'basura'); expect(_tokenPorVencer()).toBe(false); });
});

describe('_fetchSb', () => {
  it('token vigente: una sola llamada, sin renovar', async () => {
    const t = jwt(ahora() + 3600); localStorage.setItem('smp_access_token', t);
    const r = await _fetchSb('u', { method: 'POST', headers: { Authorization: 'Bearer viejo' } });
    expect(r.status).toBe(200); expect(refrescos).toBe(0); expect(llamadas).toHaveLength(1);
    expect(llamadas[0].auth).toBe('Bearer ' + t);
  });
  it('token vencido: renueva ANTES de enviar y manda el token nuevo (nada sale con 401)', async () => {
    localStorage.setItem('smp_access_token', jwt(ahora() - 60));
    await _fetchSb('u', { method: 'POST', headers: { Authorization: 'Bearer viejo' } });
    expect(refrescos).toBe(1); expect(llamadas).toHaveLength(1);
    expect(llamadas[0].auth).toBe('Bearer ' + localStorage.getItem('smp_access_token'));
  });
  it('401 con token aparentemente vigente: renueva y reintenta una vez con el token nuevo', async () => {
    localStorage.setItem('smp_access_token', jwt(ahora() + 3600));
    respuestas = [resp(401), resp(200)];
    const r = await _fetchSb('u', { method: 'POST', headers: {} });
    expect(r.status).toBe(200); expect(refrescos).toBe(1); expect(llamadas).toHaveLength(2);
  });
  it('si la renovación falla devuelve el 401 original (para que se avise el error) y no reintenta', async () => {
    localStorage.setItem('smp_access_token', jwt(ahora() + 3600));
    respuestas = [resp(401)]; refrescoOk = false;
    const r = await _fetchSb('u', { method: 'POST', headers: {} });
    expect(r.status).toBe(401); expect(llamadas).toHaveLength(1);
  });
  it('un segundo 401 después de renovar no entra en bucle: máximo 2 envíos', async () => {
    localStorage.setItem('smp_access_token', jwt(ahora() + 3600));
    respuestas = [resp(401), resp(401), resp(200)];
    const r = await _fetchSb('u', { method: 'POST', headers: {} });
    expect(r.status).toBe(401); expect(llamadas).toHaveLength(2); expect(refrescos).toBe(1);
  });
  it('sin token de usuario (clave anónima) un 401 no dispara renovaciones', async () => {
    respuestas = [resp(401)];
    const r = await _fetchSb('u', { method: 'POST', headers: { Authorization: 'Bearer anon' } });
    expect(r.status).toBe(401); expect(refrescos).toBe(0); expect(llamadas[0].auth).toBe('Bearer anon');
  });
  it('otros errores (400, 403, 500) no se reintentan', async () => {
    localStorage.setItem('smp_access_token', jwt(ahora() + 3600));
    for (const st of [400, 403, 500]) { llamadas.length = 0; respuestas = [resp(st)]; expect((await _fetchSb('u', { headers: {} })).status).toBe(st); expect(llamadas).toHaveLength(1); }
    expect(refrescos).toBe(0);
  });
  it('sin la función de renovación disponible, igual envía una vez', async () => {
    delete global._sbAuthRefresh; localStorage.setItem('smp_access_token', jwt(ahora() - 60));
    respuestas = [resp(401)];
    expect((await _fetchSb('u', { headers: {} })).status).toBe(401); expect(llamadas).toHaveLength(1);
  });
});
