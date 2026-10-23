const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Pestaña Horómetro: quien ingresa los datos puede sacar o subir la foto del horómetro (23-oct-2026). La función leer-horometro solo devuelve el número: la app lo prellena en
// «Horómetro Final», lo compara con la última lectura del equipo y la persona confirma con Guardar. Nada se guarda solo.
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const hoy = new Date().toISOString().slice(0, 10);

// Responde la lectura de la foto, volviendo a sembrar el equipo justo antes (la carga en segundo plano simulada lo pisa).
const responder = (page, datos, status = 200, cuerpo) => (route) => page.evaluate(() => window._sembrarHoromFoto && window._sembrarHoromFoto()).then(() =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo || { ok: true, datos }) }));

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

// Siembra un equipo con lectura de hace 2 días y abre «Registrar» en la pestaña Horómetro; la carga en segundo plano (simulada vacía) pisa lo sembrado, así que se repite hasta que quede.
async function abrirRegistro(page) {
  await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const hace2 = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
    window._sembrarHoromFoto = () => {
      S.s('eq', [C.recalc({ sigla: 'CN-9500', tipo: 'Camion', modelo: 'Komatsu HD785-7', frecPM: 250, hrsDia: 12, horomActual: 12000, fechaHorom: hace2 })]);
      S.s('hist', []);
    };
    go('hist'); await esp(1500);
    for (let k = 0; k < 10; k++) {
      window._sembrarHoromFoto(); window.addHist(); await esp(200);
      if (document.getElementById('hEq') && document.getElementById('hEq').options.length) break;
    }
  });
  await expect(page.locator('#hFotoBox')).toBeVisible();
}

test('foto legible: prellena el horómetro final, compara con la última lectura y no guarda hasta confirmar', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  await page.route(`${SB_URL}/functions/v1/leer-horometro`, responder(page, { horometro: 12023.4, unidad: 'h', tipo: 'digital', legible: true, incierto: false, observacion: null }));
  const subidas = [];
  await page.route(`${SB_URL}/storage/v1/object/fotos-horometro/**`, (route) => { subidas.push({ url: route.request().url(), tipo: route.request().headers()['content-type'], auth: route.request().headers()['authorization'] }); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"fotos-horometro/x"}' }); });
  await abrirRegistro(page);
  await page.evaluate(() => window._sembrarHoromFoto());
  await page.locator('#hFotoSub').setInputFiles({ name: 'horometro.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(page.locator('#hFin')).toHaveValue('12023.4', { timeout: 10000 });
  await expect(page.locator('#hIni')).toHaveValue('12000');
  await expect(page.locator('#hFotoRes')).toContainText('Leído de la foto');
  await expect(page.locator('#hFotoRes')).toContainText('avance +23,4 h');
  await expect(page.locator('#hFotoPrev')).toBeVisible();
  // nada guardado todavía
  expect(await page.evaluate(() => (S.g('hist') || []).length)).toBe(0);
  // se guarda con una sola llamada síncrona (la carga en segundo plano simulada pisa lo sembrado entre un paso y otro)
  const r = await page.evaluate(() => { window._sembrarHoromFoto(); window._horomFoto = Object.assign({}, window._horomFoto, { valor: 12023.4, incierto: false }); window.saveHist(); return { h: S.g('hist'), e: (S.g('eq') || [])[0] }; });
  expect(r.h.length).toBe(1);
  expect(r.h[0]).toMatchObject({ sigla: 'CN-9500', horomFin: 12023.4, origen: 'Foto (IA)' });
  expect(r.e.horomActual).toBe(12023.4);
  // la foto queda como evidencia: la fila guarda su ruta y se sube al bucket privado con el token de la persona
  expect(r.h[0].foto).toMatch(/^CN-9500\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.jpg$/);
  await expect.poll(() => subidas.length, { timeout: 10000 }).toBe(1);
  expect(subidas[0].url).toContain('/storage/v1/object/fotos-horometro/' + r.h[0].foto);
  expect(subidas[0].tipo).toBe('image/jpeg');
  expect(subidas[0].auth).toMatch(/^Bearer /);
});

test('si la foto no se puede subir, la lectura queda guardada sin foto y se avisa', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  await page.route(`${SB_URL}/functions/v1/leer-horometro`, responder(page, { horometro: 12010, unidad: 'h', tipo: 'digital', legible: true, incierto: false, observacion: null }));
  await page.evaluate(() => { window.__avisos = []; const t0 = window.toast; window.toast = (m) => { window.__avisos.push(String(m)); return t0(m); }; });
  await page.route(`${SB_URL}/storage/v1/object/fotos-horometro/**`, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"falla"}' }));
  await abrirRegistro(page);
  await page.evaluate(() => window._sembrarHoromFoto());
  await page.locator('#hFotoSub').setInputFiles({ name: 'h.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(page.locator('#hFin')).toHaveValue('12010', { timeout: 10000 });
  await page.evaluate(() => { window._sembrarHoromFoto(); window._horomFoto = Object.assign({}, window._horomFoto, { valor: 12010, incierto: false }); window.saveHist(); window.__fila = (S.g('hist') || [])[0]; });
  await expect.poll(() => page.evaluate(() => (window.__avisos || []).some((m) => m.includes('la foto no se pudo subir'))), { timeout: 10000 }).toBe(true);
  // la fila guardada (la misma referencia, por si la carga en segundo plano simulada vacía la lista) quedó con su lectura y sin la ruta de la foto
  const fila = await page.evaluate(() => ({ horomFin: window.__fila.horomFin, foto: window.__fila.foto }));
  expect(fila.horomFin).toBe(12010);
  expect(fila.foto).toBeUndefined();
});

test('ver la foto de una lectura pide un enlace firmado y la muestra', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  let pidioFirma = null;
  await page.route(`${SB_URL}/storage/v1/object/sign/fotos-horometro/**`, (route) => { pidioFirma = route.request().url(); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedURL: '/object/sign/fotos-horometro/CN-9500/2026-10-01/abc.jpg?token=t' }) }); });
  await page.route(`${SB_URL}/storage/v1/object/sign/fotos-horometro/CN-9500/**.jpg?token=t`, (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from(PNG_1PX) }));
  await page.evaluate(async () => { const esp = (ms) => new Promise((x) => setTimeout(x, ms)); go('hist'); await esp(1500); });
  const abrio = await page.evaluate(async () => {
    S.s('eq', [C.recalc({ sigla: 'CN-9500', tipo: 'Camion', modelo: 'X', frecPM: 250, hrsDia: 12, horomActual: 100, fechaHorom: '2026-10-01' })]);
    S.s('hist', [{ sigla: 'CN-9500', fecha: '2026-10-01', horomIni: 90, horomFin: 100, horom: 100, origen: 'Foto (IA)', foto: 'CN-9500/2026-10-01/abc.jpg' }]);
    window._horomVerFoto(0);
    await new Promise((x) => setTimeout(x, 800));
    const m = document.getElementById('mc');
    return m ? { txt: m.innerText, src: (m.querySelector('img') || {}).src || '' } : null;
  });
  expect(abrio.txt).toContain('Foto del horómetro');
  expect(abrio.txt).toContain('CN-9500');
  expect(abrio.src).toContain('/storage/v1/object/sign/fotos-horometro/CN-9500/2026-10-01/abc.jpg?token=t');
  expect(pidioFirma).toContain('/storage/v1/object/sign/fotos-horometro/CN-9500/2026-10-01/abc.jpg');
});

test('foto que no se lee: no inventa un número, avisa y deja escribirlo a mano', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  await page.route(`${SB_URL}/functions/v1/leer-horometro`, responder(page, { horometro: null, unidad: null, tipo: null, legible: false, incierto: true, observacion: 'reflejo sobre los últimos dígitos' }));
  await abrirRegistro(page);
  await page.locator('#hFotoCam').setInputFiles({ name: 'borrosa.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(page.locator('#hFotoRes')).toContainText('No se pudo leer el número con seguridad', { timeout: 10000 });
  await expect(page.locator('#hFotoRes')).toContainText('reflejo sobre los últimos dígitos');
  await expect(page.locator('#hFin')).toHaveValue('0');
});

test('foto con una lectura menor a la última: avisa en rojo y pide confirmación al guardar', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  await page.route(`${SB_URL}/functions/v1/leer-horometro`, responder(page, { horometro: 11000, unidad: 'h', tipo: 'mecanico', legible: true, incierto: true, observacion: null }));
  await abrirRegistro(page);
  await page.evaluate(() => window._sembrarHoromFoto());
  await page.locator('#hFotoSub').setInputFiles({ name: 'h.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(page.locator('#hFin')).toHaveValue('11000', { timeout: 10000 });
  await expect(page.locator('#hFotoRes')).toContainText('no puede ser menor al último registrado');
  await expect(page.locator('#hFotoRes')).toContainText('Revisa el número antes de guardar');
  // al guardar pide confirmar; si se cancela, no se guarda
  let pregunto = false;
  page.once('dialog', (d) => { pregunto = true; d.dismiss(); });
  const guardo = await page.evaluate(() => { window._sembrarHoromFoto(); window._horomFoto = { valor: 11000, incierto: true }; window.saveHist(); return (S.g('hist') || []).length; });
  expect(pregunto).toBe(true);
  expect(guardo).toBe(0);
});

test('error del servidor de lectura: avisa y no rompe el formulario', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  await page.route(`${SB_URL}/functions/v1/leer-horometro`, responder(page, null, 502, { error: 'El modelo no pudo procesar la imagen (código 503).' }));
  await abrirRegistro(page);
  await page.locator('#hFotoSub').setInputFiles({ name: 'h.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(page.locator('#hFotoRes')).toContainText('El modelo no pudo procesar la imagen', { timeout: 10000 });
  await expect(page.locator('#hFotoRes')).toContainText('Escribe el número a mano');
  await expect(page.locator('#hFin')).toBeEditable();
});
