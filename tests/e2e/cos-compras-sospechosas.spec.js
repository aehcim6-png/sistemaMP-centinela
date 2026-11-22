const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Costos: avisa de líneas de compra con monto sospechoso (coma decimal mal leída), sin cambiar nada.
test('Costos avisa de una línea de compra con precio ~1000 veces el habitual', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  const lin = (i, pu, extra) => Object.assign({ id: 'c' + i, pedido: String(100 + i), fecha: '2025-02-10', sigla: 'CN-9500', detalle: 'Filtro Aire Secundari6001', oc: '692' + i, cant: 3, precioUnit: pu, costo: 3 * pu, estado: 'Recepcion Bodega' }, extra || {});
  await page.route(`${SB_URL}/rest/v1/compras_detalle**`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const filas = [lin(1, 15074), lin(2, 16210), lin(3, 21278), lin(4, 58878), lin(5, 58878611, { oc: '692902' })];
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-4/5' }, body: JSON.stringify(filas) });
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await page.locator('#li_btn').click();
  await expect(page.locator('#loginOverlay')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#s-cos')).toHaveCount(1, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (S.g('comprasDetalle') || []).length)).toBe(5);
  await page.evaluate(() => window.go('dash'));
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.go('cos'));
  await page.waitForTimeout(2500);
  const det = page.locator('#s-cos details', { hasText: 'monto sospechoso' });
  await expect(det).toBeAttached({ timeout: 10000 });
  await expect(det.locator('summary')).toContainText('1 línea(s) de compra con monto sospechoso');
  const texto = await det.evaluate((el) => el.textContent);
  expect(texto).toContain('692902');
  expect(texto).toContain('58.878.611');
});
