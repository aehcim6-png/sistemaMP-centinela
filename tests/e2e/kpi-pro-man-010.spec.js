const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Disponibilidad → vista mensual: bajo la tabla aparecen los indicadores del procedimiento corporativo PRO-MAN-010 (MA, MTBF, MTTR, MTBS), con los mismos números que kpiProMan010.
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

test('la vista mensual muestra MA, MTBF, MTTR y MTBS del PRO-MAN-010 y avisa del equipo sin horómetro', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const dIso = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const mes = dIso(0).slice(0, 7);
    const dia = (d) => mes + '-' + String(d).padStart(2, '0');
    const eq = ['CN-1', 'CN-2', 'CF-3'].map((sigla, i) => C.recalc({ sigla, tipo: 'Camion', modelo: 'Komatsu HD785-7', frecPM: 250, hrsDia: 12, horomActual: 5000 + 100 * i, fechaHorom: dIso(0) }));
    const hist = [];
    eq.slice(0, 2).forEach((e) => { for (let n = 0; n <= 70; n++) hist.push({ _id: e.sigla + '_' + n, sigla: e.sigla, fecha: dIso(n), horom: e.horomActual - n * 10 }); });
    const ot = [
      { _id: 'o1', sigla: 'CN-1', tipo: 'Correctivo', fecha: dia(1), duracion: '6h', estadoOT: 'Cerrada' },
      { _id: 'o2', sigla: 'CN-1', tipo: 'Correctivo', fecha: dia(2), duracion: '2h', estadoOT: 'Cerrada' },
    ];
    const reg = [{ _id: 'r1', equipo: 'CN-2', tipoPM: 'PM1', fechaEntrada: dia(1), duracionH: 5 }];
    const sembrar = () => { S.s('eq', eq); S.s('hist', hist); S.s('ot', ot); S.s('reg', reg); };
    sembrar(); go('dash'); await esp(2500); go('disp'); await esp(2500);
    // la carga en segundo plano (simulada vacía) pisa lo sembrado: se siembra y se dibuja en el mismo instante, sin ceder el turno entre medio
    const dibujar = () => { sembrar(); window._dispVista = 'mensual'; renderDisp(); };
    dibujar();
    const txt = document.getElementById('s-disp').innerText.replace(/\s+/g, ' ');
    window._dibujarKpi = dibujar;
    return { txt, k: kpiProMan010(eq, ot, reg, hist, mes) };
  });
  expect(r.txt).toContain('Indicadores PRO-MAN-010');
  const f = r.k.flota;
  expect(f.equipos).toBe(2);
  expect(f.fallas).toBe(2);
  expect(r.txt.toLowerCase()).toContain(('Disponibilidad Mecánica (MA) ' + f.ma + '%').toLowerCase());   // el título de la tarjeta va en mayúsculas por CSS
  expect(r.txt).toContain('MTBS');
  expect(r.txt).toContain('(2 fallas + 1 PM)');
  expect(r.txt).toContain('1 equipo(s) sin lecturas de horómetro a ambos lados del mes quedan fuera: CF-3');
  expect(r.txt).toContain('solo cuenta fallas');
  if (process.env.KPI010_CAPTURA) {
    await page.evaluate(() => {
      window._dibujarKpi();
      const t = [...document.querySelectorAll('#s-disp div')].find((d) => d.textContent.startsWith('Indicadores PRO-MAN-010'));
      t.parentElement.querySelectorAll('details').forEach((d) => { if (d.textContent.includes('Ver por equipo')) d.open = true; });
      t.scrollIntoView();
    });
    await page.screenshot({ path: process.env.KPI010_CAPTURA, fullPage: false });
  }
});
