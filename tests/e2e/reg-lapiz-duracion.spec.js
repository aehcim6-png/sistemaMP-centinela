const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Registro PM: el «clic ✏» de la columna Duración (registros sin horas) abre el editor del registro completo, igual que el lápiz del final de la fila.
test('el lápiz de Duración abre el editor del registro', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.route(`${SB_URL}/rest/v1/equipos**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
    { sigla: 'CN-10155', tipo: 'Camion', modelo: 'X', estado: 'Operativo', frecPM: 250, hrsDia: 20, horomActual: 4950, fechaHorom: '2026-11-09' },
  ]) }));
  const regs = [
    { id: 'r1', equipo: 'CN-10155', tipoPM: 'PM3', fechaEntrada: '2026-11-09', horaEntrada: '11:00', fechaSalida: '2026-11-09', horaSalida: '23:00', horomReal: 4950, estatusEq: 'Operativo', nReg: 481 },
    { id: 'r2', equipo: 'CN-10155', tipoPM: 'PM1', fechaEntrada: '2026-10-26', horomReal: 4750, estatusEq: 'Operativo', duracion: '3h 46min', nReg: 448 },
  ];
  await page.route(`${SB_URL}/rest/v1/registros_pm**`, (r) => r.request().method() !== 'GET' ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-1/2' }, body: JSON.stringify(regs) }));
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com'); await page.locator('#li_pass').fill('claveCorrecta123'); await page.locator('#li_btn').click();
  await expect(page.locator('#s-reg')).toHaveCount(1, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (S.g('reg') || []).length)).toBe(2);
  await page.evaluate(() => window.go('dash'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.go('reg'));
  const boton = page.locator('#tbl-reg td button', { hasText: 'clic' });
  await expect(boton).toHaveCount(1, { timeout: 10000 }); // el registro sin duración
  // El registro con duración pero sin horas de entrada y salida también trae su lápiz (registros anteriores).
  await expect(page.locator('#tbl-reg td button[title^="Registro sin hora"]')).toHaveCount(1);
  await boton.click();
  await expect(page.locator('#modal, .modal, [id^="modal"]').first()).toContainText('Editar Registro — CN-10155 PM3');
  await expect(page.locator('#eFecEnt')).toHaveValue('2026-11-09');
  await expect(page.locator('#eHoraSal')).toHaveValue('23:00');
  await page.getByRole('button', { name: /Cancelar/ }).click();
  // El lápiz del final de la fila sigue funcionando.
  await page.locator('#tbl-reg button[title="Editar completo"]').first().click();
  await expect(page.locator('#eFecEnt')).toBeAttached();
});
