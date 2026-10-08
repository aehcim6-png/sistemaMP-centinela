const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

async function esperarCaptchaListo(page) {
  await page.waitForFunction(() => !!window._turnstileToken);
}

async function entrarConClaveTemporal(page) {
  await page.goto('/');
  await esperarCaptchaListo(page);
  await page.locator('#li_email').fill('nuevo@test.com');
  await page.locator('#li_pass').fill('claveTemporal123');
  await page.locator('#li_btn').click();
  await expect(page.locator('#loginOverlay')).toContainText('Primer ingreso', { timeout: 10000 });
}

async function enviarNuevaClave(page, clave) {
  await page.locator('#cc_pass1').fill(clave);
  await page.locator('#cc_pass2').fill(clave);
  await page.locator('#cc_btn').click();
}

// Reporte real (2026-10-08): "cambio la contraseña, entro, recargo la página y
// vuelve a pedir cambiarla". Causa: GoTrue rechaza el cambio con 422 y un
// cuerpo {code, error_code, msg} — sin `error`/`error_description` — y el
// cliente lo daba por exitoso: cerraba el aviso, mostraba "Contraseña
// actualizada" y nada se había guardado en el servidor.
test.describe('Cambio de contraseña obligatorio', () => {
  test('cambio exitoso: al recargar la página NO vuelve a pedir el cambio', async ({ page }) => {
    await mockSupabase(page, { loginOk: true, mustChangePassword: true });
    await entrarConClaveTemporal(page);
    await enviarNuevaClave(page, 'ClaveNueva123');
    await expect(page.locator('#loginOverlay')).toHaveCount(0, { timeout: 10000 });

    await page.reload();
    await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
    await page.waitForTimeout(2000); // el aviso de cambio aparece ~600ms después de arrancar
    await expect(page.locator('#loginOverlay')).toHaveCount(0);
  });

  test('si el servidor rechaza la misma contraseña: no se da por cambiada y se explica por qué', async ({ page }) => {
    await mockSupabase(page, { loginOk: true, mustChangePassword: true, passwordChangeError: 'same_password' });
    await entrarConClaveTemporal(page);
    await enviarNuevaClave(page, 'claveTemporal123');
    await expect(page.locator('#cc_err')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#cc_err')).toContainText('distinta');
    await expect(page.locator('#loginOverlay')).toHaveCount(1);
  });

  test('si el servidor rechaza una contraseña débil: se explica por qué y no se cierra el aviso', async ({ page }) => {
    await mockSupabase(page, { loginOk: true, mustChangePassword: true, passwordChangeError: 'weak_password' });
    await entrarConClaveTemporal(page);
    await enviarNuevaClave(page, 'abcdef');
    await expect(page.locator('#cc_err')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#cc_err')).toContainText('débil');
    await expect(page.locator('#loginOverlay')).toHaveCount(1);
  });
});
