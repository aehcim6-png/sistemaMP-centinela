const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Pautas: cada actividad muestra los minutos de trabajo por persona del PDF «Pauta Mantencion» (tabla pautas_tiempos), emparejados por parecido de texto.
test('la pestaña Pautas muestra los minutos de cada actividad', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.route(`${SB_URL}/rest/v1/equipos**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
    { sigla: 'BD-10139', tipo: 'Bulldozer', modelo: 'D375', estado: 'Operativo', frecPM: 250, hrsDia: 20, horomActual: 1000, fechaHorom: '2026-09-01' },
  ]) }));
  const pautas = [
    { id: 'p1', sigla: 'BD-10139', hoja: 'Mineria', pm: 'PM1', cat: 'REVISAR', act: 'Alternador', hrs: 250, rep: '', can: 0 },
    { id: 'p2', sigla: 'BD-10139', hoja: 'Mineria', pm: 'PM1', cat: 'ENGRASE', act: 'Barra estabilizadora', hrs: 50, rep: '', can: 0 },
    { id: 'p3', sigla: 'BD-10139', hoja: 'Mineria', pm: 'PM1', cat: 'REVISAR', act: 'Cosa que no existe en el PDF', hrs: 250, rep: '', can: 0 },
  ];
  await page.route(`${SB_URL}/rest/v1/pautas?**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-2/3' }, body: JSON.stringify(pautas) }));
  const tareas = [
    { id: 't1', sigla: 'BD-10139', hoja: 'Mineria', orden: 1, seccion: 'PM 1', act: 'Revisar alternador', topeHoras: 250, unidad: 'h', minutos: 10 },
    { id: 't2', sigla: 'BD-10139', hoja: 'Mineria', orden: 2, seccion: 'PM 1', act: 'Engrase Barra estabilizadora', topeHoras: 250, unidad: 'h', minutos: 15 },
  ];
  await page.route(`${SB_URL}/rest/v1/pautas_tiempos**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-1/2' }, body: JSON.stringify(tareas) }));
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com'); await page.locator('#li_pass').fill('claveCorrecta123'); await page.locator('#li_btn').click();
  await expect(page.locator('#s-pau')).toHaveCount(1, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (S.g('pautasTiempos') || []).length)).toBe(2);
  await expect.poll(() => page.evaluate(() => (S.g('pau') || []).length)).toBeGreaterThan(2);
  await page.evaluate(() => window.go('dash'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.go('pau'));
  await expect(page.locator('#s-pau table th', { hasText: 'Min' })).toBeAttached({ timeout: 10000 });
  const filas = page.locator('#s-pau table tr', { has: page.locator('td') });
  const texto = await filas.evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => { const i = td.querySelector('input,select'); return (i ? i.value : td.innerText).trim(); }).join(' | ')));
  const alt = texto.find((t) => t.includes('Alternador'));
  const barra = texto.find((t) => t.includes('Barra estabilizadora'));
  const nada = texto.find((t) => t.includes('Cosa que no existe'));
  expect(alt).toMatch(/250 \| 10 \|/);
  expect(barra).toMatch(/50 \| 15 \|/);
  expect(nada).toMatch(/250 \| — \|/);
  await expect(page.locator('#s-pau .toolbar')).toContainText('25 min');
  await expect(page.locator('#s-pau .toolbar')).toContainText('2 con tiempo');
});
