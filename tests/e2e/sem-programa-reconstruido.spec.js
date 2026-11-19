const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Planificación semanal: una semana pasada muestra qué tocaba (reconstruido con horómetros y PM) y cuántos hitos no tienen PM registrado.
const iso = (d) => { const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
// La semana operativa parte el jueves: la semana pasada va del jueves anterior al de esta semana hasta el miércoles previo a él.
function semanaPasada() {
  const hoy = new Date(); const x = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  x.setDate(x.getDate() - ((x.getDay() - 4 + 7) % 7));
  const ini = new Date(x); ini.setDate(ini.getDate() - 7);
  return ini;
}
test('una semana pasada muestra el programa reconstruido: hitos que tocaban y sin PM registrado', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  const ini = semanaPasada();
  const dia = (n) => { const d = new Date(ini); d.setDate(d.getDate() + n); return iso(d); };
  const eqs = ['TX-1', 'TX-2'].map((s) => ({ sigla: s, tipo: 'Camion', modelo: 'Komatsu HD785-7', estado: 'Operativo', frecPM: 250, hrsDia: 10, horomActual: 700, fechaHorom: iso(new Date()) }));
  // Horómetro 470 el día anterior a la semana, +10 por día: llega a 500 al tercer día de la semana (hito de PM2).
  const hist = [];
  ['TX-1', 'TX-2'].forEach((s) => { for (let n = -40; n <= 14; n++) hist.push({ id: s + n, sigla: s, fecha: dia(n), horom: 470 + 10 * (n + 1), horomFin: 470 + 10 * (n + 1) }); });
  const regs = [{ id: 'r1', equipo: 'TX-2', tipoPM: 'PM2', fechaEntrada: dia(3), fechaSalida: dia(3), horomReal: 500, duracionH: 5, nReg: 1, estatusEq: 'Operativo' }];
  await page.route(`${SB_URL}/rest/v1/equipos**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(eqs) }));
  await page.route(`${SB_URL}/rest/v1/registros_pm**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify(regs) }));
  await page.route(`${SB_URL}/rest/v1/historial_horometros**`, (r) => {
    if (r.request().method() !== 'GET') return r.fallback();
    const u = r.request().url(), off = +((u.match(/[?&]offset=(\d+)/) || [])[1] || 0), lim = +((u.match(/[?&]limit=(\d+)/) || [])[1] || 1e9);
    const sl = hist.slice(off, off + lim);
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': (sl.length ? off + '-' + (off + sl.length - 1) : '*') + '/' + hist.length }, body: JSON.stringify(sl) });
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com'); await page.locator('#li_pass').fill('claveCorrecta123'); await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (S.g('hist') || []).length)).toBeGreaterThan(100);
  await page.evaluate(() => { window._planiSub = 'sem'; window.go('plani'); });
  await expect(page.locator('#fSemNum')).toBeAttached({ timeout: 10000 });
  const actual = await page.evaluate(() => { const o = document.querySelector('#fSemNum option[selected], #fSemNum option:checked'); return parseInt(o.value, 10); });
  await page.evaluate((w) => { document.getElementById('fSemNum').value = String(w); renders.sem(); }, actual - 1);
  await expect(page.locator('#s-sem')).toContainText('qué tocaba y qué pasó', { timeout: 10000 });
  const cards = await page.locator('#s-sem .cards').innerText();
  expect(cards.replace(/\s+/g, ' ')).toMatch(/TOCABAN \(RECONSTRUIDO\) 2/i);
  expect(cards.replace(/\s+/g, ' ')).toMatch(/SIN PM REGISTRADO 1/i);
  const tabla = (await page.locator('#s-sem .chart-box table').innerText()).replace(/\s+/g, ' ');
  expect(tabla).toMatch(/TX-1.*Sin PM registrado/);
  expect(tabla).toMatch(/TX-2.*Ejecutado/);
});
