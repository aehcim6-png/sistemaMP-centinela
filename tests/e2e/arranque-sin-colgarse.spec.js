const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');
// Caso real (16-nov-2026, celular): con una sesión guardada, la verificación de la sesión al arrancar se quedaba colgada y la pantalla quedaba vacía
// (cabecera fija, sin contadores ni menú, sin aviso). Ahora hay un tiempo máximo y, si la app igual no arranca, un aviso con salidas.
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE5OTk5OTk5OTksInN1YiI6IngifQ.firma';
test('sesión guardada + servidor colgado: aparece el login (no pantalla vacía) en pocos segundos', async ({ page }) => {
  test.setTimeout(60000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.route('**/auth/v1/user', () => { /* nunca responde: simula la conexión colgada */ });
  await page.route('**/auth/v1/token**', () => { /* tampoco el refresco */ });
  await page.addInitScript((t) => { localStorage.setItem('smp_access_token', t); localStorage.setItem('smp_refresh_token', 'rt'); window._SMP_TIMEOUT_AUTH_MS = 1500; }, JWT);
  await page.goto('/');
  await expect(page.locator('#loginOverlay')).toBeVisible({ timeout: 15000 });
  // y la sesión guardada NO se borra solo por no haber podido verificarla (puede ser solo la señal)
  expect(await page.evaluate(() => localStorage.getItem('smp_access_token'))).toBe(JWT);
});

test('si la app no arranca en el tiempo previsto, aparece el aviso con «Reintentar» y «Cerrar sesión»', async ({ page }) => {
  test.setTimeout(60000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  // la verificación responde, pero la carga de roles queda colgada: el arranque no termina
  await page.route('**/rest/v1/user_roles**', () => { /* colgado */ });
  // la sesión se siembra UNA vez (si no, el script la volvería a poner al recargar y no se vería el efecto de «Cerrar sesión»)
  await page.addInitScript((t) => { if (!sessionStorage.getItem('_sembrado')) { sessionStorage.setItem('_sembrado', '1'); localStorage.setItem('smp_access_token', t); localStorage.setItem('smp_refresh_token', 'rt'); } window._SMP_TIMEOUT_ARRANQUE_MS = 2500; }, JWT);
  await page.goto('/');
  await expect(page.locator('#avisoCargaLenta')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#avisoCargaReint')).toBeVisible();
  await page.locator('#avisoCargaSalir').click();
  await page.waitForLoadState('domcontentloaded');
  expect(await page.evaluate(() => localStorage.getItem('smp_access_token'))).toBeNull();
});

test('arranque normal: no aparece ningún aviso', async ({ page }) => {
  test.setTimeout(60000);
  await page.addInitScript(() => { window._SMP_TIMEOUT_ARRANQUE_MS = 3000; });
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await page.locator('#li_btn').click();
  await page.locator('#s-dash').waitFor({ timeout: 15000 });
  await page.waitForTimeout(4500);
  await expect(page.locator('#avisoCargaLenta')).toHaveCount(0);
});
