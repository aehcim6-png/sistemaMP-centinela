const path = require('path');
const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Ronda 4D: la Ayuda de la app tiene buscador e índice (sin tocar los textos) y los manuales HTML tienen índice lateral fijo
// en escritorio, plegable en celular, sin desborde y sin la columna aplastada que dejó una primera versión (overflow-wrap:anywhere).
test('Ayuda con buscador e índice; manuales con índice lateral', async ({ page }) => {
  test.setTimeout(120000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });

  const a = await page.evaluate(async () => {
    const pausa = (ms) => new Promise((x) => setTimeout(x, ms));
    go('ayuda');
    for (let i = 0; i < 80 && !document.querySelector('#s-ayuda .ay-tools'); i++) { await pausa(100); if (i % 10 === 9 && window.renders && renders.ayuda) renders.ayuda(); }
    const secs = [...document.querySelectorAll('#s-ayuda [id^="m"]')].filter((n) => /^m\d+$/.test(n.id));
    const enlaces = document.querySelectorAll('#s-ayuda .ay-ind a').length;
    const q = document.querySelector('#s-ayuda .ay-q');
    const visibles = () => secs.filter((n) => n.style.display !== 'none').length;
    const out = { secs: secs.length, enlaces, todasAntes: visibles() };
    q.value = 'weibull'; q.dispatchEvent(new Event('input'));
    out.conWeibull = visibles(); out.contador = document.querySelector('#s-ayuda .ay-n').textContent;
    q.value = 'zzzxqy'; q.dispatchEvent(new Event('input'));
    out.sinResultado = visibles(); out.avisoVacio = document.querySelector('#s-ayuda .ay-n').textContent;
    q.value = ''; q.dispatchEvent(new Event('input'));
    out.todasDespues = visibles();
    return out;
  });
  expect(a.secs).toBeGreaterThan(20);
  expect(a.enlaces).toBe(a.secs);              // un enlace por sección
  expect(a.todasAntes).toBe(a.secs);
  expect(a.conWeibull).toBeGreaterThan(0);
  expect(a.conWeibull).toBeLessThan(a.secs);   // el filtro oculta las que no hablan de Weibull
  expect(a.contador).toMatch(/de \d+ secciones/);
  expect(a.sinResultado).toBe(0);
  expect(a.avisoVacio).toMatch(/ninguna/i);
  expect(a.todasDespues).toBe(a.secs);         // al borrar la búsqueda vuelve todo

  const doc = (f) => 'file://' + path.resolve(__dirname, '../../docs/' + f);
  for (const [w, h, escritorio] of [[1280, 900, true], [360, 780, false]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(doc('manual-usuario.html'));
    const m = await page.evaluate(() => {
      const nav = document.querySelector('.doc-layout > nav');
      const titulos = document.querySelectorAll('.doc-main h2, .doc-main h3').length;
      const celda = document.querySelector('.doc-main td:first-child, .doc-main th:first-child');
      return { enlaces: document.querySelectorAll('.doc-index a').length, titulos, pos: getComputedStyle(nav).position, ancho1: celda ? Math.round(celda.getBoundingClientRect().width) : 999, desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(m.enlaces).toBe(m.titulos);                      // el índice cubre todos los títulos
    expect(m.pos).toBe(escritorio ? 'sticky' : 'static');
    expect(m.ancho1).toBeGreaterThanOrEqual(80);            // la primera columna de las tablas no queda aplastada
    expect(m.desborde).toBeLessThanOrEqual(4);
  }
});
