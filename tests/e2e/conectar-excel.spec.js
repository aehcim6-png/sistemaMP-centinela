const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Código para conectar el Excel (2026-11-04): en Ayuda se crea una sesión APARTE para el Excel (contraseña + CAPTCHA)
// y se muestra su refresh_token; la sesión de la web (localStorage) no se toca.
async function entrar(page, opts = {}) {
  await mockSupabase(page, { loginOk: true, role: 'lector', nombre: 'Lector Test', ...opts });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
}

test('Ayuda → Generar código para el Excel entrega el código de una sesión nueva y no toca la de la web', async ({ page }) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  const sesionWeb = await page.evaluate(() => [localStorage.getItem('smp_access_token'), localStorage.getItem('smp_refresh_token')]);

  // el segundo login (el del Excel) devuelve otra sesión; se registra después, así que tiene prioridad sobre el mock general
  let cuerpoLogin = null;
  await page.route(`${SB_URL}/auth/v1/token?grant_type=password`, (route) => {
    cuerpoLogin = JSON.parse(route.request().postData() || '{}');
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ access_token: 'excel.access.token', refresh_token: 'rt-excel-nuevo', user: { id: 'mock-user-id-0001', email: 'admin@test.com', factors: [] } }) });
  });

  await page.evaluate(() => go('ayuda'));
  const boton = page.locator('#s-ayuda button', { hasText: 'Generar código para el Excel' });
  await expect(boton).toBeVisible({ timeout: 15000 });   // visible también para un lector (no es una acción de escritura)
  await boton.click();
  await expect(page.locator('#xlOverlay')).toBeVisible();
  await expect(page.locator('#xl_email')).toHaveValue('admin@test.com');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#xl_pass').fill('claveCorrecta123');
  await page.locator('#xl_btn').click();

  await expect(page.locator('#xl_codigo')).toHaveValue('rt-excel-nuevo', { timeout: 15000 });
  expect(cuerpoLogin.email).toBe('admin@test.com');
  expect(cuerpoLogin.gotrue_meta_security && cuerpoLogin.gotrue_meta_security.captcha_token).toBeTruthy();
  const despues = await page.evaluate(() => [localStorage.getItem('smp_access_token'), localStorage.getItem('smp_refresh_token')]);
  expect(despues).toEqual(sesionWeb);

  await page.locator('#xlOverlay button', { hasText: 'Cerrar' }).click();
  await expect(page.locator('#xlOverlay')).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('contraseña incorrecta: avisa y no muestra código', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  await page.route(`${SB_URL}/auth/v1/token?grant_type=password`, (route) =>
    route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) }));
  await page.evaluate(() => _conectarExcelUI());
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#xl_pass').fill('otraClave');
  await page.locator('#xl_btn').click();
  await expect(page.locator('#xl_err')).toHaveText('La contraseña no es correcta.');
  await expect(page.locator('#xl_paso2')).toBeHidden();
});

test('cuenta con verificación en dos pasos: pide el código de 6 dígitos antes de entregar el código del Excel', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  await page.route(`${SB_URL}/auth/v1/token?grant_type=password`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ access_token: 'aal1.token', refresh_token: 'rt-aal1-no-debe-salir', user: { id: 'u', email: 'admin@test.com', factors: [{ id: 'fx', factor_type: 'totp', status: 'verified' }] } }) }));
  await page.route(`${SB_URL}/auth/v1/factors/fx/challenge`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'ch1' }) }));
  await page.route(`${SB_URL}/auth/v1/factors/fx/verify`, (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.code === '654321') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'aal2.token', refresh_token: 'rt-aal2', user: { id: 'u' } }) });
    return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'invalid code' }) });
  });
  await page.evaluate(() => _conectarExcelUI());
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#xl_pass').fill('claveCorrecta123');
  await page.locator('#xl_btn').click();
  await expect(page.locator('#xl_mfa_box')).toBeVisible();
  await expect(page.locator('#xl_paso2')).toBeHidden();
  await page.locator('#xl_mfa').fill('111111');
  await page.locator('#xl_btn').click();
  await expect(page.locator('#xl_err')).toHaveText('El código de 6 dígitos no es correcto.');
  await page.locator('#xl_mfa').fill('654321');
  await page.locator('#xl_btn').click();
  await expect(page.locator('#xl_codigo')).toHaveValue('rt-aal2', { timeout: 15000 });
});
