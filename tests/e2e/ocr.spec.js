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

// _revisarChequeoNeuOCR/_guardarChequeoNeuOCR (modules/renders/neu.js): a
// diferencia de pauta/informe (que solo prellenan UN formulario), el chequeo
// de neumáticos SÍ guarda al final — pero solo lo que la persona dejó
// tildado, y solo filas que calzan con un neumático Operativo ya registrado
// en ese Equipo+Posición (nunca crea neumáticos nuevos a ciegas).
test('OCR de chequeo de neumáticos: solo guarda las filas tildadas que calzan con un neumático real', async ({ page }) => {
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
  await page.route(`${SB_URL}/rest/v1/neumaticos**`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'neu-fixture-1', sigla: 'CAEX-01', tipo: 'Nuevo', marca: 'Bridgestone',
        serie: 'SER-0001', medida: '27.00R49', posicion: 'Del.Izq', numPos: 1,
        estado: 'Operativo', tipoEquipo: 'CAEX', vidaUtil: 4000, remNuevo: 91,
        remanente: 40, pctRemanente: 44,
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
  await expect.poll(() => page.evaluate(() => (S.g('neu') || []).some((n) => n.serie === 'SER-0001'))).toBe(true);
  // go('neu') dibuja adentro de #s-neu, que recién existe una vez que
  // initNav() corrió (dentro de _arrancar(), llamado cuando TERMINA
  // _sbLoadHeavy() por completo) — _sbCache['neu'] puede llenarse ANTES de
  // eso, mientras otras ~30 tablas todavía están cargando en paralelo, así
  // que el poll de arriba no alcanza para garantizar que el shell de
  // pestañas ya esté armado.
  await page.waitForFunction(() => !!document.getElementById('s-dash'), { timeout: 15000 });

  await page.evaluate(() => go('neu'));
  await expect(page.locator('#neuChequeoFoto')).toBeAttached();
  const medsAntes = await page.evaluate(() => (S.g('neuMed') || []).length);

  await page.route(`${SB_URL}/functions/v1/leer-chequeo-neumaticos`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        datos: {
          paneles: [
            {
              equipo: 'CAEX-01',
              fecha: '2026-09-10',
              horometro: 10500,
              // Una fila que SÍ calza con el neumático registrado arriba (numPos:1)...
              neumaticos: [
                { posicion: 1, presion: 110, temperatura: 65, remExt: 18, remInt: 17 },
                // ...y otra que no calza con ningún neumático Operativo conocido (posición 9).
                { posicion: 9, presion: 100, temperatura: 60, remExt: 20, remInt: 20 },
              ],
            },
          ],
        },
      }),
    })
  );

  await page.locator('#neuChequeoFoto').setInputFiles({ name: 'chequeo.png', mimeType: 'image/png', buffer: PNG_1PX });

  // Se abre el modal de revisión con la fila que calza, tildada por defecto.
  await expect(page.locator('#chqSel_0_0')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#chqSel_0_0')).toBeChecked();
  // La fila sin match (posición 9) se muestra atenuada, sin checkbox propio.
  await expect(page.locator('#mc')).toContainText('Sin neumático Operativo registrado');

  // Nada se guardó todavía con solo abrir el modal.
  const medsDuranteRevision = await page.evaluate(() => (S.g('neuMed') || []).length);
  expect(medsDuranteRevision).toBe(medsAntes);

  await page.locator('button:has-text("Guardar mediciones seleccionadas")').click();
  await expect(page.locator('#tst')).toContainText('medición(es) guardada(s)', { timeout: 10000 });

  const medsFinal = await page.evaluate(() => S.g('neuMed'));
  expect(medsFinal.length).toBe(medsAntes + 1);
  const medNueva = medsFinal[medsFinal.length - 1];
  expect(medNueva.sigla).toBe('CAEX-01');
  expect(medNueva.remExt).toBe(18);
  expect(medNueva.remInt).toBe(17);
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
