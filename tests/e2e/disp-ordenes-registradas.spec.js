const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Disponibilidad: lista las órdenes del año (vigentes con fecha de salida + histórico sin fecha de salida) y deja claro que el histórico no suma horas detenido.
test('Disponibilidad lista las órdenes del año, las del histórico marcadas sin horas detenido', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  const mes = new Date().toISOString().slice(0, 7);
  const dia = (n) => mes + '-' + String(n).padStart(2, '0');
  await page.route(`${SB_URL}/rest/v1/correctivos_historico**`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const filas = [
      { id: 'h1', sigla: 'CN-9500', fecha: dia(3), sistema: 'Frenos', descripcion: 'Se repara fuga de aire', tipoInt: 'Correctiva', fuente: 'ordenes_trabajo (Excel 2026-11-05)' },
      { id: 'h2', sigla: 'CN-9500', fecha: dia(4), sistema: 'Engrase', descripcion: 'PM1', tipoInt: 'Programada', fuente: 'WhatsApp — BSM_CEN EQUIPOS' },
    ];
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-1/2' }, body: JSON.stringify(filas) });
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await page.locator('#li_btn').click();
  await expect(page.locator('#loginOverlay')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#s-disp')).toHaveCount(1, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (S.g('otHist') || []).length)).toBe(2);
  await page.evaluate(() => window.go('dash'));
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.go('disp'));
  await page.waitForTimeout(2500);
  const sec = page.locator('#dispOrdenes');
  await expect(sec).toBeAttached({ timeout: 10000 });
  await expect(sec.locator('summary')).toContainText('Órdenes de trabajo registradas');
  await expect(sec.locator('summary')).toContainText('2 del histórico (sin horas detenido)');
  const texto = await sec.evaluate((el) => el.textContent);
  expect(texto).toContain('Excel de órdenes');
  expect(texto).toContain('no suman horas detenido');
  expect(texto).toContain('no falla'); // la programada (PM1) no cuenta como falla
});
