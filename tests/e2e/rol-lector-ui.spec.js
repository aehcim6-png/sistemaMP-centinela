const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

async function esperarCaptchaListo(page) {
  await page.waitForFunction(() => !!window._turnstileToken);
}

async function llenarLogin(page, email, pass) {
  await page.locator('#li_email').fill(email);
  await page.locator('#li_pass').fill(pass);
  await expect(page.locator('#li_email')).toHaveValue(email, { timeout: 15000 });
  await expect(page.locator('#li_pass')).toHaveValue(pass, { timeout: 15000 });
}

test('verificación: _aplicarRolUI oculta los botones de escritura para el rol lector', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'lector', nombre: 'Lector Test' });

  await page.goto('/');
  await esperarCaptchaListo(page);
  await llenarLogin(page, 'lector@test.com', 'claveCorrecta123');
  await page.locator('#li_btn').click();
  await expect(page.locator('#loginOverlay')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 10000 });

  await page.evaluate(() => window.go('ot'));

  // "+ Nueva OT" (onclick="addOT()") matches _RE_ACCION_ESCRITURA — debe quedar oculto.
  const btnNuevaOT = page.locator('button[onclick="addOT()"]');
  await expect(btnNuevaOT).toBeHidden({ timeout: 10000 });

  // Un botón de solo-lectura del mismo panel (ir a Estadística) debe seguir visible.
  const btnEstadistica = page.locator("button[onclick=\"go('comp2');comp2Sub('estadistica')\"]");
  await expect(btnEstadistica).toBeVisible();
});

test('verificación: un admin SÍ ve los botones de escritura', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });

  await page.goto('/');
  await esperarCaptchaListo(page);
  await llenarLogin(page, 'admin@test.com', 'claveCorrecta123');
  await page.locator('#li_btn').click();
  await expect(page.locator('#loginOverlay')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 10000 });

  await page.evaluate(() => window.go('ot'));

  const btnNuevaOT = page.locator('button[onclick="addOT()"]');
  await expect(btnNuevaOT).toBeVisible({ timeout: 10000 });
});
