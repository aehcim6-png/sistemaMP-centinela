const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Etapa 2 de «datos desactualizados» (23-oct): qué muestran el Dashboard y Disponibilidad cuando se deja de ingresar información 1 semana, 1 mes o 2 meses.
// Una semana sin datos sigue contando (la ventana es de 7 días); dos meses sin datos deja el mes actual SIN DATO, no «100 % disponible».
const iso = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

async function entrar(page) {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 900 });
}

// Siembra 3 equipos con lecturas diarias de horómetro hasta `hace` días atrás y devuelve los textos de las dos pantallas.
async function escenario(page, hace, captura) {
  const r = await page.evaluate(async ({ hace }) => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const dIso = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const eq = ['CN-1', 'CN-2', 'CF-3'].map((sigla, i) => C.recalc({ sigla, tipo: 'Camion', modelo: 'Komatsu HD785-7', frecPM: 250, hrsDia: 12, horomActual: 5000 + 100 * i, fechaHorom: dIso(hace) }));
    const hist = [];
    eq.forEach((e) => { for (let n = hace; n <= hace + 120; n++) hist.push({ _id: e.sigla + '_' + n, sigla: e.sigla, fecha: dIso(n), horom: e.horomActual - (n - hace) * 10 }); });
    const sembrar = () => { S.s('eq', eq); S.s('hist', hist); S.s('ot', []); S.s('reg', []); };
    window._sembrarCob = sembrar;
    const out = {};
    // se cargan primero los módulos de las dos pestañas; después se siembra y se dibuja en el mismo instante, porque la carga en segundo plano (simulada vacía) pisa lo sembrado
    sembrar(); go('dash'); await esp(1500); go('disp'); await esp(1500);
    sembrar(); go('dash');
    out.dash = document.getElementById('s-dash').innerText.replace(/\s+/g, ' ');
    sembrar(); window._dispVista = 'mensual'; go('disp');
    out.disp = document.getElementById('s-disp').innerText.replace(/\s+/g, ' ');
    out.nHist = (S.g('hist') || []).length; out.nEq = (S.g('eq') || []).length;
    return out;
  }, { hace });
  if (captura) {
    await page.evaluate(() => { window._sembrarCob(); window._dispVista = 'mensual'; go('disp'); });
    await page.screenshot({ path: captura + '-disp.png', fullPage: false });
    await page.evaluate(() => { window._sembrarCob(); go('dash'); });
    await page.screenshot({ path: captura + '-dash.png', fullPage: false });
  }
  return r;
}

test('una semana sin ingresar datos: la disponibilidad se sigue calculando, sin aviso de cobertura', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  const r = await escenario(page, 7, process.env.COB_CAPTURA ? process.env.COB_CAPTURA + '7d' : null);
  expect(r.disp).not.toContain('Cobertura de datos');
  expect(r.disp).not.toContain('Sin registros de ningún equipo');
  expect(r.dash).toContain('DISPONIBILIDAD MECÁNICA');
  expect(r.dash).not.toContain('Cobertura de datos');
});

test('un mes sin ingresar datos (captura para revisar)', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  const r = await escenario(page, 30, process.env.COB_CAPTURA ? process.env.COB_CAPTURA + '30d' : null);
  expect(r.dash).toContain('DISPONIBILIDAD MECÁNICA');
});

test('dos meses sin ingresar datos: el mes actual queda sin dato, no en 100 %', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  const r = await escenario(page, 60, process.env.COB_CAPTURA ? process.env.COB_CAPTURA + '60d' : null);
  expect(r.disp).toContain('Sin registros de ningún equipo en este período (no se asume 100 %)');
  expect(r.disp).not.toMatch(/FLOTA \d{4}-\d{2}\s*100%/);
  expect(r.dash).toContain('Sin registros de ningún equipo en este período');
});
