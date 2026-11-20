const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Planificación semanal: si la semana tiene programa oficial del taller cargado (programa_pm_semanal), se muestra ese programa comparado con los PM registrados.
const iso = (d) => { const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const inicioSemana = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() - 4 + 7) % 7)); return x; };
test('una semana pasada con programa oficial muestra qué estaba programado y qué se hizo', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  const hoy = new Date();
  const iniActual = inicioSemana(hoy);
  const ini = new Date(iniActual); ini.setDate(ini.getDate() - 7);                 // jueves de la semana pasada
  const anio = (() => { const a = inicioSemana(new Date(iniActual.getFullYear() + 1, 0, 1)); return iniActual >= a ? iniActual.getFullYear() + 1 : iniActual.getFullYear(); })();
  const ancla = inicioSemana(new Date(anio, 0, 1));
  const semana = Math.round((ini - ancla) / 864e5 / 7) + 1;
  test.skip(semana < 2, 'a comienzos de año la numeración cambia; la prueba usa la semana anterior');
  const dia = (n) => { const d = new Date(ini); d.setDate(d.getDate() + n); return iso(d); };
  const prog = [
    { id: 'p1', anio, semana, fechaSemana: iso(ini), sigla: 'TX-1', siglaPrograma: 'TX-1', tipoPM: 'PM2', horomHito: 500, fechaProgramada: dia(3), nota: null },
    { id: 'p2', anio, semana, fechaSemana: iso(ini), sigla: 'TX-2', siglaPrograma: 'TX-2', tipoPM: 'PM2', horomHito: 500, fechaProgramada: dia(3), nota: null },
    { id: 'p3', anio, semana, fechaSemana: iso(ini), sigla: 'TX-3', siglaPrograma: 'TX-3', tipoPM: 'PM1', horomHito: 250, fechaProgramada: dia(1), nota: 'Condicionada: Programar mantencion pm1 cuando quede operativo' },
  ];
  const eqs = ['TX-1', 'TX-2', 'TX-3'].map((s) => ({ sigla: s, tipo: 'Camion', modelo: 'Komatsu HD785-7', estado: 'Operativo', frecPM: 250, hrsDia: 10, horomActual: 700, fechaHorom: iso(hoy) }));
  const regs = [{ id: 'r1', equipo: 'TX-2', tipoPM: 'PM2', fechaEntrada: dia(3), fechaSalida: dia(3), horomReal: 500, duracionH: 5, nReg: 1, estatusEq: 'Operativo' }];
  await page.route(`${SB_URL}/rest/v1/equipos**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(eqs) }));
  await page.route(`${SB_URL}/rest/v1/registros_pm**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify(regs) }));
  await page.route(`${SB_URL}/rest/v1/programa_pm_semanal**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-2/3' }, body: JSON.stringify(prog) }));
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com'); await page.locator('#li_pass').fill('claveCorrecta123'); await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (S.g('programaSemanal') || []).length)).toBe(3);
  await page.evaluate(() => { window._planiSub = 'sem'; window.go('plani'); });
  await expect(page.locator('#fSemNum')).toBeAttached({ timeout: 10000 });
  await page.evaluate((w) => { document.getElementById('fSemNum').value = String(w); renders.sem(); }, semana);
  await expect(page.locator('#s-sem')).toContainText('Programa oficial del taller', { timeout: 10000 });
  const cards = (await page.locator('#s-sem .cards').innerText()).replace(/\s+/g, ' ');
  expect(cards).toMatch(/PROGRAMADOS \(TALLER\) 2/i);       // la condicionada no cuenta
  expect(cards).toMatch(/SIN PM REGISTRADO 1/i);
  const tabla = (await page.locator('#s-sem .chart-box table').first().innerText()).replace(/\s+/g, ' ');
  expect(tabla).toMatch(/TX-1.*Sin PM registrado/);
  expect(tabla).toMatch(/TX-2.*Ejecutado/);
  expect(tabla).toMatch(/TX-3.*condicionada/);
  // No aparece la reconstrucción por horómetro: manda el programa oficial.
  await expect(page.locator('#s-sem')).not.toContainText('qué tocaba y qué pasó');
  // Se puede reprogramar desde el programa oficial.
  await page.locator('#s-sem .chart-box button', { hasText: 'Reprogramar' }).first().click();
  await expect(page.locator('#rpSem')).toBeAttached();
});
