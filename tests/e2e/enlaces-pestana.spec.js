const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Enlaces directos a cada pestaña (5-nov-2026): .../#mkpi pide la clave como siempre y después entra directo a esa pestaña.
async function iniciarSesion(page) {
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
}

test('un enlace con # entra directo a esa pestaña después de iniciar sesión, y cambiar de pestaña actualiza el enlace', async ({ page }) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/#mkpi');
  await iniciarSesion(page);
  await expect(page.locator('#s-mkpi')).toHaveClass(/\bon\b/, { timeout: 15000 });
  await expect(page.locator('#s-dash')).not.toHaveClass(/\bon\b/);
  expect(await page.evaluate(() => location.hash)).toBe('#mkpi');
  // cambiar de pestaña actualiza el # (para poder copiarlo desde la barra del navegador)
  await page.evaluate(() => go('eq'));
  expect(await page.evaluate(() => location.hash)).toBe('#eq');
  // pegar otro enlace en la misma pestaña del navegador cambia de pestaña
  await page.evaluate(() => { location.hash = '#cos'; });
  await expect(page.locator('#s-cos')).toHaveClass(/\bon\b/, { timeout: 15000 });
  // un # que no es una pestaña (anclaje del manual) no mueve nada
  await page.evaluate(() => { location.hash = '#m32'; });
  await page.waitForTimeout(500);
  await expect(page.locator('#s-cos')).toHaveClass(/\bon\b/);
  expect(errores).toEqual([]);
});

test('un # inexistente no rompe la entrada: se abre el Dashboard', async ({ page }) => {
  test.setTimeout(60000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/#no-existe');
  await iniciarSesion(page);
  await expect(page.locator('#s-dash')).toHaveClass(/\bon\b/, { timeout: 15000 });
});

test('el botón Enlace copia la dirección de la pestaña y la Ayuda lista un enlace por pestaña', async ({ page }) => {
  test.setTimeout(60000);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await iniciarSesion(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(() => go('mkpi'));
  await expect(page.locator('#exportBar button[aria-label="Copiar enlace de esta pestaña"]')).toBeVisible();
  const copiado = await page.evaluate(async () => {
    let texto = '';
    const original = navigator.clipboard && navigator.clipboard.writeText;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { texto = t; return Promise.resolve(); } }, configurable: true });
    document.querySelector('#exportBar button[aria-label="Copiar enlace de esta pestaña"]').click();
    await new Promise((x) => setTimeout(x, 100));
    void original;
    return texto;
  });
  expect(copiado).toMatch(/\/#mkpi$/);
  await page.evaluate(() => go('ayuda'));
  await expect(page.locator('#s-ayuda')).toContainText('Enlaces directos a cada pestaña', { timeout: 15000 });
  const enlaces = await page.locator('#s-ayuda a[href*="#"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')).filter((h) => /\/#[a-z0-9_-]+$/i.test(h)));
  expect(enlaces.some((h) => h.endsWith('#dash'))).toBe(true);
  expect(enlaces.some((h) => h.endsWith('#mkpi'))).toBe(true);
  expect(enlaces.some((h) => h.endsWith('#cos'))).toBe(true);
});
