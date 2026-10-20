const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Ronda 3 de diseño (marco de escritorio): la cabecera de una sola fila solo existe cuando cabe (≥1480 px) y en ningún ancho
// los indicadores se pisan con el logo o con los botones; el menú lateral marca la pestaña activa (aria-current) y se recorre
// con las flechas; el celular no cambia.
test('cabecera sin solapes, menú lateral con flechas y celular intacto', async ({ page }) => {
  test.setTimeout(120000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });

  const medir = () => page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    const sola = (a, b) => !(a.r <= b.l + 1 || b.r <= a.l + 1 || a.b <= b.t + 1 || b.b <= a.t + 1);   // true = se pisan
    const h = document.querySelector('.header'), logo = h.querySelector('.logo'), st = h.querySelector('.hstats'), der = document.getElementById('headerRight');
    const cajas = [...st.querySelectorAll('.hs')].map(r);
    const cualquierPisa = cajas.some((c, i) => cajas.slice(i + 1).some((d) => sola(c, d)));
    return { alto: h.offsetHeight, grid: getComputedStyle(h).gridTemplateAreas.replace(/"/g, '') === 'logo stats right', logoVsStats: sola(r(logo), r(st)), statsVsDer: sola(r(st), r(der)), entreIndicadores: cualquierPisa, desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });

  for (const [w, h, unaFila] of [[1500, 900, true], [1366, 800, false], [1024, 800, false]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    const m = await medir();   // grid = la grilla de una fila (solo ≥1480 px)
    expect(m.grid).toBe(unaFila);
    if (unaFila) expect(m.alto).toBeLessThanOrEqual(80);
    expect(m.logoVsStats).toBe(false);
    expect(m.statsVsDer).toBe(false);
    expect(m.entreIndicadores).toBe(false);
    expect(m.desborde).toBeLessThanOrEqual(4);
  }

  // menú lateral: una sola pestaña con aria-current="page" (la activa) y las flechas mueven el foco
  await page.setViewportSize({ width: 1280, height: 900 });
  const n = await page.evaluate(async () => {
    go('dash'); await new Promise((x) => setTimeout(x, 400));
    const marcadas = [...document.querySelectorAll('#nav .nav-grp button[aria-current="page"]')];
    const botones = [...document.querySelectorAll('#nav .nav-grp button')];
    botones[0].focus();
    return { marcadas: marcadas.length, esLaActiva: marcadas.length === 1 && marcadas[0].classList.contains('on'), total: botones.length };
  });
  expect(n.marcadas).toBe(1);
  expect(n.esLaActiva).toBe(true);
  await page.keyboard.press('ArrowDown');
  const sig = await page.evaluate(() => [...document.querySelectorAll('#nav .nav-grp button')].indexOf(document.activeElement));
  expect(sig).toBe(1);
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => [...document.querySelectorAll('#nav .nav-grp button')].indexOf(document.activeElement))).toBe(0);

  // celular: la cabecera no usa la grilla de una fila
  await page.setViewportSize({ width: 360, height: 780 });
  await page.waitForTimeout(300);
  const mov = await medir();
  expect(mov.grid).toBe(false);
  expect(mov.desborde).toBeLessThanOrEqual(4);
});
