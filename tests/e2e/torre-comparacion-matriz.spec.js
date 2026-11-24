const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Torre de Control: la matriz es el Score en uso (24-nov-2026), con una comparación contra el Score anterior y un botón para volver al método anterior.
test('Torre usa la matriz como Score, muestra la comparación con el Score anterior, el veto y permite volver al método anterior', async ({ page }) => {
  test.setTimeout(120000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.waitForTimeout(3000);
  const t = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const hoy = new Date().toISOString().slice(0, 10), ayer = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const mk = (sigla, horom) => ({ sigla, tipo: 'Camion', modelo: 'HD785-7', frecPM: 250, hrsDia: 12, horomActual: horom, horomProxPM: horom + 100, fechaHorom: hoy, fechaProxPM: hoy, criticidad: 'Crítico' });
    const sembrar = () => {
      S.s('eq', [mk('TW-1', 5000), mk('TW-2', 5000)]);
      S.s('compMayores', [{ _id: 'c1', sigla: 'TW-1', comp: 'Motor', esOriginal: true, vidaUtil: 15000 }, { _id: 'c2', sigla: 'TW-2', comp: 'Motor', esOriginal: true, vidaUtil: 15000 }, { _id: 'c3', sigla: 'TW-2', comp: 'Hidráulico', esOriginal: true, vidaUtil: 15000 }]);
      S.s('aceite', [{ _id: 'a1', sigla: 'TW-2', _sigla: 'TW-2', equipo: 'TW-2', fecha: ayer, componente: 'TRANSMISION', estado: 'ALERTA' }]);
      S.s('ot', []); S.s('neu', []);
    };
    sembrar(); go('dash'); await esp(1000); go('torre');
    for (let k = 0; k < 50; k++) { sembrar(); window.renderTorre(); const x = (document.getElementById('s-torre') || {}).textContent || ''; if (/TW-1/.test(x) && /TW-2/.test(x)) return x; await esp(100); }
    return '';
  });
  expect(t).toContain('Comparación: Score anterior vs. matriz');
  expect(t).toContain('la matriz es el Score en uso');
  expect(t).toContain('matriz de salud');
  expect(t).toContain('aceite en alerta: TRANSMISION');   // el veto de TW-2 con su motivo
  expect(t).toContain('TW-1');
  // volver al método anterior con el botón y que la Torre lo diga
  const t2 = await page.evaluate(async () => {
    window._torreCambiarMetodo();
    await new Promise((x) => setTimeout(x, 500));
    const x = (document.getElementById('s-torre') || {}).textContent || '';
    window._torreCambiarMetodo();   // dejar la matriz como estaba
    return x;
  });
  expect(t2).toContain('método anterior');
});
