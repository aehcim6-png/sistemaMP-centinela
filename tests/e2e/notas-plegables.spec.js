const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Notas plegables (24-nov-2026): bajo el título de cada pestaña hay una nota; un botón ⓘ la oculta o la vuelve a mostrar, y se recuerda por pestaña.
test('Cada pestaña tiene un botón ⓘ que oculta y muestra su nota, y lo elegido se recuerda', async ({ page }) => {
  test.setTimeout(150000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Correctivos: nota «N total (incluye correctivos…)»
  await page.evaluate(() => go('ot'));
  const nota = page.locator('#s-ot .sec-s').first();
  const btn = page.locator('#s-ot .nota-btn').first();
  await expect(nota).toBeVisible({ timeout: 10000 });
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await btn.click();
  await expect(nota).toBeHidden();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');

  // se recuerda: al volver a dibujar la pestaña, la nota sigue oculta
  await page.evaluate(() => go('reg'));
  await page.evaluate(() => go('ot'));
  await expect(page.locator('#s-ot .sec-s').first()).toBeHidden({ timeout: 10000 });
  expect(await page.evaluate(() => localStorage.getItem('notasOcultas'))).toContain('s-ot');

  // otra pestaña no se ve afectada, y se puede volver a mostrar
  await page.evaluate(() => go('reg'));
  await expect(page.locator('#s-reg .sec-s').first()).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => go('ot'));
  await page.locator('#s-ot .nota-btn').first().click();
  await expect(page.locator('#s-ot .sec-s').first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('notasOcultas'))).not.toContain('s-ot');

  // todas las pestañas con nota tienen su botón (una vez por nota)
  const faltan = [];
  for (const id of ['eq', 'reg', 'plani', 'stk2', 'buscar', 'venc']) {
    await page.evaluate((i) => go(i), id);
    await page.waitForTimeout(1500);
    const r = await page.evaluate((i) => {
      const s = document.getElementById('s-' + i);
      const notas = [...s.querySelectorAll('.sec-s')].filter((n) => n.textContent.trim());
      return { notas: notas.length, botones: s.querySelectorAll('.nota-btn').length };
    }, id);
    if (r.notas && r.botones !== r.notas) faltan.push(id + ':' + JSON.stringify(r));
  }
  expect(faltan).toEqual([]);
});
