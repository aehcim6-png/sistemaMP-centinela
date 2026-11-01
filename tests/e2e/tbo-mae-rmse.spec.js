const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// MAE y RMSE en el pronóstico de gasto (1-nov-2026): la tabla de modelos muestra el error medio (MAE) y el error con picos (RMSE), con una explicación plegada y el RMSE
// marcado cuando es mucho mayor que el MAE.
test('TBO muestra el MAE y el RMSE de cada modelo, con su explicación', async ({ page }) => {
  test.setTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 900 });

  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const eq = [{ sigla: 'ZZ-1', tipo: 'Camion', modelo: 'X', horomActual: 1000, frecPM: 250 }];
    // 40 meses de compras con un mes muy caro (pico) para que el RMSE supere al MAE
    const hoy = new Date(); const compras = [];
    for (let i = 0; i < 40; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - 41 + i, 10);
      const f = d.toISOString().slice(0, 10);
      compras.push({ pedido: 'P' + i, sigla: 'ZZ-1', detalle: 'rep ' + i, costo: 100000 + (i % 12) * 5000 + (i === 30 ? 400000 : 0), fecha: f, tipo: 'Repuesto' });
    }
    window._comp2Sub = 'tbo';
    go('comp2'); await esp(2500);   // carga el módulo; luego se siembra y se dibuja en el mismo instante (la carga en segundo plano borra lo sembrado)
    for (let k = 0; k < 10; k++) {
      S.s('eq', eq); S.s('ocHist', compras); renders.tbo();
      const t = document.getElementById('s-tbo');
      if (t && /Con errores grandes \(RMSE\)/.test(t.textContent)) {
        const det = [...t.querySelectorAll('details')].find((d) => /MAE y el RMSE/.test(d.querySelector('summary').textContent));
        return { ok: true, resumen: !!det, cerrada: !!det && !det.open, ejemplo: !!det && /6,25/.test(det.textContent) };
      }
      await esp(500);
    }
    return { ok: false };
  });
  expect(r.ok).toBe(true);
  expect(r.resumen).toBe(true);
  expect(r.cerrada).toBe(true);
  expect(r.ejemplo).toBe(true);
  expect(errores).toEqual([]);
});
