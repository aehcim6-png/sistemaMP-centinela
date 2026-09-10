// Mocks para las pruebas E2E: la sandbox de CI/desarrollo no tiene salida de
// red hacia Supabase ni Cloudflare, así que cada flujo E2E debe interceptar
// esas llamadas con page.route() en vez de pegarle a la infraestructura real
// (ver docs/arquitectura.md sobre el modo "todo gratis" — estas pruebas no
// deben depender de, ni gastar cuota de, ningún servicio externo).
const SB_URL = 'https://jyhpfwivhwzylkzxrsbt.supabase.co';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Reemplaza el script real de Cloudflare Turnstile por un stub que resuelve
// el desafío solo, sin intervención — las pruebas de login no están
// validando el CAPTCHA de Cloudflare en sí (eso es responsabilidad de
// Cloudflare), solo que la app funcione correctamente alrededor de él.
async function mockTurnstile(page) {
  await page.route(TURNSTILE_SCRIPT_URL, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.turnstile = {
          render: function(el, opts) {
            window.__turnstileCallback = opts && opts.callback;
            if (el) el.innerHTML = '<div style="width:300px;height:65px" data-testid="mock-turnstile-widget"></div>';
            setTimeout(function(){ if (window.__turnstileCallback) window.__turnstileCallback('mock-turnstile-token'); }, 10);
            return 'mock-widget-id';
          },
          reset: function() {
            setTimeout(function(){ if (window.__turnstileCallback) window.__turnstileCallback('mock-turnstile-token-refrescado'); }, 10);
          },
          remove: function(){}
        };
      `,
    })
  );
}

// Intercepta TODO lo que la app le manda a Supabase. Cualquier ruta no
// reconocida cae en el 'default' (200, cuerpo vacío) — evita que una llamada
// best-effort no contemplada (telemetría, changelog, etc.) se quede
// colgada contra la red real bloqueada de este entorno.
async function mockSupabase(page, opts = {}) {
  const {
    loginOk = true,
    email = 'admin@test.com',
    userId = 'mock-user-id-0001',
    role = 'admin',
    nombre = 'Admin Test',
    mustChangePassword = false,
    // Si se pasa, el login devuelve un factor TOTP ya verificado (activa el
    // segundo paso de MFA) — ver _mostrarMfaChallengeUI en index.html. El
    // access_token del login en sí queda a nivel aal1 (sin guardar sesión
    // todavía); mfaCodigoValido es el único código de 6 dígitos que
    // _mfaVerify acepta en este mock.
    mfaFactorId = null,
    mfaCodigoValido = '123456',
  } = opts;

  await mockTurnstile(page);

  await page.route(`${SB_URL}/**`, (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      if (!loginOk) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock.access.token',
          refresh_token: 'mock-refresh-token',
          user: {
            id: userId,
            email,
            factors: mfaFactorId ? [{ id: mfaFactorId, factor_type: 'totp', status: 'verified' }] : [],
            user_metadata: mustChangePassword ? { must_change_password: true } : {},
          },
        }),
      });
    }

    if (mfaFactorId && path === `/auth/v1/factors/${mfaFactorId}/challenge` && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'mock-challenge-id' }),
      });
    }

    if (mfaFactorId && path === `/auth/v1/factors/${mfaFactorId}/verify` && method === 'POST') {
      const body = route.request().postDataJSON();
      if (body && body.code === mfaCodigoValido) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock.aal2.access.token',
            refresh_token: 'mock-aal2-refresh-token',
            user: {
              id: userId,
              email,
              factors: [{ id: mfaFactorId, factor_type: 'totp', status: 'verified' }],
              user_metadata: {},
            },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_code', message: 'Invalid TOTP code entered' }),
      });
    }

    if (path === '/auth/v1/user') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: userId, email, factors: [], user_metadata: {} }),
      });
    }

    if (path === '/rest/v1/user_roles') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ role, nombre }]),
      });
    }

    if (path.startsWith('/functions/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }

    if (path.startsWith('/rest/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: method === 'GET' ? '[]' : '{}' });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

module.exports = { mockSupabase, mockTurnstile, SB_URL, TURNSTILE_SCRIPT_URL };
