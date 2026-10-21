const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Accesos del servidor (22-oct): tarjeta en Configuración (solo admin) que lee public.accesos_servidor — el registro que copia el propio servidor
// de cada sesión de Supabase Auth. Rojo = sospechoso (también llega por correo), ámbar = revisar, base = ya existía al instalar.
const hace = (h) => new Date(Date.now() - h * 3600000).toISOString();
const FILAS = [
  { sesion_creada: hace(1), usuario_email: 'duena@test.com', ip: '9.9.9.9', navegador: '<script>window.__xss=1</script> Chrome', aal_final: 'aal1', motivos: ['ip_y_navegador_nuevos', 'mfa_incompleto'], nivel: 'rojo', base: false },
  { sesion_creada: hace(5), usuario_email: 'duena@test.com', ip: '3.3.3.3', navegador: 'Chrome Linux', aal_final: 'aal2', motivos: ['ip_nueva'], nivel: 'ambar', base: false },
  { sesion_creada: hace(30), usuario_email: 'duena@test.com', ip: '1.1.1.1', navegador: 'Chrome Linux', aal_final: 'aal2', motivos: [], nivel: 'normal', base: false },
  { sesion_creada: hace(24 * 20), usuario_email: 'antigua@test.com', ip: '2.2.2.2', navegador: 'Chrome Win', aal_final: 'aal1', motivos: [], nivel: 'base', base: true },
];

async function entrar(page, role, respuesta) {
  await mockSupabase(page, { loginOk: true, role, nombre: 'Usuario Test' });
  await page.route('**/rest/v1/accesos_servidor*', (route) => route.fulfill(respuesta));
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
}

test('el admin ve en rojo los accesos sospechosos del servidor, con el detalle escapado', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page, 'admin', { status: 200, contentType: 'application/json', body: JSON.stringify(FILAS) });
  await page.evaluate(() => go('cfg'));
  const resumen = page.locator('#accSrvResumen');
  await expect(resumen).toContainText('1 acceso(s) sospechoso(s)', { timeout: 15000 });
  await expect(resumen).toContainText('1 por revisar');                       // la sesión «base» de hace 20 días no cuenta
  await expect(page.locator('#accSrvCard')).toHaveCSS('border-left-color', /.+/);
  expect(await page.evaluate(() => document.getElementById('accSrvCard').style.borderLeftColor)).toBe('var(--danger)');
  // la tarjeta quedó dentro del grupo «Usuarios y accesos»
  expect(await page.evaluate(() => /Usuarios y accesos/.test(document.getElementById('accSrvCard').closest('.cfg-grupo').querySelector('summary').textContent))).toBe(true);

  await page.evaluate(() => verAccesosServidor());
  const tabla = page.locator('#mbg table');
  await expect(tabla).toContainText('duena@test.com', { timeout: 10000 });
  await expect(tabla).toContainText('IP y navegador nunca vistos en esta cuenta');
  await expect(tabla).toContainText('la sesión no la completó');
  await expect(tabla).toContainText('sesión anterior a la instalación');
  await expect(tabla).toContainText('<script>window.__xss=1</script>');       // el navegador lo controla quien entra: se muestra como texto
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator('#mbg script').count()).toBe(0);
});

test('sin sospechosos en 72 h muestra el estado en verde', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page, 'admin', { status: 200, contentType: 'application/json', body: JSON.stringify([FILAS[2], FILAS[3]]) });
  await page.evaluate(() => go('cfg'));
  await expect(page.locator('#accSrvResumen')).toContainText('Sin accesos sospechosos', { timeout: 15000 });
});

test('si la tabla todavía no existe en el proyecto, la tarjeta avisa que falta activarla', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page, 'admin', { status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: 'Could not find the table' }) });
  await page.evaluate(() => go('cfg'));
  await expect(page.locator('#accSrvResumen')).toContainText('Aún no está activado', { timeout: 15000 });
});

test('un operador no ve la tarjeta de accesos del servidor', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page, 'operador', { status: 200, contentType: 'application/json', body: JSON.stringify(FILAS) });
  await page.evaluate(() => go('cfg'));
  await page.waitForTimeout(2500);
  expect(await page.locator('#accSrvCard').count()).toBe(0);
});
