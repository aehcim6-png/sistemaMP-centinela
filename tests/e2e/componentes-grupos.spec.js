const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Componentes (29-oct-2026): el rótulo de cada grupo (Mis componentes / Fallas / Análisis) es un botón que abre la primera sub-pestaña del grupo y se marca al estar dentro.
test('en Componentes, tocar el rótulo «Fallas» abre Informes de Falla y se marca', async ({ page }) => {
  test.setTimeout(90000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { window._comp2Sub = 'comp'; go('comp2'); });
  await expect(page.locator('#s-comp2 .subtabs-gb')).toHaveCount(3, { timeout: 15000 });
  await page.locator('#s-comp2 .subtabs-gb', { hasText: 'Fallas' }).click();
  await expect(page.locator('#s-informes')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#s-comp2 .subtabs-gb.on')).toHaveText('Fallas');
  await expect(page.locator('#s-comp2 .subtab.on')).toContainText('Informes de Falla');
  await page.locator('#s-comp2 .subtabs-gb', { hasText: 'Análisis' }).click();
  await expect(page.locator('#s-rvc')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#s-comp2 .subtabs-gb.on')).toHaveText('Análisis');
});
