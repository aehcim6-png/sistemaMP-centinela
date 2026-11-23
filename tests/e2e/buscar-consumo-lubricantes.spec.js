const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Buscar → consumo de lubricantes de los informes de bodega: toda la flota (por tipo, por equipo, por mes) y la ficha de un equipo (por tipo, por mes, por fecha).
test('Buscar muestra el consumo de lubricantes de la flota y de un equipo, con filtro por lubricante', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.route(`${SB_URL}/rest/v1/equipos**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
    { sigla: 'CN-9500', tipo: 'Camión', modelo: 'X', estado: 'Operativo', frecPM: 250, hrsDia: 12, horomActual: 5000, fechaHorom: '2026-11-20' },
    { sigla: 'CN-9501', tipo: 'Camión', modelo: 'X', estado: 'Operativo', frecPM: 250, hrsDia: 12, horomActual: 4000, fechaHorom: '2026-11-20' },
  ]) }));
  await page.route(`${SB_URL}/rest/v1/consumo_lubricantes**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-4/5' }, body: JSON.stringify([
    { id: 'c1', fecha: '2026-09-10', sigla: 'CN-9500', lubricante: 'MOBILTRANS HD 30', cantidad: 100, unidad: 'L', fuente: 'Informe 2026-09' },
    { id: 'c2', fecha: '2026-10-20', sigla: 'CN-9501', lubricante: 'MOBILTRANS HD 30', cantidad: 50, unidad: 'L', fuente: 'Informe 2026-10' },
    { id: 'c3', fecha: '2026-10-22', sigla: 'CN-9500', lubricante: 'MOBILGREASE XHP 322 MINE', cantidad: 30, unidad: 'kg', fuente: 'Informe 2026-10' },
    { id: 'c4', fecha: '2026-11-02', sigla: 'CN-9500', lubricante: 'ADBLUE', cantidad: 40, unidad: 'L', fuente: 'Informe 2026-11' },
    { id: 'c5', fecha: '2026-11-03', sigla: 'CN-9500', lubricante: 'MOBILTRANS HD 30', cantidad: 10, unidad: 'L', fuente: 'Informe 2026-11' },
  ]) }));
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com'); await page.locator('#li_pass').fill('claveCorrecta123'); await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (S.g('consLub') || []).length)).toBe(5);
  await page.evaluate(() => window.go('dash'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.go('buscar'));
  await expect(page.locator('#fBuscarEq')).toBeAttached({ timeout: 10000 });

  // Toda la flota: totales por unidad, por tipo de lubricante y por equipo
  const flota = page.locator('#s-buscar .chart-box', { hasText: 'Consumo de lubricantes de la flota' });
  await expect(flota).toContainText('5 salidas');
  await expect(flota).toContainText('160 L');       // aceite: 100 + 50 + 10
  await expect(flota).toContainText('30 kg');       // grasa aparte
  await expect(flota).toContainText('40 L');        // AdBlue aparte
  await expect(flota.locator('tr', { hasText: 'MOBILTRANS HD 30' }).first()).toContainText('3');   // 3 salidas

  // Filtrar por un lubricante: la tabla por equipo muestra solo ese lubricante
  await page.evaluate(() => { document.getElementById('fBuscarLub').value = 'MOBILTRANS HD 30'; renders.buscar(); });
  await expect(page.locator('#s-buscar .chart-box', { hasText: 'Consumo de lubricantes de la flota' })).toContainText('CN-9501');
  await expect(page.locator('#s-buscar .chart-box', { hasText: 'Consumo de lubricantes de la flota' })).not.toContainText('MOBILGREASE');

  // Ficha de un equipo: por tipo, por mes y por fecha
  await page.evaluate(() => { document.getElementById('fBuscarLub').value = ''; document.getElementById('fBuscarEq').value = 'CN-9500'; renders.buscar(); });
  const caja = page.locator('#s-buscar .chart-box[data-bz^="Consumo de lubricantes"]');
  await expect(caja).toContainText('4 salidas', { timeout: 10000 });
  await expect(caja).toContainText('Salidas por fecha');
  await expect(caja).toContainText('03-11-2026');
  await expect(caja).toContainText('MOBILGREASE XHP 322 MINE');
  await expect(caja).not.toContainText('CN-9501');
});
