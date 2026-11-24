const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Torre de Control: comparación del Score actual con la matriz propuesta (24-nov-2026). Es un borrador desplegable que no cambia el Score visible.
test('Torre muestra la comparación Score actual vs matriz propuesta, con el veto y sin cambiar el Score visible', async ({ page }) => {
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
  expect(t).toContain('Comparación: Score actual vs. matriz propuesta');
  expect(t).toContain('borrador, no cambia lo que se ve arriba');
  expect(t).toContain('aceite en alerta: TRANSMISION');   // el veto de TW-2 con su motivo
  expect(t).toContain('TW-1');
});
