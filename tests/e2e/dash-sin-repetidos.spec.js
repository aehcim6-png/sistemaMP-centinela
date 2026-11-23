const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Dashboard sin repetidos (23-nov-2026): un equipo urgente (PM en 7 días o menos) sale solo en «Equipos Urgentes», no también en «Próximos PMs»; y la lista de salud baja ya no es un bloque aparte debajo del Mapa de Salud.
test('Dashboard: un equipo urgente no se repite en Próximos PMs y no hay un bloque aparte de Salud Baja', async ({ page }) => {
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
  const r = await page.evaluate(async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const mk = (sigla, horomActual) => ({ sigla, tipo: 'Camion', modelo: 'M', frecPM: 250, hrsDia: 10, horomActual, fechaHorom: hoy, criticidad: 'Crítico' });
    const sembrar = () => { S.s('eq', [mk('UR-1', 950), mk('PX-1', 900)]); };   // UR-1: PM en 5 días (urgente) · PX-1: PM en 10 días (próxima)
    for (let k = 0; k < 40; k++) {
      sembrar(); window.renderDash();
      const t = document.getElementById('s-dash').innerText;
      if (/UR-1/.test(t) && /PX-1/.test(t)) {
        const bloques = [...document.querySelectorAll('#s-dash .chart-box, #s-dash div')].filter((d) => /Próximos PMs/.test((d.firstElementChild || {}).innerText || '') && d.children.length > 1);
        const prox = bloques.length ? bloques[bloques.length - 1].innerText : '';
        const urg = [...document.querySelectorAll('#s-dash .chart-box')].find((d) => /Equipos Urgentes/.test(d.innerText));
        return { t, prox, urg: urg ? urg.innerText : '' };
      }
      await new Promise((x) => setTimeout(x, 100));
    }
    return { t: document.getElementById('s-dash').innerText, prox: '', urg: '' };
  });
  expect(r.urg).toContain('UR-1');                         // el urgente está en «Equipos Urgentes»
  expect(r.prox).toContain('PX-1');                        // el de 10 días, en «Próximos PMs»
  expect(r.prox).not.toContain('UR-1');                    // y el urgente no se repite ahí
  expect(r.t).toContain('8 a 14 días');
  expect(r.t).not.toContain('Equipos con Salud Baja');     // ya no hay un bloque aparte de salud baja
});
