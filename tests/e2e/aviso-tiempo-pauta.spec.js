const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// rAvisoTiempoPauta (modules/renders/reg.js): al registrar un PM, con los minutos por tarea de pautas_tiempos dice cuánto trabajo pide la pauta
// y si la duración anotada da para hacerla. Es solo informativo: no bloquea ni guarda nada.
// Pauta de prueba del grupo (referencia CN-9507, como GRUPO_PAUTAS): PM1 = 5 tareas de 250 h × 60 min = 300 min = 5 h-persona.
// El formulario vive en un diálogo que Playwright no da por visible (igual que en ocr.spec.js): se asigna el valor y se dispara el evento de cambio, como haría el navegador.
const poner = (page, id, valor) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [id, valor]);

test('al registrar un PM, avisa cuánto pide la pauta y si el tiempo anotado alcanza', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.route(`${SB_URL}/rest/v1/equipos**`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { sigla: 'CN-9500', tipo: 'Camion', modelo: 'Komatsu HD785-7', estado: 'Operativo', frecPM: 250, hrsDia: 20, horomActual: 10000, fechaHorom: '2026-09-01' },
        { sigla: 'CA-1', tipo: 'Camioneta', modelo: 'Toyota Hilux', estado: 'Operativo', frecPM: 10000, hrsDia: 8, horomActual: 90000, fechaHorom: '2026-09-01' },
      ]),
    });
  });
  const tareas = [1, 2, 3, 4, 5].map((i) => ({ id: 'pt' + i, sigla: 'CN-9507', modelo: 'Komatsu HD785-7', hoja: 'Mineria', orden: i, seccion: null, act: 'Tarea ' + i, topeHoras: 250, unidad: 'h', minutos: 60 }));
  await page.route(`${SB_URL}/rest/v1/pautas_tiempos**`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-4/5' }, body: JSON.stringify(tareas) });
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_email')).toHaveValue('admin@test.com', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#loginOverlay')).toHaveCount(0, { timeout: 10000 });
  await expect.poll(() => page.evaluate(() => (S.g('eq') || []).some((e) => e.sigla === 'CN-9500'))).toBe(true);
  await expect.poll(() => page.evaluate(() => (S.g('pautasTiempos') || []).length)).toBe(5);

  await page.evaluate(() => addReg());
  await expect(page.locator('#rPautaTiempo')).toBeAttached();
  const regAntes = await page.evaluate(() => (S.g('reg') || []).length);

  // Equipo del grupo HD785-7 (su pauta de tiempos vive bajo CN-9507): sin horas anotadas solo dice cuánto pide la pauta.
  await poner(page, 'rEq', 'CN-9500');
  await poner(page, 'rPM', 'PM1');
  await expect(page.locator('#rPautaTiempo')).toContainText('pide 5 h de trabajo por persona');
  await expect(page.locator('#rPautaTiempo')).toContainText('5 tareas');

  // 1 h anotada, cuadrilla de 3: cobertura 0,6 → no alcanza, se necesitarían 5 técnicos.
  await poner(page, 'rFecEnt', '2026-09-10');
  await poner(page, 'rHoraEnt', '08:00');
  await poner(page, 'rFecSal', '2026-09-10');
  await poner(page, 'rHoraSal', '09:00');
  await expect(page.locator('#rPautaTiempo')).toContainText('unos 5 técnicos');
  await expect(page.locator('#rPautaTiempo')).toContainText('no alcanza a cubrir toda la pauta');

  // 0,5 h: menos de la mitad → pide marcar «No — faltó algo».
  await poner(page, 'rHoraSal', '08:30');
  await expect(page.locator('#rPautaTiempo')).toContainText('Es poco tiempo para toda la pauta');
  await expect(page.locator('#rPautaTiempo')).toContainText('faltó algo');

  // 2 h: cobertura 1,2 → alcanza, sin advertencia.
  await poner(page, 'rHoraSal', '10:00');
  await expect(page.locator('#rPautaTiempo')).toContainText('unos 2,5 técnicos');
  await expect(page.locator('#rPautaTiempo')).not.toContainText('no alcanza');
  await expect(page.locator('#rPautaTiempo')).not.toContainText('poco tiempo');

  // Equipo medido en km (camioneta): no hay aviso.
  await poner(page, 'rEq', 'CA-1');
  await expect(page.locator('#rPautaTiempo')).toHaveText('');

  // Informativo: no guardó nada.
  expect(await page.evaluate(() => (S.g('reg') || []).length)).toBe(regAntes);
});
