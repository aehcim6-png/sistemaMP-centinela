const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// PNG 1x1 válido (se decodifica de verdad en <img>, requisito de
// comprimirImagen() — no importa el contenido visual, solo que sea una
// imagen real que el navegador pueda cargar y volver a codificar a JPEG).
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

async function loginComoAdmin(page) {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_email')).toHaveValue('admin@test.com', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#loginOverlay')).toHaveCount(0, { timeout: 10000 });
}

// _prellenarDesdeOCR/_leerPautaFotoSeleccionada (modules/renders/reg.js): la
// lectura de la foto de la pauta de PM SOLO prellena el formulario de
// "Registrar Mantención" — nunca llama a saveReg() por su cuenta, la persona
// tiene que revisar y guardar a mano (ver comentario del propio archivo:
// motivado por un caso real de tipear 7 pautas firmadas a mano).
test('OCR de pauta PM prellena el formulario y NO guarda nada solo', async ({ page }) => {
  // Un equipo cuya sigla calza EXACTO con lo que "lee" el OCR más abajo —
  // así se puede verificar también el auto-match de equipo por sigla. Se
  // mockea el endpoint ANTES de navegar (en vez de sembrar con S.s() después
  // del login) porque _refrescarDatosPostLogin() sigue cargando datos de
  // fondo después de que el overlay de login ya desapareció — sembrar la
  // caché justo ahí es una carrera contra esa carga, que la pisa con [].
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.route(`${SB_URL}/rest/v1/equipos**`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        sigla: 'CAEX-01', tipo: 'CAEX', modelo: 'Test 797F', estado: 'Operativo',
        frecPM: 250, hrsDia: 20, horomActual: 10000, fechaHorom: '2026-09-01',
      }]),
    });
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_email')).toHaveValue('admin@test.com', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#loginOverlay')).toHaveCount(0, { timeout: 10000 });
  await expect.poll(() => page.evaluate(() => (S.g('eq') || []).some((e) => e.sigla === 'CAEX-01'))).toBe(true);

  await page.evaluate(() => addReg());
  await expect(page.locator('#rPautaFoto')).toBeAttached();
  const regAntes = await page.evaluate(() => (S.g('reg') || []).length);

  await page.route(`${SB_URL}/functions/v1/leer-pauta-pm`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        datos: {
          sigla: 'CAEX-01',
          tipoPM: 'PM2',
          horometro: 12345,
          horaInicio: '08:00',
          horaTermino: '10:30',
          fecha: '2026-09-10',
          tecnico1: 'Juan Pérez',
          camposInciertos: ['fecha'],
        },
      }),
    })
  );

  await page.locator('#rPautaFoto').setInputFiles({ name: 'pauta.png', mimeType: 'image/png', buffer: PNG_1PX });

  await expect(page.locator('#tst')).toContainText('Pauta leída', { timeout: 10000 });

  // Campos numéricos/de texto prellenados con lo que "leyó" el OCR.
  await expect(page.locator('#rHor')).toHaveValue('12345');
  await expect(page.locator('#rHoraEnt')).toHaveValue('08:00');
  await expect(page.locator('#rHoraSal')).toHaveValue('10:30');
  await expect(page.locator('#rPM')).toHaveValue('PM2');
  // Auto-match de equipo por sigla exacta.
  await expect(page.locator('#rEq')).toHaveValue('CAEX-01');

  // La fecha viene SIEMPRE marcada para revisión manual (ver comentario de
  // _activarLeerPauta: el año puede fallar sin quedar en camposInciertos).
  const fechaMarcada = await page.evaluate(() => document.getElementById('rFecEnt').style.background !== '');
  expect(fechaMarcada).toBe(true);

  // Nunca se guardó nada solo: sigue siendo un prellenado, no un guardado.
  const regDespues = await page.evaluate(() => (S.g('reg') || []).length);
  expect(regDespues).toBe(regAntes);
});

test('OCR con error del servidor no rompe el formulario ni finge datos', async ({ page }) => {
  await loginComoAdmin(page);
  await page.evaluate(() => addReg());
  await expect(page.locator('#rPautaFoto')).toBeAttached();

  await page.route(`${SB_URL}/functions/v1/leer-pauta-pm`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'No se pudo leer la foto, intenta con más luz' }),
    })
  );

  await page.locator('#rPautaFoto').setInputFiles({ name: 'pauta.png', mimeType: 'image/png', buffer: PNG_1PX });

  await expect(page.locator('#tst')).toContainText('No se pudo leer la foto', { timeout: 10000 });
  await expect(page.locator('#rHor')).toHaveValue('');
});
