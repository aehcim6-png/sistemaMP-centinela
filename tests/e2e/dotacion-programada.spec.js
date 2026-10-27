const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Trabajos diarios programados → Resumen: la tarjeta «Dotación programada» cuenta personas por día y turno según su cargo, aunque el cargo venga escrito de distintas formas.
test('el resumen de la programación diaria muestra la dotación por turno con los cargos normalizados', async ({ page }) => {
  test.setTimeout(120000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 1000 });
  const texto = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const f = (fecha, turno, nombre, cargo) => ({ fecha, turno, nombre, cargo, orden: 1, responsable: 'X', bloques: [] });
    const sembrar = () => S.s('progDia', [f('2026-07-14', 'Día', 'A', 'Mecánico'), f('2026-07-14', 'Día', 'B', 'Mecánico Lider'), f('2026-07-14', 'Día', 'C', 'Eelctro Mecanico'), f('2026-07-14', 'Día', 'D', 'Soldador'),
      f('2026-07-14', 'Noche', 'E', 'Mecanico'), f('2026-07-14', 'Noche', 'F', 'Mecánico lider'), f('2026-07-17', 'Día', 'A', 'Mecánico'), f('2026-07-17', 'Día', 'G', 'Supervisor general')]);
    window._progDiaVista = 'resumen'; window._planiSub = 'progdia';
    sembrar(); go('plani');
    let t = '';
    for (let k = 0; k < 60; k++) {
      sembrar();
      if (typeof renders.progdia === 'function' && document.getElementById('s-progdia')) renders.progdia();
      await esp(100);
      t = (document.getElementById('s-progdia') || {}).innerText || '';
      if (/Dotación programada/i.test(t)) break;
    }
    return t;
  });
  expect(texto).toMatch(/Dotación programada/i);
  expect(texto).toMatch(/Día:\s*1,5 mecánicos/);          // 2 el 14 y 1 el 17
  expect(texto).toMatch(/Noche:\s*2 mecánicos/);
  expect(texto).toContain('de 2 día(s) cargado(s)');
  expect(texto).toContain('Cargos sin clasificar: Supervisor general');
});
