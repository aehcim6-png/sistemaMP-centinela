const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// En celular el menú es una barra inferior de accesos rápidos + "Más" (menú completo en pantalla completa); en escritorio, la barra lateral.
test('celular: barra inferior, "Más" abre el menú completo y elegir una pestaña lo cierra', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });

  await expect(page.locator('#bnav')).toBeVisible();
  await expect(page.locator('#bnav button')).toHaveCount(5); // 4 accesos + Más
  await expect(page.locator('.nav')).toBeHidden();

  await page.locator('#bnavMas').click();
  await expect(page.locator('.nav')).toBeVisible();
  await expect(page.locator('.nav-grp button')).toHaveCount(21); // las 21 pestañas, en sus 5 grupos

  await page.locator('.nav-grp button[title="Correctivos"]').click();
  await expect(page.locator('.nav')).toBeHidden();
  expect(await page.evaluate(() => currentTab)).toBe('ot');

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('#bnav')).toBeHidden();
  await expect(page.locator('.nav')).toBeVisible();
});
