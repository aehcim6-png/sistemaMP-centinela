const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');
// En el celular la cabecera tiene la marca y 7 íconos de acción: la marca no debe quedar tapada por los íconos (se veía «SistemaMP» con un ícono encima).
for (const ancho of [320, 360, 390, 411, 480]) {
  test(`Cabecera en celular de ${ancho}px: los íconos no tapan el título y la cabecera no se sale de la pantalla`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: ancho, height: 800 });
    await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
    await page.goto('/');
    await page.waitForFunction(() => !!window._turnstileToken);
    await page.locator('#li_email').fill('admin@test.com');
    await page.locator('#li_pass').fill('claveCorrecta123');
    await page.locator('#li_btn').click();
    await page.locator('#s-dash').waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const caja = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width }; };
      const titulo = document.querySelector('.logo-t');
      const rango = document.createRange(); rango.selectNodeContents(titulo.firstChild);   // solo el texto «SistemaMP», sin el subtítulo
      const txt = rango.getBoundingClientRect();
      const btns = [...document.querySelectorAll('#headerRight button, #headerRight #_userBadge, #_userBadge')].filter((b) => b.offsetWidth > 0);
      const izq = Math.min(...btns.map((b) => b.getBoundingClientRect().left));
      const der = Math.max(...btns.map((b) => b.getBoundingClientRect().right));
      return { textoDer: txt.right, primerIconoIzq: izq, ultimoIconoDer: der, ancho: window.innerWidth, nBtns: btns.length, scroll: document.querySelector('.header').scrollWidth };
    });
    expect(m.nBtns).toBeGreaterThanOrEqual(6);
    expect(m.textoDer).toBeLessThanOrEqual(m.primerIconoIzq + 0.5);   // el título termina antes de empezar los íconos
    expect(m.ultimoIconoDer).toBeLessThanOrEqual(m.ancho + 0.5);       // el último ícono cabe en la pantalla
    expect(m.scroll).toBeLessThanOrEqual(m.ancho + 1);                 // la cabecera no se sale de la pantalla
  });
}
