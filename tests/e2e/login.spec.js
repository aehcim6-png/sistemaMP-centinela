const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Espera a que el widget mockeado de Turnstile ya haya entregado el token
// (ver mock-supabase.js: llega ~10ms después de que "carga" el script) antes
// de llenar el formulario — sin esto, bajo carga (ej. varios specs corriendo
// en paralelo) el clic en #li_btn puede llegar antes de que el botón
// realmente acepte el envío, dejando el formulario en un estado intermedio.
async function esperarCaptchaListo(page) {
  await page.waitForFunction(() => !!window._turnstileToken);
}

// expect(locator).toHaveValue() reintenta hasta que el DOM converge — a
// diferencia de fill() seguido de un click inmediato, esto cierra cualquier
// ventana donde el overlay se haya vuelto a dibujar (ej. bajo carga pesada,
// con varios specs corriendo en paralelo) entre llenar el campo y hacer clic,
// que dejaba el formulario con los campos vacíos justo antes del envío.
async function llenarLogin(page, email, pass) {
  await page.locator('#li_email').fill(email);
  await page.locator('#li_pass').fill(pass);
  await expect(page.locator('#li_email')).toHaveValue(email, { timeout: 15000 });
  await expect(page.locator('#li_pass')).toHaveValue(pass, { timeout: 15000 });
}

test.describe('Login', () => {
  test('muestra el widget de CAPTCHA (Turnstile) antes de poder ingresar', async ({ page }) => {
    await mockSupabase(page, { loginOk: true });
    await page.goto('/');
    await expect(page.locator('#li_captcha')).toBeVisible();
    await expect(page.locator('#li_email')).toBeVisible();
    await expect(page.locator('#li_pass')).toBeVisible();
  });

  test('login con credenciales correctas cierra el overlay y entra al dashboard', async ({ page }) => {
    await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
    await page.goto('/');
    await esperarCaptchaListo(page);
    await llenarLogin(page, 'admin@test.com', 'claveCorrecta123');
    // El botón espera un token de Turnstile (mockeado, llega ~10ms después
    // de que el script "de Cloudflare" carga) antes de aceptar el clic.
    await expect(page.locator('#li_btn')).toBeEnabled();
    await page.locator('#li_btn').click();
    await expect(page.locator('#loginOverlay')).toHaveCount(0, { timeout: 10000 });
  });

  test('login con credenciales incorrectas muestra error y no cierra el overlay', async ({ page }) => {
    await mockSupabase(page, { loginOk: false });
    await page.goto('/');
    await esperarCaptchaListo(page);
    await llenarLogin(page, 'admin@test.com', 'claveIncorrecta');
    await page.locator('#li_btn').click();
    await expect(page.locator('#li_err')).toBeVisible();
    await expect(page.locator('#li_err')).toHaveText('Email o contraseña incorrectos.');
    await expect(page.locator('#loginOverlay')).toBeVisible();
  });

  test('cuenta con contraseña vencida por primer ingreso pide cambio de clave antes de entrar', async ({ page }) => {
    await mockSupabase(page, { loginOk: true, mustChangePassword: true });
    await page.goto('/');
    await esperarCaptchaListo(page);
    await llenarLogin(page, 'nuevo@test.com', 'claveTemporal123');
    await page.locator('#li_btn').click();
    await expect(page.locator('#loginOverlay')).toContainText('Primer ingreso', { timeout: 10000 });
  });
});
