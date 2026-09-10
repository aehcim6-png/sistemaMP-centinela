const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

const MFA_FACTOR_ID = 'mock-totp-factor-1';

async function loginConCredencialesCorrectas(page) {
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_email')).toHaveValue('admin@test.com', { timeout: 15000 });
  await page.locator('#li_btn').click();
}

// _mostrarMfaChallengeUI/_mfaChallenge/_mfaVerify (index.html): cuando la
// cuenta ya tiene un factor TOTP verificado, la clave sola no basta — el
// access_token del login queda a nivel aal1 (nunca se guarda en
// localStorage) hasta que el código de 6 dígitos se confirme contra
// Supabase Auth. Sin este segundo paso, cualquiera que solo supiera la
// contraseña de una cuenta con 2FA activado podría entrar igual.
test.describe('Login con verificación en dos pasos (MFA)', () => {
  test('cuenta con MFA activo pide el código de 6 dígitos antes de entrar', async ({ page }) => {
    await mockSupabase(page, { loginOk: true, role: 'admin', mfaFactorId: MFA_FACTOR_ID });
    await page.goto('/');
    await loginConCredencialesCorrectas(page);

    // No entra directo: el overlay de login sigue, pero cambia a la
    // pantalla de "Verificación en dos pasos".
    await expect(page.locator('#loginOverlay')).toContainText('Verificación en dos pasos', { timeout: 10000 });
    await expect(page.locator('#mfa_code')).toBeVisible();

    // La sesión NO debe quedar guardada todavía (el access_token del login
    // es solo aal1, nunca se persiste hasta pasar este segundo paso).
    const tokenGuardado = await page.evaluate(() => localStorage.getItem('smp_access_token'));
    expect(tokenGuardado).toBeNull();
  });

  test('código MFA correcto completa el login', async ({ page }) => {
    await mockSupabase(page, { loginOk: true, role: 'admin', mfaFactorId: MFA_FACTOR_ID, mfaCodigoValido: '123456' });
    await page.goto('/');
    await loginConCredencialesCorrectas(page);
    await expect(page.locator('#mfa_code')).toBeVisible({ timeout: 10000 });

    await page.locator('#mfa_code').fill('123456');
    await page.locator('#mfa_btn').click();

    await expect(page.locator('#loginOverlay')).toHaveCount(0, { timeout: 10000 });
    const tokenGuardado = await page.evaluate(() => localStorage.getItem('smp_access_token'));
    expect(tokenGuardado).toBe('mock.aal2.access.token');
  });

  test('código MFA incorrecto muestra error y no entra', async ({ page }) => {
    await mockSupabase(page, { loginOk: true, role: 'admin', mfaFactorId: MFA_FACTOR_ID, mfaCodigoValido: '123456' });
    await page.goto('/');
    await loginConCredencialesCorrectas(page);
    await expect(page.locator('#mfa_code')).toBeVisible({ timeout: 10000 });

    await page.locator('#mfa_code').fill('999999');
    await page.locator('#mfa_btn').click();

    await expect(page.locator('#mfa_err')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#mfa_err')).toHaveText('Código incorrecto.');
    await expect(page.locator('#loginOverlay')).toBeVisible();
    const tokenGuardado = await page.evaluate(() => localStorage.getItem('smp_access_token'));
    expect(tokenGuardado).toBeNull();
  });

  test('cuenta sin MFA activo entra directo, sin pedir código', async ({ page }) => {
    await mockSupabase(page, { loginOk: true, role: 'admin' });
    await page.goto('/');
    await loginConCredencialesCorrectas(page);
    await expect(page.locator('#loginOverlay')).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('#mfa_code')).toHaveCount(0);
  });
});
