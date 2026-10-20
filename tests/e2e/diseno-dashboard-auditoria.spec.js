const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Rediseño (19-oct): las dos tarjetas de confiabilidad se distinguen por nombre, los indicadores se explican en palabras
// simples, y el resumen de la Auditoría sigue en UNA fila en escritorio (la primera versión de v0 lo apilaba) y en
// grilla de 2 columnas en celular, sin scroll horizontal de la página.
test('Dashboard explica sus indicadores y la Auditoría mantiene su diseño en escritorio y celular', async ({ page }) => {
  test.setTimeout(120000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });

  const seed = (id) => page.evaluate(async (id) => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const eq = [1, 2, 3, 4].map((i) => ({ sigla: 'ZZ-' + i, tipo: 'Camion', modelo: 'X', horomActual: 1000 * i, frecPM: 250 }));
    let texto = '';
    for (let k = 0; k < 8; k++) {
      S.s('eq', eq); S.s('ot', []); await esp(400);
      go(id); renders[id] && renders[id](); await esp(900);
      const el = document.getElementById('s-' + id);
      texto = el ? el.innerText : '';
      if (id === 'dash' ? /probabilidad de no fallar/i.test(texto) : !!document.querySelector('#s-audit .audit-summary')) break;
    }
    return texto;
  }, id);

  const t = await seed('dash');
  expect(t).toMatch(/probabilidad de no fallar \(R\)/i);
  expect(t).toMatch(/equipos sin fallas/i);
  expect(t).toMatch(/se puede corregir ahora/i);
  expect(t).toMatch(/muestra lo ocurrido/i);
  expect(t).not.toMatch(/confiabilidad \(R\)/i);   // el nombre viejo que se confundía con «Equipos sin fallas»

  for (const [w, h, esEscritorio] of [[1280, 900, true], [360, 780, false]]) {
    await page.setViewportSize({ width: w, height: h });
    await seed('audit');
    const r = await page.evaluate(() => {
      const caja = document.querySelector('#s-audit .audit-summary');
      const tops = Array.from(caja.querySelectorAll('.card')).map((c) => Math.round(c.getBoundingClientRect().top));
      return { n: tops.length, filas: new Set(tops).size, desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(r.n).toBe(6);
    expect(r.desborde).toBeLessThanOrEqual(4);
    if (esEscritorio) expect(r.filas).toBe(1);   // seis tarjetas en una sola fila
    else expect(r.filas).toBe(3);                // 2 columnas × 3 filas
  }
});
