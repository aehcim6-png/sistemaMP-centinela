const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Buscar → «Compras e instalaciones por ítem»: «seat belt» (inglés) encuentra la compra y la cruza con la OT que dice que se instaló.
test('Buscar cruza la compra de un cinturón (Seat Belt) con la OT de instalación', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.route(`${SB_URL}/rest/v1/equipos**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
    { sigla: 'BD-9533', tipo: 'Bulldozer', modelo: 'Komatsu D375A-6R', estado: 'Operativo', frecPM: 250, hrsDia: 20, horomActual: 10700, fechaHorom: '2026-09-01' },
  ]) }));
  await page.route(`${SB_URL}/rest/v1/compras_detalle**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-1/2' }, body: JSON.stringify([
    { id: 'c1', pedido: '14035', fecha: '2026-03-21', sigla: 'BD-9533', detalle: 'Seat Belt 5615781410', oc: '758390', cant: 1, precioUnit: 986921, costo: 986921, estado: 'Recepcion Bodega', fechaEstado: '2026-04-10' },
    { id: 'c2', pedido: '13842', fecha: '2026-02-28', sigla: 'BD-9533', detalle: 'Carrete Maguera Retractil', oc: '753169', cant: 1, precioUnit: 679260, costo: 679260, estado: 'Recepcion Bodega', fechaEstado: '2026-03-10' },
  ]) }));
  await page.route(`${SB_URL}/rest/v1/correctivos**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify([
    { id: 'o1', sigla: 'BD-9533', tipo: 'Correctiva', fecha: '2026-04-20', horom: 10690, sintoma: 'Se instala cinturon de seguridad nuevo', estadoOT: 'Cerrada' },
  ]) }));
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com'); await page.locator('#li_pass').fill('claveCorrecta123'); await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (S.g('comprasDetalle') || []).length)).toBe(2);
  await page.evaluate(() => window.go('dash'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.go('buscar'));
  await expect(page.locator('#fBuscarEq')).toBeAttached({ timeout: 10000 });
  await page.evaluate(() => { document.getElementById('fBuscarEq').value = 'BD-9533'; renders.buscar(); });
  await expect(page.locator('#fBuscarItem')).toBeAttached({ timeout: 10000 });
  await page.evaluate(() => { document.getElementById('fBuscarItem').value = 'seat belt'; renders.buscar(); });
  const caja = page.locator('#s-buscar .chart-box', { hasText: 'Compras e instalaciones por ítem' });
  await expect(caja).toContainText('1 línea(s) de compra', { timeout: 10000 });
  await expect(caja).toContainText('Seat Belt 5615781410');
  await expect(caja).toContainText('2026-04-20');
  await expect(caja).toContainText('1 con instalación comprobada');
  await expect(caja).not.toContainText('Maguera');
});
