const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Buscar → ficha del equipo: las tablas se redibujan al elegir equipo y deben seguir ordenables por encabezado (⇅); las fechas y duraciones ordenan de verdad.
test('la tabla Registros PM de Buscar se ordena por fecha y por duración', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.route(`${SB_URL}/rest/v1/equipos**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
    { sigla: 'CN-9500', tipo: 'Camion', modelo: 'Komatsu HD785-7', estado: 'Operativo', frecPM: 250, hrsDia: 20, horomActual: 5000, fechaHorom: '2026-09-01' },
  ]) }));
  const R = (id, f, pm, ini, fin, dur, h) => ({ id, equipo: 'CN-9500', tipoPM: pm, fechaEntrada: f, fechaSalida: f, horaEntrada: ini, horaSalida: fin, duracion: dur, horomReal: h, estatusEq: 'Operativo', nReg: id.length });
  const regs = [R('a', '2026-03-10', 'PM1', '08:00', '10:00', '2h 00min', 4750), R('b', '2026-01-05', 'PM2', '08:00', '18:30', '10h 30min', 4500), R('c', '2026-02-20', 'PM1', '09:00', '09:45', '0h 45min', 4600)];
  await page.route(`${SB_URL}/rest/v1/registros_pm**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-2/3' }, body: JSON.stringify(regs) }));
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com'); await page.locator('#li_pass').fill('claveCorrecta123'); await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (S.g('reg') || []).length)).toBe(3);
  await page.evaluate(() => window.go('dash'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.go('buscar'));
  await expect(page.locator('#fBuscarEq')).toBeAttached({ timeout: 10000 });
  // Elegir el equipo redibuja la ficha: sus tablas deben quedar ordenables.
  await page.evaluate(() => { document.getElementById('fBuscarEq').value = 'CN-9500'; renders.buscar(); });
  const tabla = page.locator('#s-buscar .chart-box', { hasText: 'Registros PM (3)' }).locator('table');
  await expect(tabla.locator('th .sortArrow').first()).toBeAttached({ timeout: 10000 });
  const col = async (i) => tabla.locator('tr').filter({ hasNot: page.locator('th') }).evaluateAll((trs, i) => trs.map((tr) => tr.children[i].innerText.trim()), i);
  await tabla.locator('th', { hasText: 'Fecha' }).click();
  expect(await col(0)).toEqual(['2026-01-05', '2026-02-20', '2026-03-10']);
  await tabla.locator('th', { hasText: 'Fecha' }).click();
  expect(await col(0)).toEqual(['2026-03-10', '2026-02-20', '2026-01-05']);
  await tabla.locator('th', { hasText: 'Duración' }).click();
  expect(await col(4)).toEqual(['0h 45min', '2h 00min', '10h 30min']);
});
