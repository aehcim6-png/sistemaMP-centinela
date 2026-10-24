const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Disponibilidad → Reportabilidad diaria → «Importar desde captura» (24-oct-2026): la IA lee la captura del estatus de equipos, la persona compara con la imagen, confirma el día y recién ahí se guarda.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function entrar(page) {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 900 });
}

const SEMBRAR = `
  window._sembrarRep = () => {
    S.s('eq', ['CF-9510', 'CF-8769', 'CN-9503', 'TI-5142', 'BS-5752'].map((sigla) => ({ sigla, tipo: 'Camion', modelo: 'X', hrsDia: 12 })));
    S.s('reportab', []);
  };
`;

const LECTURA = {
  legible: true, formato: 'estatus', fecha: '23-11-2099', supervisor: 'MAICOL OROSTEGUI', observacion: null,
  filas: [
    { sigla: 'CF-9510', estatus: 'FS', fechaFS: '03-10-2026', comentario: 'FUGA REFRIGERANTE MOTOR', incierto: false },
    { sigla: 'CF-8769', estatus: 'OP', fechaFS: null, comentario: null, incierto: false },
    { sigla: 'CN-9503', estatus: 'FS', fechaFS: '23-10-2026', comentario: 'MANTENCION NO PROGRAMADA', incierto: true },
    { sigla: 'TI 5142', estatus: 'FS', fechaFS: '14-10-2026', comentario: 'PIOLA CORTADA', incierto: false },
    { sigla: 'CN-7578', estatus: 'OP', fechaFS: null, comentario: null, incierto: false },
  ],
};

async function abrirDisp(page) {
  await page.evaluate(async (sem) => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    eval(sem);
    window._sembrarRep(); go('disp');
    for (let i = 0; i < 100 && (typeof renders.disp !== 'function' || !document.getElementById('s-disp')); i++) await esp(100);
    for (let k = 0; k < 12; k++) {
      window._sembrarRep(); renders.disp(); await esp(400);
      if (/Importar desde captura/.test((document.getElementById('s-disp') || {}).innerText || '')) break;
    }
  }, SEMBRAR);
}

test('la captura se lee, se muestra junto a la imagen, pide confirmar el día y recién ahí se guarda con su origen', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  const pedidos = [];
  await page.route(`${SB_URL}/functions/v1/leer-estatus-equipos`, async (route) => {
    pedidos.push(JSON.parse(route.request().postData()));
    await page.evaluate(() => window._sembrarRep());
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, datos: LECTURA }) });
  });
  await abrirDisp(page);
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'estatus-23.png', mimeType: 'image/png', buffer: PNG });
  const modal = page.locator('#modal, .modal, #mb').first();
  await expect(page.getByText('compara lo leído con la imagen')).toBeVisible({ timeout: 20000 });
  expect(pedidos.length).toBe(1);
  expect(pedidos[0].mimeType).toBe('image/jpeg');
  expect(typeof pedidos[0].imagenBase64).toBe('string');
  await expect(page.getByText('que está en el futuro')).toBeVisible();
  await expect(page.getByText('Indica el día de esta captura')).toBeVisible();
  await expect(page.getByText('Ver lo leído (5 equipos: 3 FS, 2 OP)')).toBeVisible();
  // nada se guardó solo
  expect(await page.evaluate(() => (S.g('reportab') || []).length)).toBe(0);
  // la persona confirma el día; se vuelve a sembrar y a calcular en el mismo instante
  const r = await page.evaluate(() => {
    window._sembrarRep();
    window.repCapFecha(0, '2026-10-23');
    const txt = (document.querySelector('#mb, .modal, #modal') || document.body).innerText;
    window.confirmarImportReportabilidad();
    const filas = (S.g('reportab') || []).map((x) => [x.fecha, x.sigla, x.estatus, x.fechaDetencion || '', x.fuente || ''].join('|')).sort();
    return { txt, filas };
  });
  expect(r.txt).toMatch(/nuevas/);
  // CN-7578 no está en la flota: no se carga; TI 5142 se normaliza a TI-5142
  expect(r.filas.map((f) => f.split('|').slice(0, 4).join('|'))).toEqual([
    '2026-10-23|CF-8769|OP|', '2026-10-23|CF-9510|FS|2026-10-03', '2026-10-23|CN-9503|FS|2026-10-23', '2026-10-23|TI-5142|FS|2026-10-14',
  ]);
  expect(r.filas.every((f) => /captura leída por IA/.test(f.split('|')[4]) && /estatus-23\.png/.test(f.split('|')[4]))).toBe(true);
});

test('un error de la función se informa y no deja nada a medias', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  await page.route(`${SB_URL}/functions/v1/leer-estatus-equipos`, async (route) => {
    await page.evaluate(() => window._sembrarRep());
    return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'El modelo no pudo procesar la imagen (código 500).' }) });
  });
  await abrirDisp(page);
  await page.evaluate(() => { window._toasts = []; const t = window.toast; window.toast = function (m) { window._toasts.push(String(m)); return t && t.apply(this, arguments); }; });
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'mala.png', mimeType: 'image/png', buffer: PNG });
  await expect.poll(() => page.evaluate(() => window._toasts.join(' | ')), { timeout: 20000 }).toContain('mala.png: El modelo no pudo procesar la imagen');
  expect(await page.evaluate(() => (S.g('reportab') || []).length)).toBe(0);
  expect(await page.evaluate(() => window._reportabCap ? window._reportabCap.items.length : 0)).toBe(0);
});

test('una captura que no es una tabla de estatus se rechaza con el motivo', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  await page.route(`${SB_URL}/functions/v1/leer-estatus-equipos`, async (route) => {
    await page.evaluate(() => window._sembrarRep());
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, datos: { legible: false, formato: null, fecha: null, supervisor: null, filas: [], observacion: 'No es una tabla de estatus de equipos.' } }) });
  });
  await abrirDisp(page);
  await page.evaluate(() => { window._toasts = []; const t = window.toast; window.toast = function (m) { window._toasts.push(String(m)); return t && t.apply(this, arguments); }; });
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
  await expect.poll(() => page.evaluate(() => window._toasts.join(' | ')), { timeout: 20000 }).toContain('foto.png: No es una tabla de estatus de equipos.');
});
