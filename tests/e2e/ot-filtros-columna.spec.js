const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Correctivos: cada columna se filtra desde su encabezado (fila de filtros bajo los títulos). Equipo y Tipo mueven los filtros de la barra de arriba.
test('Correctivos filtra por fecha, equipo y texto desde los encabezados', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.route(`${SB_URL}/rest/v1/equipos**`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { sigla: 'CN-9500', tipo: 'Camion', modelo: 'Komatsu HD785-7', estado: 'Operativo', frecPM: 250, hrsDia: 20, horomActual: 10000, fechaHorom: '2026-09-01' },
      { sigla: 'CN-9501', tipo: 'Camion', modelo: 'Komatsu HD785-7', estado: 'Operativo', frecPM: 250, hrsDia: 20, horomActual: 9000, fechaHorom: '2026-09-01' },
    ]) });
  });
  const f = (id, sigla, fecha, sintoma, extra) => Object.assign({ id, sigla, tipo: 'Correctivo', fecha, fechaEntrada: fecha, sintoma, estadoOT: 'Cerrada', estatusEq: 'Operativo' }, extra || {});
  const filas = [
    f('a1', 'CN-9500', '2025-03-05', 'cambio neumatico', { sistema: 'Ruedas y neumáticos' }),
    f('a2', 'CN-9501', '2025-03-07', 'bajo fluido hidraulico', { sistema: 'Hidráulico' }),
    f('a3', 'CN-9500', '2025-04-02', 'fuga de aceite'),
  ];
  await page.route(`${SB_URL}/rest/v1/correctivos**`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-2/3' }, body: JSON.stringify(filas) });
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-ot')).toHaveCount(1, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (S.g('ot') || []).length)).toBe(3);
  await page.evaluate(() => window.go('dash'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.go('ot'));
  const filtros = page.locator('#s-ot tr.fila-filtros');
  await expect(filtros).toBeAttached({ timeout: 10000 });
  const filas_ = () => page.locator('#s-ot table tr').filter({ hasNot: page.locator('th') });
  await expect(filas_()).toHaveCount(3);

  // Fecha: el mes 2025-03 deja dos órdenes.
  await filtros.locator('th').nth(3).locator('select').selectOption('2025-03');
  await expect(filas_()).toHaveCount(2);
  // Equipo (mueve el filtro de la barra de arriba): queda una.
  await filtros.locator('th').nth(1).locator('select').selectOption('CN-9500');
  await expect(filas_()).toHaveCount(1);
  expect(await page.evaluate(() => document.getElementById('fOtEq').value)).toBe('CN-9500');
  // Quitar filtros de columnas deja la fecha sin filtro (el de equipo es el de arriba y se queda).
  await page.getByRole('button', { name: /Quitar filtros de columnas/ }).click();
  await expect(filas_()).toHaveCount(2);
  // Texto en Síntoma.
  await page.locator('#s-ot tr.fila-filtros th').nth(5).locator('input').fill('fuga');
  await page.locator('#s-ot tr.fila-filtros th').nth(5).locator('input').dispatchEvent('change');
  await expect(filas_()).toHaveCount(1);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-sistemaMP-centinela/21b81192-da77-579c-a107-cc2ffd13bbbe/scratchpad/ot_filtros.png', clip: { x: 0, y: 0, width: 1500, height: 900 } });
});
