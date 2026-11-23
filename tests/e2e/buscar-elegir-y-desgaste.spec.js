const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Buscar → ficha del equipo: bloque «Elementos de desgaste» y «¿Qué quieres ver?» (mostrar/ocultar y plegar/desplegar cada bloque, recordado en el navegador).
test('Buscar muestra los elementos de desgaste del equipo y deja elegir qué ver y plegar bloques', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.route(`${SB_URL}/rest/v1/equipos**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
    { sigla: 'MN-6112', tipo: 'Motoniveladora', modelo: 'Komatsu GD-705-5', estado: 'Operativo', frecPM: 250, hrsDia: 12, horomActual: 9397, fechaHorom: '2026-11-20' },
  ]) }));
  const hoy = new Date(); const f = (d) => new Date(hoy.getTime() - d * 864e5).toISOString().slice(0, 10);
  await page.route(`${SB_URL}/rest/v1/gets_cambios**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-3/4' }, body: JSON.stringify([
    { id: 'g1', sigla: 'MN-6112', fecha: f(60), horometro: 9000, horometroDudoso: false, descripcion: 'Cuchillas: cambio de cuchillas', pieza: 'Cuchillas', observaciones: 'Equipo: MN-12 cambio de cuchillas', fuente: 'WhatsApp (chat BSM_CEN importado 2026-11-23)' },
    { id: 'g2', sigla: 'MN-6112', fecha: f(40), horometro: 9100, horometroDudoso: false, descripcion: 'Cuchillas: cambio de cuchillas', pieza: 'Cuchillas', observaciones: 'cambio de cuchillas', fuente: 'WhatsApp (chat BSM_CEN importado 2026-11-23)' },
    { id: 'g3', sigla: 'MN-6112', fecha: f(20), horometro: 9250, horometroDudoso: false, descripcion: 'Cuchillas: cambio de cuchillas', pieza: 'Cuchillas', observaciones: 'cambio de cuchillas', fuente: 'WhatsApp (chat BSM_CEN importado 2026-11-23)' },
    { id: 'g4', sigla: 'MN-6112', fecha: f(5), horometro: 9380, horometroDudoso: false, descripcion: 'Calzas: cambio de calzas', pieza: 'Calzas', observaciones: 'cambio de calzas', fuente: 'WhatsApp (chat BSM_CEN importado 2026-11-23)' },
  ]) }));
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com'); await page.locator('#li_pass').fill('claveCorrecta123'); await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (S.g('getsCambios') || []).length)).toBe(4);
  await page.evaluate(() => window.go('dash'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.go('buscar'));
  await expect(page.locator('#fBuscarEq')).toBeAttached({ timeout: 10000 });
  await page.evaluate(() => { document.getElementById('fBuscarEq').value = 'MN-6112'; renders.buscar(); });

  const caja = page.locator('#s-buscar .chart-box[data-bz="Elementos de desgaste"]');
  await expect(caja).toContainText('4 cambios', { timeout: 10000 });
  await expect(caja).toContainText('Cuchillas');
  await expect(caja).toContainText('Calzas');

  // ¿Qué quieres ver? — ocultar el bloque con su botón y volver a mostrarlo
  const chip = page.locator('#buscarVerBarra .bz-chip', { hasText: 'Elementos de desgaste' });
  await chip.click();
  await expect(caja).toBeHidden();
  await chip.click();
  await expect(caja).toBeVisible();

  // Plegar con un clic en el título: queda el título y se esconde el contenido
  await caja.locator('.chart-t').click();
  await expect(caja).toHaveClass(/bz-plegado/);
  await expect(caja.locator('table').first()).toBeHidden();
  // y se recuerda al volver a dibujar la ficha
  await page.evaluate(() => renders.buscar());
  await expect(page.locator('#s-buscar .chart-box[data-bz="Elementos de desgaste"]')).toHaveClass(/bz-plegado/);
  await page.locator('#buscarVerBarra button', { hasText: 'Desplegar todo' }).click();
  await expect(page.locator('#s-buscar .chart-box[data-bz="Elementos de desgaste"] table').first()).toBeVisible();

  // Reordenar: «Elementos de desgaste» sube un lugar con su flecha ▲, se recuerda al redibujar y «Orden original» lo devuelve
  const nombres = () => page.evaluate(() => [...document.querySelectorAll('#s-buscar > .chart-box[data-bz]')].map(x => x.dataset.bz));
  const antes = await nombres();
  const i = antes.indexOf('Elementos de desgaste');
  expect(i).toBeGreaterThan(0);
  await page.locator('#s-buscar .chart-box[data-bz="Elementos de desgaste"] .bz-mov [data-mv="-1"]').click();
  const despues = await nombres();
  expect(despues.indexOf('Elementos de desgaste')).toBe(i - 1);
  expect(despues[i]).toBe(antes[i - 1]);
  await page.evaluate(() => renders.buscar());
  expect((await nombres()).indexOf('Elementos de desgaste')).toBe(i - 1);
  await page.locator('#buscarVerBarra button', { hasText: 'Orden original' }).click();
  expect(await nombres()).toEqual(antes);
});
