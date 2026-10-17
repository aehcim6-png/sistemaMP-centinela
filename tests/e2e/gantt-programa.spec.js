const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Carta Gantt: el PM sale del Programa Anual del mes; un correctivo se pinta aparte y no cuenta como PM ejecutado.
test('Gantt toma el PM del Programa Anual y separa el correctivo del PM ejecutado', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });

  const r = await page.evaluate(async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const MS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const mes = MS[new Date().getMonth()];
    const meses = {}; MS.forEach(m => { meses[m] = ''; }); meses[mes] = 'PM3';
    S.s('eq', [{ sigla: 'ZZ-1', tipo: 'Camion', modelo: 'X', tipoPM: 'PM1' }, { sigla: 'ZZ-2', tipo: 'Camion', modelo: 'X', tipoPM: 'PM1' }]);
    S.s('prg', [{ sigla: 'ZZ-1', tipo: 'Camion', modelo: 'X', meses }, { sigla: 'ZZ-2', tipo: 'Camion', modelo: 'X', meses }]);
    S.s('gantt', []);
    S.s('reg', []);
    S.s('ot', [{ sigla: 'ZZ-2', fecha: hoy }]);
    go('plani');
    for (let i = 0; i < 100 && !document.getElementById('s-gantt'); i++) await new Promise(r => setTimeout(r, 100));
    planiSub('gantt');
    for (let i = 0; i < 100 && !document.querySelector('#s-gantt table tr td'); i++) await new Promise(r => setTimeout(r, 100));
    const filas = [...document.querySelectorAll('#s-gantt table tr')].slice(1).map(tr => ({
      sigla: tr.cells[0].innerText.trim(), pm: tr.cells[1].innerText.trim(), estado: tr.cells[4].innerText.replace(/\s+/g, ' ').trim(),
      avance: tr.cells[5].innerText.trim(), naranjo: [...tr.querySelectorAll('td')].some(td => td.style.background && td.title === 'Correctivo registrado'),
    }));
    return filas;
  });
  const z1 = r.find(f => f.sigla === 'ZZ-1'), z2 = r.find(f => f.sigla === 'ZZ-2');
  expect(z1.pm).toBe('PM3');          // Programa Anual manda sobre el PM1 del equipo
  expect(z2.pm).toBe('PM3');
  expect(z2.naranjo).toBe(true);      // el correctivo se pinta
  expect(z2.estado).toContain('correctivo');
  expect(z2.estado).not.toContain('PM ejecutado');
  expect(z2.avance).toBe('0%');       // no queda en 100 % por un correctivo
});
